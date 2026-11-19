import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import clsx from 'clsx';
import { ArrowLeft, Mic, MicOff, Video, VideoOff, MonitorUp, MonitorX, Hand, MessageSquare, Users, PhoneOff, Send, VolumeX, CircleStop, X, TriangleAlert } from 'lucide-react';
import { useGetLiveRoomQuery, useStartLiveMutation, useEndLiveMutation } from '../store/api.js';
import { selectToken, selectUser } from '../store/authSlice.js';
import { toast } from '../store/uiSlice.js';
import { useLiveRoom } from '../hooks/useLiveRoom.js';
import { Avatar, Confirm, Empty, PageLoader, Spinner, StatusTag } from '../components/ui.jsx';
import { dayLabel, timeLabel, fromNow, errorMessage, plural } from '../lib/format.js';

function Tile({ name, role, stream, showVideo, muted, isSelf, audioOn, hand, big, connection }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (el.srcObject !== stream) el.srcObject = stream || null;
    if (stream) el.play?.().catch(() => {});
  }, [stream, showVideo]);
  return (
    <div className={clsx('relative overflow-hidden rounded-xl bg-board-900 ring-1 ring-white/10', big ? 'h-full w-full' : 'aspect-video')}>
      {/* Always mounted so remote audio keeps playing when the camera is off. */}
      <video ref={ref} autoPlay playsInline muted={muted} className={clsx('h-full w-full', big ? 'object-contain' : 'object-cover', !showVideo && 'invisible absolute', isSelf && showVideo && !big && '-scale-x-100')} />
      {!showVideo && <div className="absolute inset-0 grid place-items-center"><Avatar name={name} size={big ? 96 : 64} /></div>}
      <div className="absolute inset-x-2 bottom-2 flex items-center gap-1.5">
        <span className="flex min-w-0 items-center gap-1.5 rounded-md bg-board-950/75 px-2 py-1 text-xs font-semibold text-white backdrop-blur-sm">
          {!audioOn && <MicOff className="h-3.5 w-3.5 shrink-0 text-[#FF9A8C]" aria-label="Muted" />}
          <span className="truncate">{name}{isSelf && ' (you)'}</span>
          {role === 'host' && <span className="shrink-0 rounded bg-pencil px-1 text-[10px] font-bold text-ink">Host</span>}
        </span>
        {hand && <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-pencil text-ink" title="Hand raised"><Hand className="h-3.5 w-3.5" aria-label="Hand raised" /></span>}
      </div>
      {!isSelf && connection && !['connected', 'new'].includes(connection) && (
        <span className="absolute right-2 top-2 rounded-md bg-board-950/75 px-2 py-1 text-[11px] text-white/80">{connection === 'connecting' ? 'Connecting' : 'Reconnecting'}</span>
      )}
    </div>
  );
}

