import '../server/env.mjs';
import { createAccountStore } from '../server/account-store.mjs';
import { engineConfig, ensureEngines, stopEngines } from '../server/engines.mjs';
import { problems } from '../server/problems/index.mjs';
import { runQuery } from '../server/runner.mjs';
import { backfillLeaderboard } from '../server/leaderboard-backfill.mjs';

let store;
try {
  await ensureEngines();
  store = await createAccountStore({ config: (await engineConfig()).postgresql });
  const result = await backfillLeaderboard({ store, problems, runQuery });
  console.log(`Verified ${result.credited} existing solutions; awarded ${result.points} points. ${result.unverified} question histories need a new accepted submission.`);
} finally {
  await store?.close();
  await stopEngines();
}
