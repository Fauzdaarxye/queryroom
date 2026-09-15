import rectanglesArea from './rectangles-area.mjs';
import { playlistProblems } from './playlist.mjs';
import { additionalProblems } from './additional.mjs';

// IDs use the source question number so adding or reordering questions never renumbers them.
const catalog = [rectanglesArea, ...playlistProblems, ...additionalProblems].map(problem => ({...problem, id: `qr${problem.number}`}));
if (new Set(catalog.map(problem => problem.id)).size !== catalog.length) throw new Error('Question IDs must be unique. Check for a duplicate question number.');
// Keep slug keys so existing browser progress and saved links continue to work.
export const problems = new Map(catalog.map(problem => [problem.slug, problem]));
export function publicProblem(problem) {
  const { expected, submissionCases, referenceSql, ...details } = problem;
  return { ...details, practiceCases: details.practiceCases.map(({expected,...test})=>test), totalTests: submissionCases.length };
}
