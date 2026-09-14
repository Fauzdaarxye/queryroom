const numeric = value => typeof value === 'number' || (typeof value === 'string' && /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value));
const canonical = value => numeric(value) ? Math.round(Number(value) * 1e6) / 1e6 : value;
const rowKey = row => JSON.stringify(row.map(canonical));

export function compareResult(problem, actual, expected) {
  const actualNames = actual.columns.map(c => c.toLowerCase());
  const expectedNames = expected.columns.map(c => c.toLowerCase());
  if (JSON.stringify(actualNames) !== JSON.stringify(expectedNames)) return { passed: false, reason: `Expected columns: ${expected.columns.join(', ')}. Check your column names and their order.` };
  if (actual.rows.length !== expected.rows.length) return { passed: false, reason: `Expected ${expected.rows.length} rows, but your query returned ${actual.rows.length}.` };
  const actualBag = actual.rows.map(rowKey).sort(), expectedBag = expected.rows.map(rowKey).sort();
  if (JSON.stringify(actualBag) !== JSON.stringify(expectedBag)) return { passed: false, reason: 'Your values differ from the expected result. Compare the output tables below.' };
  const ordered = problem.orderMatters !== false;
  if (ordered && problem.orderBy?.length) {
    const keys = problem.orderBy.map(k => ({ index: expectedNames.indexOf(k.column.toLowerCase()), direction: k.direction === 'desc' ? -1 : 1 }));
    for (let i = 1; i < actual.rows.length; i++) {
      for (const key of keys) {
        const a = canonical(actual.rows[i-1][key.index]), b = canonical(actual.rows[i][key.index]);
        if (a === b) continue;
        const cmp = a === null ? -1 : b === null ? 1 : a < b ? -1 : 1;
        if (cmp * key.direction > 0) return { passed: false, reason: 'Your row order differs from the required sorting. Check the ORDER BY columns and directions.' };
        break;
      }
    }
  } else if (ordered && actual.rows.some((row, i) => rowKey(row) !== rowKey(expected.rows[i]))) {
    return { passed: false, reason: 'Your row order differs from the expected result. Check the required sorting and tie breakers.' };
  }
  return { passed: true, reason: null };
}
