import http from 'node:http';
import { Server as SocketServer } from 'socket.io';
import { config, assertConfig } from './config.js';
import { connectDb, disconnectDb, dbInfo } from './db.js';
import { createApp } from './app.js';
import { initQueue, startWorker, closeQueue, queueInfo } from './services/queue.js';
import { attachRealtime } from './realtime/rooms.js';
import { paymentProvider } from './services/payments.js';
import { User, Lesson } from './models/index.js';
import { log } from './utils/log.js';

async function main() {
  assertConfig();
  await connectDb();
  await initQueue();
  if (config.runWorkerInApi) await startWorker();

  // Jobs on the in-process queue do not survive a restart; flag them so the instructor can re-upload.
  if (queueInfo.driver === 'inline') {
    const stuck = await Lesson.updateMany(
      { 'video.status': { $in: ['queued', 'processing'] } },
      { $set: { 'video.status': 'failed', 'video.error': 'Processing was interrupted by a restart. Upload the video again.' } }
    );
    if (stuck.modifiedCount) log.warn(`${stuck.modifiedCount} interrupted video job(s) marked as failed.`);
  }

  if (config.autoSeed && (await User.estimatedDocumentCount()) === 0) {
    log.info('Empty database: loading demo content (set AUTO_SEED=false to skip)...');
    const { runSeed } = await import('./seed/seed.js');
    await runSeed();
  }

  const app = createApp();
  const server = http.createServer(app);
  const io = new SocketServer(server, { cors: { origin: [config.clientUrl, config.publicUrl], credentials: true }, maxHttpBufferSize: 1e6 });
  attachRealtime(io);

  server.listen(config.port, () => {
    log.info(`Homeroom API on ${config.publicUrl}  [db: ${dbInfo.mode} | queue: ${queueInfo.driver} | storage: ${config.storageDriver} | payments: ${paymentProvider()}]`);
    if (!config.isProd) log.info(`Open the app at ${config.clientUrl}`);
  });

  const shutdown = async (signal) => {
    log.info(`${signal} received, shutting down...`);
    io.close();
    server.close();
    await closeQueue();
    await disconnectDb();
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  log.error(err.message || err);
  process.exit(1);
});
