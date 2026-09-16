import { randomUUID } from 'node:crypto';
import { Parser } from 'htmlparser2';
import { cleanStatement } from './validation.ts';
import type { Cell, InputData, Problem, TableSchema, TestCase } from '../../shared/types.ts';

export function sourceSlug(source: string): string {
  let url: URL;
  try { url = new URL(source.trim()); } catch { throw new Error('Paste a LeetCode question URL.'); }
  const match = url.pathname.match(/^\/problems\/([a-z0-9]+(?:-[a-z0-9]+)*)(?:\/(?:description|editorial|solutions))?\/?$/);
  if (url.protocol !== 'https:' || !['leetcode.com', 'www.leetcode.com'].includes(url.hostname) || url.port || url.username || url.password || !match) throw new Error('Use an HTTPS LeetCode problem link, such as https://leetcode.com/problems/rectangles-area/description/.');
  return match[1];
}
export function emptyDraft(title = 'Untitled question', slug = `question-${randomUUID().slice(0, 8)}`): Problem {
  return { id: `qr${randomUUID()}`, slug, number: 0, title, difficulty: 'Medium', category: 'Database', collection: 'Added questions', source: '', schema: [], starter: '-- Write your SQL query below\n\n', statementHtml: '', practiceCases: [], submissionCases: [], references: {mysql: '', postgresql: ''}, orderMatters: false, orderBy: [] };
}
function readableHtml(html: string) {
  let text = '';
  const parser = new Parser({ontext: value => {text += value;}, onclosetag: tag => {
    if (tag === 'td' || tag === 'th') text += '|';
    if (['p', 'pre', 'br', 'div', 'li', 'tr'].includes(tag)) text += '\n';
  }, onopentag: tag => {if (tag === 'br') text += '\n'; if (tag === 'tr') text += '\n|';}}, {decodeEntities: true});
  parser.write(html); parser.end(); return text;
}
export function inferSchema(html: string): TableSchema[] {
  // Only infer structured column data. Imported SQL/HTML is never executed.
  const text = readableHtml(html);
  const tables: TableSchema[] = [];
  const sections = [...text.matchAll(/Table:\s*([A-Za-z_][A-Za-z0-9_]*)/g)];
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    const block = text.slice(section.index! + section[0].length, sections[i + 1]?.index ?? text.length);
    const columns = [...block.matchAll(/\|\s*([A-Za-z_][A-Za-z0-9_]*)\s*\|\s*(int(?:eger)?|bigint|varchar(?:\(\d+\))?|text|enum(?:\([^\n]*\))?|date(?:time)?|timestamp|decimal(?:\([^\n]*\))?|float|double)\s*\|/gi)].map(match => {
      const displayType = match[2].toLowerCase();
      return { name: match[1], displayType: displayType === 'timestamp' ? 'datetime' : displayType,
        type: (/^(int|bigint)/.test(displayType) ? 'INTEGER' : /^(decimal|float|double)/.test(displayType) ? 'REAL' : 'TEXT') as 'INTEGER' | 'REAL' | 'TEXT' };
    });
    if (columns.length && !tables.some(table => table.name === section[1])) tables.push({ name: section[1], columns });
  }
  return tables;
}
export function inferExamples(html: string, schema: TableSchema[]): TestCase[] {
  const text = readableHtml(html), examples: TestCase[] = [];
  const blocks = [...text.matchAll(/Input:\s*([\s\S]*?)Output:\s*([\s\S]*?)(?=Explanation:|Example\s*\d|$)/gi)];
  const rows = (block: string) => block.split('\n').map(line => line.trim()).filter(line => line.startsWith('|') && line.endsWith('|')).map(line => line.slice(1, -1).split('|').map(cell => cell.trim()));
  const value = (cell: string): Cell => /^null$/i.test(cell) ? null : /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(cell) && Number.isSafeInteger(Math.trunc(Number(cell))) ? Number(cell) : cell;
  for (const block of blocks) {
    const input: InputData = {};
    for (const table of schema) {
      const match = block[1].match(new RegExp(`(?:^|\\n)\\s*${table.name}\\s*(?:table)?\\s*:\\s*([\\s\\S]*?)(?=\\n\\s*[A-Za-z_][A-Za-z0-9_]*\\s*(?:table)?\\s*:|$)`, 'i'));
      if (!match) continue;
      const [columns, ...data] = rows(match[1]);
      if (!columns || JSON.stringify(columns) !== JSON.stringify(table.columns.map(column => column.name))) continue;
      input[table.name] = data.map(row => row.map((cell, i) => table.columns[i]?.type === 'TEXT' && !/^null$/i.test(cell) ? cell : value(cell)));
    }
    const [columns, ...output] = rows(block[2]);
    if (schema.length && Object.keys(input).length === schema.length && columns && output.every(row => row.length === columns.length)) {
      examples.push({id: examples.length ? `example-${examples.length + 1}` : 'example', name: `Example ${examples.length + 1}`, kind: 'Published example', description: 'Imported public example. Review the values and types before publishing.', input, expected: {columns, rows: output.map(row => row.map(value))}});
    }
  }
  return examples;
}
function completeImport(problem: Problem) {
  problem.schema = inferSchema(problem.statementHtml || '');
  const cases = inferExamples(problem.statementHtml || '', problem.schema);
  problem.submissionCases = cases; problem.practiceCases = cases;
  if (cases[0]?.expected) problem.example = {input: cases[0].input, output: cases[0].expected};
  return problem;
}
export async function importQuestion(value: {url?: string; text?: string; title?: string}, fetchImpl: typeof fetch = fetch): Promise<{problem: Problem; notice: string}> {
  const pasted = typeof value.text === 'string' ? value.text.slice(0, 200000) : '';
  if (!value.url) {
    const problem = emptyDraft(value.title?.trim().slice(0, 200) || 'Untitled question');
    problem.statementHtml = cleanStatement(pasted.includes('<') ? pasted : `<pre>${pasted.replaceAll('&', '&amp;').replaceAll('<', '&lt;')}</pre>`);
    return { problem: completeImport(problem), notice: 'Draft created. Review the statement, schema, and examples, then add edge cases and reference solutions.' };
  }
  const slug = sourceSlug(value.url);
  const problem = emptyDraft(slug.split('-').map(word => word[0].toUpperCase() + word.slice(1)).join(' '), slug);
  problem.source = `https://leetcode.com/problems/${slug}/description/`;
  let notice = 'Imported the public statement. Review the inferred schema and examples, then add edge cases and reference solutions before publishing.';
  try {
    // Fixed destination plus rejected redirects prevents arbitrary URL fetching/SSRF.
    const response = await fetchImpl('https://leetcode.com/graphql/', { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10000),
      headers: {'Content-Type': 'application/json'}, body: JSON.stringify({query: 'query questionData($titleSlug: String!) { question(titleSlug: $titleSlug) { questionFrontendId title titleSlug difficulty content } }', variables: {titleSlug: slug}}) });
    if (!response.ok || !response.body) throw new Error('Unavailable');
    const reader = response.body.getReader(); let size = 0; const chunks: Uint8Array[] = [];
    try { while (true) { const {value: chunk, done} = await reader.read(); if (done) break; size += chunk.length; if (size > 2_000_000) throw new Error('Too large'); chunks.push(chunk); } }
    finally { await reader.cancel(); }
    const imported = JSON.parse(Buffer.concat(chunks).toString()).data?.question;
    if (!imported || imported.titleSlug !== slug) throw new Error('Unavailable');
    if (/^\d+$/.test(imported.questionFrontendId)) { problem.number = Number(imported.questionFrontendId); problem.id = `qr${problem.number}`; }
    if (typeof imported.title === 'string') problem.title = imported.title.slice(0, 200);
    if (['Easy', 'Medium', 'Hard'].includes(imported.difficulty)) problem.difficulty = imported.difficulty;
    if (typeof imported.content === 'string' && imported.content.trim()) problem.statementHtml = cleanStatement(imported.content);
    else throw new Error('Statement unavailable');
  } catch {
    notice = 'The source did not provide a public statement. The link is saved; paste the question text and add its schema and tests to complete this draft.';
  }
  if (pasted) problem.statementHtml = cleanStatement(pasted.includes('<') ? pasted : `<pre>${pasted.replaceAll('&', '&amp;').replaceAll('<', '&lt;')}</pre>`);
  return {problem: completeImport(problem), notice};
}
