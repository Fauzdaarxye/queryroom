import '../backend/config/env.mjs';
import { createAccountStore } from '../database/repositories/account-store.mjs';
import { engineConfig, ensureEngines, stopEngines } from '../database/connections/engines.mjs';
import { problems } from '../backend/problems/index.mjs';
import { runQuery } from '../backend/sql/runner.mjs';
import { backfillLeaderboard } from '../backend/services/leaderboard-backfill.mjs';

let store;
try {
  await ensureEngines();
  store = await createAccountStore({ config: (await engineConfig()).postgresql });
  const result = await backfillLeaderboard({ store, problems, runQuery });
  console.log(
    `Verified ${result.credited} existing solutions; awarded ${result.points} points. ${result.unverified} question histories need a new accepted submission.`,
  );
} finally {
  await store?.close();
  await stopEngines();
}
