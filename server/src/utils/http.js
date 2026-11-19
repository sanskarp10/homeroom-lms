export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}
export const badRequest = (m, d) => new HttpError(400, m, d);
export const unauthorized = (m = 'Sign in to continue.') => new HttpError(401, m);
export const forbidden = (m = 'You do not have access to this.') => new HttpError(403, m);
export const notFound = (m = 'Not found.') => new HttpError(404, m);

/** Wrap an async route so rejections reach the error middleware. */
export const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/** Validate req.body (or another part) with a zod schema. */
export const validate = (schema, part = 'body') => (req, _res, next) => {
  const result = schema.safeParse(req[part]);
  if (!result.success) {
    const details = result.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
    const first = details[0];
    return next(new HttpError(400, first.field ? `${first.field}: ${first.message}` : first.message, details));
  }
  if (part === 'query') req.validQuery = result.data;
  else req[part] = result.data;
  next();
};

export const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function slugify(text) {
  return String(text)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70) || 'course';
}
