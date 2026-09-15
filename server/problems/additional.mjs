import data from './additional.json' with {type:'json'};
import { additionalCheckers } from './additional-checkers.mjs';
import { expandEdgeCases } from './edge-cases.mjs';

export const additionalProblems = data.map(details=>expandEdgeCases({...details,expected:additionalCheckers[details.number]}));
