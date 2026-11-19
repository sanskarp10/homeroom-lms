import { Course, Lesson, Enrollment } from '../models/index.js';

/** Refresh the denormalised counters on a course. */
export async function recalcCourse(courseId) {
  const [lessons, enrollmentCount] = await Promise.all([
    Lesson.find({ course: courseId }).select('type video.duration video.status content quiz.questions').lean(),
    Enrollment.countDocuments({ course: courseId }),
  ]);
  const totalDuration = lessons.reduce((sum, l) => sum + estimateSeconds(l), 0);
  await Course.updateOne({ _id: courseId }, { $set: { lessonCount: lessons.length, totalDuration, enrollmentCount } });
}

/** Seconds a lesson takes: real duration for video, reading time for articles, ~1 min per question. */
export function estimateSeconds(lesson) {
  if (lesson.type === 'video') return lesson.video?.status === 'ready' ? lesson.video.duration || 0 : 0;
  if (lesson.type === 'quiz') return (lesson.quiz?.questions?.length || 0) * 60;
  const words = (lesson.content || '').split(/\s+/).filter(Boolean).length;
  return Math.max(60, Math.round((words / 200) * 60));
}

/** Lessons of a course grouped by section, in display order. */
export async function loadCurriculum(course, { select } = {}) {
  const lessons = await Lesson.find({ course: course._id }).sort({ order: 1, createdAt: 1 }).select(select).lean();
  const bySection = new Map(course.sections.map((s) => [String(s._id), []]));
  for (const lesson of lessons) bySection.get(String(lesson.section))?.push(lesson);
  return course.sections.map((s) => ({ id: String(s._id), title: s.title, lessons: bySection.get(String(s._id)) || [] }));
}
