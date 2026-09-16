import { expandEdgeCases } from './edge-cases.mjs';
import { loadQuestionGroup } from './load-data.mjs';

function expected(data) {
  const points = [...data.Points].sort((a, b) => a[0] - b[0]);
  const rows = [];
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const a = points[i],
        b = points[j];
      const area = Math.abs(a[1] - b[1]) * Math.abs(a[2] - b[2]);
      if (area > 0) rows.push([a[0], b[0], area]);
    }
  }
  rows.sort((a, b) => b[2] - a[2] || a[0] - b[0] || a[1] - b[1]);
  return { columns: ['p1', 'p2', 'area'], rows };
}

export default expandEdgeCases({ ...loadQuestionGroup('original')[0], expected });
