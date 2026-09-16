import { configureRunner } from '../backend/sql/runner.ts';
import { readSeed } from '../database/catalog/seed.ts';
const problems = new Map((await readSeed()).map((problem) => [problem.slug, problem]));
configureRunner(async (slug) => problems.get(slug) || null);
