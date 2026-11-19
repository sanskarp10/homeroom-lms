import { config } from '../config.js';
import { Order, Enrollment } from '../models/index.js';
import { recalcCourse } from './courseStats.js';

export const paymentProvider = () => (config.stripeSecretKey ? 'stripe' : 'test');

let stripeClient = null;
export async function stripe() {
  if (!config.stripeSecretKey) return null;
  if (!stripeClient) {
    const { default: Stripe } = await import('stripe');
    stripeClient = new Stripe(config.stripeSecretKey);
  }
  return stripeClient;
}

/** Split a sale between the platform and the instructor. */
export function splitAmount(amount, feePercent = config.platformFeePercent) {
  const platformFee = Math.round((amount * feePercent) / 100);
  return { platformFee, instructorNet: amount - platformFee };
}

export async function createOrder({ user, course, provider }) {
  return Order.create({
    user: user._id,
    course: course._id,
    instructor: course.instructor._id || course.instructor,
    amount: course.price,
    ...splitAmount(course.price),
    currency: config.currency,
    provider,
  });
}

export async function enrollUser(userId, courseId, orderId) {
  const enrollment = await Enrollment.findOneAndUpdate(
    { user: userId, course: courseId },
    { $setOnInsert: { user: userId, course: courseId, order: orderId } },
    { upsert: true, returnDocument: 'after' }
  );
  await recalcCourse(courseId);
  return enrollment;
}

/** Mark an order paid and enroll the buyer. Safe to call more than once. */
export async function fulfillOrder(orderId, providerRef) {
  const order = await Order.findOneAndUpdate(
    { _id: orderId, status: { $ne: 'paid' } },
    { $set: { status: 'paid', paidAt: new Date(), ...(providerRef ? { providerRef } : {}) } },
    { returnDocument: 'after' }
  );
  const current = order || (await Order.findById(orderId));
  if (!current) return null;
  await enrollUser(current.user, current.course, current._id);
  return current;
}
