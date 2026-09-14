const input = (rows) => ({ Points: rows });
const practiceCases = [
  { id: 'example', name: 'Example 1', kind: 'Published example', description: 'The example from the question.', input: input([[1, 2, 7], [2, 4, 8], [3, 2, 10]]) },
  { id: 'same-x', name: 'Same x-coordinate', kind: 'Edge case', description: 'All points lie on one vertical line.', input: input([[1, 3, 1], [2, 3, 5], [3, 3, 9]]) },
  { id: 'same-y', name: 'Same y-coordinate', kind: 'Edge case', description: 'All points lie on one horizontal line.', input: input([[1, 1, 4], [2, 5, 4], [3, 9, 4]]) },
  { id: 'negative', name: 'Negative coordinates', kind: 'Practice case', description: 'Points on both sides of the coordinate axes.', input: input([[1, -3, -2], [2, 2, 4], [3, -1, 5], [4, 3, -4]]) },
  { id: 'ties', name: 'Equal areas', kind: 'Edge case', description: 'Several pairs produce the same area. Check the tie-breaking order.', input: input([[8, 0, 0], [2, 2, 2], [5, 0, 2], [1, 2, 0], [9, 1, 1]]) },
  { id: 'one-point', name: 'One point', kind: 'Edge case', description: 'A table containing just one point.', input: input([[7, 3, 8]]) },
  { id: 'duplicate-coordinates', name: 'Duplicate coordinates', kind: 'Edge case', description: 'Different IDs can occupy the same location.', input: input([[1, 1, 1], [2, 1, 1], [3, 4, 5], [4, 4, 5]]) },
  { id: 'unordered-ids', name: 'Unordered IDs', kind: 'Practice case', description: 'IDs are nonconsecutive and input rows are out of order.', input: input([[30, 2, 3], [4, 8, 6], [17, -1, 2], [2, 0, -2]]) },
  { id: 'large-coordinates', name: 'Large coordinates', kind: 'Edge case', description: 'Areas can exceed the range of a 32-bit integer.', input: input([[1, -50000, -50000], [2, 50000, 50000], [3, 0, 20000]]) },
  { id: 'empty', name: 'Empty table', kind: 'Edge case', description: 'No points are present.', input: input([]) },
  { id: 'origin', name: 'Points at the origin', kind: 'Practice case', description: 'Zero coordinates mixed with horizontal and vertical alignments.', input: input([[1, 0, 0], [2, 0, 5], [3, 5, 0], [4, 5, 5], [5, -5, -5]]) },
  { id: 'all-pairs', name: 'Every pair is valid', kind: 'Practice case', description: 'Every point has a distinct x- and y-coordinate.', input: input([[1, 1, 8], [2, 2, 3], [3, 3, 6], [4, 4, 1], [5, 5, 9]]) },
];

function expected(data) {
  const points = [...data.Points].sort((a, b) => a[0] - b[0]);
  const rows = [];
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const a = points[i], b = points[j];
      const area = Math.abs(a[1] - b[1]) * Math.abs(a[2] - b[2]);
      if (area > 0) rows.push([a[0], b[0], area]);
    }
  }
  rows.sort((a, b) => b[2] - a[2] || a[0] - b[0] || a[1] - b[1]);
  return { columns: ['p1', 'p2', 'area'], rows };
}

function generatedCases() {
  let seed = 1459;
  const random = (n) => { seed = (1664525 * seed + 1013904223) >>> 0; return seed % n; };
  return Array.from({ length: 24 }, (_, i) => {
    const rows = Array.from({ length: 5 + random(15) }, (_, j) => [j * 3 + 1, random(21) - 10, random(21) - 10]);
    for (let j = rows.length - 1; j > 0; j--) { const k = random(j + 1); [rows[j], rows[k]] = [rows[k], rows[j]]; }
    return { id: `generated-${i + 1}`, name: `Additional case ${i + 1}`, kind: 'Generated practice case', description: 'An additional local test with mixed coordinates and shuffled IDs.', input: input(rows) };
  });
}

export default {
  slug: 'rectangles-area', number: 1459, title: 'Rectangles Area', difficulty: 'Medium', category: 'Database',
  source: 'https://leetcode.com/problems/rectangles-area/description/',
  reference: 'https://github.com/doocs/leetcode/blob/main/solution/1400-1499/1459.Rectangles%20Area/README_EN.md',
  summary: 'Find every axis-aligned rectangle with a non-zero area that can be formed by any two points in the Points table.',
  rules: [
    'Return p1 and p2, the IDs of the two points at opposite corners of a rectangle, with p1 < p2.',
    'Return area, the area of that rectangle. Exclude rectangles with an area of zero.',
    'Order by area in descending order. Break ties by p1 in ascending order, then p2 in ascending order.',
  ],
  schema: [{ name: 'Points', columns: [{ name: 'id', type: 'INTEGER', primaryKey: true }, { name: 'x_value', type: 'INTEGER' }, { name: 'y_value', type: 'INTEGER' }], note: 'id uniquely identifies each row. Each point is a 2D coordinate (x_value, y_value).' }],
  starter: '-- Write your SQL query below\n\n',
  example: { input: practiceCases[0].input, output: expected(practiceCases[0].input), explanation: 'Points 2 and 3 form a rectangle with area 4. Points 1 and 2 form a rectangle with area 2. Points 1 and 3 share an x-coordinate, so their area is zero and they are excluded.' },
  practiceCases, submissionCases: [...practiceCases, ...generatedCases()], expected,
};
