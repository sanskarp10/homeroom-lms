/**
 * Auto-grading. Single and true/false questions need the one right option;
 * multiple-answer questions need exactly the right set (no partial credit).
 */
export function gradeQuiz(quiz, answers = {}) {
  let score = 0;
  let maxScore = 0;
  const results = quiz.questions.map((q) => {
    const selected = [...new Set(answers[String(q._id)] || [])].filter((i) => i < q.options.length).sort((a, b) => a - b);
    const correct = [...q.correct].sort((a, b) => a - b);
    const isCorrect = selected.length === correct.length && selected.every((v, i) => v === correct[i]);
    maxScore += q.points;
    if (isCorrect) score += q.points;
    return { question: q._id, selected, correct, isCorrect, points: isCorrect ? q.points : 0, explanation: q.explanation || '' };
  });
  const percent = maxScore ? Math.round((score / maxScore) * 100) : 0;
  return { score, maxScore, percent, passed: percent >= (quiz.passingPercent ?? 70), results };
}
