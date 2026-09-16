import { loadQuestionGroup } from './load-data.mjs';
const data = loadQuestionGroup('playlist');
import { playlistExpected } from './playlist-checkers.mjs';
import { expandEdgeCases } from './edge-cases.mjs';

export const playlistProblems = data.map((details) => {
  const problem = { ...details };
  problem.expected = (input) => playlistExpected(problem, input);
  return expandEdgeCases(problem);
});
