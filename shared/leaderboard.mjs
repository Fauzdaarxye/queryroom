export const difficultyPoints = Object.freeze({ Easy: 10, Medium: 25, Hard: 50 });
export const leaderboardPageSize = 10;
export const defaultLeaderboardOptions = { search: '', page: 1 };

export function readLeaderboardOptions(search) {
  const params = new URLSearchParams(search);
  const page = Number(params.get('page'));
  return { search: (params.get('q') || '').slice(0, 24),
    page: Number.isSafeInteger(page) && page > 0 ? Math.min(page, 100000) : 1 };
}

export function leaderboardQuery({ search = '', page = 1 }) {
  const params = new URLSearchParams();
  if (search) params.set('q', search);
  if (page > 1) params.set('page', String(page));
  return params.size ? `?${params}` : '';
}

// Call only with a server-owned problem and the result of a full submission.
export function verifiedPoints(problem, submission) {
  const total = problem?.submissionCases?.length;
  return total > 0 && submission.verdict === 'Accepted'
    && ['mysql', 'postgresql'].includes(submission.engine)
    && submission.total === total && submission.passed === total
    ? difficultyPoints[problem.difficulty] || 0 : 0;
}
