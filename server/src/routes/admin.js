import { Router } from 'express';
import { z } from 'zod';
import { User, Course, Order, Enrollment, Lesson, LiveClass, Certificate, ROLES } from '../models/index.js';
import { requireRole } from '../middleware/auth.js';
import { wrap, validate, badRequest, notFound, escapeRegex } from '../utils/http.js';
import { isId } from '../utils/access.js';
import { courseCard } from '../utils/serialize.js';
import { queueCounts, queueInfo } from '../services/queue.js';
import { config } from '../config.js';

const router = Router();
router.use(requireRole('admin'));

router.get('/overview', wrap(async (_req, res) => {
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000);
  const [usersByRole, coursesByStatus, revenue, revenue30, enrollments, certificates, liveNow, videoStates, recentUsers, recentOrders, topCourses, jobs] =
    await Promise.all([
      User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]),
      Course.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Order.aggregate([{ $match: { status: 'paid' } }, { $group: { _id: null, gross: { $sum: '$amount' }, fees: { $sum: '$platformFee' }, sales: { $sum: 1 } } }]),
      Order.aggregate([{ $match: { status: 'paid', paidAt: { $gte: since } } }, { $group: { _id: null, gross: { $sum: '$amount' }, fees: { $sum: '$platformFee' }, sales: { $sum: 1 } } }]),
      Enrollment.countDocuments(),
      Certificate.countDocuments(),
      LiveClass.countDocuments({ status: 'live' }),
      Lesson.aggregate([{ $match: { type: 'video' } }, { $group: { _id: '$video.status', count: { $sum: 1 } } }]),
      User.find().sort({ createdAt: -1 }).limit(6).lean(),
      Order.find({ status: 'paid' }).sort({ paidAt: -1 }).limit(8).populate('user', 'name').populate('course', 'title slug').lean(),
      Course.find({ status: 'published' }).sort({ enrollmentCount: -1 }).limit(5).populate('instructor', 'name').lean(),
      queueCounts().catch(() => null),
    ]);
  const toMap = (rows) => Object.fromEntries(rows.map((r) => [r._id || 'none', r.count]));
  const total = (rows) => ({ gross: rows[0]?.gross || 0, fees: rows[0]?.fees || 0, sales: rows[0]?.sales || 0 });
  res.json({
    currency: config.currency,
    users: toMap(usersByRole),
    courses: toMap(coursesByStatus),
    revenue: total(revenue),
    revenue30: total(revenue30),
    enrollments,
    certificates,
    liveNow,
    videos: toMap(videoStates),
    queue: { driver: queueInfo.driver, jobs },
    recentUsers: recentUsers.map((u) => ({ id: String(u._id), name: u.name, email: u.email, role: u.role, createdAt: u.createdAt })),
    recentOrders: recentOrders.map((o) => ({
      id: String(o._id), amount: o.amount, fee: o.platformFee, paidAt: o.paidAt,
      student: o.user?.name || 'Deleted user', course: o.course ? { title: o.course.title, slug: o.course.slug } : null,
    })),
    topCourses: topCourses.map(courseCard),
  });
}));

router.get('/users', wrap(async (req, res) => {
  const filter = {};
  if (ROLES.includes(req.query.role)) filter.role = req.query.role;
  if (req.query.q) {
    const rx = new RegExp(escapeRegex(String(req.query.q).slice(0, 80)), 'i');
    filter.$or = [{ name: rx }, { email: rx }];
  }
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = 25;
  const [users, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    User.countDocuments(filter),
  ]);
  res.json({
    items: users.map((u) => ({ id: String(u._id), name: u.name, email: u.email, role: u.role, disabled: !!u.disabled, createdAt: u.createdAt })),
    total, page, pages: Math.max(1, Math.ceil(total / limit)),
  });
}));

router.patch('/users/:id', validate(z.object({ role: z.enum(ROLES).optional(), disabled: z.boolean().optional() })), wrap(async (req, res) => {
  if (!isId(req.params.id)) throw notFound('User not found.');
  if (String(req.user._id) === req.params.id) throw badRequest('You cannot change your own role or disable yourself.');
  const user = await User.findById(req.params.id);
  if (!user) throw notFound('User not found.');
  Object.assign(user, req.body);
  await user.save();
  res.json({ user: { id: String(user._id), name: user.name, email: user.email, role: user.role, disabled: user.disabled, createdAt: user.createdAt } });
}));

router.get('/courses', wrap(async (req, res) => {
  const filter = {};
  if (['draft', 'published', 'archived'].includes(req.query.status)) filter.status = req.query.status;
  if (req.query.q) filter.title = new RegExp(escapeRegex(String(req.query.q).slice(0, 80)), 'i');
  const courses = await Course.find(filter).sort({ updatedAt: -1 }).limit(100).populate('instructor', 'name headline').lean();
  res.json({ items: courses.map(courseCard) });
}));

router.patch('/courses/:id', validate(z.object({ status: z.enum(['draft', 'published', 'archived']) })), wrap(async (req, res) => {
  if (!isId(req.params.id)) throw notFound('Course not found.');
  const course = await Course.findById(req.params.id).populate('instructor', 'name headline');
  if (!course) throw notFound('Course not found.');
  course.status = req.body.status;
  if (course.status === 'published' && !course.publishedAt) course.publishedAt = new Date();
  await course.save();
  res.json({ course: courseCard(course) });
}));

export default router;
