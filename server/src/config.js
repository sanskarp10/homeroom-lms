import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const SERVER_ROOT = path.resolve(__dirname, '..');
export const REPO_ROOT = path.resolve(SERVER_ROOT, '..');

dotenv.config({ path: path.join(SERVER_ROOT, '.env'), quiet: true });

/**
 * Read an env var. Empty values and untouched placeholders (anything that
 * starts with REPLACE_ME) count as "not set", so the app can boot with the
 * shipped .env and fall back to its local drivers.
 */
function env(name, fallback = undefined) {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  const value = String(raw).trim();
  if (!value || value.startsWith('REPLACE_ME')) return fallback;
  return value;
}
const bool = (name, fallback) => {
  const v = env(name);
  return v === undefined ? fallback : ['1', 'true', 'yes', 'on'].includes(v.toLowerCase());
};
const num = (name, fallback) => {
  const v = Number(env(name));
  return Number.isFinite(v) && env(name) !== undefined ? v : fallback;
};

const nodeEnv = env('NODE_ENV', 'development');
const isProd = nodeEnv === 'production';
const isTest = nodeEnv === 'test';
const port = num('PORT', 4000);

const aws = {
  region: env('AWS_REGION'),
  accessKeyId: env('AWS_ACCESS_KEY_ID'),
  secretAccessKey: env('AWS_SECRET_ACCESS_KEY'),
  bucket: env('S3_BUCKET'),
  cloudfrontDomain: (env('CLOUDFRONT_DOMAIN') || '').replace(/^https?:\/\//, '').replace(/\/+$/, '') || undefined,
};
const s3Ready = Boolean(aws.region && aws.bucket && aws.cloudfrontDomain);
const requestedStorage = env('STORAGE_DRIVER', 'auto');

export const config = {
  nodeEnv,
  isProd,
  isTest,
  port,
  clientUrl: env('CLIENT_URL', 'http://localhost:5173').replace(/\/+$/, ''),
  publicUrl: env('PUBLIC_URL', `http://localhost:${port}`).replace(/\/+$/, ''),

  mongoUri: env('MONGO_URI', 'mongodb://127.0.0.1:27017/homeroom'),
  mongoMemoryFallback: bool('MONGO_MEMORY_FALLBACK', !isProd),
  autoSeed: bool('AUTO_SEED', !isProd && !isTest),

  jwtSecret: env('JWT_SECRET', isProd ? undefined : 'dev-only-secret-change-me'),
  jwtExpiresIn: env('JWT_EXPIRES_IN', '7d'),

  redisUrl: env('REDIS_URL', 'redis://127.0.0.1:6379'),
  queueDriver: env('QUEUE_DRIVER', 'auto'), // auto | bullmq | inline
  runWorkerInApi: bool('RUN_WORKER_IN_API', true),
  transcodeConcurrency: num('TRANSCODE_CONCURRENCY', 1),

  storageDriver: requestedStorage === 'auto' ? (s3Ready ? 's3' : 'local') : requestedStorage,
  aws,
  s3Ready,
  storageRoot: path.resolve(SERVER_ROOT, env('STORAGE_DIR', 'storage')),
  maxUploadMb: num('MAX_UPLOAD_MB', 1024),

  ffmpegPath: env('FFMPEG_PATH'),
  ffmpegPreset: env('FFMPEG_PRESET', 'veryfast'),

  stripeSecretKey: env('STRIPE_SECRET_KEY'),
  stripeWebhookSecret: env('STRIPE_WEBHOOK_SECRET'),
  platformFeePercent: num('PLATFORM_FEE_PERCENT', 20),
  currency: env('CURRENCY', 'usd').toLowerCase(),

  stunUrls: env('STUN_URLS', 'stun:stun.l.google.com:19302').split(',').map((s) => s.trim()).filter(Boolean),
  turn: { url: env('TURN_URL'), username: env('TURN_USERNAME'), credential: env('TURN_CREDENTIAL') },
};

export function assertConfig() {
  const problems = [];
  if (!config.jwtSecret) problems.push('JWT_SECRET is required in production.');
  if (config.storageDriver === 's3' && !config.s3Ready) {
    problems.push('STORAGE_DRIVER=s3 needs AWS_REGION, S3_BUCKET and CLOUDFRONT_DOMAIN.');
  }
  if (problems.length) {
    throw new Error(`Invalid configuration:\n - ${problems.join('\n - ')}\nSee SETUP_GUIDE.md.`);
  }
}

export function iceServers() {
  const servers = [];
  if (config.stunUrls.length) servers.push({ urls: config.stunUrls });
  if (config.turn.url) {
    servers.push({ urls: config.turn.url.split(',').map((s) => s.trim()), username: config.turn.username, credential: config.turn.credential });
  }
  return servers;
}
