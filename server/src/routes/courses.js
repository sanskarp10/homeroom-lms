import { Router } from 'express';
import { z } from 'zod';
import { Course, Lesson, LiveClass, CATEGORIES, LEVELS } from '../models/index.js';
import { authOptional } from '../middleware/auth.js';
import { wrap, validate, notFound, escapeRegex } from '../utils/http.js';
import { canManage, findEnrollment } from '../utils/access.js';
import { loadCurriculum } from '../services/courseStats.js';
import { courseCard, courseFull, lessonOutline, liveClassView } from '../utils/serialize.js';

const router = Router();

const listSchema = z.object({
  q: z.string().trim().max(80).optional(),
  category: z.string().optional(),
  level: z.enum(LEVELS).optional(),
  price: z.enum(['free', 'paid']).optional(),
  sort: z.enum(['popular', 'newest', 'price-asc', 'price-desc']).default('popular'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(48).default(12),
});

const SORTS = {
  popular: { enrollmentCount: -1, publishedAt: -1 },
  newest: { publishedAt: -1 },
  'price-asc': { price: 1, enrollmentCount: -1 },
  'price-desc': { price: -1, enrollmentCount: -1 },
};

router.get('/', validate(listSchema, 'query'), wrap(async (req, res) => {
  const { q, category, level, price, sort, page, limit } = req.validQuery;
  const filter = { status: 'published' };
  if (category && CATEGORIES.includes(category)) filter.category = category;
  if (level) filter.level = level;
  if (price === 'free') filter.price = 0;
  if (price === 'paid') filter.price = { $gt: 0 };
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ title: rx }, { subtitle: rx }, { category: rx }];
  }
  const [items, total] = await Promise.all([
    Course.find(filter).sort(SORTS[sort]).skip((page - 1) * limit).limit(limit).populate('instructor', 'name headline').lean(),
    Course.countDocuments(filter),
  ]);
  res.json({ items: items.map(courseCard), total, page, pages: Math.max(1, Math.ceil(total / limit)) });
}));

router.get('/categories', wrap(async (_req, res) => {
  const counts = await Course.aggregate([{ $match: { status: 'published' } }, { $group: { _id: '$category', count: { $sum: 1 } } }]);
  const byName = Object.fromEntries(counts.map((c) => [c._id, c.count]));
  res.json({ categories: CATEGORIES.map((name) => ({ name, count: byName[name] || 0 })), levels: LEVELS });
}));

router.get('/:slug', authOptional, wrap(async (req, res) => {
  const course = await Course.findOne({ slug: req.params.slug }).populate('instructor', 'name headline bio');
  if (!course) throw notFound('This course does not exist.');
  const manage = canManage(req.user, course);
  if (course.status !== 'published' && !manage) throw notFound('This course does not exist.');

  const [curriculum, enrollment, liveClasses, instructorCourses] = await Promise.all([
    loadCurriculum(course, { select: 'title type isPreview section order video.duration video.status content quiz.questions' }),
    findEnrollment(req.user, course._id),
    LiveClass.find({ course: course._id, status: { $in: ['scheduled', 'live'] }, scheduledAt: { $gte: new Date(Date.now() - 6 * 3600 * 1000) } })
      .sort({ scheduledAt: 1 }).limit(5).lean(),
    Course.countDocuments({ instructor: course.instructor._id, status: 'published' }),
  ]);

  res.json({
    course: courseFull(course),
    curriculum: curriculum.map((s) => ({ ...s, lessons: s.lessons.map(lessonOutline) })),
    liveClasses: liveClasses.map(liveClassView),
    instructorCourseCount: instructorCourses,
    access: {
      manage,
      enrolled: !!enrollment,
      progress: enrollment?.progress || 0,
      lastLesson: enrollment?.lastLesson ? String(enrollment.lastLesson) : null,
    },
  });
}));

export default router;
