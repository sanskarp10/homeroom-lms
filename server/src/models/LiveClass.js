import mongoose from 'mongoose';

const liveClassSchema = new mongoose.Schema(
  {
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    instructor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 140 },
    description: { type: String, default: '', maxlength: 1000 },
    scheduledAt: { type: Date, required: true, index: true },
    durationMin: { type: Number, default: 60, min: 5, max: 480 },
    status: { type: String, enum: ['scheduled', 'live', 'ended'], default: 'scheduled', index: true },
    startedAt: Date,
    endedAt: Date,
    peakAttendance: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const liveMessageSchema = new mongoose.Schema(
  {
    liveClass: { type: mongoose.Schema.Types.ObjectId, ref: 'LiveClass', required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: String,
    role: String,
    text: { type: String, required: true, maxlength: 1000 },
  },
  { timestamps: true }
);

export const LiveClass = mongoose.model('LiveClass', liveClassSchema);
export const LiveMessage = mongoose.model('LiveMessage', liveMessageSchema);
