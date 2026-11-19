#!/usr/bin/env node
/**
 * First-run setup. Safe to run any number of times.
 *  - creates server/.env from server/.env.example (never overwrites an existing file)
 *  - replaces the JWT_SECRET placeholder with a random secret
 *  - creates client/.env from client/.env.example
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const quiet = process.env.npm_lifecycle_event === 'predev';
const say = (msg) => console.log(`[setup] ${msg}`);

function ensureEnv(dir) {
  const example = path.join(root, dir, '.env.example');
  const target = path.join(root, dir, '.env');
  if (fs.existsSync(target)) {
    if (!quiet) say(`${dir}/.env already exists, left untouched`);
    return target;
  }
  fs.copyFileSync(example, target);
  say(`created ${dir}/.env from ${dir}/.env.example`);
  return target;
}

const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 18 || (major === 18 && minor < 18)) {
  console.error(`[setup] Node ${process.versions.node} is too old. Install Node 20 or newer (https://nodejs.org).`);
  process.exit(1);
}

const serverEnv = ensureEnv('server');
ensureEnv('client');

let text = fs.readFileSync(serverEnv, 'utf8');
if (/^JWT_SECRET=(REPLACE_ME.*)?$/m.test(text)) {
  text = text.replace(/^JWT_SECRET=.*$/m, `JWT_SECRET=${crypto.randomBytes(48).toString('hex')}`);
  fs.writeFileSync(serverEnv, text);
  say('generated a random JWT_SECRET in server/.env');
}
if (!quiet) say('done. Next: npm run dev   (then open http://localhost:5173)');
