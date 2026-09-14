import data from './additional.json' with {type:'json'};
import { additionalCheckers } from './additional-checkers.mjs';

export const additionalProblems = data.map(details=>({...details,expected:additionalCheckers[details.number]}));
