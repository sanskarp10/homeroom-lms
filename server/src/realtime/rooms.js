/**
 * Live classroom signalling over Socket.IO.
 *
 * Media flows peer to peer (WebRTC mesh); this server only introduces peers,
 * relays their SDP/ICE messages, and carries chat and presence. Room state is
 * kept in memory, so run one API instance or add the Socket.IO Redis adapter
 * before scaling out (see docs/ARCHITECTURE.md).
 */
import { LiveClass, LiveMessage, Enrollment } from '../models/index.js';
import { userFromToken } from '../middleware/auth.js';
import { canManage, isId } from '../utils/access.js';
import { log } from '../utils/log.js';

let io = null;
const rooms = new Map(); // classId -> Map(socketId -> participant)
const roomName = (classId) => `live:${classId}`;

export const roomSize = (classId) => rooms.get(classId)?.size || 0;

export function endRoom(classId) {
  if (!io) return;
  io.to(roomName(classId)).emit('live:ended');
  io.in(roomName(classId)).socketsLeave(roomName(classId));
  rooms.delete(classId);
}

export function attachRealtime(server) {
  io = server;

  io.use(async (socket, next) => {
    const user = await userFromToken(socket.handshake.auth?.token);
    if (!user) return next(new Error('unauthorized'));
    socket.data.user = user;
    next();
  });

  io.on('connection', (socket) => {
    const user = socket.data.user;

    socket.on('live:join', async ({ classId, media } = {}, ack) => {
      const reply = typeof ack === 'function' ? ack : () => {};
      try {
        if (!isId(classId)) return reply({ error: 'Live class not found.' });
        const liveClass = await LiveClass.findById(classId).populate('course', 'instructor title');
        if (!liveClass || !liveClass.course) return reply({ error: 'Live class not found.' });
        const isHost = canManage(user, liveClass.course);
        if (!isHost && !(await Enrollment.exists({ user: user._id, course: liveClass.course._id }))) {
          return reply({ error: 'Enroll in this course to join its live classes.' });
        }
        if (liveClass.status === 'ended') return reply({ error: 'This class has ended.' });
        if (liveClass.status !== 'live' && !isHost) return reply({ error: 'The instructor has not started this class yet.', waiting: true });

        leave(socket); // one room per socket
        const room = rooms.get(classId) || new Map();
        rooms.set(classId, room);
        const me = {
          socketId: socket.id,
          userId: String(user._id),
          name: user.name,
          role: isHost ? 'host' : 'student',
          media: { audio: !!media?.audio, video: !!media?.video, screen: false },
          hand: false,
        };
        const peers = [...room.values()];
        room.set(socket.id, me);
        socket.data.classId = classId;
        socket.data.isHost = isHost;
        socket.join(roomName(classId));
        socket.to(roomName(classId)).emit('live:peer-joined', me);
        if (room.size > liveClass.peakAttendance) {
          LiveClass.updateOne({ _id: classId }, { $max: { peakAttendance: room.size } }).catch(() => {});
        }
        reply({ ok: true, self: me, peers });
      } catch (err) {
        log.error('live:join failed:', err.message);
        reply({ error: 'Could not join the class. Try again.' });
      }
    });

    // WebRTC offer/answer/ICE relay between two participants of the same room.
    socket.on('live:signal', ({ to, data } = {}) => {
      const room = rooms.get(socket.data.classId);
      if (!room || !room.has(to) || !data) return;
      io.to(to).emit('live:signal', { from: socket.id, data });
    });

    socket.on('live:state', (state = {}) => {
      const me = rooms.get(socket.data.classId)?.get(socket.id);
      if (!me) return;
      if (state.media) me.media = { audio: !!state.media.audio, video: !!state.media.video, screen: !!state.media.screen };
      if (typeof state.hand === 'boolean') me.hand = state.hand;
      socket.to(roomName(socket.data.classId)).emit('live:peer-state', { socketId: socket.id, media: me.media, hand: me.hand });
    });

    socket.on('live:chat', async ({ text } = {}, ack) => {
      const classId = socket.data.classId;
      const me = rooms.get(classId)?.get(socket.id);
      const body = String(text || '').trim().slice(0, 1000);
      if (!me || !body) return;
      const message = { id: `${socket.id}-${Date.now()}`, userId: me.userId, name: me.name, role: me.role, text: body, at: new Date().toISOString() };
      io.to(roomName(classId)).emit('live:chat', message);
      if (typeof ack === 'function') ack({ ok: true });
      LiveMessage.create({ liveClass: classId, user: user._id, name: me.name, role: me.role, text: body }).catch(() => {});
    });

    // Host controls
    socket.on('live:mute-all', () => {
      if (socket.data.isHost) socket.to(roomName(socket.data.classId)).emit('live:force-mute');
    });
    socket.on('live:lower-hand', ({ socketId } = {}) => {
      const peer = rooms.get(socket.data.classId)?.get(socketId);
      if (!socket.data.isHost || !peer) return;
      peer.hand = false;
      io.to(roomName(socket.data.classId)).emit('live:peer-state', { socketId, media: peer.media, hand: false });
    });

    socket.on('live:leave', () => leave(socket));
    socket.on('disconnect', () => leave(socket));
  });
}

function leave(socket) {
  const classId = socket.data.classId;
  if (!classId) return;
  const room = rooms.get(classId);
  if (room?.delete(socket.id)) socket.to(roomName(classId)).emit('live:peer-left', { socketId: socket.id });
  if (room && room.size === 0) rooms.delete(classId);
  socket.leave(roomName(classId));
  socket.data.classId = null;
}
