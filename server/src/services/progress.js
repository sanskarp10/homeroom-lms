import { customAlphabet } from 'nanoid';
import { Lesson, Course, User, Certificate } from '../models/index.js';

const code = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 10);

/**
 * Recalculate progress for an enrollment. When every lesson is complete the
 * course is marked finished and a certificate is issued (once).
 */
export async function refreshProgress(enrollment) {
  const lessons = await Lesson.find({ course: enrollment.course }).select('_id').lean();
  const valid = new Set(lessons.map((l) => String(l._id)));
  const done = [...new Set(enrollment.completedLessons.map(String))].filter((id) => valid.has(id));
  enrollment.completedLessons = done;
  enrollment.progress = lessons.length ? Math.round((done.length / lessons.length) * 100) : 0;

  let certificate = null;
  let newlyCompleted = false;
  if (lessons.length && done.length === lessons.length) {
    if (!enrollment.completedAt) {
      enrollment.completedAt = new Date();
      newlyCompleted = true;
    }
    certificate = await issueCertificate(enrollment.user, enrollment.course);
  }
  await enrollment.save();
  return { enrollment, certificate, newlyCompleted };
}

export async function issueCertificate(userId, courseId, issuedAt = new Date()) {
  const existing = await Certificate.findOne({ user: userId, course: courseId });
  if (existing) return existing;
  const [user, course] = await Promise.all([User.findById(userId), Course.findById(courseId).populate('instructor', 'name')]);
  if (!user || !course) return null;
  try {
    return await Certificate.create({
      code: `HR-${code()}`,
      user: userId,
      course: courseId,
      studentName: user.name,
      courseTitle: course.title,
      instructorName: course.instructor?.name || 'Homeroom',
      hours: Math.max(1, Math.round((course.totalDuration / 3600) * 10) / 10),
      issuedAt,
    });
  } catch (err) {
    if (err.code === 11000) return Certificate.findOne({ user: userId, course: courseId }); // raced with another request
    throw err;
  }
}
