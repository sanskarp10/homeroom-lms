/** Student-facing learning: enrollments, the course player, progress and quizzes. */
import { Router } from 'express';
import { z } from 'zod';
import { Course, Lesson, Enrollment, QuizAttempt, Certificate } from '../models/index.js';
import { authOptional, requireAuth } from '../middleware/auth.js';
import { wrap, validate, badRequest, forbidden, notFound } from '../utils/http.js';
import { canManage, findEnrollment, isId } from '../utils/access.js';
import { loadCurriculum } from '../services/courseStats.js';
import { refreshProgress } from '../services/progress.js';
import { enrollUser } from '../services/payments.js';
import { gradeQuiz } from '../services/grading.js';
import { courseCard, courseFull, lessonOutline, lessonForLearner, attemptView, certificateView } from '../utils/serialize.js';

const router = Router();

/* ---------- Enrollments ---------- */

router.get('/enrollments', requireAuth, wrap(async (req, res) => {
  const enrollments = await Enrollment.find({ user: req.user._id })
    .sort({ updatedAt: -1 })
    .populate({ path: 'course', populate: { path: 'instructor', select: 'name headline' } })
    .lean();
  const certs = await Certificate.find({ user: req.user._id }).lean();
  const certByCourse = new Map(certs.map((c) => [String(c.course), c]));
  res.json({
    items: enrollments.filter((e) => e.course).map((e) => ({
      id: String(e._id),
      progress: e.progress,
      completedAt: e.completedAt,
      completedCount: e.completedLessons.length,
      lastLesson: e.lastLesson ? String(e.lastLesson) : null,
      enrolledAt: e.createdAt,
      updatedAt: e.updatedAt,
      course: courseCard(e.course),
      certificate: certByCourse.has(String(e.course._id)) ? certificateView(certByCourse.get(String(e.course._id))) : null,
    })),
  });
}));

/** Enroll in a free course. Paid courses go through /api/payments/checkout. */
router.post('/enrollments', requireAuth, validate(z.object({ courseId: z.string() })), wrap(async (req, res) => {
  if (!isId(req.body.courseId)) throw notFound('Course not found.');
  const course = await Course.findById(req.body.courseId);
  if (!course || course.status !== 'published') throw notFound('Course not found.');
  if (course.price > 0) throw badRequest('This course is paid. Use checkout to enroll.');
  const enrollment = await enrollUser(req.user._id, course._id);
  res.status(201).json({ enrollment: { id: String(enrollment._id), progress: enrollment.progress } });
}));

/* ---------- Course player ---------- */

router.get('/courses/:courseId', requireAuth, wrap(async (req, res) => {
  if (!isId(req.params.courseId)) throw notFound('Course not found.');
  const course = await Course.findById(req.params.courseId).populate('instructor', 'name headline');
  if (!course) throw notFound('Course not found.');
  const manage = canManage(req.user, course);
  const enrollment = await findEnrollment(req.user, course._id);
  if (!enrollment && !manage) throw forbidden('Enroll in this course to start learning.');

  const curriculum = await loadCurriculum(course, { select: 'title type isPreview section order video.duration video.status content quiz.questions' });
  const completed = new Set((enrollment?.completedLessons || []).map(String));
  const certificate = enrollment ? await Certificate.findOne({ user: req.user._id, course: course._id }) : null;
  res.json({
    course: courseFull(course),
    curriculum: curriculum.map((s) => ({
      ...s,
      lessons: s.lessons.map((l) => ({ ...lessonOutline(l), completed: completed.has(String(l._id)) })),
    })),
    enrollment: enrollment
      ? { progress: enrollment.progress, completedAt: enrollment.completedAt, lastLesson: enrollment.lastLesson ? String(enrollment.lastLesson) : null }
      : null,
    certificate: certificate ? certificateView(certificate) : null,
    manage,
  });
}));

async function loadLessonAccess(req, { allowPreview = false } = {}) {
  if (!isId(req.params.lessonId)) throw notFound('Lesson not found.');
  const lesson = await Lesson.findById(req.params.lessonId);
  if (!lesson) throw notFound('Lesson not found.');
  const course = await Course.findById(lesson.course);
  if (!course) throw notFound('Lesson not found.');
  const manage = canManage(req.user, course);
  const enrollment = await findEnrollment(req.user, course._id);
  const preview = allowPreview && lesson.isPreview && course.status === 'published';
  if (!enrollment && !manage && !preview) {
    throw forbidden(req.user ? 'Enroll in this course to open this lesson.' : 'Sign in and enroll to open this lesson.');
  }
  return { lesson, course, enrollment, manage };
}

