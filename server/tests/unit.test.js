import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import { gradeQuiz } from '../src/services/grading.js';
import { splitAmount } from '../src/services/payments.js';
import { pickRenditions } from '../src/services/transcoder.js';
import { slugify, escapeRegex } from '../src/utils/http.js';
import { estimateSeconds } from '../src/services/courseStats.js';

const q = (type, options, correct, points = 1) => ({ _id: new mongoose.Types.ObjectId(), type, options, correct, points });

describe('quiz grading', () => {
  const quiz = {
    passingPercent: 70,
    questions: [q('single', ['a', 'b', 'c'], [1]), q('boolean', ['True', 'False'], [0]), q('multiple', ['a', 'b', 'c', 'd'], [0, 2], 2)],
  };
  const [q1, q2, q3] = quiz.questions.map((x) => String(x._id));

  it('awards full marks for all correct answers', () => {
    const r = gradeQuiz(quiz, { [q1]: [1], [q2]: [0], [q3]: [2, 0] });
    expect(r).toMatchObject({ score: 4, maxScore: 4, percent: 100, passed: true });
  });
  it('gives no partial credit on multiple-answer questions', () => {
    const r = gradeQuiz(quiz, { [q1]: [1], [q2]: [0], [q3]: [0] });
    expect(r).toMatchObject({ score: 2, percent: 50, passed: false });
    expect(r.results[2]).toMatchObject({ isCorrect: false, correct: [0, 2] });
  });
  it('treats missing and out-of-range answers as wrong', () => {
    const r = gradeQuiz(quiz, { [q1]: [9] });
    expect(r).toMatchObject({ score: 0, percent: 0, passed: false });
  });
  it('passes exactly at the threshold', () => {
    const r = gradeQuiz({ passingPercent: 75, questions: quiz.questions }, { [q1]: [1], [q3]: [0, 2] });
    expect(r).toMatchObject({ percent: 75, passed: true });
  });
});

describe('revenue split', () => {
  it('splits a sale between platform and instructor without losing a cent', () => {
    expect(splitAmount(4900, 20)).toEqual({ platformFee: 980, instructorNet: 3920 });
    const odd = splitAmount(3333, 15);
    expect(odd.platformFee + odd.instructorNet).toBe(3333);
  });
});

describe('video ladder', () => {
  it('never upscales', () => {
    expect(pickRenditions(720).map((r) => r.height)).toEqual([360, 720]);
    expect(pickRenditions(1080).map((r) => r.height)).toEqual([360, 720, 1080]);
    expect(pickRenditions(240).map((r) => r.height)).toEqual([240]);
    expect(pickRenditions(2160, 720).map((r) => r.height)).toEqual([360, 720]);
  });
});

describe('helpers', () => {
  it('slugifies titles', () => expect(slugify('  React: from First Principles! ')).toBe('react-from-first-principles'));
  it('escapes regex input', () => expect(new RegExp(escapeRegex('c++ (intro)')).test('c++ (intro)')).toBe(true));
  it('estimates lesson length', () => {
    expect(estimateSeconds({ type: 'quiz', quiz: { questions: [1, 2, 3] } })).toBe(180);
    expect(estimateSeconds({ type: 'video', video: { status: 'ready', duration: 42 } })).toBe(42);
    expect(estimateSeconds({ type: 'video', video: { status: 'processing', duration: 42 } })).toBe(0);
  });
});

describe('checkout cancellation link', () => {
  it('keeps the cancellation flag when returning from the local test gateway', () => {
    const source = fs.readFileSync(path.resolve('..', 'client', 'src', 'pages', 'Checkout.jsx'), 'utf8');
    expect(source).toContain('to={`/courses/${course.slug}?checkout=cancelled`}');
  });
});
