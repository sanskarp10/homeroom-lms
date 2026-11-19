/**
 * Payments in test mode.
 *   - With STRIPE_SECRET_KEY set: Stripe Checkout (use sk_test_ keys).
 *   - Without it: a built-in test gateway that accepts Stripe's test card numbers,
 *     so the whole purchase flow works offline.
 */
import { Router } from 'express';
import express from 'express';
import { z } from 'zod';
import { Course, Order, Enrollment } from '../models/index.js';
import { requireAuth } from '../middleware/auth.js';
import { wrap, validate, badRequest, notFound, forbidden } from '../utils/http.js';
import { isId } from '../utils/access.js';
import { paymentProvider, stripe, createOrder, fulfillOrder, enrollUser } from '../services/payments.js';
import { config } from '../config.js';
import { log } from '../utils/log.js';

const router = Router();

router.get('/config', (_req, res) => res.json({ provider: paymentProvider(), currency: config.currency, platformFeePercent: config.platformFeePercent }));

router.post('/checkout', requireAuth, validate(z.object({ courseId: z.string() })), wrap(async (req, res) => {
  if (!isId(req.body.courseId)) throw notFound('Course not found.');
  const course = await Course.findById(req.body.courseId);
  if (!course || course.status !== 'published') throw notFound('Course not found.');
  if (String(course.instructor) === String(req.user._id)) throw badRequest('You teach this course, so you already have access.');
  if (await Enrollment.exists({ user: req.user._id, course: course._id })) return res.json({ enrolled: true });
  if (course.price === 0) {
    await enrollUser(req.user._id, course._id);
    return res.json({ enrolled: true });
  }

  const provider = paymentProvider();
  const order = await createOrder({ user: req.user, course, provider });

  if (provider === 'stripe') {
    const client = await stripe();
    const session = await client.checkout.sessions.create({
      mode: 'payment',
      customer_email: req.user.email,
      client_reference_id: String(order._id),
      metadata: { orderId: String(order._id), courseId: String(course._id), userId: String(req.user._id) },
      line_items: [{
        quantity: 1,
        price_data: {
          currency: config.currency,
          unit_amount: course.price,
          product_data: { name: course.title, description: course.subtitle || undefined },
        },
      }],
      success_url: `${config.clientUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${config.clientUrl}/courses/${course.slug}?checkout=cancelled`,
    });
    order.providerRef = session.id;
    await order.save();
    return res.json({ provider, url: session.url, orderId: String(order._id) });
  }
  res.json({ provider, orderId: String(order._id) });
}));

const orderView = (o) => ({
  id: String(o._id),
  amount: o.amount,
  currency: o.currency,
  status: o.status,
  provider: o.provider,
  paidAt: o.paidAt,
  createdAt: o.createdAt,
  course: o.course?.title ? { id: String(o.course._id), title: o.course.title, slug: o.course.slug, category: o.course.category, subtitle: o.course.subtitle } : undefined,
});

router.get('/orders', requireAuth, wrap(async (req, res) => {
  const orders = await Order.find({ user: req.user._id, status: 'paid' }).sort({ paidAt: -1 }).populate('course', 'title slug category subtitle').lean();
  res.json({ items: orders.map(orderView) });
}));

router.get('/orders/:id', requireAuth, wrap(async (req, res) => {
  if (!isId(req.params.id)) throw notFound('Order not found.');
  const order = await Order.findById(req.params.id).populate('course', 'title slug category subtitle');
  if (!order) throw notFound('Order not found.');
  if (String(order.user) !== String(req.user._id)) throw forbidden();
  res.json({ order: orderView(order) });
}));

const cardSchema = z.object({
  cardNumber: z.string().transform((s) => s.replace(/\D/g, '')),
  expiry: z.string().trim(),
  cvc: z.string().trim(),
  name: z.string().trim().min(1, 'Enter the name on the card.'),
});

const TEST_CARDS = {
  '4242424242424242': { ok: true },
  '5555555555554444': { ok: true },
  '4000000000000002': { ok: false, message: 'The card was declined. Try 4242 4242 4242 4242.' },
  '4000000000009995': { ok: false, message: 'The card has insufficient funds. Try 4242 4242 4242 4242.' },
};

/** Built-in test gateway. Only active when Stripe is not configured. */
router.post('/test/:orderId/pay', requireAuth, validate(cardSchema), wrap(async (req, res) => {
  if (paymentProvider() !== 'test') throw badRequest('The test gateway is off because Stripe is configured.');
  if (!isId(req.params.orderId)) throw notFound('Order not found.');
  const order = await Order.findById(req.params.orderId);
  if (!order) throw notFound('Order not found.');
  if (String(order.user) !== String(req.user._id)) throw forbidden();
  if (order.status === 'paid') return res.json({ status: 'paid', courseId: String(order.course) });

  const { cardNumber, expiry, cvc } = req.body;
  const card = TEST_CARDS[cardNumber];
  const m = expiry.match(/^(\d{2})\s*\/\s*(\d{2})$/);
  if (!m || Number(m[1]) < 1 || Number(m[1]) > 12) throw badRequest('Enter the expiry date as MM/YY.');
  if (new Date(2000 + Number(m[2]), Number(m[1]), 1) <= new Date()) throw badRequest('This card has expired. Use any future date.');
  if (!/^\d{3,4}$/.test(cvc)) throw badRequest('Enter the 3-digit security code.');
  if (!card) throw badRequest('This is test mode. Use the test card 4242 4242 4242 4242.');
  if (!card.ok) {
    order.status = 'failed';
    await order.save();
    return res.status(402).json({ error: card.message });
  }
  await fulfillOrder(order._id, `test_${order._id}`);
  res.json({ status: 'paid', courseId: String(order.course) });
}));

/** Called from the success page: confirms the Stripe session server-side (works without webhooks). */
router.get('/stripe/verify', requireAuth, wrap(async (req, res) => {
  const client = await stripe();
  if (!client) throw badRequest('Stripe is not configured.');
  const sessionId = String(req.query.session_id || '');
  if (!sessionId) throw badRequest('Missing session_id.');
  const session = await client.checkout.sessions.retrieve(sessionId);
  const order = await Order.findOne({ providerRef: session.id }).populate('course', 'title slug category subtitle');
  if (!order || String(order.user) !== String(req.user._id)) throw notFound('Order not found.');
  if (session.payment_status === 'paid') await fulfillOrder(order._id, session.id);
  const fresh = await Order.findById(order._id).populate('course', 'title slug category subtitle');
  res.json({ order: orderView(fresh), courseId: String(fresh.course._id) });
}));

/** Stripe webhook. Mounted with a raw body parser in app.js. */
export const stripeWebhook = [
  express.raw({ type: 'application/json' }),
  wrap(async (req, res) => {
    const client = await stripe();
    if (!client) return res.status(400).json({ error: 'Stripe is not configured.' });
    let event;
    try {
      event = config.stripeWebhookSecret
        ? client.webhooks.constructEvent(req.body, req.headers['stripe-signature'], config.stripeWebhookSecret)
        : JSON.parse(req.body.toString());
    } catch (err) {
      log.warn('Stripe webhook signature check failed:', err.message);
      return res.status(400).json({ error: 'Invalid signature.' });
    }
    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
      const session = event.data.object;
      const orderId = session.metadata?.orderId || session.client_reference_id;
      if (session.payment_status === 'paid' && isId(orderId)) await fulfillOrder(orderId, session.id);
    }
    res.json({ received: true });
  }),
];

export default router;
