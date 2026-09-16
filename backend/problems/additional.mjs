import { loadQuestionGroup } from './load-data.mjs';
const data = loadQuestionGroup('additional');
import { additionalCheckers } from './additional-checkers.mjs';
import { expandEdgeCases } from './edge-cases.mjs';

export const additionalProblems = data.map((details) =>
  expandEdgeCases({ ...details, expected: additionalCheckers[details.number] }),
);
