import mongoose from 'mongoose';

const certificateSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    // Snapshot so the certificate never changes after it is issued.
    studentName: String,
    courseTitle: String,
    instructorName: String,
    hours: Number,
    issuedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);
certificateSchema.index({ user: 1, course: 1 }, { unique: true });

export const Certificate = mongoose.model('Certificate', certificateSchema);