router.get('/lessons/:lessonId', authOptional, wrap(async (req, res) => {
  const { lesson, enrollment } = await loadLessonAccess(req, { allowPreview: true });
  const lastAttempt = lesson.type === 'quiz' && req.user
    ? await QuizAttempt.findOne({ user: req.user._id, lesson: lesson._id }).sort({ createdAt: -1 })
    : null;
  const attempts = lesson.type === 'quiz' && req.user ? await QuizAttempt.countDocuments({ user: req.user._id, lesson: lesson._id }) : 0;
  res.json({
    lesson: lessonForLearner(lesson),
    position: enrollment?.positions?.get(String(lesson._id)) || 0,
    completed: !!enrollment?.completedLessons.some((id) => String(id) === String(lesson._id)),
    lastAttempt: attemptView(lastAttempt),
    attempts,
  });
}));

const progressPayload = (result) => ({
  progress: result.enrollment.progress,
  completedAt: result.enrollment.completedAt,
  courseCompleted: result.newlyCompleted,
  certificate: result.certificate ? certificateView(result.certificate) : null,
});

/** Save the playback position. A video counts as complete once 90% has been watched. */
router.post('/lessons/:lessonId/position', requireAuth, validate(z.object({ position: z.number().min(0).max(86400) })), wrap(async (req, res) => {
  const { lesson, enrollment } = await loadLessonAccess(req);
  if (!enrollment) return res.json({ saved: false }); // instructors previewing their own course
  const key = String(lesson._id);
  enrollment.positions.set(key, Math.round(req.body.position));
  enrollment.lastLesson = lesson._id;
  const duration = lesson.video?.duration || 0;
  const already = enrollment.completedLessons.some((id) => String(id) === key);
  if (!already && lesson.type === 'video' && duration > 0 && req.body.position >= duration * 0.9) {
    enrollment.completedLessons.push(lesson._id);
    return res.json({ saved: true, completed: true, ...progressPayload(await refreshProgress(enrollment)) });
  }
  await enrollment.save();
  res.json({ saved: true, completed: already, progress: enrollment.progress });
}));

router.post('/lessons/:lessonId/complete', requireAuth, validate(z.object({ completed: z.boolean().default(true) })), wrap(async (req, res) => {
  const { lesson, enrollment } = await loadLessonAccess(req);
  if (!enrollment) throw badRequest('Enroll in this course to track progress.');
  if (lesson.type === 'quiz') throw badRequest('Pass the quiz to complete this lesson.');
  const key = String(lesson._id);
  enrollment.completedLessons = enrollment.completedLessons.filter((id) => String(id) !== key);
  if (req.body.completed) enrollment.completedLessons.push(lesson._id);
  enrollment.lastLesson = lesson._id;
  res.json({ completed: req.body.completed, ...progressPayload(await refreshProgress(enrollment)) });
}));

const quizSchema = z.object({ answers: z.record(z.string(), z.array(z.number().int().min(0)).max(8)) });

/** Grade a quiz attempt. Passing completes the lesson. */
router.post('/lessons/:lessonId/quiz', requireAuth, validate(quizSchema), wrap(async (req, res) => {
  const { lesson, enrollment } = await loadLessonAccess(req);
  if (lesson.type !== 'quiz') throw badRequest('This lesson is not a quiz.');
  if (!lesson.quiz.questions.length) throw badRequest('This quiz has no questions yet.');
  const graded = gradeQuiz(lesson.quiz, req.body.answers);
  const attempt = await QuizAttempt.create({ user: req.user._id, course: lesson.course, lesson: lesson._id, answers: req.body.answers, ...graded });

  let progress = null;
  if (enrollment) {
    enrollment.lastLesson = lesson._id;
    const key = String(lesson._id);
    if (graded.passed && !enrollment.completedLessons.some((id) => String(id) === key)) enrollment.completedLessons.push(lesson._id);
    progress = progressPayload(await refreshProgress(enrollment));
  }
  const attempts = await QuizAttempt.countDocuments({ user: req.user._id, lesson: lesson._id });
  res.status(201).json({ attempt: attemptView(attempt), attempts, ...(progress || {}) });
}));

export default router;
