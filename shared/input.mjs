export function validateInput(problem, data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Provide a JSON object containing the table data.');
  if (Object.keys(data).sort().join(',') !== problem.schema.map(t => t.name).sort().join(',')) throw new Error(`Include exactly these tables: ${problem.schema.map(t => t.name).join(', ')}.`);
  for (const table of problem.schema) {
    const rows = data[table.name];
    if (!Array.isArray(rows) || rows.length > 100) throw new Error(`${table.name} must contain an array of at most 100 rows.`);
    const keyColumns = table.primaryKey || table.columns.filter(c => c.primaryKey).map(c => c.name);
    const keys = new Set();
    for (const row of rows) {
      if (!Array.isArray(row) || row.length !== table.columns.length) throw new Error(`Every ${table.name} row needs ${table.columns.length} values.`);
      row.forEach((value, i) => {
        const column = table.columns[i];
        if (value === null) {
          if (keyColumns.includes(column.name) || (problem.slug === 'rectangles-area')) throw new Error(`${column.name} must be an integer and cannot be null.`);
          return;
        }
        if (column.type === 'INTEGER' && (!Number.isSafeInteger(value) || Math.abs(value) > 1_000_000_000)) throw new Error(`${column.name} must be an integer between -1000000000 and 1000000000.`);
        if (column.type === 'REAL' && (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value)>1_000_000_000)) throw new Error(`${column.name} must be a finite number between -1000000000 and 1000000000.`);
        if (column.type === 'TEXT' && (typeof value !== 'string' || value.length>2000)) throw new Error(`${column.name} must be text of at most 2,000 characters.`);
        if (/^date(time)?$/i.test(column.displayType || '') && !/^\d{4}-\d{2}-\d{2}(?: \d{2}:\d{2}:\d{2})?$/.test(value)) throw new Error(`${column.name} needs a date in YYYY-MM-DD format${column.displayType.toLowerCase()==='datetime' ? ' with HH:MM:SS' : ''}.`);
        if (problem.slug === 'rectangles-area' && Math.abs(value)>1_000_000) throw new Error(`${column.name} must be an integer between -1000000 and 1000000.`);
      });
      if (keyColumns.length) {
        const key=JSON.stringify(keyColumns.map(name=>row[table.columns.findIndex(c=>c.name===name)]));
        if (keys.has(key)) throw new Error(`${table.name}: ${keyColumns.join(', ')} values must be unique.`);
        keys.add(key);
      }
    }
  }
  return data;
}
