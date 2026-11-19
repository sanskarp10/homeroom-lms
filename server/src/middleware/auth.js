import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { User } from '../models/index.js';
import { unauthorized, forbidden } from '../utils/http.js';

export const signToken = (user) =>
  jwt.sign({ sub: user._id.toString(), role: user.role }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });

export async function userFromToken(token) {
  if (!token) return null;
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    const user = await User.findById(payload.sub);
    return user && !user.disabled ? user : null;
  } catch {
    return null;
  }
}

const bearer = (req) => {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7) : null;
};

/** Attach req.user when a valid token is present; never rejects. */
export async function authOptional(req, _res, next) {
  req.user = await userFromToken(bearer(req));
  next();
}

export async function requireAuth(req, _res, next) {
  req.user = await userFromToken(bearer(req));
  if (!req.user) return next(unauthorized());
  next();
}

export const requireRole = (...roles) => [
  requireAuth,
  (req, _res, next) => (roles.includes(req.user.role) ? next() : next(forbidden())),
];
