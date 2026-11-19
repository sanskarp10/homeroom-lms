import mongoose from 'mongoose';

const questionSchema = new mongoose.Schema({
  prompt: { type: String, required: true, maxlength: 1000 },
  type: { type: String, enum: ['single', 'multiple', 'boolean'], default: 'single' },
  options: { type: [String], default: [] },
  correct: { type: [Number], default: [] }, // indexes into options
  points: { type: Number, default: 1, min: 0 },
  explanation: { type: String, default: '', maxlength: 1000 },
});

const lessonSchema = new mongoose.Schema(
  {
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    section: { type: mongoose.Schema.Types.ObjectId, required: true },
    order: { type: Number, default: 0 },
    title: { type: String, required: true, trim: true, maxlength: 140 },
    type: { type: String, enum: ['video', 'article', 'quiz'], default: 'video' },
    isPreview: { type: Boolean, default: false },
    content: { type: String, default: '', maxlength: 40000 }, // article body or video notes
    video: {
      status: { type: String, enum: ['none', 'queued', 'processing', 'ready', 'failed'], default: 'none' },
      progress: { type: Number, default: 0 },
      assetId: String,
      sourceKey: String,
      hlsKey: String,
      posterKey: String,
      duration: { type: Number, default: 0 },
      renditions: { type: [Number], default: [] },
      originalName: String,
      size: Number,
      error: String,
    },
    quiz: {
      passingPercent: { type: Number, default: 70, min: 0, max: 100 },
      questions: { type: [questionSchema], default: [] },
    },
  },
  { timestamps: true }
);
lessonSchema.index({ course: 1, section: 1, order: 1 });

export const Lesson = mongoose.model('Lesson', lessonSchema);