function ControlButton({ on = true, danger, accent, label, onClick, children, disabled }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={label} title={label} aria-pressed={on}
      className={clsx('on-board grid h-11 w-11 place-items-center rounded-full transition-colors duration-100 disabled:opacity-40 sm:h-12 sm:w-12',
        danger ? 'bg-redpen text-white hover:bg-[#A93023]' : accent ? 'bg-pencil text-ink hover:bg-[#E9AA1D]' : on ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-white text-redpen hover:bg-white/90')}>
      {children}
    </button>
  );
}

function ChatPanel({ messages, onSend, selfId, disabled }) {
  const [text, setText] = useState('');
  const listRef = useRef(null);
  useEffect(() => { const el = listRef.current; if (el) el.scrollTop = el.scrollHeight; }, [messages.length]);
  const submit = (e) => {
    e.preventDefault();
    const value = text.trim();
    if (!value) return;
    onSend(value);
    setText('');
  };
  return (
    <div className="flex h-full min-h-0 flex-col">
      <ul ref={listRef} className="scroll-thin min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
        {messages.length === 0 && <li className="pt-6 text-center text-sm text-white/45">No messages yet. Ask a question to get things started.</li>}
        {messages.map((m) => (
          <li key={m.id} className="text-sm">
            <p className="flex items-baseline gap-2">
              <span className={clsx('font-semibold', m.role === 'host' ? 'text-pencil' : 'text-white')}>{m.name}{m.userId === selfId && ' (you)'}</span>
              <span className="text-[11px] tabular text-white/40">{timeLabel(m.at)}</span>
            </p>
            <p className="mt-0.5 whitespace-pre-wrap break-words leading-snug text-white/85">{m.text}</p>
          </li>
        ))}
      </ul>
      {!disabled && (
        <form onSubmit={submit} className="flex gap-2 border-t border-white/10 p-3">
          <label className="flex-1"><span className="sr-only">Message</span>
            <input value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} placeholder="Message the class" className="on-board h-10 w-full rounded-lg border border-white/15 bg-white/[.07] px-3 text-sm text-white placeholder:text-white/40 focus:border-pencil focus:outline-none" />
          </label>
          <button type="submit" className="on-board btn-accent btn-icon h-10 w-10" aria-label="Send message" disabled={!text.trim()}><Send className="h-4 w-4" /></button>
        </form>
      )}
    </div>
  );
}

