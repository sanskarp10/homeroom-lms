import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { Check, X, RotateCcw } from 'lucide-react';
import { useSubmitQuizMutation } from '../store/api.js';
import { ErrorNote, Spinner } from './ui.jsx';
import { errorMessage, plural } from '../lib/format.js';

const HELP = { single: 'Choose one answer.', boolean: 'True or false?', multiple: 'Choose every answer that applies.' };

function Option({ type, name, label, checked, onChange, disabled, state }) {
  // state: undefined while answering; 'right' | 'wrong' | 'missed' once marked
  return (
    <label className={clsx('flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3 text-[15px] leading-snug transition-colors duration-100',
      disabled && 'cursor-default',
      state === 'right' && 'border-pass bg-pass-light',
      state === 'wrong' && 'border-redpen bg-redpen-light',
      state === 'missed' && 'border-dashed border-pass bg-white',
      !state && (checked ? 'border-board bg-white ring-2 ring-board/15' : 'border-line-strong bg-white hover:border-board'))}>
      <input type={type === 'multiple' ? 'checkbox' : 'radio'} name={name} checked={checked} onChange={onChange} disabled={disabled} className="mt-0.5 h-4 w-4 shrink-0 accent-[#1F3A33]" />
      <span className="flex-1">{label}</span>
      {state === 'right' && <Check className="h-4 w-4 shrink-0 text-pass" strokeWidth={3} aria-label="Correct" />}
      {state === 'wrong' && <X className="h-4 w-4 shrink-0 text-redpen" strokeWidth={3} aria-label="Incorrect" />}
      {state === 'missed' && <span className="shrink-0 text-xs font-semibold text-pass">Correct answer</span>}
    </label>
  );
}

export default function Quiz({ lesson, courseId, lastAttempt, attempts, onGraded }) {
  const { questions, passingPercent } = lesson.quiz;
  const [submit, { isLoading, error }] = useSubmitQuizMutation();
  const [answers, setAnswers] = useState({});
  const [attempt, setAttempt] = useState(lastAttempt);
  const [retaking, setRetaking] = useState(false);
  const marked = attempt && !retaking;
  const resultByQuestion = useMemo(() => new Map((attempt?.results || []).map((r) => [r.question, r])), [attempt]);
  const answered = questions.filter((q) => (answers[q.id] || []).length > 0).length;

  const choose = (q, index) => setAnswers((prev) => {
    const current = prev[q.id] || [];
    const next = q.type === 'multiple' ? (current.includes(index) ? current.filter((i) => i !== index) : [...current, index]) : [index];
    return { ...prev, [q.id]: next };
  });

  const send = async (e) => {
    e.preventDefault();
    try {
      const result = await submit({ lessonId: lesson.id, courseId, answers }).unwrap();
      setAttempt(result.attempt);
      setRetaking(false);
      onGraded?.(result);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch { /* shown below */ }
  };
  const retake = () => { setAnswers({}); setRetaking(true); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  if (!questions.length) return <p className="text-ink-faint">This quiz has no questions yet.</p>;

  return (
    <form onSubmit={send} className="max-w-2xl">
      {marked ? (
        <div className={clsx('mb-8 flex flex-wrap items-center gap-x-6 gap-y-3 rounded-panel border px-5 py-4', attempt.passed ? 'border-pass/40 bg-pass-light' : 'border-redpen/30 bg-redpen-light')} role="status">
          <p className={clsx('font-display text-5xl font-semibold tabular', attempt.passed ? 'text-pass' : 'text-redpen')}>{attempt.percent}%</p>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{attempt.passed ? 'Passed' : 'Not passed yet'}</p>
            <p className="text-sm text-ink-soft">
              {attempt.score} of {plural(attempt.maxScore, 'point')}. {attempt.passed ? 'This lesson is complete.' : `You need ${passingPercent}% to pass. Read the notes below and try again.`}
            </p>
          </div>
          <button type="button" onClick={retake} className="btn-outline btn-sm"><RotateCcw className="h-3.5 w-3.5" />{attempt.passed ? 'Retake' : 'Try again'}</button>
        </div>
      ) : (
        <p className="mb-6 text-sm text-ink-faint">{plural(questions.length, 'question')}. Pass mark {passingPercent}%.{attempts > 0 && ` Attempt ${attempts + 1}.`}</p>
      )}

      <ol className="space-y-8">
        {questions.map((q, n) => {
          const result = marked ? resultByQuestion.get(q.id) : null;
          const selected = result ? result.selected : answers[q.id] || [];
          return (
            <li key={q.id}>
              <fieldset disabled={marked}>
                <legend className="mb-1 flex gap-3 text-lg font-semibold leading-snug">
                  <span className="tabular text-ink-faint">{n + 1}.</span><span>{q.prompt}</span>
                </legend>
                <p className="mb-3 pl-7 text-xs text-ink-faint">{HELP[q.type]}{q.points !== 1 && ` Worth ${plural(q.points, 'point')}.`}</p>
                <div className="space-y-2 pl-7">
                  {q.options.map((option, index) => {
                    const isSelected = selected.includes(index);
                    const isCorrect = result?.correct.includes(index);
                    const state = result ? (isSelected ? (isCorrect ? 'right' : 'wrong') : isCorrect ? 'missed' : undefined) : undefined;
                    return <Option key={index} type={q.type} name={q.id} label={option} checked={isSelected} disabled={marked} state={state} onChange={() => choose(q, index)} />;
                  })}
                </div>
                {result?.explanation && (
                  <p className="ml-7 mt-3 border-l-[3px] border-pencil pl-3 text-sm leading-relaxed text-ink-soft">{result.explanation}</p>
                )}
              </fieldset>
            </li>
          );
        })}
      </ol>

      {!marked && (
        <div className="mt-9 flex flex-wrap items-center gap-4">
          <button type="submit" className="btn-primary btn-lg" disabled={isLoading || answered < questions.length}>{isLoading && <Spinner />}Submit answers</button>
          <p className="text-sm text-ink-faint" aria-live="polite">{answered < questions.length ? `${answered} of ${questions.length} answered` : 'All questions answered'}</p>
        </div>
      )}
      <ErrorNote className="mt-4">{error && errorMessage(error)}</ErrorNote>
    </form>
  );
}
