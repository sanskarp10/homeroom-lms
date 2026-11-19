import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    instructor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    amount: { type: Number, required: true }, // minor units
    platformFee: { type: Number, required: true },
    instructorNet: { type: Number, required: true },
    currency: { type: String, default: 'usd' },
    provider: { type: String, enum: ['stripe', 'test'], required: true },
    providerRef: String, // Stripe checkout session id
    status: { type: String, enum: ['pending', 'paid', 'failed'], default: 'pending', index: true },
    paidAt: Date,
  },
  { timestamps: true }
);
orderSchema.index({ instructor: 1, status: 1, paidAt: -1 });

export const Order = mongoose.model('Order', orderSchema);
