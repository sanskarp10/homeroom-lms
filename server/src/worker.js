/**
 * Standalone video worker: `npm run worker`.
 * Use it when RUN_WORKER_IN_API=false so transcoding runs on its own machine.
 * Needs the same .env as the API (MongoDB, Redis and storage settings).
 */
import { config, assertConfig } from './config.js';
import { connectDb, disconnectDb } from './db.js';
import { initQueue, startWorker, closeQueue, queueInfo } from './services/queue.js';
import { log } from './utils/log.js';

async function main() {
  assertConfig();
  if (config.queueDriver === 'inline') throw new Error('A separate worker needs Redis. Set QUEUE_DRIVER=bullmq (or auto) and REDIS_URL.');
  await connectDb();
  await initQueue();
  if (queueInfo.driver !== 'bullmq') throw new Error(`Redis is not reachable at ${config.redisUrl}.`);
  await startWorker();
  const shutdown = async () => {
    await closeQueue();
    await disconnectDb();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  log.error(err.message || err);
  process.exit(1);
});
