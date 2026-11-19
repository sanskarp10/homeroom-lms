/**
 * Demo data: accounts, a course catalog with real HLS video, quizzes,
 * enrollments, three months of sales, certificates and a live class timetable.
 *
 *   npm run seed            add demo data to an empty database
 *   npm run seed -- --reset wipe everything first
 */
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { config } from '../config.js';
import { connectDb, disconnectDb } from '../db.js';
import { User, Course, Lesson, Enrollment, Order, LiveClass, LiveMessage, Certificate, QuizAttempt } from '../models/index.js';
import { ffmpegBinary, transcodeToHls } from '../services/transcoder.js';
import { putDir, mediaRoot, tmpRoot } from '../services/storage.js';
import { recalcCourse } from '../services/courseStats.js';
import { issueCertificate } from '../services/progress.js';
import { splitAmount } from '../services/payments.js';
import { slugify } from '../utils/http.js';
import { log } from '../utils/log.js';
import { USERS, COURSES, LIVE, PASSWORD, FIRST_NAMES, LAST_NAMES } from './content.js';

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;

// Deterministic randomness so every seed produces the same demo.
function rng(seed) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Sample clips are generated with FFmpeg itself, so seeding works offline. */
const SAMPLES = [
  { id: 'seed-cells', seconds: 30, source: 'life=size=160x90:rate=12:ratio=0.12:mold=12:life_color=#F2B632:death_color=#1F3A33:mold_color=#3E6B5E,scale=1280:720:flags=neighbor' },
  { id: 'seed-fractal', seconds: 24, source: 'mandelbrot=size=1280x720:rate=24' },
  { id: 'seed-testcard', seconds: 20, source: 'testsrc2=size=1280x720:rate=30' },
];

function ffmpeg(args) {
  return new Promise(async (resolve, reject) => {
    const child = spawn(await ffmpegBinary(), args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    child.stderr.on('data', (d) => (err += d));
    child.on('error', reject);
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(err.trim().split('\n').pop() || `ffmpeg exited with ${code}`))));
  });
}

async function ensureSampleVideos() {
  const ready = [];
  for (const sample of SAMPLES) {
    const prefix = `videos/${sample.id}`;
    const local = config.storageDriver === 'local' && fs.existsSync(path.join(mediaRoot, prefix, 'master.m3u8'));
    try {
      let duration = sample.seconds;
      let renditions = [360, 720];
      if (!local) {
        log.info(`  preparing sample video ${sample.id} (${sample.seconds}s) with FFmpeg...`);
        const src = path.join(tmpRoot, `${sample.id}.mp4`);
        const out = path.join(tmpRoot, `hls-${sample.id}`);
        await ffmpeg([
          '-y', '-hide_banner', '-loglevel', 'error',
          '-f', 'lavfi', '-i', sample.source,
          '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo',
          '-t', String(sample.seconds), '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '96k', src,
        ]);
        const result = await transcodeToHls(src, out);
        await putDir(out, prefix);
        await fsp.rm(src, { force: true });
        await fsp.rm(out, { recursive: true, force: true });
        duration = Math.round(result.duration);
        renditions = result.renditions;
      }
      ready.push({ status: 'ready', progress: 100, hlsKey: `${prefix}/master.m3u8`, posterKey: `${prefix}/poster.jpg`, duration, renditions, originalName: `${sample.id}.mp4` });
    } catch (err) {
      log.warn(`  could not prepare ${sample.id}: ${err.message}`);
    }
  }
  if (!ready.length) log.warn('  FFmpeg is unavailable, so demo video lessons have no video. Upload your own from the course editor.');
  return ready;
}

