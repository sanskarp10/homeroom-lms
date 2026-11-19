/** Instructor-facing course builder: courses, sections, lessons, video upload, quizzes. */
import { Router } from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import multer from 'multer';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import { Course, Lesson, Enrollment, CATEGORIES, LEVELS } from '../models/index.js';
import { requireRole } from '../middleware/auth.js';
import { wrap, validate, badRequest, notFound, slugify } from '../utils/http.js';
import { loadManagedCourse, isId, canManage } from '../utils/access.js';
import { loadCurriculum, recalcCourse } from '../services/courseStats.js';
import { enqueueTranscode } from '../services/queue.js';
import { putFile, removePrefix, tmpRoot } from '../services/storage.js';
import { courseCard, courseFull, lessonForEditor } from '../utils/serialize.js';
import { config } from '../config.js';

const router = Router();
const staff = requireRole('instructor', 'admin');

const VIDEO_EXT = ['.mp4', '.mov', '.m4v', '.mkv', '.webm', '.avi'];
const IMAGE_EXT = ['.jpg', '.jpeg', '.png', '.webp'];
const diskStorage = multer.diskStorage({
  destination: tmpRoot,
  filename: (_req, file, cb) => cb(null, `upload-${nanoid(12)}${path.extname(file.originalname).toLowerCase()}`),
});
const byExtension = (allowed, message) => (_req, file, cb) =>
  allowed.includes(path.extname(file.originalname).toLowerCase()) ? cb(null, true) : cb(badRequest(message));

const uploadVideo = multer({
  storage: diskStorage,
  limits: { fileSize: config.maxUploadMb * 1024 * 1024 },
  fileFilter: byExtension(VIDEO_EXT, `Upload a video file (${VIDEO_EXT.join(', ')}).`),
}).single('video');
const uploadImage = multer({
  storage: diskStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: byExtension(IMAGE_EXT, 'Upload a JPG, PNG or WebP image.'),
}).single('image');

async function uniqueSlug(title, excludeId) {
  const base = slugify(title);
  let slug = base;
  for (let i = 2; await Course.exists({ slug, _id: { $ne: excludeId } }); i++) slug = `${base}-${i}`;
  return slug;
}

/* ---------- Courses ---------- */

router.get('/courses', staff, wrap(async (req, res) => {
  const filter = req.user.role === 'admin' && req.query.all === '1' ? {} : { instructor: req.user._id };
  const courses = await Course.find(filter).sort({ updatedAt: -1 }).populate('instructor', 'name headline').lean();
  res.json({ items: courses.map(courseCard) });
}));

const courseSchema = z.object({
  title: z.string().trim().min(4, 'Give the course a title of at least 4 characters.').max(120),
  subtitle: z.string().trim().max(200).optional(),
  description: z.string().trim().max(8000).optional(),
  outcomes: z.array(z.string().trim().min(1).max(160)).max(12).optional(),
  category: z.enum(CATEGORIES).optional(),
  level: z.enum(LEVELS).optional(),
  language: z.string().trim().max(40).optional(),
  price: z.coerce.number().int().min(0).max(1000000).optional(),
});

router.post('/courses', staff, validate(courseSchema), wrap(async (req, res) => {
  const course = await Course.create({
    ...req.body,
    slug: await uniqueSlug(req.body.title),
    instructor: req.user._id,
    sections: [{ title: 'Getting started' }],
  });
  res.status(201).json({ course: courseFull(await course.populate('instructor', 'name headline')) });
}));

router.get('/courses/:id', staff, wrap(async (req, res) => {
  const course = await loadManagedCourse(req, req.params.id);
  await course.populate('instructor', 'name headline');
  const curriculum = await loadCurriculum(course);
  res.json({
    course: courseFull(course),
    curriculum: curriculum.map((s) => ({ ...s, lessons: s.lessons.map(lessonForEditor) })),
  });
}));

router.patch('/courses/:id', staff, validate(courseSchema.partial()), wrap(async (req, res) => {
  const course = await loadManagedCourse(req, req.params.id);
  if (req.body.title && req.body.title !== course.title && course.status === 'draft') {
    course.slug = await uniqueSlug(req.body.title, course._id); // keep URLs stable once published
  }
  Object.assign(course, req.body);
  await course.save();
  res.json({ course: courseFull(await course.populate('instructor', 'name headline')) });
}));

router.post('/courses/:id/thumbnail', staff, uploadImage, wrap(async (req, res) => {
  if (!req.file) throw badRequest('Choose an image to upload.');
  try {
    const course = await loadManagedCourse(req, req.params.id);
    const key = `thumbnails/${course._id}-${nanoid(8)}${path.extname(req.file.filename)}`;
    await putFile(req.file.path, key);
    if (course.thumbnailKey) await removePrefix(course.thumbnailKey).catch(() => {});
    course.thumbnailKey = key;
    await course.save();
    res.json({ course: courseFull(await course.populate('instructor', 'name headline')) });
  } finally {
    await fs.rm(req.file.path, { force: true });
  }
}));

