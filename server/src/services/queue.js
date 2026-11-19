/**
 * Background jobs. BullMQ on Redis is the real driver; when Redis is not
 * reachable in development the same processor runs on a tiny in-process
 * queue so video uploads still work on a fresh laptop.
 */
import { config } from '../config.js';
import { log } from '../utils/log.js';

export const QUEUE_NAME = 'video-transcode';
export const queueInfo = { driver: 'none', worker: false };

let queue = null;
let worker = null;
let connection = null;
let inlineChain = Promise.resolve();
let processor = null;

async function redisReachable() {
  const { default: IORedis } = await import('ioredis');
  const probe = new IORedis(config.redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: 0,
    connectTimeout: 1500,
    retryStrategy: () => null,
    enableOfflineQueue: false,
  });
  probe.on('error', () => {});
  try {
    await probe.connect();
    await probe.ping();
    return true;
  } catch {
    return false;
  } finally {
    probe.disconnect();
  }
}

async function newConnection() {
  const { default: IORedis } = await import('ioredis');
  const conn = new IORedis(config.redisUrl, { maxRetriesPerRequest: null });
  conn.on('error', (err) => log.error('Redis:', err.message));
  return conn;
}

export async function initQueue() {
  let driver = config.queueDriver;
  if (driver === 'auto') {
    driver = (await redisReachable()) ? 'bullmq' : 'inline';
    if (driver === 'inline') {
      if (config.isProd) throw new Error(`Redis is not reachable at REDIS_URL. Fix it or set QUEUE_DRIVER=inline.`);
      log.warn('Redis not reachable. Video jobs will run in-process (QUEUE_DRIVER=inline).');
    }
  }
  if (driver === 'bullmq') {
    const { Queue } = await import('bullmq');
    connection = await newConnection();
    queue = new Queue(QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { count: 200 },
        removeOnFail: { count: 500 },
      },
    });
  }
  queueInfo.driver = driver;
  return driver;
}

/** Start consuming jobs in this process. */
export async function startWorker() {
  const { processTranscode } = await import('../jobs/transcodeJob.js');
  processor = processTranscode;
  if (queueInfo.driver === 'bullmq') {
    const { Worker } = await import('bullmq');
    worker = new Worker(QUEUE_NAME, (job) => processTranscode(job.data, (p) => job.updateProgress(p)), {
      connection: await newConnection(),
      concurrency: config.transcodeConcurrency,
      lockDuration: 10 * 60 * 1000,
    });
    worker.on('failed', (job, err) => log.error(`Transcode job ${job?.id} failed: ${err.message}`));
    worker.on('completed', (job) => log.info(`Transcode job ${job.id} finished`));
  }
  queueInfo.worker = true;
  log.info(`Video worker ready (${queueInfo.driver})`);
}

export async function enqueueTranscode(data) {
  if (queueInfo.driver === 'bullmq') {
    const job = await queue.add('transcode', data);
    return job.id;
  }
  if (!processor) processor = (await import('../jobs/transcodeJob.js')).processTranscode;
  inlineChain = inlineChain.then(() => processor(data).catch((err) => log.error(`Transcode failed: ${err.message}`)));
  return `inline-${Date.now()}`;
}

/** Resolves when the in-process queue is empty (used by the seed script and tests). */
export const inlineIdle = () => inlineChain;

export async function queueCounts() {
  if (queueInfo.driver !== 'bullmq') return null;
  return queue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed');
}

export async function closeQueue() {
  await worker?.close().catch(() => {});
  await queue?.close().catch(() => {});
  connection?.disconnect();
  worker = queue = connection = null;
}
