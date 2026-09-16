import '../backend/config/env.mjs';
import { createAccountStore } from '../database/repositories/account-store.mjs';
import { engineConfig, ensureEngines, stopEngines } from '../database/connections/engines.mjs';
import { createCatalog } from '../database/catalog/store.ts';
import { runQuery, configureRunner } from '../backend/sql/runner.ts';
import { backfillLeaderboard } from '../backend/services/leaderboard-backfill.mjs';

let store, catalog;
try {
  await ensureEngines();
  store = await createAccountStore({ config: (await engineConfig()).postgresql });
  catalog = await createCatalog((await engineConfig()).postgresql);
  configureRunner(catalog.published);
  const problems = new Map();
  for (const slug of await catalog.slugs()) problems.set(slug, await catalog.published(slug));
  const result = await backfillLeaderboard({ store, problems, runQuery });
  console.log(
    `Verified ${result.credited} existing solutions; awarded ${result.points} points. ${result.unverified} question histories need a new accepted submission.`,
  );
} finally {
  await store?.close();
  await catalog?.close();
  await stopEngines();
}
