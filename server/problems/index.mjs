import rectanglesArea from './rectangles-area.mjs';
import { playlistProblems } from './playlist.mjs';
import { additionalProblems } from './additional.mjs';

// Register future questions here. Each problem provides its schema, fixtures, and an independent result checker.
export const problems = new Map([rectanglesArea, ...playlistProblems, ...additionalProblems].map((problem) => [problem.slug, problem]));
export function publicProblem(problem) {
  const { expected, submissionCases, referenceSql, ...details } = problem;
  return { ...details, practiceCases: details.practiceCases.map(({expected,...test})=>test), totalTests: submissionCases.length };
}