router.post('/courses/:id/publish', staff, validate(z.object({ published: z.boolean() })), wrap(async (req, res) => {
  const course = await loadManagedCourse(req, req.params.id);
  if (req.body.published) {
    const lessons = await Lesson.find({ course: course._id }).select('type title video.status quiz.questions').lean();
    const problems = [];
    if (!lessons.length) problems.push('Add at least one lesson.');
    if (!course.description || course.description.length < 40) problems.push('Write a description of at least 40 characters.');
    const pending = lessons.filter((l) => l.type === 'video' && l.video?.status !== 'ready');
    if (pending.length) problems.push(`${pending.length} video ${pending.length === 1 ? 'lesson has' : 'lessons have'} no finished video yet.`);
    const emptyQuiz = lessons.filter((l) => l.type === 'quiz' && !(l.quiz?.questions?.length));
    if (emptyQuiz.length) problems.push(`${emptyQuiz.length} ${emptyQuiz.length === 1 ? 'quiz has' : 'quizzes have'} no questions.`);
    if (problems.length) throw badRequest('This course is not ready to publish.', problems.map((message) => ({ field: '', message })));
    course.status = 'published';
    course.publishedAt = course.publishedAt || new Date();
  } else {
    course.status = 'draft';
  }
  await course.save();
  await recalcCourse(course._id);
  res.json({ course: courseFull(await (await Course.findById(course._id)).populate('instructor', 'name headline')) });
}));

router.delete('/courses/:id', staff, wrap(async (req, res) => {
  const course = await loadManagedCourse(req, req.params.id);
  if (await Enrollment.exists({ course: course._id })) {
    throw badRequest('Students are enrolled in this course, so it cannot be deleted. Unpublish it instead.');
  }
  const lessons = await Lesson.find({ course: course._id }).select('video.assetId').lean();
  await Promise.all(lessons.filter((l) => l.video?.assetId).map((l) => removePrefix(`videos/${l.video.assetId}`).catch(() => {})));
  await Lesson.deleteMany({ course: course._id });
  if (course.thumbnailKey) await removePrefix(course.thumbnailKey).catch(() => {});
  await course.deleteOne();
  res.json({ ok: true });
}));

/* ---------- Sections ---------- */

const sectionSchema = z.object({ title: z.string().trim().min(1, 'Name the section.').max(120) });

router.post('/courses/:id/sections', staff, validate(sectionSchema), wrap(async (req, res) => {
  const course = await loadManagedCourse(req, req.params.id);
  course.sections.push({ title: req.body.title });
  await course.save();
  const section = course.sections.at(-1);
  res.status(201).json({ section: { id: String(section._id), title: section.title, lessons: [] } });
}));

router.patch('/courses/:id/sections/:sectionId', staff, validate(sectionSchema), wrap(async (req, res) => {
  const course = await loadManagedCourse(req, req.params.id);
  const section = course.sections.id(req.params.sectionId);
  if (!section) throw notFound('Section not found.');
  section.title = req.body.title;
  await course.save();
  res.json({ section: { id: String(section._id), title: section.title } });
}));

router.delete('/courses/:id/sections/:sectionId', staff, wrap(async (req, res) => {
  const course = await loadManagedCourse(req, req.params.id);
  const section = course.sections.id(req.params.sectionId);
  if (!section) throw notFound('Section not found.');
  if (await Lesson.exists({ course: course._id, section: section._id })) {
    throw badRequest('Move or delete the lessons in this section first.');
  }
  section.deleteOne();
  await course.save();
  res.json({ ok: true });
}));

const reorderSchema = z.object({
  sections: z.array(z.object({ id: z.string(), lessons: z.array(z.string()) })).min(1),
});

/** Save a new order of sections and lessons (lessons may move between sections). */
router.put('/courses/:id/order', staff, validate(reorderSchema), wrap(async (req, res) => {
  const course = await loadManagedCourse(req, req.params.id);
  const known = new Map(course.sections.map((s) => [String(s._id), s]));
  const ordered = req.body.sections.map((s) => known.get(s.id)).filter(Boolean);
  if (ordered.length !== course.sections.length) throw badRequest('The section list is out of date. Reload and try again.');
  course.sections = ordered;
  await course.save();
  const ops = req.body.sections.flatMap((s) =>
    s.lessons.filter(isId).map((lessonId, index) => ({
      updateOne: { filter: { _id: lessonId, course: course._id }, update: { $set: { section: s.id, order: index } } },
    }))
  );
  if (ops.length) await Lesson.bulkWrite(ops);
  res.json({ ok: true });
}));

/* ---------- Lessons ---------- */

const questionSchema = z.object({
  prompt: z.string().trim().min(1, 'Every question needs a prompt.').max(1000),
  type: z.enum(['single', 'multiple', 'boolean']),
  options: z.array(z.string().trim().min(1, 'Answer options cannot be empty.').max(300)).min(2, 'Add at least two answer options.').max(8),
  correct: z.array(z.number().int().min(0)).min(1, 'Mark the correct answer for every question.'),
  points: z.coerce.number().min(0).max(100).default(1),
  explanation: z.string().trim().max(1000).optional(),
}).refine((q) => q.correct.every((i) => i < q.options.length), { message: 'A correct answer points at a missing option.' })
  .refine((q) => q.type === 'multiple' || q.correct.length === 1, { message: 'Single-answer questions need exactly one correct answer.' });

