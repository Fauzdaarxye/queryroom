import data from './playlist.json' with { type: 'json' };
import { referenceResult } from '../database.mjs';

export const playlistProblems = data.map(details => {
  const problem = { ...details };
  problem.expected = input => referenceResult(problem, input);
  return problem;
});