function PeoplePanel({ people, isHost, onMuteAll, onLowerHand }) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      {isHost && people.length > 1 && (
        <div className="border-b border-white/10 p-3"><button type="button" onClick={onMuteAll} className="on-board btn btn-sm w-full bg-white/10 text-white hover:bg-white/20"><VolumeX className="h-4 w-4" />Mute everyone</button></div>
      )}
      <ul className="scroll-thin min-h-0 flex-1 overflow-y-auto py-2">
        {people.map((p) => (
          <li key={p.socketId} className="flex items-center gap-3 px-4 py-2">
            <Avatar name={p.name} size={30} />
            <span className="min-w-0 flex-1 truncate text-sm text-white">{p.name}{p.isSelf && ' (you)'}</span>
            {p.role === 'host' && <StatusTag status="host">Host</StatusTag>}
            {p.hand && (isHost && !p.isSelf
              ? <button type="button" onClick={() => onLowerHand(p.socketId)} className="on-board rounded-md bg-pencil px-2 py-1 text-[11px] font-bold text-ink" title="Lower hand">Hand up</button>
              : <Hand className="h-4 w-4 text-pencil" aria-label="Hand raised" />)}
            {p.media.audio ? <Mic className="h-4 w-4 text-white/60" aria-label="Microphone on" /> : <MicOff className="h-4 w-4 text-[#FF9A8C]" aria-label="Muted" />}
            {p.media.video || p.media.screen ? <Video className="h-4 w-4 text-white/60" aria-label="Camera on" /> : <VideoOff className="h-4 w-4 text-white/35" aria-label="Camera off" />}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function LiveRoom() {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const token = useSelector(selectToken);
  const user = useSelector(selectUser);
  const [side, setSide] = useState(() => (window.innerWidth >= 1024 ? 'chat' : null));
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [start, startState] = useStartLiveMutation();
  const [end, endState] = useEndLiveMutation();

  // While waiting in the lobby, keep checking whether the instructor has started the class.
  const [polling, setPolling] = useState(true);
  const { data, isLoading, error } = useGetLiveRoomQuery(id, { pollingInterval: polling ? 5000 : 0 });
  const room = useLiveRoom({
    classId: id, token,
    iceServers: data?.iceServers, // read when a peer connection is created
    onForceMute: () => dispatch(toast.info('The host muted everyone. Unmute when you want to speak.')),
  });
  const inRoom = room.status === 'joined' || room.status === 'connecting';
  useEffect(() => setPolling(!inRoom), [inRoom]);

  useEffect(() => { room.initMedia(); /* ask for camera and microphone once, in the lobby */ // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const liveClass = data?.liveClass;
  const isHost = !!data?.isHost;
  const messages = room.messages.length ? room.messages : data?.messages || [];

  const people = useMemo(() => {
    const me = room.self ? [{ ...room.self, media: room.media, hand: room.hand, isSelf: true, stream: room.localStream }] : [];
    return [...me, ...room.peers];
  }, [room.self, room.media, room.hand, room.localStream, room.peers]);
  const presenter = people.find((p) => p.media.screen);

  if (isLoading) return <div className="grid h-screen place-items-center bg-board-950"><Spinner className="h-6 w-6 text-pencil" /></div>;
  if (error) {
    return (
      <div className="page pt-20">
        <Empty title={error.status === 403 ? 'This class is for enrolled students' : 'This live class could not be opened'} action={<Link to="/live" className="btn-primary">See the timetable</Link>}>{errorMessage(error)}</Empty>
      </div>
    );
  }

  const ended = liveClass.status === 'ended' || room.status === 'ended';
  const joinNow = async () => {
    try {
      if (isHost && liveClass.status !== 'live') await start(id).unwrap();
      room.join();
    } catch (err) { dispatch(toast.error(errorMessage(err))); }
  };
  const leaveRoom = () => { room.leave(); navigate(liveClass.course?.slug ? `/courses/${liveClass.course.slug}` : '/live'); };
  const endForAll = async () => {
    try { await end(id).unwrap(); setConfirmEnd(false); room.leave(); room.setStatus('ended'); }
    catch (err) { dispatch(toast.error(errorMessage(err))); }
  };

  const header = (
    <header className="on-board flex h-14 shrink-0 items-center gap-3 border-b border-white/10 px-3 text-white sm:px-4">
      <Link to={liveClass.course?.slug ? `/courses/${liveClass.course.slug}` : '/live'} onClick={() => room.leave()} className="btn btn-icon rounded-md text-white/80 hover:bg-white/10 hover:text-white" aria-label="Leave and go back"><ArrowLeft className="h-5 w-5" /></Link>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{liveClass.title}</p>
        <p className="truncate text-xs text-white/55">{liveClass.course?.title}</p>
      </div>
      {inRoom && <StatusTag status="live">Live</StatusTag>}
      {inRoom && <span className="hidden items-center gap-1.5 text-xs text-white/70 sm:flex"><Users className="h-4 w-4" />{people.length}</span>}
    </header>
  );

  /* ---------- Lobby, waiting room and ended screen ---------- */
  if (!inRoom) {
    const waiting = !isHost && liveClass.status !== 'live' && !ended;
    return (
      <div className="flex min-h-screen flex-col bg-board-950">
        {header}
        <div className="mx-auto grid w-full max-w-5xl flex-1 items-center gap-8 px-4 py-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          {!ended && (
            <div>
              <Tile name={user.name} stream={room.localStream} showVideo={room.media.video} muted isSelf audioOn={room.media.audio} />
              <div className="mt-4 flex justify-center gap-3">
                <ControlButton on={room.media.audio} label={room.media.audio ? 'Mute microphone' : 'Unmute microphone'} onClick={room.toggleMic}>{room.media.audio ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}</ControlButton>
                <ControlButton on={room.media.video} label={room.media.video ? 'Turn camera off' : 'Turn camera on'} onClick={room.toggleCam}>{room.media.video ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}</ControlButton>
              </div>
              {room.mediaNote && <p className="mt-4 flex items-start gap-2 rounded-lg bg-white/[.06] px-3.5 py-3 text-sm text-white/75"><TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-pencil" aria-hidden="true" />{room.mediaNote}</p>}
            </div>
          )}
          <div className={clsx('text-white', ended && 'lg:col-span-2 lg:mx-auto lg:max-w-xl')}>
            <p className="text-sm text-white/55">{ended ? 'This class has ended' : liveClass.status === 'live' ? 'Happening now' : `${dayLabel(liveClass.scheduledAt)} at ${timeLabel(liveClass.scheduledAt)}, ${liveClass.durationMin} min`}</p>
            <h1 className="mt-1 text-4xl font-medium leading-tight text-white">{liveClass.title}</h1>
            <p className="mt-2 text-white/70">{liveClass.course?.title}, with {liveClass.instructor?.name}</p>
            {liveClass.description && <p className="mt-4 leading-relaxed text-white/70">{liveClass.description}</p>}

            {ended ? (
              <>
                <p className="mt-5 text-sm text-white/60">{liveClass.peakAttendance > 0 && `${plural(liveClass.peakAttendance, 'person', 'people')} attended. `}The chat from the session is kept below.</p>
                <div className="mt-5 h-80 overflow-hidden rounded-xl bg-white/[.04] ring-1 ring-white/10"><ChatPanel messages={messages} selfId={user.id} disabled /></div>
                <Link to={liveClass.course?.slug ? `/courses/${liveClass.course.slug}` : '/live'} className="on-board btn-accent mt-6">Back to the course</Link>
              </>
            ) : waiting ? (
              <div className="mt-7 rounded-xl bg-white/[.06] px-4 py-4" role="status">
                <p className="flex items-center gap-2 font-semibold"><Spinner className="text-pencil" />Waiting for {liveClass.instructor?.name?.split(' ')[0] || 'the instructor'} to start the class</p>
                <p className="mt-1 text-sm text-white/60">Scheduled {fromNow(liveClass.scheduledAt)}. This page checks every few seconds; you can join as soon as it starts.</p>
              </div>
            ) : (
              <>
                {room.status === 'error' && <p className="mt-5 rounded-lg bg-redpen/20 px-3.5 py-3 text-sm text-[#FFC2B8]" role="alert">{room.error}</p>}
                <button type="button" onClick={joinNow} disabled={startState.isLoading} className="on-board btn-accent btn-lg mt-7">
                  {startState.isLoading && <Spinner />}{isHost ? (liveClass.status === 'live' ? 'Rejoin as host' : 'Start the class') : 'Join the class'}
                </button>
                {isHost && liveClass.status !== 'live' && <p className="mt-3 text-sm text-white/55">Starting opens the room to enrolled students. {data.online > 0 && `${data.online} already here.`}</p>}
                {!isHost && data.online > 0 && <p className="mt-3 text-sm text-white/55">{plural(data.online, 'person', 'people')} in the room.</p>}
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ---------- In the room ---------- */
  const others = presenter ? people.filter((p) => p !== presenter) : people;
  const count = people.length;
  const grid = count <= 1 ? 'grid-cols-1 max-w-4xl' : count <= 4 ? 'grid-cols-1 sm:grid-cols-2 max-w-5xl' : count <= 9 ? 'grid-cols-2 lg:grid-cols-3 max-w-6xl' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4';
  const tile = (p, big) => (
    <Tile key={p.socketId} name={p.name} role={p.role} stream={p.stream} big={big}
      showVideo={!!p.stream && (p.media.video || p.media.screen)} muted={!!p.isSelf} isSelf={!!p.isSelf} audioOn={p.media.audio} hand={p.hand} connection={p.connection} />
  );

  return (
    <div className="flex h-screen flex-col bg-board-950">
      {header}
      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
            {room.status === 'connecting' ? (
              <div className="grid h-full place-items-center text-white/70"><p className="flex items-center gap-2"><Spinner className="text-pencil" />Joining the class</p></div>
            ) : presenter ? (
              <div className="flex h-full flex-col gap-3">
                <div className="min-h-0 flex-1">{tile(presenter, true)}</div>
                {others.length > 0 && <div className="scroll-thin flex shrink-0 gap-3 overflow-x-auto pb-1">{others.map((p) => <div key={p.socketId} className="w-40 shrink-0 sm:w-48">{tile(p)}</div>)}</div>}
              </div>
            ) : (
              <div className={clsx('mx-auto grid h-full w-full content-center gap-3', grid)}>{people.map((p) => tile(p))}</div>
            )}
          </div>

          <div className="flex shrink-0 items-center justify-center gap-2 border-t border-white/10 px-3 py-3 sm:gap-3">
            <ControlButton on={room.media.audio} label={room.media.audio ? 'Mute microphone' : 'Unmute microphone'} onClick={room.toggleMic}>{room.media.audio ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}</ControlButton>
            <ControlButton on={room.media.video} label={room.media.video ? 'Turn camera off' : 'Turn camera on'} onClick={room.toggleCam}>{room.media.video ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}</ControlButton>
            {room.canShareScreen && <ControlButton accent={room.media.screen} label={room.media.screen ? 'Stop sharing your screen' : 'Share your screen'} onClick={room.toggleScreen}>{room.media.screen ? <MonitorX className="h-5 w-5" /> : <MonitorUp className="h-5 w-5" />}</ControlButton>}
            <ControlButton accent={room.hand} label={room.hand ? 'Lower your hand' : 'Raise your hand'} onClick={room.toggleHand}><Hand className="h-5 w-5" /></ControlButton>
            <span className="mx-1 h-6 w-px bg-white/15" aria-hidden="true" />
            <ControlButton accent={side === 'chat'} label="Chat" onClick={() => setSide(side === 'chat' ? null : 'chat')}><MessageSquare className="h-5 w-5" /></ControlButton>
            <ControlButton accent={side === 'people'} label="People" onClick={() => setSide(side === 'people' ? null : 'people')}><Users className="h-5 w-5" /></ControlButton>
            <span className="mx-1 h-6 w-px bg-white/15" aria-hidden="true" />
            <ControlButton danger label="Leave the class" onClick={leaveRoom}><PhoneOff className="h-5 w-5" /></ControlButton>
            {isHost && <button type="button" onClick={() => setConfirmEnd(true)} className="on-board btn btn-sm hidden bg-white/10 text-white hover:bg-redpen sm:inline-flex"><CircleStop className="h-4 w-4" />End class</button>}
          </div>
        </div>

        {side && (
          <aside className="absolute inset-y-14 right-0 z-20 flex w-[min(22rem,92vw)] flex-col border-l border-white/10 bg-board-900 shadow-pop lg:static lg:inset-auto lg:w-80 lg:shadow-none">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 text-white">
              <div className="flex gap-1" role="tablist">
                {[['chat', 'Chat'], ['people', `People (${count})`]].map(([key, label]) => (
                  <button key={key} type="button" role="tab" aria-selected={side === key} onClick={() => setSide(key)} className={clsx('on-board rounded-md px-3 py-1.5 text-sm font-semibold', side === key ? 'bg-white/10 text-white' : 'text-white/55 hover:text-white')}>{label}</button>
                ))}
              </div>
              <button type="button" onClick={() => setSide(null)} className="on-board rounded p-1 text-white/60 hover:text-white lg:hidden" aria-label="Close panel"><X className="h-4 w-4" /></button>
            </div>
            <div className="min-h-0 flex-1">
              {side === 'chat' ? <ChatPanel messages={messages} onSend={room.sendChat} selfId={user.id} /> : <PeoplePanel people={people} isHost={isHost} onMuteAll={() => { room.muteAll(); dispatch(toast.info('Everyone else is muted.')); }} onLowerHand={room.lowerHand} />}
            </div>
          </aside>
        )}
      </div>
      {isHost && <button type="button" onClick={() => setConfirmEnd(true)} className="on-board btn btn-sm absolute right-3 top-3 z-30 bg-redpen text-white sm:hidden">End</button>}
      <Confirm open={confirmEnd} onClose={() => setConfirmEnd(false)} onConfirm={endForAll} busy={endState.isLoading} title="End the class for everyone?" confirmLabel="End class">
        Everyone is disconnected and the class is marked as finished. The chat stays available afterwards.
      </Confirm>
    </div>
  );
}