const lessonCreateSchema = z.object({
  sectionId: z.string(),
  title: z.string().trim().min(1, 'Name the lesson.').max(140),
  type: z.enum(['video', 'article', 'quiz']),
});

router.post('/courses/:id/lessons', staff, validate(lessonCreateSchema), wrap(async (req, res) => {
  const course = await loadManagedCourse(req, req.params.id);
  const section = course.sections.id(req.body.sectionId);
  if (!section) throw notFound('Section not found.');
  const order = await Lesson.countDocuments({ course: course._id, section: section._id });
  const lesson = await Lesson.create({ course: course._id, section: section._id, title: req.body.title, type: req.body.type, order });
  await recalcCourse(course._id);
  res.status(201).json({ lesson: lessonForEditor(lesson) });
}));

async function loadManagedLesson(req) {
  if (!isId(req.params.lessonId)) throw notFound('Lesson not found.');
  const lesson = await Lesson.findById(req.params.lessonId);
  if (!lesson) throw notFound('Lesson not found.');
  const course = await loadManagedCourse(req, lesson.course);
  return { lesson, course };
}

const lessonUpdateSchema = z.object({
  title: z.string().trim().min(1).max(140).optional(),
  isPreview: z.boolean().optional(),
  content: z.string().max(40000).optional(),
  quiz: z.object({
    passingPercent: z.coerce.number().min(0).max(100),
    questions: z.array(questionSchema).max(100),
  }).optional(),
});

router.get('/lessons/:lessonId', staff, wrap(async (req, res) => {
  const { lesson } = await loadManagedLesson(req);
  res.json({ lesson: lessonForEditor(lesson) });
}));

router.patch('/lessons/:lessonId', staff, validate(lessonUpdateSchema), wrap(async (req, res) => {
  const { lesson } = await loadManagedLesson(req);
  const { quiz, ...rest } = req.body;
  Object.assign(lesson, rest);
  if (quiz) {
    lesson.quiz.passingPercent = quiz.passingPercent;
    lesson.quiz.questions = quiz.questions;
  }
  await lesson.save();
  await recalcCourse(lesson.course);
  res.json({ lesson: lessonForEditor(lesson) });
}));

router.delete('/lessons/:lessonId', staff, wrap(async (req, res) => {
  const { lesson } = await loadManagedLesson(req);
  if (lesson.video?.assetId) await removePrefix(`videos/${lesson.video.assetId}`).catch(() => {});
  await lesson.deleteOne();
  await Enrollment.updateMany({ course: lesson.course }, { $pull: { completedLessons: lesson._id } });
  await recalcCourse(lesson.course);
  res.json({ ok: true });
}));

/**
 * Upload a lesson video. The request returns as soon as the file is on disk;
 * FFmpeg runs in a background job and the editor polls the lesson for progress.
 */
router.post('/lessons/:lessonId/video', staff, uploadVideo, wrap(async (req, res) => {
  if (!req.file) throw badRequest('Choose a video file to upload.');
  let lesson;
  try {
    ({ lesson } = await loadManagedLesson(req));
    if (lesson.type !== 'video') throw badRequest('Only video lessons accept a video upload.');
  } catch (err) {
    await fs.rm(req.file.path, { force: true });
    throw err;
  }
  const previous = lesson.video?.assetId;
  const assetId = nanoid(16);
  let sourceKey;
  if (config.storageDriver === 's3' && !config.runWorkerInApi) {
    // The worker runs on another machine, so hand it the source through S3.
    sourceKey = `sources/${assetId}${path.extname(req.file.filename)}`;
    await putFile(req.file.path, sourceKey);
  }
  lesson.video = {
    status: 'queued',
    progress: 0,
    assetId,
    sourceKey,
    originalName: req.file.originalname,
    size: req.file.size,
    duration: 0,
    renditions: [],
  };
  await lesson.save();
  await enqueueTranscode({ lessonId: String(lesson._id), assetId, inputPath: req.file.path, sourceKey });
  if (previous) removePrefix(`videos/${previous}`).catch(() => {});
  await recalcCourse(lesson.course);
  res.status(202).json({ lesson: lessonForEditor(lesson) });
}));

router.delete('/lessons/:lessonId/video', staff, wrap(async (req, res) => {
  const { lesson } = await loadManagedLesson(req);
  if (lesson.video?.assetId) await removePrefix(`videos/${lesson.video.assetId}`).catch(() => {});
  lesson.video = { status: 'none', progress: 0 };
  await lesson.save();
  await recalcCourse(lesson.course);
  res.json({ lesson: lessonForEditor(lesson) });
}));

export default router;
export { canManage };