export async function runSeed({ reset = false } = {}) {
  if (reset) {
    await Promise.all([User, Course, Lesson, Enrollment, Order, LiveClass, LiveMessage, Certificate, QuizAttempt].map((m) => m.deleteMany({})));
    log.info('  existing data removed');
  } else if (await User.exists({ email: USERS[0].email })) {
    log.info('  demo data already present (use --reset to rebuild it)');
    return;
  }
  const rand = rng(20261112);
  const pick = (list) => list[Math.floor(rand() * list.length)];
  const now = Date.now();

  /* Accounts */
  const hash = await (async () => { const u = new User(); await u.setPassword(PASSWORD); return u.passwordHash; })();
  const users = {};
  for (const u of USERS) {
    const { key, ...fields } = u;
    users[key] = await User.create({ ...fields, passwordHash: hash });
  }
  const crowd = await User.insertMany(
    Array.from({ length: 36 }, (_, i) => {
      const first = FIRST_NAMES[i % FIRST_NAMES.length];
      const last = LAST_NAMES[Math.floor(rand() * LAST_NAMES.length)];
      const createdAt = new Date(now - Math.floor(rand() * 150) * DAY);
      return { name: `${first} ${last}`, email: `${first}.${last}${i}@example.com`.toLowerCase(), role: 'student', passwordHash: hash, createdAt, updatedAt: createdAt };
    }),
    { timestamps: false }
  );
  log.info(`  ${USERS.length + crowd.length} accounts`);

  /* Courses and lessons */
  const videos = await ensureSampleVideos();
  const courses = {};
  let videoIndex = 0;
  for (const def of COURSES) {
    const publishedAt = new Date(now - (30 + Math.floor(rand() * 150)) * DAY);
    const course = await Course.create({
      title: def.title, slug: slugify(def.title), subtitle: def.subtitle, description: def.description, outcomes: def.outcomes,
      category: def.category, level: def.level, price: def.price, instructor: users[def.instructor]._id,
      status: def.draft ? 'draft' : 'published', publishedAt: def.draft ? undefined : publishedAt,
      sections: def.sections.map((s) => ({ title: s.title })),
    });
    const lessons = [];
    def.sections.forEach((section, si) => {
      section.lessons.forEach(([kind, title, body, preview], li) => {
        const base = { course: course._id, section: course.sections[si]._id, order: li, title };
        if (kind === 'v') {
          const video = videos.length ? videos[videoIndex++ % videos.length] : { status: 'none' };
          lessons.push({ ...base, type: 'video', content: body || '', isPreview: !!preview, video });
        } else if (kind === 'a') {
          lessons.push({ ...base, type: 'article', content: body });
        } else {
          lessons.push({
            ...base, type: 'quiz',
            quiz: {
              passingPercent: 70,
              questions: body.map(([prompt, options, correct, explanation]) => ({
                prompt, options, explanation, points: 1,
                correct: Array.isArray(correct) ? correct : [correct],
                type: Array.isArray(correct) ? 'multiple' : options.length === 2 ? 'boolean' : 'single',
              })),
            },
          });
        }
      });
    });
    course.$lessons = await Lesson.insertMany(lessons);
    await recalcCourse(course._id);
    courses[def.key] = course;
  }
  log.info(`  ${COURSES.length} courses, ${await Lesson.countDocuments()} lessons`);

  /* Enrollments, orders, certificates */
  const enroll = async (user, key, { daysAgo, fraction }) => {
    const course = courses[key];
    const at = new Date(now - daysAgo * DAY - Math.floor(rand() * DAY));
    let order;
    if (course.price > 0) {
      [order] = await Order.insertMany([{
        user: user._id, course: course._id, instructor: course.instructor, amount: course.price, ...splitAmount(course.price),
        currency: config.currency, provider: 'test', providerRef: `seed_${user._id}_${course._id}`, status: 'paid', paidAt: at, createdAt: at, updatedAt: at,
      }], { timestamps: false });
    }
    const all = course.$lessons;
    const doneCount = Math.round(all.length * fraction);
    const done = all.slice(0, doneCount);
    const completedAt = doneCount === all.length ? new Date(Math.min(now, at.getTime() + (3 + rand() * 20) * DAY)) : undefined;
    await Enrollment.insertMany([{
      user: user._id, course: course._id, order: order?._id, completedLessons: done.map((l) => l._id),
      lastLesson: (all[Math.min(doneCount, all.length - 1)] || all[0])?._id,
      progress: all.length ? Math.round((doneCount / all.length) * 100) : 0, completedAt,
      createdAt: at, updatedAt: completedAt || at,
    }], { timestamps: false });
    if (completedAt) await issueCertificate(user._id, course._id, completedAt);
  };

  const published = COURSES.filter((c) => !c.draft);
  for (const def of published) {
    const buyers = [...crowd].sort(() => rand() - 0.5).slice(0, Math.min(crowd.length, def.popularity));
    for (const buyer of buyers) {
      const r = rand();
      // Skew sales toward recent weeks so the revenue chart trends upward.
      await enroll(buyer, def.key, { daysAgo: Math.floor(Math.pow(rand(), 1.7) * 110), fraction: r < 0.22 ? 1 : r < 0.4 ? 0 : Math.round(rand() * 8) / 10 });
    }
  }
  await enroll(users.sam, 'git', { daysAgo: 40, fraction: 1 });
  await enroll(users.sam, 'react', { daysAgo: 12, fraction: 0.4 });
  await enroll(users.sam, 'stats', { daysAgo: 2, fraction: 0 });
  for (const def of COURSES) await recalcCourse(courses[def.key]._id);
  log.info(`  ${await Enrollment.countDocuments()} enrollments, ${await Order.countDocuments()} paid orders, ${await Certificate.countDocuments()} certificates`);

  /* Live classes */
  for (const def of LIVE) {
    const course = courses[def.course];
    // Round to the next half hour so the timetable reads naturally.
    const scheduledAt = new Date(Math.ceil((now + def.inHours * HOUR) / (30 * 60 * 1000)) * 30 * 60 * 1000);
    const liveClass = await LiveClass.create({
      course: course._id, instructor: course.instructor, title: def.title, description: def.description, scheduledAt, durationMin: def.duration,
      status: def.ended ? 'ended' : 'scheduled',
      ...(def.ended ? { startedAt: scheduledAt, endedAt: new Date(scheduledAt.getTime() + def.duration * 60000), peakAttendance: 14 } : {}),
    });
    for (const [who, text] of def.chat || []) {
      await LiveMessage.create({ liveClass: liveClass._id, user: users[who]._id, name: users[who].name, role: users[who].role === 'instructor' ? 'host' : 'student', text });
    }
  }
  log.info(`  ${LIVE.length} live classes`);

  log.info('');
  log.info('  Demo accounts (password for all: ' + PASSWORD + ')');
  log.info('    student     sam@homeroom.test');
  log.info('    instructor  maya@homeroom.test');
  log.info('    admin       admin@homeroom.test');
  log.info('');
}

// Run directly: node src/seed/seed.js [--reset]
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  (async () => {
    try {
      await connectDb();
      log.info('Seeding demo data...');
      await runSeed({ reset: process.argv.includes('--reset') });
      log.info('Seed complete.');
    } catch (err) {
      log.error(err);
      process.exitCode = 1;
    } finally {
      await disconnectDb();
      await mongoose.disconnect().catch(() => {});
    }
  })();
}
