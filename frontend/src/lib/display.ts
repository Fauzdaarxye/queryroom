export const cx = (...items: (string | false | null | undefined)[]) =>
  items.filter(Boolean).join(' ');
export const engineLabel = (engine: string | undefined) =>
  ({ mysql: 'MySQL', postgresql: 'PostgreSQL', sqlite: 'SQLite (previous engine)' })[
    engine as 'mysql' | 'postgresql' | 'sqlite'
  ] || 'SQLite (previous engine)';
