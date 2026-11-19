import { urlFor } from '../services/storage.js';
import { estimateSeconds } from '../services/courseStats.js';

const id = (v) => (v == null ? v : String(v._id || v));

export function instructorBrief(u) {
  if (!u || !u.name) return u ? { id: id(u) } : null;
  return { id: id(u), name: u.name, headline: u.headline || '', bio: u.bio || '' };
}

export function courseCard(c) {
  return {
    id: id(c),
    slug: c.slug,
    title: c.title,
    subtitle: c.subtitle,
    category: c.category,
    level: c.level,
    language: c.language,
    price: c.price,
    thumbnailUrl: urlFor(c.thumbnailKey),
    status: c.status,
    publishedAt: c.publishedAt,
    updatedAt: c.updatedAt,
    lessonCount: c.lessonCount,
    totalDuration: c.totalDuration,
    enrollmentCount: c.enrollmentCount,
    instructor: instructorBrief(c.instructor),
  };
}

export function courseFull(c) {
  return { ...courseCard(c), description: c.description, outcomes: c.outcomes || [] };
}

/** What anyone may see about a lesson before enrolling. */
export function lessonOutline(l) {
  return { id: id(l), title: l.title, type: l.type, isPreview: !!l.isPreview, duration: estimateSeconds(l) };
}

export function videoState(l) {
  const v = l.video || {};
  return {
    status: v.status || 'none',
    progress: v.progress || 0,
    duration: v.duration || 0,
    renditions: v.renditions || [],
    originalName: v.originalName || '',
    error: v.error || '',
    url: v.status === 'ready' ? urlFor(v.hlsKey) : '',
    posterUrl: v.status === 'ready' ? urlFor(v.posterKey) : '',
  };
}

/** Full lesson for the instructor's editor (includes quiz answers). */
export function lessonForEditor(l) {
  return {
    id: id(l),
    section: id(l.section),
    order: l.order,
    title: l.title,
    type: l.type,
    isPreview: !!l.isPreview,
    content: l.content || '',
    duration: estimateSeconds(l),
    video: videoState(l),
    quiz: {
      passingPercent: l.quiz?.passingPercent ?? 70,
      questions: (l.quiz?.questions || []).map((q) => ({
        id: id(q),
        prompt: q.prompt,
        type: q.type,
        options: q.options,
        correct: q.correct,
        points: q.points,
        explanation: q.explanation || '',
      })),
    },
  };
}

/** Lesson for a learner: quiz answers and explanations are removed. */
export function lessonForLearner(l) {
  return {
    id: id(l),
    courseId: id(l.course),
    title: l.title,
    type: l.type,
    isPreview: !!l.isPreview,
    content: l.content || '',
    duration: estimateSeconds(l),
    video: l.type === 'video' ? videoState(l) : undefined,
    quiz:
      l.type === 'quiz'
        ? {
            passingPercent: l.quiz?.passingPercent ?? 70,
            questions: (l.quiz?.questions || []).map((q) => ({
              id: id(q),
              prompt: q.prompt,
              type: q.type,
              options: q.options,
              points: q.points,
            })),
          }
        : undefined,
  };
}

export function attemptView(a) {
  if (!a) return null;
  return {
    id: id(a),
    score: a.score,
    maxScore: a.maxScore,
    percent: a.percent,
    passed: a.passed,
    createdAt: a.createdAt,
    results: (a.results || []).map((r) => ({
      question: id(r.question),
      selected: r.selected,
      correct: r.correct,
      isCorrect: r.isCorrect,
      points: r.points,
      explanation: r.explanation || '',
    })),
  };
}

export function liveClassView(c) {
  return {
    id: id(c),
    title: c.title,
    description: c.description,
    scheduledAt: c.scheduledAt,
    durationMin: c.durationMin,
    status: c.status,
    startedAt: c.startedAt,
    endedAt: c.endedAt,
    peakAttendance: c.peakAttendance,
    course: c.course && c.course.title ? { id: id(c.course), title: c.course.title, slug: c.course.slug, category: c.course.category } : { id: id(c.course) },
    instructor: instructorBrief(c.instructor),
  };
}

export function certificateView(c) {
  return {
    id: id(c),
    code: c.code,
    studentName: c.studentName,
    courseTitle: c.courseTitle,
    instructorName: c.instructorName,
    hours: c.hours,
    issuedAt: c.issuedAt,
    courseId: id(c.course),
    pdfUrl: `/api/certificates/${c.code}/pdf`,
  };
}
