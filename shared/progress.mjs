export const emptyProgress = () => ({ draft: null, notes: '', bookmarked: false, solved: false, submissions: [] });

export function progressPatch(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid progress update.');
  const patch = {};
  for (const [key, value] of Object.entries(input)) {
    if (key === 'draft' || key === 'notes') {
      if (key === 'draft' && value === null) { patch[key] = null; continue; }
      if (typeof value !== 'string' || value.length > 20000) throw new Error('Drafts and notes are limited to 20,000 characters.');
    } else if (key === 'solved' || key === 'bookmarked') {
      if (typeof value !== 'boolean') throw new Error('Progress flags must be true or false.');
    } else throw new Error('Unsupported progress field.');
    patch[key] = value;
  }
  return patch;
}

export function importedProgress(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid browser progress.');
  const { submissions = [], ...fields } = input;
  const saved = { ...emptyProgress(), ...progressPatch(fields) };
  if (!Array.isArray(submissions) || submissions.length > 100) throw new Error('Import up to 100 submissions per question.');
  saved.submissions = submissions.map(item => {
    if (!item || typeof item.id !== 'string' || item.id.length > 100 || typeof item.sql !== 'string' || item.sql.length > 20000
      || !['mysql', 'postgresql', 'sqlite'].includes(item.engine || 'sqlite')
      || !['Accepted', 'Wrong Answer', 'Runtime Error', 'Time Limit Exceeded'].includes(item.verdict)
      || !Number.isFinite(Date.parse(item.date))) throw new Error('A browser submission has invalid data.');
    return { id: item.id, sql: item.sql, date: new Date(item.date).toISOString(), engine: item.engine || 'sqlite', verdict: item.verdict,
      passed: Math.max(0, Math.min(10000, Number(item.passed) || 0)), total: Math.max(0, Math.min(10000, Number(item.total) || 0)),
      runtime: Math.max(0, Math.min(3600000, Number(item.runtime) || 0)) };
  });
  return saved;
}

export function mergeImportedProgress(account, guest) {
  const unique = new Map([...guest.submissions, ...account.submissions].map(item => [item.id, item]));
  return { ...account, draft: account.draft || guest.draft, notes: account.notes || guest.notes,
    solved: account.solved || guest.solved, bookmarked: account.bookmarked || guest.bookmarked,
    submissions: [...unique.values()].sort((a, b) => Date.parse(b.date) - Date.parse(a.date)).slice(0, 100) };
}

export function hasProgress(saved) {
  return Boolean(saved && (saved.draft || saved.notes || saved.solved || saved.bookmarked || saved.submissions?.length));
}
