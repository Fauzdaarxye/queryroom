import { readSeed } from '../../database/catalog/seed.ts';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { playlistExpected } from './playlist-checkers.mjs';
import { additionalCheckers } from './additional-checkers.mjs';
import { publicProblem as published } from '../../database/catalog/store.ts';
const sqlite = JSON.parse(
  gunzipSync(readFileSync(new URL('./sqlite-references.json.gz', import.meta.url))),
);
const catalog = await readSeed();
for (const problem of catalog) {
  problem.referenceSql = sqlite[problem.slug];
  problem.expected = problem.playlist
    ? (input) => playlistExpected(problem, input)
    : additionalCheckers[problem.number] ||
      ((input) => {
        const points = [...input.Points].sort((a, b) => a[0] - b[0]);
        const rows = points
          .flatMap((a, i) =>
            points
              .slice(i + 1)
              .map((b) => [a[0], b[0], Math.abs(a[1] - b[1]) * Math.abs(a[2] - b[2])]),
          )
          .filter((row) => row[2] > 0)
          .sort((a, b) => b[2] - a[2] || a[0] - b[0] || a[1] - b[1]);
        return { columns: ['p1', 'p2', 'area'], rows };
      });
}
export const problems = new Map(catalog.map((problem) => [problem.slug, problem]));
export const additionalProblems = catalog.filter(
  (problem) => problem.collection === 'Added questions',
);
export const publicProblem = (problem) => {
  const { expected, referenceSql, ...data } = problem;
  return published(data);
};
