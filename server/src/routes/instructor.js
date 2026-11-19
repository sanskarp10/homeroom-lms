/** Instructor revenue dashboard. */
import { Router } from 'express';
import { Course, Order, Enrollment } from '../models/index.js';
import { requireRole } from '../middleware/auth.js';
import { wrap } from '../utils/http.js';
import { config } from '../config.js';

const router = Router();
const DAY = 24 * 3600 * 1000;
const dayKey = (d) => new Date(d).toISOString().slice(0, 10);

router.get('/dashboard', requireRole('instructor', 'admin'), wrap(async (req, res) => {
  const days = [7, 30, 90, 365].includes(Number(req.query.days)) ? Number(req.query.days) : 30;
  const instructor = req.user._id;
  const since = new Date(new Date().setUTCHours(0, 0, 0, 0) - (days - 1) * DAY);
  const previousSince = new Date(since.getTime() - days * DAY);
  const paid = { instructor, status: 'paid' };

  const sum = { $group: { _id: null, gross: { $sum: '$amount' }, net: { $sum: '$instructorNet' }, fees: { $sum: '$platformFee' }, sales: { $sum: 1 } } };
  const [courses, lifetimeAgg, rangeAgg, previousAgg, daily, byCourse, recent] = await Promise.all([
    Course.find({ instructor }).select('title slug status price enrollmentCount lessonCount category').lean(),
    Order.aggregate([{ $match: paid }, sum]),
    Order.aggregate([{ $match: { ...paid, paidAt: { $gte: since } } }, sum]),
    Order.aggregate([{ $match: { ...paid, paidAt: { $gte: previousSince, $lt: since } } }, sum]),
    Order.aggregate([
      { $match: { ...paid, paidAt: { $gte: since } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$paidAt' } }, gross: { $sum: '$amount' }, net: { $sum: '$instructorNet' }, sales: { $sum: 1 } } },
    ]),
    Order.aggregate([
      { $match: paid },
      { $group: { _id: '$course', gross: { $sum: '$amount' }, net: { $sum: '$instructorNet' }, sales: { $sum: 1 } } },
    ]),
    Order.find(paid).sort({ paidAt: -1 }).limit(12).populate('user', 'name email').populate('course', 'title slug').lean(),
  ]);

  const courseIds = courses.map((c) => c._id);
  const [progressAgg, students] = await Promise.all([
    Enrollment.aggregate([
      { $match: { course: { $in: courseIds } } },
      { $group: { _id: '$course', avgProgress: { $avg: '$progress' }, completed: { $sum: { $cond: [{ $ifNull: ['$completedAt', false] }, 1, 0] } }, students: { $sum: 1 } } },
    ]),
    Enrollment.distinct('user', { course: { $in: courseIds } }),
  ]);

  const zero = { gross: 0, net: 0, fees: 0, sales: 0 };
  const strip = (a) => { const { _id, ...rest } = a[0] || zero; return { ...zero, ...rest }; };
  const dailyMap = new Map(daily.map((d) => [d._id, d]));
  const series = Array.from({ length: days }, (_, i) => {
    const date = dayKey(since.getTime() + i * DAY);
    const d = dailyMap.get(date);
    return { date, gross: d?.gross || 0, net: d?.net || 0, sales: d?.sales || 0 };
  });
  const revenueByCourse = new Map(byCourse.map((c) => [String(c._id), c]));
  const progressByCourse = new Map(progressAgg.map((c) => [String(c._id), c]));

  res.json({
    days,
    currency: config.currency,
    platformFeePercent: config.platformFeePercent,
    lifetime: strip(lifetimeAgg),
    range: strip(rangeAgg),
    previous: strip(previousAgg),
    students: students.length,
    series,
    courses: courses
      .map((c) => {
        const r = revenueByCourse.get(String(c._id));
        const p = progressByCourse.get(String(c._id));
        return {
          id: String(c._id), title: c.title, slug: c.slug, status: c.status, price: c.price, category: c.category,
          students: p?.students || 0,
          completed: p?.completed || 0,
          avgProgress: Math.round(p?.avgProgress || 0),
          gross: r?.gross || 0, net: r?.net || 0, sales: r?.sales || 0,
        };
      })
      .sort((a, b) => b.net - a.net),
    recent: recent.map((o) => ({
      id: String(o._id), amount: o.amount, net: o.instructorNet, fee: o.platformFee, paidAt: o.paidAt, provider: o.provider,
      student: o.user ? { name: o.user.name, email: o.user.email } : null,
      course: o.course ? { title: o.course.title, slug: o.course.slug } : null,
    })),
  });
}));

export default router;
