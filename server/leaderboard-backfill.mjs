// Old browser/imported history is not proof. Re-run its SQL against every test
// with the normal sandbox before granting a one-time leaderboard award.
export async function backfillLeaderboard({ store, problems, runQuery }) {
  let credited = 0, points = 0, unverified = 0;
  for (const candidate of await store.unscoredAccepted()) {
    const problem = problems.get(candidate.slug);
    if (!problem) continue;
    const seen = new Set();
    let accepted = false;
    for (const submission of candidate.submissions || []) {
      if (submission.verdict !== 'Accepted' || !['mysql','postgresql'].includes(submission.engine)
        || typeof submission.sql !== 'string' || submission.sql.length > 20000) continue;
      const key = JSON.stringify([submission.engine, submission.sql]);
      if (seen.has(key)) continue;
      seen.add(key);
      const result = await runQuery({ slug: problem.slug, sql: submission.sql, engine: submission.engine, mode: 'submit' });
      if (result.verdict !== 'Accepted') continue;
      const earned = await store.creditVerifiedSolution(candidate.user_id, problem, result);
      if (earned) { credited++; points += earned; }
      accepted = true;
      break;
    }
    if (!accepted) unverified++;
  }
  return { credited, points, unverified };
}
