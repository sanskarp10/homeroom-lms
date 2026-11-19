import mongoose from 'mongoose';

const quizAttemptSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    lesson: { type: mongoose.Schema.Types.ObjectId, ref: 'Lesson', required: true, index: true },
    answers: { type: Map, of: [Number], default: {} }, // questionId -> selected option indexes
    score: Number,
    maxScore: Number,
    percent: Number,
    passed: Boolean,
    results: [
      {
        _id: false,
        question: mongoose.Schema.Types.ObjectId,
        selected: [Number],
        correct: [Number],
        isCorrect: Boolean,
        points: Number,
        explanation: String,
      },
    ],
  },
  { timestamps: true }
);
quizAttemptSchema.index({ user: 1, lesson: 1, createdAt: -1 });

export const QuizAttempt = mongoose.model('QuizAttempt', quizAttemptSchema);
