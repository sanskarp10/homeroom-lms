import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { User } from '../models/index.js';
import { requireAuth, signToken } from '../middleware/auth.js';
import { wrap, validate, badRequest, unauthorized } from '../utils/http.js';
import { config } from '../config.js';

const router = Router();

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: config.isTest ? 10000 : 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Wait a few minutes and try again.' },
});

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Enter your name.').max(80),
  email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
  password: z.string().min(8, 'Use at least 8 characters.').max(200),
  role: z.enum(['student', 'instructor']).default('student'),
});

router.post('/register', limiter, validate(registerSchema), wrap(async (req, res) => {
  const { name, email, password, role } = req.body;
  if (await User.exists({ email })) throw badRequest('An account with this email already exists. Sign in instead.');
  const user = new User({ name, email, role });
  await user.setPassword(password);
  await user.save();
  res.status(201).json({ token: signToken(user), user: user.toPublic() });
}));

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
  password: z.string().min(1, 'Enter your password.'),
});

router.post('/login', limiter, validate(loginSchema), wrap(async (req, res) => {
  const user = await User.findOne({ email: req.body.email }).select('+passwordHash');
  if (!user || !(await user.checkPassword(req.body.password))) throw unauthorized('Email or password is incorrect.');
  if (user.disabled) throw unauthorized('This account has been disabled. Contact an administrator.');
  res.json({ token: signToken(user), user: user.toPublic() });
}));

router.get('/me', requireAuth, (req, res) => res.json({ user: req.user.toPublic() }));

const profileSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  headline: z.string().trim().max(140).optional(),
  bio: z.string().trim().max(2000).optional(),
});

router.patch('/me', requireAuth, validate(profileSchema), wrap(async (req, res) => {
  Object.assign(req.user, req.body);
  await req.user.save();
  res.json({ user: req.user.toPublic() });
}));

const passwordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, 'Use at least 8 characters.').max(200),
});

router.post('/password', requireAuth, validate(passwordSchema), wrap(async (req, res) => {
  const user = await User.findById(req.user._id).select('+passwordHash');
  if (!(await user.checkPassword(req.body.currentPassword))) throw badRequest('Your current password is incorrect.');
  await user.setPassword(req.body.newPassword);
  await user.save();
  res.json({ ok: true });
}));

export default router;
