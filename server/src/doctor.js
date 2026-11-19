/**
 * `npm run doctor` - checks every external dependency and says, in plain words,
 * what works, what is running on a local fallback, and what to fix.
 * Exit code 0 = nothing failed. Exit code 1 = at least one FAIL line.
 */
import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import { config, SERVER_ROOT } from './config.js';

const lines = [];
let failed = false;
const pass = (name, detail) => lines.push(`PASS  ${name.padEnd(12)} ${detail}`);
const warn = (name, detail) => lines.push(`WARN  ${name.padEnd(12)} ${detail}`);
const fail = (name, detail) => { failed = true; lines.push(`FAIL  ${name.padEnd(12)} ${detail}`); };

async function main() {
  // Node and env file
  const [major] = process.versions.node.split('.').map(Number);
  major >= 18 ? pass('node', `v${process.versions.node}`) : fail('node', `v${process.versions.node} is too old; install Node 20+`);
  fs.existsSync(path.join(SERVER_ROOT, '.env')) ? pass('env file', 'server/.env found') : warn('env file', 'server/.env missing; run `npm run setup`');
  if (!config.jwtSecret || config.jwtSecret === 'dev-only-secret-change-me') {
    (config.isProd ? fail : warn)('jwt', 'JWT_SECRET is not set; run `npm run setup` or set a long random value');
  } else pass('jwt', 'JWT_SECRET is set');

  // MongoDB
  try {
    await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 4000 });
    pass('mongodb', `connected to ${config.mongoUri.replace(/\/\/([^:/]+):([^@]+)@/, '//$1:***@')}`);
    await mongoose.disconnect();
  } catch (err) {
    const msg = `cannot reach MONGO_URI (${err.message.split('\n')[0]})`;
    config.mongoMemoryFallback && !config.isProd
      ? warn('mongodb', `${msg}. Development will use the embedded database. For production set MONGO_URI (SETUP_GUIDE.md step 3).`)
      : fail('mongodb', `${msg}. See SETUP_GUIDE.md step 3.`);
  }

  // Redis / BullMQ
  if (config.queueDriver === 'inline') warn('redis', 'QUEUE_DRIVER=inline: video jobs run inside the API process, without BullMQ');
  else {
    try {
      const { default: IORedis } = await import('ioredis');
      const redis = new IORedis(config.redisUrl, { lazyConnect: true, maxRetriesPerRequest: 0, connectTimeout: 3000, retryStrategy: () => null });
      redis.on('error', () => {});
      await redis.connect();
      await redis.ping();
      redis.disconnect();
      pass('redis', `connected to ${config.redisUrl.replace(/\/\/([^:/]*):([^@]+)@/, '//$1:***@')} (BullMQ queue active)`);
    } catch (err) {
      const msg = `cannot reach REDIS_URL (${err.message || 'connection refused'})`;
      config.queueDriver === 'auto' && !config.isProd
        ? warn('redis', `${msg}. Development will process videos in-process. For BullMQ start Redis (SETUP_GUIDE.md step 4).`)
        : fail('redis', `${msg}. See SETUP_GUIDE.md step 4.`);
    }
  }

  // FFmpeg
  const { ffmpegVersion } = await import('./services/transcoder.js');
  const ff = await ffmpegVersion();
  ff.ok ? pass('ffmpeg', `using ${ff.path}`) : fail('ffmpeg', `${ff.error || 'not runnable'}. Install FFmpeg and set FFMPEG_PATH (SETUP_GUIDE.md step 5).`);

  // Storage
  if (config.storageDriver === 'local') {
    warn('storage', 'local disk (server/storage). Fine for development; set the AWS_* / S3_BUCKET / CLOUDFRONT_DOMAIN values for S3 + CloudFront (SETUP_GUIDE.md step 6).');
  } else {
    const { putFile, removePrefix, urlFor, tmpRoot } = await import('./services/storage.js');
    const key = `healthchecks/doctor-${Date.now()}.txt`;
    const tmp = path.join(tmpRoot, 'doctor.txt');
    fs.writeFileSync(tmp, 'homeroom');
    try {
      await putFile(tmp, key);
      pass('s3', `wrote an object to bucket ${config.aws.bucket}`);
      try {
        const res = await fetch(urlFor(key));
        res.ok ? pass('cloudfront', `${config.aws.cloudfrontDomain} served the object`) : fail('cloudfront', `${urlFor(key)} answered HTTP ${res.status}. Check the distribution origin and the bucket policy (SETUP_GUIDE.md step 6).`);
      } catch (err) {
        fail('cloudfront', `could not fetch ${urlFor(key)}: ${err.message}`);
      }
      await removePrefix(key).catch(() => {});
    } catch (err) {
      fail('s3', `could not write to bucket ${config.aws.bucket}: ${err.name} ${err.message}. Check the keys, region and IAM policy (SETUP_GUIDE.md step 6).`);
    } finally {
      fs.rmSync(tmp, { force: true });
    }
  }

  // Stripe
  if (!config.stripeSecretKey) warn('payments', 'built-in test gateway (card 4242 4242 4242 4242). Set STRIPE_SECRET_KEY for Stripe Checkout (SETUP_GUIDE.md step 7).');
  else {
    try {
      const { default: Stripe } = await import('stripe');
      await new Stripe(config.stripeSecretKey).balance.retrieve();
      pass('stripe', `key accepted (${config.stripeSecretKey.startsWith('sk_test_') ? 'test mode' : 'LIVE mode: real money will move'})`);
      config.stripeWebhookSecret ? pass('stripe hook', 'STRIPE_WEBHOOK_SECRET is set') : warn('stripe hook', 'STRIPE_WEBHOOK_SECRET not set. Payments still confirm on the success page; add the webhook for reliability.');
    } catch (err) {
      fail('stripe', `Stripe rejected STRIPE_SECRET_KEY: ${err.message}`);
    }
  }

  // WebRTC
  config.turn.url
    ? pass('turn', `TURN server configured (${config.turn.url})`)
    : warn('turn', 'no TURN server. Live classes work on most networks through STUN; strict corporate or mobile networks need TURN (SETUP_GUIDE.md step 8).');

  // URLs
  if (config.isProd && /localhost|127\.0\.0\.1/.test(`${config.clientUrl}${config.publicUrl}`)) {
    fail('urls', 'CLIENT_URL / PUBLIC_URL still point at localhost in production');
  } else pass('urls', `CLIENT_URL=${config.clientUrl}  PUBLIC_URL=${config.publicUrl}`);

  console.log('\nHomeroom doctor\n---------------');
  console.log(lines.join('\n'));
  console.log(failed ? '\nResult: FIX THE FAIL LINES ABOVE.\n' : '\nResult: OK. WARN lines are local fallbacks; they are fine for development.\n');
  process.exit(failed ? 1 : 0);
}

main().catch((err) => { console.error(err); process.exit(1); });
