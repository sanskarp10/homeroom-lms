import mongoose from 'mongoose';

const enrollmentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    completedLessons: { type: [mongoose.Schema.Types.ObjectId], default: [] },
    positions: { type: Map, of: Number, default: {} }, // lessonId -> seconds watched
    lastLesson: { type: mongoose.Schema.Types.ObjectId, ref: 'Lesson' },
    progress: { type: Number, default: 0 }, // 0..100
    completedAt: Date,
  },
  { timestamps: true }
);
enrollmentSchema.index({ user: 1, course: 1 }, { unique: true });

export const Enrollment = mongoose.model('Enrollment', enrollmentSchema);
