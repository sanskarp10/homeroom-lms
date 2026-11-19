import { Router } from 'express';
import { z } from 'zod';
import { Course, Enrollment, LiveClass, LiveMessage } from '../models/index.js';
import { authOptional, requireAuth, requireRole } from '../middleware/auth.js';
import { wrap, validate, badRequest, forbidden, notFound } from '../utils/http.js';
import { canManage, isId, loadManagedCourse } from '../utils/access.js';
import { liveClassView } from '../utils/serialize.js';
import { iceServers } from '../config.js';
import { endRoom, roomSize } from '../realtime/rooms.js';

const router = Router();
const staff = requireRole('instructor', 'admin');
const HOUR = 3600 * 1000;
const populate = [{ path: 'course', select: 'title slug category status instructor' }, { path: 'instructor', select: 'name headline' }];

/** Close classes that were left "live" long after their slot (for example after a server restart). */
async function sweepStale() {
  await LiveClass.updateMany(
    { status: 'live', startedAt: { $lt: new Date(Date.now() - 12 * HOUR) } },
    { $set: { status: 'ended', endedAt: new Date() } }
  );
}

/** Public timetable for the home page: what is live now and what is coming up. */
router.get('/schedule', authOptional, wrap(async (req, res) => {
  await sweepStale();
  const classes = await LiveClass.find({
    $or: [{ status: 'live' }, { status: 'scheduled', scheduledAt: { $gte: new Date(Date.now() - HOUR) } }],
  }).sort({ scheduledAt: 1 }).limit(30).populate(populate).lean();
  const visible = classes.filter((c) => c.course?.status === 'published').slice(0, Number(req.query.limit) || 8);
  let enrolled = new Set();
  if (req.user) enrolled = new Set((await Enrollment.find({ user: req.user._id }).select('course').lean()).map((e) => String(e.course)));
  res.json({
    items: visible.map((c) => ({
      ...liveClassView(c),
      canJoin: !!req.user && (enrolled.has(String(c.course._id)) || canManage(req.user, c.course)),
    })),
  });
}));

/** Classes for the signed-in user: courses they study (students) or teach (instructors). */
router.get('/mine', requireAuth, wrap(async (req, res) => {
  await sweepStale();
  const enrolledIds = (await Enrollment.find({ user: req.user._id }).select('course').lean()).map((e) => e.course);
  const filter = { $or: [{ course: { $in: enrolledIds } }, { instructor: req.user._id }] };
  const [upcoming, past] = await Promise.all([
    LiveClass.find({ ...filter, status: { $in: ['scheduled', 'live'] } }).sort({ scheduledAt: 1 }).limit(30).populate(populate).lean(),
    LiveClass.find({ ...filter, status: 'ended' }).sort({ endedAt: -1 }).limit(10).populate(populate).lean(),
  ]);
  const view = (c) => ({ ...liveClassView(c), isHost: String(c.instructor?._id) === String(req.user._id), canJoin: true });
  res.json({ upcoming: upcoming.map(view), past: past.map(view) });
}));

router.get('/course/:courseId', staff, wrap(async (req, res) => {
  const course = await loadManagedCourse(req, req.params.courseId);
  const classes = await LiveClass.find({ course: course._id }).sort({ scheduledAt: -1 }).populate(populate).lean();
  res.json({ items: classes.map(liveClassView) });
}));

const classSchema = z.object({
  courseId: z.string(),
  title: z.string().trim().min(3, 'Give the class a title.').max(140),
  description: z.string().trim().max(1000).optional(),
  scheduledAt: z.coerce.date(),
  durationMin: z.coerce.number().int().min(5).max(480).default(60),
});

router.post('/', staff, validate(classSchema), wrap(async (req, res) => {
  const course = await loadManagedCourse(req, req.body.courseId);
  const { courseId, ...fields } = req.body;
  const created = await LiveClass.create({ ...fields, course: course._id, instructor: course.instructor });
  res.status(201).json({ liveClass: liveClassView(await created.populate(populate)) });
}));

async function loadClass(id) {
  if (!isId(id)) throw notFound('Live class not found.');
  const liveClass = await LiveClass.findById(id).populate(populate);
  if (!liveClass || !liveClass.course) throw notFound('Live class not found.');
  return liveClass;
}

router.patch('/:id', staff, validate(classSchema.omit({ courseId: true }).partial()), wrap(async (req, res) => {
  const liveClass = await loadClass(req.params.id);
  if (!canManage(req.user, liveClass.course)) throw forbidden();
  if (liveClass.status === 'ended') throw badRequest('This class has ended and can no longer be edited.');
  Object.assign(liveClass, req.body);
  await liveClass.save();
  res.json({ liveClass: liveClassView(liveClass) });
}));

router.delete('/:id', staff, wrap(async (req, res) => {
  const liveClass = await loadClass(req.params.id);
  if (!canManage(req.user, liveClass.course)) throw forbidden();
  if (liveClass.status === 'live') throw badRequest('End the class before deleting it.');
  await LiveMessage.deleteMany({ liveClass: liveClass._id });
  await liveClass.deleteOne();
  res.json({ ok: true });
}));

router.post('/:id/start', staff, wrap(async (req, res) => {
  const liveClass = await loadClass(req.params.id);
  if (!canManage(req.user, liveClass.course)) throw forbidden();
  if (liveClass.status === 'ended') throw badRequest('This class has already ended. Schedule a new one.');
  if (liveClass.status !== 'live') {
    liveClass.status = 'live';
    liveClass.startedAt = new Date();
    await liveClass.save();
  }
  res.json({ liveClass: liveClassView(liveClass) });
}));

router.post('/:id/end', staff, wrap(async (req, res) => {
  const liveClass = await loadClass(req.params.id);
  if (!canManage(req.user, liveClass.course)) throw forbidden();
  if (liveClass.status !== 'ended') {
    liveClass.status = 'ended';
    liveClass.endedAt = new Date();
    await liveClass.save();
  }
  endRoom(String(liveClass._id));
  res.json({ liveClass: liveClassView(liveClass) });
}));

/** Everything the classroom page needs: class details, your role, ICE servers and chat history. */
router.get('/:id', requireAuth, wrap(async (req, res) => {
  const liveClass = await loadClass(req.params.id);
  const isHost = canManage(req.user, liveClass.course);
  const enrolled = isHost || (await Enrollment.exists({ user: req.user._id, course: liveClass.course._id }));
  if (!enrolled) throw forbidden('Enroll in this course to join its live classes.');
  const messages = await LiveMessage.find({ liveClass: liveClass._id }).sort({ createdAt: -1 }).limit(100).lean();
  res.json({
    liveClass: liveClassView(liveClass),
    isHost,
    iceServers: iceServers(),
    online: roomSize(String(liveClass._id)),
    messages: messages.reverse().map((m) => ({ id: String(m._id), userId: String(m.user), name: m.name, role: m.role, text: m.text, at: m.createdAt })),
  });
}));

export default router;
