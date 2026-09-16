import {configureRunner} from '../server/runner.ts';
import {readSeed} from '../server/catalog/seed.ts';
const problems = new Map((await readSeed()).map(problem => [problem.slug, problem]));
configureRunner(async slug => problems.get(slug) || null);
