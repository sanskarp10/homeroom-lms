import mongoose from 'mongoose';

export const LEVELS = ['beginner', 'intermediate', 'advanced'];
export const CATEGORIES = [
  'Web Development',
  'Data Science',
  'Design',
  'Business',
  'Photography',
  'Music',
  'Languages',
  'Personal Growth',
];

const sectionSchema = new mongoose.Schema({ title: { type: String, required: true, trim: true, maxlength: 120 } });

const courseSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    slug: { type: String, required: true, unique: true },
    subtitle: { type: String, default: '', maxlength: 200 },
    description: { type: String, default: '', maxlength: 8000 },
    outcomes: { type: [String], default: [] },
    category: { type: String, enum: CATEGORIES, default: 'Web Development', index: true },
    level: { type: String, enum: LEVELS, default: 'beginner' },
    language: { type: String, default: 'English' },
    price: { type: Number, default: 0, min: 0 }, // minor units (cents)
    thumbnailKey: { type: String, default: '' },
    instructor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    status: { type: String, enum: ['draft', 'published', 'archived'], default: 'draft', index: true },
    publishedAt: Date,
    sections: { type: [sectionSchema], default: [] },
    // Denormalised counters, refreshed by services/courseStats.js
    lessonCount: { type: Number, default: 0 },
    totalDuration: { type: Number, default: 0 }, // seconds
    enrollmentCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);
courseSchema.index({ status: 1, category: 1, publishedAt: -1 });
courseSchema.index({ title: 'text', subtitle: 'text' });

export const Course = mongoose.model('Course', courseSchema);
