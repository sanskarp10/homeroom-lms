import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import multer from 'multer';
import { config, REPO_ROOT } from './config.js';
import { HttpError } from './utils/http.js';
import { log } from './utils/log.js';
import { mediaRoot, contentTypeFor } from './services/storage.js';
import { dbInfo } from './db.js';
import { queueInfo } from './services/queue.js';
import { paymentProvider } from './services/payments.js';
import { ffmpegVersion } from './services/transcoder.js';
import authRoutes from './routes/auth.js';
import courseRoutes from './routes/courses.js';
import manageRoutes from './routes/manage.js';
import learnRoutes from './routes/learn.js';
import paymentRoutes, { stripeWebhook } from './routes/payments.js';
import instructorRoutes from './routes/instructor.js';
import adminRoutes from './routes/admin.js';
import liveRoutes from './routes/live.js';
import certificateRoutes from './routes/certificates.js';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  const cdn = config.aws.cloudfrontDomain ? [`https://${config.aws.cloudfrontDomain}`] : [];
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'blob:', ...cdn],
          mediaSrc: ["'self'", 'blob:', ...cdn],
          connectSrc: ["'self'", 'ws:', 'wss:', ...cdn],
          workerSrc: ["'self'", 'blob:'],
          fontSrc: ["'self'", 'data:'],
          frameSrc: ["'self'"],
          objectSrc: ["'none'"],
          upgradeInsecureRequests: null,
        },
      },
    })
  );
  app.use(cors({ origin: [config.clientUrl, config.publicUrl], credentials: true }));
  if (!config.isTest) app.use(morgan(config.isProd ? 'combined' : 'dev', { skip: (req) => req.url.startsWith('/media/') }));

  // Stripe needs the raw request body, so its webhook is mounted before express.json().
  app.post('/api/payments/webhook', ...stripeWebhook);
  app.use(express.json({ limit: '2mb' }));

  // Locally stored media (HLS playlists, segments, posters, thumbnails). With the s3 driver CloudFront serves these instead.
  app.use(
    '/media',
    express.static(mediaRoot, {
      maxAge: '365d',
      immutable: true,
      index: false,
      setHeaders: (res, file) => {
        res.setHeader('Content-Type', contentTypeFor(file));
        res.setHeader('Access-Control-Allow-Origin', '*');
      },
    })
  );

  app.get('/api/health', async (_req, res) => {
    const ffmpeg = await ffmpegVersion();
    res.json({
      ok: dbInfo.mode !== 'none',
      env: config.nodeEnv,
      database: dbInfo.mode,
      queue: queueInfo.driver,
      worker: queueInfo.worker ? 'in this process' : 'separate process (npm run worker)',
      storage: config.storageDriver,
      cdn: config.storageDriver === 's3' ? config.aws.cloudfrontDomain : 'local /media',
      payments: paymentProvider(),
      ffmpeg: ffmpeg.ok,
      turn: !!config.turn.url,
      time: new Date().toISOString(),
    });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/courses', courseRoutes);
  app.use('/api/manage', manageRoutes);
  app.use('/api/learn', learnRoutes);
  app.use('/api/payments', paymentRoutes);
  app.use('/api/instructor', instructorRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/live', liveRoutes);
  app.use('/api/certificates', certificateRoutes);
  app.use('/api', (_req, _res, next) => next(new HttpError(404, 'This API route does not exist.')));

  // In production the API also serves the built React app.
  const dist = path.join(REPO_ROOT, 'client', 'dist');
  if (fs.existsSync(path.join(dist, 'index.html'))) {
    app.use(express.static(dist, { index: false, maxAge: '1h', setHeaders: (res, file) => {
      if (file.includes(`${path.sep}assets${path.sep}`)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    } }));
    app.get(/^(?!\/(api|media|socket\.io)\/).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  }

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err instanceof multer.MulterError) {
      const message = err.code === 'LIMIT_FILE_SIZE' ? `That file is too large. The limit is ${config.maxUploadMb} MB for video and 5 MB for images.` : err.message;
      return res.status(400).json({ error: message });
    }
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message, details: err.details });
    if (err?.name === 'ValidationError') return res.status(400).json({ error: Object.values(err.errors)[0]?.message || 'Invalid data.' });
    if (err?.name === 'CastError') return res.status(404).json({ error: 'Not found.' });
    if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'The request body is not valid JSON.' });
    log.error(err);
    res.status(500).json({ error: 'Something went wrong on the server. Try again.' });
  });

  return app;
}
