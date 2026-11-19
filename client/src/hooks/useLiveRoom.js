/**
 * Live classroom over WebRTC.
 *
 * Topology: a mesh. Every participant holds one RTCPeerConnection to every
 * other participant; the server only relays signalling (see server/src/realtime).
 *
 * Negotiation rule that keeps things simple and glare-free:
 *   the participant who joins LATER always makes the offer. It creates one audio
 *   and one video transceiver per connection; the earlier participant attaches
 *   its tracks to those same transceivers when it answers. After that, turning
 *   the camera on/off or sharing a screen is just sender.replaceTrack(), which
 *   needs no renegotiation.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { API_ORIGIN } from '../lib/format.js';

const mediaDevices = () => (typeof navigator !== 'undefined' ? navigator.mediaDevices : undefined);

export function useLiveRoom({ classId, token, iceServers, initialMessages = [], onForceMute }) {
  const [status, setStatus] = useState('lobby'); // lobby | connecting | joined | waiting | ended | error
  const [error, setError] = useState('');
  const [mediaNote, setMediaNote] = useState('');
  const [media, setMedia] = useState({ audio: false, video: false, screen: false });
  const [hand, setHand] = useState(false);
  const [self, setSelf] = useState(null);
  const [peers, setPeers] = useState([]);
  const [messages, setMessages] = useState(initialMessages);
  const [localStream, setLocalStream] = useState(null);

  const socketRef = useRef(null);
  const pcs = useRef(new Map()); // socketId -> { pc, stream, queue, chain, audioSender, videoSender, initiator }
  const people = useRef(new Map()); // socketId -> participant info from the server
  const audioTrack = useRef(null);
  const cameraTrack = useRef(null);
  const screenTrack = useRef(null);
  const mediaRef = useRef(media);
  const handRef = useRef(false);
  const iceRef = useRef(iceServers);
  const forceMuteRef = useRef(onForceMute);
  iceRef.current = iceServers;
  forceMuteRef.current = onForceMute;

  useEffect(() => { setMessages(initialMessages); /* history arrives once */ // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMessages.length === 0]);

  const outgoingVideo = () => screenTrack.current || cameraTrack.current || null;

  const publishPeers = useCallback(() => {
    setPeers([...people.current.values()].map((p) => {
      const entry = pcs.current.get(p.socketId);
      return { ...p, stream: entry?.stream || null, connection: entry?.pc.connectionState || 'new' };
    }));
  }, []);

  const syncState = useCallback((next, nextHand = handRef.current) => {
    mediaRef.current = next;
    handRef.current = nextHand;
    setMedia(next);
    setHand(nextHand);
    const video = outgoingVideo();
    setLocalStream(video ? new MediaStream([video]) : null);
    socketRef.current?.emit('live:state', { media: next, hand: nextHand });
  }, []);

  const replaceOnAll = (kind, track) => {
    for (const entry of pcs.current.values()) {
      const sender = kind === 'audio' ? entry.audioSender : entry.videoSender;
      sender?.replaceTrack(track).catch(() => {});
    }
  };

  /* ---------- Local media ---------- */

  const initMedia = useCallback(async () => {
    const devices = mediaDevices();
    if (!devices?.getUserMedia) {
      setMediaNote('This browser cannot use a camera or microphone here. Live classes need HTTPS (or localhost). You can still watch and chat.');
      return;
    }
    const video = { width: { ideal: 1280 }, height: { ideal: 720 } };
    const audio = { echoCancellation: true, noiseSuppression: true };
    let stream = null;
    for (const constraints of [{ audio, video }, { audio }, { video }]) {
      try { stream = await devices.getUserMedia(constraints); break; } catch { /* try the next combination */ }
    }
    if (!stream) {
      setMediaNote('Camera and microphone are blocked or missing. You can still join to watch and chat. To speak, allow access in the address bar and reload.');
      return;
    }
    audioTrack.current = stream.getAudioTracks()[0] || null;
    cameraTrack.current = stream.getVideoTracks()[0] || null;
    if (!audioTrack.current) setMediaNote('No microphone was found. You can still use chat.');
    else if (!cameraTrack.current) setMediaNote('No camera was found. You will join with audio only.');
    syncState({ audio: !!audioTrack.current, video: !!cameraTrack.current, screen: false });
  }, [syncState]);

  const toggleMic = useCallback(async () => {
    const current = mediaRef.current;
    if (!audioTrack.current) {
      try {
        const stream = await mediaDevices().getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
        audioTrack.current = stream.getAudioTracks()[0];
        replaceOnAll('audio', audioTrack.current);
        syncState({ ...current, audio: true });
      } catch { setMediaNote('The microphone could not be turned on. Check the browser permission for this site.'); }
      return;
    }
    audioTrack.current.enabled = !current.audio;
    syncState({ ...current, audio: !current.audio });
  }, [syncState]);

  const toggleCam = useCallback(async () => {
    const current = mediaRef.current;
    if (current.video && cameraTrack.current) {
      cameraTrack.current.stop(); // really release the camera so its light goes off
      cameraTrack.current = null;
      if (!screenTrack.current) replaceOnAll('video', null);
      syncState({ ...current, video: false });
      return;
    }
    try {
      const stream = await mediaDevices().getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 } } });
      cameraTrack.current = stream.getVideoTracks()[0];
      if (!screenTrack.current) replaceOnAll('video', cameraTrack.current);
      syncState({ ...current, video: true });
    } catch { setMediaNote('The camera could not be turned on. Check the browser permission for this site.'); }
  }, [syncState]);

  const stopScreen = useCallback(() => {
    if (!screenTrack.current) return;
    screenTrack.current.onended = null;
    screenTrack.current.stop();
    screenTrack.current = null;
    replaceOnAll('video', cameraTrack.current || null);
    syncState({ ...mediaRef.current, screen: false });
  }, [syncState]);

  const toggleScreen = useCallback(async () => {
    if (screenTrack.current) return stopScreen();
    try {
      const stream = await mediaDevices().getDisplayMedia({ video: { frameRate: 15 }, audio: false });
      screenTrack.current = stream.getVideoTracks()[0];
      screenTrack.current.onended = stopScreen; // the browser's own "Stop sharing" button
      replaceOnAll('video', screenTrack.current);
      syncState({ ...mediaRef.current, screen: true });
    } catch { /* the picker was cancelled */ }
  }, [stopScreen, syncState]);

  const toggleHand = useCallback(() => syncState(mediaRef.current, !handRef.current), [syncState]);

  /* ---------- Peer connections ---------- */

  const closePeer = (id) => {
    const entry = pcs.current.get(id);
    if (!entry) return;
    entry.pc.onicecandidate = entry.pc.ontrack = entry.pc.onnegotiationneeded = entry.pc.onconnectionstatechange = null;
    entry.pc.close();
    pcs.current.delete(id);
  };
  const closeAllPeers = () => { [...pcs.current.keys()].forEach(closePeer); people.current.clear(); };

  const createPeer = useCallback((id, initiator) => {
    const socket = socketRef.current;
    const pc = new RTCPeerConnection({ iceServers: iceRef.current || [] });
    const entry = { pc, stream: new MediaStream(), queue: [], chain: Promise.resolve(), audioSender: null, videoSender: null, initiator };
    pcs.current.set(id, entry);
    pc.onicecandidate = (e) => e.candidate && socket.emit('live:signal', { to: id, data: { candidate: e.candidate } });
    pc.ontrack = (e) => {
      if (!entry.stream.getTracks().includes(e.track)) entry.stream.addTrack(e.track);
      publishPeers();
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' && initiator) pc.restartIce();
      publishPeers();
    };
    if (initiator) {
      pc.onnegotiationneeded = async () => {
        try {
          await pc.setLocalDescription();
          socket.emit('live:signal', { to: id, data: { description: pc.localDescription } });
        } catch { /* a newer negotiation superseded this one */ }
      };
      entry.audioSender = pc.addTransceiver(audioTrack.current || 'audio', { direction: 'sendrecv' }).sender;
      entry.videoSender = pc.addTransceiver(outgoingVideo() || 'video', { direction: 'sendrecv' }).sender;
    }
    return entry;
  }, [publishPeers]);

  const handleSignal = useCallback(({ from, data }) => {
    if (!people.current.has(from)) return;
    const entry = pcs.current.get(from) || createPeer(from, false);
    const { pc } = entry;
    // Process messages from one peer strictly in order.
    entry.chain = entry.chain.then(async () => {
      if (data.description) {
        await pc.setRemoteDescription(data.description);
        if (data.description.type === 'offer') {
          if (!entry.audioSender) {
            for (const transceiver of pc.getTransceivers()) {
              const kind = transceiver.receiver.track.kind;
              transceiver.direction = 'sendrecv';
              if (kind === 'audio') { entry.audioSender = transceiver.sender; await transceiver.sender.replaceTrack(audioTrack.current || null); }
              if (kind === 'video') { entry.videoSender = transceiver.sender; await transceiver.sender.replaceTrack(outgoingVideo()); }
            }
          }
          await pc.setLocalDescription();
          socketRef.current?.emit('live:signal', { to: from, data: { description: pc.localDescription } });
        }
        for (const candidate of entry.queue.splice(0)) await pc.addIceCandidate(candidate).catch(() => {});
      } else if (data.candidate) {
        if (pc.remoteDescription) await pc.addIceCandidate(data.candidate).catch(() => {});
        else entry.queue.push(data.candidate);
      }
    }).catch(() => {});
  }, [createPeer]);

  /* ---------- Room lifecycle ---------- */

  const stopLocalMedia = () => {
    [audioTrack, cameraTrack, screenTrack].forEach((ref) => { ref.current?.stop(); ref.current = null; });
  };

  const join = useCallback(() => {
    if (socketRef.current) return;
    setStatus('connecting');
    setError('');
    const socket = io(API_ORIGIN || undefined, { auth: { token }, transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      closeAllPeers(); // also covers reconnects: socket ids change, so every connection is rebuilt
      socket.emit('live:join', { classId, media: mediaRef.current }, (res) => {
        if (!res?.ok) {
          socket.disconnect();
          socketRef.current = null;
          if (res?.waiting) return setStatus('waiting');
          setError(res?.error || 'Could not join the class.');
          return setStatus(res?.error === 'This class has ended.' ? 'ended' : 'error');
        }
        setSelf(res.self);
        for (const peer of res.peers) {
          people.current.set(peer.socketId, peer);
          createPeer(peer.socketId, true);
        }
        publishPeers();
        setStatus('joined');
        if (handRef.current) socket.emit('live:state', { media: mediaRef.current, hand: true });
      });
    });
    socket.on('connect_error', (err) => {
      if (socket.active) return; // socket.io is retrying on its own
      setError(err.message === 'unauthorized' ? 'Your session has expired. Sign in again.' : 'Could not connect to the classroom server.');
      setStatus('error');
    });
    socket.on('live:peer-joined', (peer) => { people.current.set(peer.socketId, peer); publishPeers(); });
    socket.on('live:peer-left', ({ socketId }) => { closePeer(socketId); people.current.delete(socketId); publishPeers(); });
    socket.on('live:peer-state', ({ socketId, media: m, hand: h }) => {
      const peer = people.current.get(socketId);
      if (socketId === socket.id) { if (h === false && handRef.current) { handRef.current = false; setHand(false); } return; }
      if (!peer) return;
      people.current.set(socketId, { ...peer, media: m, hand: h });
      publishPeers();
    });
    socket.on('live:signal', handleSignal);
    socket.on('live:chat', (message) => setMessages((prev) => [...prev.slice(-299), message]));
    socket.on('live:force-mute', () => {
      if (audioTrack.current && mediaRef.current.audio) {
        audioTrack.current.enabled = false;
        syncState({ ...mediaRef.current, audio: false });
        forceMuteRef.current?.();
      }
    });
    socket.on('live:ended', () => {
      closeAllPeers();
      stopLocalMedia();
      socket.disconnect();
      socketRef.current = null;
      setLocalStream(null);
      publishPeers();
      setStatus('ended');
    });
  }, [classId, token, createPeer, handleSignal, publishPeers, syncState]);

  const leave = useCallback(() => {
    socketRef.current?.emit('live:leave');
    socketRef.current?.disconnect();
    socketRef.current = null;
    closeAllPeers();
    stopLocalMedia();
    setLocalStream(null);
    setPeers([]);
  }, []);

  useEffect(() => () => {
    socketRef.current?.disconnect();
    socketRef.current = null;
    closeAllPeers();
    stopLocalMedia();
  }, []);

  const sendChat = useCallback((text) => socketRef.current?.emit('live:chat', { text }), []);
  const muteAll = useCallback(() => socketRef.current?.emit('live:mute-all'), []);
  const lowerHand = useCallback((socketId) => socketRef.current?.emit('live:lower-hand', { socketId }), []);

  return {
    status, setStatus, error, mediaNote, media, hand, self, peers, messages, localStream,
    initMedia, join, leave, toggleMic, toggleCam, toggleScreen, toggleHand, sendChat, muteAll, lowerHand,
    canShareScreen: !!mediaDevices()?.getDisplayMedia,
  };
}
