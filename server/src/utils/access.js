import mongoose from 'mongoose';
import { Course, Enrollment } from '../models/index.js';
import { notFound, forbidden } from './http.js';

export const isId = (v) => mongoose.isValidObjectId(v);

export const canManage = (user, course) =>
  !!user && (user.role === 'admin' || String(course.instructor?._id || course.instructor) === String(user._id));

/** Load a course the current user may edit, or throw. */
export async function loadManagedCourse(req, courseId) {
  if (!isId(courseId)) throw notFound('Course not found.');
  const course = await Course.findById(courseId);
  if (!course) throw notFound('Course not found.');
  if (!canManage(req.user, course)) throw forbidden('Only the instructor of this course can change it.');
  return course;
}

export async function findEnrollment(user, courseId) {
  if (!user) return null;
  return Enrollment.findOne({ user: user._id, course: courseId });
}
