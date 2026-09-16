export const cx = (...items) => items.filter(Boolean).join(' ');
export const engineLabel = (engine) =>
  ({ mysql: 'MySQL', postgresql: 'PostgreSQL', sqlite: 'SQLite (previous engine)' })[engine] ||
  'SQLite (previous engine)';
