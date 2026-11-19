import path from 'node:path';
import fs from 'node:fs';
import mongoose from 'mongoose';
import { config, SERVER_ROOT } from './config.js';
import { log } from './utils/log.js';

let memoryServer = null;
export const dbInfo = { mode: 'none', uri: '' };

mongoose.set('strictQuery', true);

export async function connectDb() {
  try {
    await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: config.isProd ? 10000 : 2500 });
    dbInfo.mode = 'mongodb';
    dbInfo.uri = redact(config.mongoUri);
    log.info(`MongoDB connected (${dbInfo.uri})`);
    return;
  } catch (err) {
    if (!config.mongoMemoryFallback) {
      throw new Error(`Could not reach MongoDB at ${redact(config.mongoUri)}: ${err.message}`);
    }
    await mongoose.disconnect().catch(() => {});
  }

  // Zero-install fallback for local development: an embedded mongod that keeps
  // its data in server/.data so restarts do not lose anything.
  log.warn(`MongoDB not reachable at ${redact(config.mongoUri)}. Starting the embedded dev database instead.`);
  log.warn('First start downloads a MongoDB binary (about 100 MB). This happens once.');
  const { MongoMemoryServer } = await import('mongodb-memory-server-core');
  const opts = {};
  if (!config.isTest) {
    const dbPath = path.join(SERVER_ROOT, '.data', 'mongo');
    fs.mkdirSync(dbPath, { recursive: true });
    opts.instance = { dbPath, storageEngine: 'wiredTiger', dbName: 'homeroom' };
  }
  memoryServer = await MongoMemoryServer.create(opts);
  const uri = memoryServer.getUri('homeroom');
  await mongoose.connect(uri);
  dbInfo.mode = 'embedded';
  dbInfo.uri = uri;
  log.info(`Embedded MongoDB ready (${uri})`);
}

export async function disconnectDb() {
  await mongoose.disconnect().catch(() => {});
  if (memoryServer) await memoryServer.stop({ doCleanup: config.isTest }).catch(() => {});
  memoryServer = null;
}

function redact(uri) {
  return uri.replace(/\/\/([^:/]+):([^@]+)@/, '//$1:***@');
}
