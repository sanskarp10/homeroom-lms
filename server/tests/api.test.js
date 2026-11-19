/**
 * End-to-end API tests. They run the real Express app against a real MongoDB
 * (TEST_MONGO_URI, or an embedded one) and the real FFmpeg pipeline.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import request from 'supertest';
import mongoose from 'mongoose';
import { Server as SocketServer } from 'socket.io';
import { io as ioClient } from 'socket.io-client';

let app, api, server, port, models, queue, storage, transcoder;
const state = {};
const auth = (token) => ({ Authorization: `Bearer ${token}` });
const timings = {};

async function register(name, email, role) {
  const res = await api.post('/api/auth/register').send({ name, email, password: 'password123', role });
  expect(res.status).toBe(201);
  return res.body;
}

beforeAll(async () => {
  const { connectDb } = await import('../src/db.js');
  await connectDb();
  await mongoose.connection.dropDatabase();
  models = await import('../src/models/index.js');
  queue = await import('../src/services/queue.js');
  storage = await import('../src/services/storage.js');
  transcoder = await import('../src/services/transcoder.js');
  await queue.initQueue();
  await queue.startWorker();
  const { createApp } = await import('../src/app.js');
  const { attachRealtime } = await import('../src/realtime/rooms.js');
  app = createApp();
  server = http.createServer(app);
  attachRealtime(new SocketServer(server));
  await new Promise((r) => server.listen(0, r));
  port = server.address().port;
  api = request(app);

  state.instructor = await register('Ivy Instructor', 'ivy@test.dev', 'instructor');
  state.other = await register('Otto Other', 'otto@test.dev', 'instructor');
  state.student = await register('Stu Student', 'stu@test.dev', 'student');
  state.outsider = await register('Olga Outsider', 'olga@test.dev', 'student');
  const admin = new models.User({ name: 'Ada Admin', email: 'ada@test.dev', role: 'admin' });
  await admin.setPassword('password123');
  await admin.save();
  state.admin = (await api.post('/api/auth/login').send({ email: 'ada@test.dev', password: 'password123' })).body;
});

afterAll(async () => {
  await new Promise((r) => server.close(r));
  await queue.closeQueue();
  await mongoose.connection.dropDatabase();
  const { disconnectDb } = await import('../src/db.js');
  await disconnectDb();
  await fsp.rm(path.resolve('storage-test'), { recursive: true, force: true });
  if (process.env.PRINT_TIMINGS) console.log('TIMINGS ' + JSON.stringify(timings));
});

describe('health and auth', () => {
  it('reports its drivers', async () => {
    const res = await api.get('/api/health');
    expect(res.body).toMatchObject({ ok: true, queue: 'inline', storage: 'local', payments: 'test', ffmpeg: true });
  });
  it('rejects duplicate emails and weak passwords', async () => {
    expect((await api.post('/api/auth/register').send({ name: 'X Y', email: 'stu@test.dev', password: 'password123' })).status).toBe(400);
    const weak = await api.post('/api/auth/register').send({ name: 'X Y', email: 'new@test.dev', password: 'short' });
    expect(weak.status).toBe(400);
    expect(weak.body.error).toMatch(/8 characters/);
  });
  it('cannot self-register as admin', async () => {
    const res = await api.post('/api/auth/register').send({ name: 'Evil', email: 'evil@test.dev', password: 'password123', role: 'admin' });
    expect(res.status).toBe(400);
  });
  it('logs in and returns the profile, and rejects bad credentials', async () => {
    const ok = await api.post('/api/auth/login').send({ email: 'STU@test.dev', password: 'password123' });
    expect(ok.status).toBe(200);
    expect(ok.body.user).toMatchObject({ role: 'student', email: 'stu@test.dev' });
    expect(ok.body.user.passwordHash).toBeUndefined();
    expect((await api.post('/api/auth/login').send({ email: 'stu@test.dev', password: 'nope' })).status).toBe(401);
    expect((await api.get('/api/auth/me')).status).toBe(401);
    expect((await api.get('/api/auth/me').set(auth(state.student.token))).body.user.name).toBe('Stu Student');
  });
});

describe('course builder (instructor)', () => {
  it('blocks students from creating courses', async () => {
    const res = await api.post('/api/manage/courses').set(auth(state.student.token)).send({ title: 'Nope course' });
    expect(res.status).toBe(403);
  });

  it('creates a course with a section, an article, a quiz and a video lesson', async () => {
    const created = await api.post('/api/manage/courses').set(auth(state.instructor.token)).send({
      title: 'Testing in practice', subtitle: 'A course used by the test suite', category: 'Web Development', level: 'beginner', price: 4900,
      description: 'A long enough description so that the publish checks are satisfied by this course.',
    });
    expect(created.status).toBe(201);
    state.course = created.body.course;
    expect(state.course).toMatchObject({ slug: 'testing-in-practice', status: 'draft', price: 4900 });

    const manage = await api.get(`/api/manage/courses/${state.course.id}`).set(auth(state.instructor.token));
    state.sectionId = manage.body.curriculum[0].id;

    const mk = (title, type) => api.post(`/api/manage/courses/${state.course.id}/lessons`).set(auth(state.instructor.token)).send({ sectionId: state.sectionId, title, type });
    state.video = (await mk('Watch this', 'video')).body.lesson;
    state.article = (await mk('Read this', 'article')).body.lesson;
    state.quiz = (await mk('Prove it', 'quiz')).body.lesson;

    await api.patch(`/api/manage/lessons/${state.video.id}`).set(auth(state.instructor.token)).send({ isPreview: true }).expect(200);
    await api.patch(`/api/manage/lessons/${state.article.id}`).set(auth(state.instructor.token)).send({ content: '## Hello\n\nSome words.' }).expect(200);
    const quiz = await api.patch(`/api/manage/lessons/${state.quiz.id}`).set(auth(state.instructor.token)).send({
      quiz: {
        passingPercent: 70,
        questions: [
          { prompt: '2 + 2?', type: 'single', options: ['3', '4', '5'], correct: [1], points: 1, explanation: 'Basic sums.' },
          { prompt: 'The sky is blue.', type: 'boolean', options: ['True', 'False'], correct: [0], points: 1 },
          { prompt: 'Pick the even numbers.', type: 'multiple', options: ['1', '2', '3', '4'], correct: [1, 3], points: 2 },
        ],
      },
    });
    expect(quiz.status).toBe(200);
    state.questions = quiz.body.lesson.quiz.questions;
    expect(state.questions).toHaveLength(3);
  });

  it('validates quiz questions', async () => {
    const res = await api.patch(`/api/manage/lessons/${state.quiz.id}`).set(auth(state.instructor.token)).send({
      quiz: { passingPercent: 70, questions: [{ prompt: 'Bad', type: 'single', options: ['a', 'b'], correct: [5], points: 1 }] },
    });
    expect(res.status).toBe(400);
  });

  it('stops another instructor from editing the course', async () => {
    const res = await api.patch(`/api/manage/courses/${state.course.id}`).set(auth(state.other.token)).send({ title: 'Hijacked title' });
    expect(res.status).toBe(403);
  });

  it('refuses to publish while the video lesson has no video', async () => {
    const res = await api.post(`/api/manage/courses/${state.course.id}/publish`).set(auth(state.instructor.token)).send({ published: true });
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body.details)).toMatch(/no finished video/);
  });

  it('rejects non-video uploads', async () => {
    const res = await api.post(`/api/manage/lessons/${state.video.id}/video`).set(auth(state.instructor.token))
      .attach('video', Buffer.from('hello'), 'notes.txt');
    expect(res.status).toBe(400);
  });

  it('transcodes an uploaded video to adaptive HLS in a background job', async () => {
    // Make a real 6 second 720p clip with FFmpeg's built-in test source.
    const src = path.join(storage.tmpRoot, 'fixture.mp4');
    const bin = await transcoder.ffmpegBinary();
    const made = spawnSync(bin, ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=1280x720:rate=24', '-f', 'lavfi', '-i', 'sine=frequency=440',
      '-t', '6', '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-c:a', 'aac', src]);
    expect(made.status).toBe(0);
    timings.fixtureBytes = fs.statSync(src).size;

    const started = Date.now();
    const up = await api.post(`/api/manage/lessons/${state.video.id}/video`).set(auth(state.instructor.token)).attach('video', src);
    timings.uploadResponseMs = Date.now() - started;
    expect(up.status).toBe(202);
    expect(['queued', 'processing']).toContain(up.body.lesson.video.status);

    await queue.inlineIdle();
    timings.transcodeMs = Date.now() - started;

    const after = await api.get(`/api/manage/lessons/${state.video.id}`).set(auth(state.instructor.token));
    const video = after.body.lesson.video;
    expect(video).toMatchObject({ status: 'ready', progress: 100, renditions: [360, 720] });
    expect(video.duration).toBeGreaterThanOrEqual(5);
    expect(video.url).toMatch(/^\/media\/videos\/.+\/master\.m3u8$/);
    state.videoUrl = video.url;

    const master = await api.get(video.url);
    expect(master.status).toBe(200);
    expect(master.headers['content-type']).toMatch(/mpegurl/);
    expect(master.text).toMatch(/RESOLUTION=640x360/);
    expect(master.text).toMatch(/RESOLUTION=1280x720/);
    const variant = await api.get(video.url.replace('master.m3u8', 'v360/index.m3u8'));
    expect(variant.text).toMatch(/#EXT-X-ENDLIST/);
    const segment = variant.text.split('\n').find((l) => l.endsWith('.ts'));
    const seg = await api.get(video.url.replace('master.m3u8', `v360/${segment}`));
    expect(seg.status).toBe(200);
    expect(seg.headers['content-type']).toMatch(/mp2t/);
    expect((await api.get(video.posterUrl)).status).toBe(200);
    // the uploaded source and the FFmpeg work folder are cleaned up afterwards
    expect(fs.readdirSync(storage.tmpRoot).filter((f) => f.startsWith('upload-') || f.startsWith('hls-'))).toEqual([]);
  });

  it('publishes once everything is ready and appears in the catalog', async () => {
    const res = await api.post(`/api/manage/courses/${state.course.id}/publish`).set(auth(state.instructor.token)).send({ published: true });
    expect(res.status).toBe(200);
    expect(res.body.course).toMatchObject({ status: 'published', lessonCount: 3 });
    const list = await api.get('/api/courses?q=testing');
    expect(list.body.items.map((c) => c.slug)).toContain('testing-in-practice');
    const paid = await api.get('/api/courses?price=free');
    expect(paid.body.items).toHaveLength(0);
  });

  it('reorders lessons', async () => {
    const order = [state.quiz.id, state.article.id, state.video.id];
    await api.put(`/api/manage/courses/${state.course.id}/order`).set(auth(state.instructor.token)).send({ sections: [{ id: state.sectionId, lessons: order }] }).expect(200);
    const detail = await api.get('/api/courses/testing-in-practice');
    expect(detail.body.curriculum[0].lessons.map((l) => l.id)).toEqual(order);
    await api.put(`/api/manage/courses/${state.course.id}/order`).set(auth(state.instructor.token))
      .send({ sections: [{ id: state.sectionId, lessons: [state.video.id, state.article.id, state.quiz.id] }] }).expect(200);
  });
});

describe('access control for learners', () => {
  it('shows the outline but never quiz answers on the public page', async () => {
    const res = await api.get('/api/courses/testing-in-practice');
    expect(res.status).toBe(200);
    expect(res.body.access).toMatchObject({ enrolled: false, manage: false });
    expect(JSON.stringify(res.body)).not.toMatch(/"correct"/);
  });
  it('lets anyone watch a preview lesson, signed in or not', async () => {
    const res = await api.get(`/api/learn/lessons/${state.video.id}`);
    expect(res.status).toBe(200);
    expect(res.body.lesson.video.url).toBe(state.videoUrl);
  });
  it('locks other lessons until the student enrolls', async () => {
    expect((await api.get(`/api/learn/lessons/${state.article.id}`)).status).toBe(403);
    expect((await api.get(`/api/learn/lessons/${state.article.id}`).set(auth(state.student.token))).status).toBe(403);
    expect((await api.get(`/api/learn/courses/${state.course.id}`).set(auth(state.student.token))).status).toBe(403);
  });
  it('does not allow free enrollment into a paid course', async () => {
    const res = await api.post('/api/learn/enrollments').set(auth(state.student.token)).send({ courseId: state.course.id });
    expect(res.status).toBe(400);
  });
});

describe('payments (test mode)', () => {
  it('creates an order, declines a bad card, then accepts the test card', async () => {
    const checkout = await api.post('/api/payments/checkout').set(auth(state.student.token)).send({ courseId: state.course.id });
    expect(checkout.body).toMatchObject({ provider: 'test' });
    state.orderId = checkout.body.orderId;

    const card = { name: 'Stu Student', expiry: '12/40', cvc: '123' };
    const declined = await api.post(`/api/payments/test/${state.orderId}/pay`).set(auth(state.student.token)).send({ ...card, cardNumber: '4000 0000 0000 0002' });
    expect(declined.status).toBe(402);
    const expired = await api.post(`/api/payments/test/${state.orderId}/pay`).set(auth(state.student.token)).send({ ...card, expiry: '01/20', cardNumber: '4242 4242 4242 4242' });
    expect(expired.status).toBe(400);
    const stolen = await api.post(`/api/payments/test/${state.orderId}/pay`).set(auth(state.outsider.token)).send({ ...card, cardNumber: '4242 4242 4242 4242' });
    expect(stolen.status).toBe(403);

    const paid = await api.post(`/api/payments/test/${state.orderId}/pay`).set(auth(state.student.token)).send({ ...card, cardNumber: '4242 4242 4242 4242' });
    expect(paid.body).toMatchObject({ status: 'paid', courseId: state.course.id });
  });

  it('records the 80/20 split and enrolls the buyer exactly once', async () => {
    const order = await models.Order.findById(state.orderId);
    expect(order).toMatchObject({ status: 'paid', amount: 4900, platformFee: 980, instructorNet: 3920 });
    await api.post(`/api/payments/test/${state.orderId}/pay`).set(auth(state.student.token)).send({ name: 'S', expiry: '12/40', cvc: '123', cardNumber: '4242424242424242' }).expect(200);
    expect(await models.Enrollment.countDocuments({ course: state.course.id })).toBe(1);
    const again = await api.post('/api/payments/checkout').set(auth(state.student.token)).send({ courseId: state.course.id });
    expect(again.body).toEqual({ enrolled: true });
    const detail = await api.get('/api/courses/testing-in-practice').set(auth(state.student.token));
    expect(detail.body.access.enrolled).toBe(true);
    expect(detail.body.course.enrollmentCount).toBe(1);
  });

  it('shows the sale on the instructor revenue dashboard', async () => {
    const res = await api.get('/api/instructor/dashboard?days=30').set(auth(state.instructor.token));
    expect(res.body.lifetime).toMatchObject({ gross: 4900, net: 3920, fees: 980, sales: 1 });
    expect(res.body.series).toHaveLength(30);
    expect(res.body.series.at(-1)).toMatchObject({ net: 3920, sales: 1 });
    expect(res.body.courses[0]).toMatchObject({ title: 'Testing in practice', students: 1, net: 3920 });
    expect(res.body.recent[0].student.name).toBe('Stu Student');
    const other = await api.get('/api/instructor/dashboard').set(auth(state.other.token));
    expect(other.body.lifetime.gross).toBe(0);
    expect((await api.get('/api/instructor/dashboard').set(auth(state.student.token))).status).toBe(403);
  });
});

describe('progress, quizzes and certificates', () => {
  const s = () => auth(state.student.token);

  it('saves the playback position and completes a video at 90%', async () => {
    const early = await api.post(`/api/learn/lessons/${state.video.id}/position`).set(s()).send({ position: 2 });
    expect(early.body).toMatchObject({ saved: true, completed: false });
    const resume = await api.get(`/api/learn/lessons/${state.video.id}`).set(s());
    expect(resume.body.position).toBe(2);
    const late = await api.post(`/api/learn/lessons/${state.video.id}/position`).set(s()).send({ position: 5.8 });
    expect(late.body).toMatchObject({ completed: true, progress: 33 });
  });

  it('marks an article complete', async () => {
    const res = await api.post(`/api/learn/lessons/${state.article.id}/complete`).set(s()).send({ completed: true });
    expect(res.body).toMatchObject({ completed: true, progress: 67, courseCompleted: false, certificate: null });
  });

  it('hides answers from the learner and will not complete a quiz by hand', async () => {
    const res = await api.get(`/api/learn/lessons/${state.quiz.id}`).set(s());
    expect(res.body.lesson.quiz.questions).toHaveLength(3);
    expect(JSON.stringify(res.body.lesson)).not.toMatch(/correct|explanation/);
    expect((await api.post(`/api/learn/lessons/${state.quiz.id}/complete`).set(s()).send({})).status).toBe(400);
  });

  it('auto-grades a failed attempt and explains the answers', async () => {
    const [q1, q2, q3] = state.questions;
    const res = await api.post(`/api/learn/lessons/${state.quiz.id}/quiz`).set(s()).send({ answers: { [q1.id]: [0], [q2.id]: [0], [q3.id]: [1] } });
    expect(res.status).toBe(201);
    expect(res.body.attempt).toMatchObject({ score: 1, maxScore: 4, percent: 25, passed: false });
    expect(res.body.attempt.results[0]).toMatchObject({ isCorrect: false, correct: [1], explanation: 'Basic sums.' });
    expect(res.body.progress).toBe(67);
  });

  it('passes on a correct attempt, finishes the course and issues a certificate', async () => {
    const [q1, q2, q3] = state.questions;
    const res = await api.post(`/api/learn/lessons/${state.quiz.id}/quiz`).set(s()).send({ answers: { [q1.id]: [1], [q2.id]: [0], [q3.id]: [3, 1] } });
    expect(res.body.attempt).toMatchObject({ percent: 100, passed: true });
    expect(res.body).toMatchObject({ progress: 100, courseCompleted: true, attempts: 2 });
    state.cert = res.body.certificate;
    expect(state.cert.code).toMatch(/^HR-[A-Z2-9]{10}$/);
    expect(state.cert).toMatchObject({ studentName: 'Stu Student', courseTitle: 'Testing in practice', instructorName: 'Ivy Instructor' });
  });

  it('serves the certificate as a PDF and verifies it publicly', async () => {
    const started = Date.now();
    const pdf = await api.get(state.cert.pdfUrl).buffer(true).parse((res, cb) => { const chunks = []; res.on('data', (c) => chunks.push(c)); res.on('end', () => cb(null, Buffer.concat(chunks))); });
    timings.certificatePdfMs = Date.now() - started;
    timings.certificatePdfBytes = pdf.body.length;
    expect(pdf.status).toBe(200);
    expect(pdf.headers['content-type']).toBe('application/pdf');
    expect(pdf.body.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.body.length).toBeGreaterThan(1500);

    const verify = await api.get(`/api/certificates/verify/${state.cert.code.toLowerCase()}`);
    expect(verify.body.certificate.studentName).toBe('Stu Student');
    expect((await api.get('/api/certificates/verify/HR-DOESNOTEXIST')).status).toBe(404);
    const mine = await api.get('/api/certificates').set(s());
    expect(mine.body.items).toHaveLength(1);
  });

  it('issues only one certificate however often the course is re-completed', async () => {
    await api.post(`/api/learn/lessons/${state.article.id}/complete`).set(s()).send({ completed: false }).expect(200);
    const back = await api.post(`/api/learn/lessons/${state.article.id}/complete`).set(s()).send({ completed: true });
    expect(back.body.certificate.code).toBe(state.cert.code);
    expect(await models.Certificate.countDocuments()).toBe(1);
  });

  it('lists the course under "my learning" with progress and certificate', async () => {
    const res = await api.get('/api/learn/enrollments').set(s());
    expect(res.body.items[0]).toMatchObject({ progress: 100, course: { slug: 'testing-in-practice' }, certificate: { code: state.cert.code } });
  });
});

describe('live classes', () => {
  const connect = (token) => ioClient(`http://localhost:${port}`, { auth: { token }, transports: ['websocket'], forceNew: true });
  const emit = (socket, event, payload) => new Promise((resolve) => socket.emit(event, payload, resolve));
  const once = (socket, event) => new Promise((resolve) => socket.once(event, resolve));

  it('lets the instructor schedule a class and keeps students from starting it', async () => {
    const res = await api.post('/api/live').set(auth(state.instructor.token)).send({
      courseId: state.course.id, title: 'Office hours', scheduledAt: new Date(Date.now() + 3600e3).toISOString(), durationMin: 45,
    });
    expect(res.status).toBe(201);
    state.live = res.body.liveClass;
    expect((await api.post('/api/live').set(auth(state.student.token)).send({ courseId: state.course.id, title: 'Mine', scheduledAt: new Date().toISOString() })).status).toBe(403);
    expect((await api.post(`/api/live/${state.live.id}/start`).set(auth(state.student.token))).status).toBe(403);
    expect((await api.post(`/api/live/${state.live.id}/start`).set(auth(state.other.token))).status).toBe(403);
    const schedule = await api.get('/api/live/schedule').set(auth(state.student.token));
    expect(schedule.body.items[0]).toMatchObject({ title: 'Office hours', canJoin: true });
  });

  it('only admits enrolled students, and only once the class is live', async () => {
    expect((await api.get(`/api/live/${state.live.id}`).set(auth(state.outsider.token))).status).toBe(403);
    const room = await api.get(`/api/live/${state.live.id}`).set(auth(state.student.token));
    expect(room.body).toMatchObject({ isHost: false });
    expect(room.body.iceServers[0].urls[0]).toMatch(/^stun:/);

    const student = connect(state.student.token);
    await once(student, 'connect');
    const early = await emit(student, 'live:join', { classId: state.live.id });
    expect(early).toMatchObject({ waiting: true });
    student.disconnect();

    const outsider = connect(state.outsider.token);
    await once(outsider, 'connect');
    expect((await emit(outsider, 'live:join', { classId: state.live.id })).error).toMatch(/Enroll/);
    outsider.disconnect();

    const anon = ioClient(`http://localhost:${port}`, { auth: { token: 'garbage' }, transports: ['websocket'], forceNew: true });
    const err = await once(anon, 'connect_error');
    expect(err.message).toBe('unauthorized');
    anon.close();
  });

  it('relays WebRTC signalling, presence and chat between host and student', async () => {
    const started = await api.post(`/api/live/${state.live.id}/start`).set(auth(state.instructor.token));
    expect(started.body.liveClass.status).toBe('live');

    const host = connect(state.instructor.token);
    const student = connect(state.student.token);
    await Promise.all([once(host, 'connect'), once(student, 'connect')]);

    const hostJoin = await emit(host, 'live:join', { classId: state.live.id, media: { audio: true, video: true } });
    expect(hostJoin).toMatchObject({ ok: true, self: { role: 'host' }, peers: [] });

    const hostSeesJoin = once(host, 'live:peer-joined');
    const studentJoin = await emit(student, 'live:join', { classId: state.live.id, media: { audio: true, video: false } });
    expect(studentJoin.peers).toHaveLength(1);
    expect(studentJoin.peers[0]).toMatchObject({ role: 'host', name: 'Ivy Instructor', media: { audio: true, video: true } });
    expect(await hostSeesJoin).toMatchObject({ role: 'student', name: 'Stu Student' });

    // SDP offer from the newcomer reaches the host, and only the host.
    const t0 = performance.now();
    const offer = once(host, 'live:signal');
    student.emit('live:signal', { to: host.id, data: { description: { type: 'offer', sdp: 'v=0 fake' } } });
    const got = await offer;
    timings.signalRelayMs = Math.round((performance.now() - t0) * 100) / 100;
    expect(got).toEqual({ from: student.id, data: { description: { type: 'offer', sdp: 'v=0 fake' } } });

    const stateChange = once(host, 'live:peer-state');
    student.emit('live:state', { hand: true, media: { audio: false, video: false } });
    expect(await stateChange).toMatchObject({ socketId: student.id, hand: true, media: { audio: false } });

    const chatSeen = Promise.all([once(host, 'live:chat'), once(student, 'live:chat')]);
    student.emit('live:chat', { text: '  Can you repeat that?  ' });
    const [m1] = await chatSeen;
    expect(m1).toMatchObject({ name: 'Stu Student', role: 'student', text: 'Can you repeat that?' });

    const muted = once(student, 'live:force-mute');
    host.emit('live:mute-all');
    await muted;

    const ended = once(student, 'live:ended');
    await api.post(`/api/live/${state.live.id}/end`).set(auth(state.instructor.token)).expect(200);
    await ended;
    host.disconnect();
    student.disconnect();

    await new Promise((r) => setTimeout(r, 150));
    const history = await api.get(`/api/live/${state.live.id}`).set(auth(state.student.token));
    expect(history.body.liveClass).toMatchObject({ status: 'ended', peakAttendance: 2 });
    expect(history.body.messages.map((m) => m.text)).toEqual(['Can you repeat that?']);
  });
});

describe('admin', () => {
  it('is closed to everyone else', async () => {
    expect((await api.get('/api/admin/overview').set(auth(state.instructor.token))).status).toBe(403);
    expect((await api.get('/api/admin/overview')).status).toBe(401);
  });
  it('summarises the platform', async () => {
    const res = await api.get('/api/admin/overview').set(auth(state.admin.token));
    expect(res.body.users).toMatchObject({ student: 2, instructor: 2, admin: 1 });
    expect(res.body.revenue).toMatchObject({ gross: 4900, fees: 980, sales: 1 });
    expect(res.body).toMatchObject({ enrollments: 1, certificates: 1, videos: { ready: 1 } });
  });
  it('changes roles and disables accounts', async () => {
    const promoted = await api.patch(`/api/admin/users/${state.outsider.user.id}`).set(auth(state.admin.token)).send({ role: 'instructor' });
    expect(promoted.body.user.role).toBe('instructor');
    await api.patch(`/api/admin/users/${state.outsider.user.id}`).set(auth(state.admin.token)).send({ disabled: true }).expect(200);
    expect((await api.get('/api/auth/me').set(auth(state.outsider.token))).status).toBe(401);
    expect((await api.post('/api/auth/login').send({ email: 'olga@test.dev', password: 'password123' })).status).toBe(401);
    expect((await api.patch(`/api/admin/users/${state.admin.user.id}`).set(auth(state.admin.token)).send({ role: 'student' })).status).toBe(400);
  });
  it('can take a course down', async () => {
    await api.patch(`/api/admin/courses/${state.course.id}`).set(auth(state.admin.token)).send({ status: 'archived' }).expect(200);
    expect((await api.get('/api/courses/testing-in-practice')).status).toBe(404);
    // enrolled students keep access to what they bought
    expect((await api.get(`/api/learn/courses/${state.course.id}`).set(auth(state.student.token))).status).toBe(200);
  });
  it('will not delete a course that has students', async () => {
    const res = await api.delete(`/api/manage/courses/${state.course.id}`).set(auth(state.instructor.token));
    expect(res.status).toBe(400);
  });
});
