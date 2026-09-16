import { z } from 'zod';
import sanitizeHtml from 'sanitize-html';
import type { Problem } from '../../shared/types.ts';
import { validateInput } from '../../shared/input.mjs';
import { checkStatement } from '../sql/check-statement.mjs';

const identifier = z
  .string()
  .regex(
    /^[A-Za-z_][A-Za-z0-9_]{0,62}$/,
    'Use letters, numbers, and underscores for table and column names.',
  );
const cell = z.union([z.string().max(2000), z.number().finite(), z.null()]);
const input = z.record(z.string(), z.array(z.array(cell).max(50)).max(100));
const result = z.object({
  columns: z.array(z.string().min(1).max(100)).min(1).max(100),
  rows: z.array(z.array(cell).max(100)).max(5000),
});
const test = z.object({
  id: z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/),
  name: z.string().min(1).max(200),
  kind: z.string().max(100).default('Practice case'),
  description: z.string().max(3000).optional(),
  input,
  expected: result.nullish().transform((value) => value || undefined),
});
const schema = z
  .array(
    z.object({
      name: identifier,
      note: z.string().max(3000).optional(),
      primaryKey: z.array(identifier).optional(),
      columns: z
        .array(
          z.object({
            name: identifier,
            type: z.enum(['INTEGER', 'REAL', 'TEXT']),
            displayType: z.string().max(100).optional(),
            primaryKey: z.boolean().optional(),
          }),
        )
        .min(1)
        .max(50),
    }),
  )
  .max(20);
const webUrl = z
  .string()
  .max(2000)
  .refine((value) => !value || /^https:\/\//.test(value), 'Links must use HTTPS.');
const question = z.object({
  id: z.string().regex(/^qr[a-zA-Z0-9-]{1,80}$/),
  slug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .max(150),
  number: z.number().int().nonnegative(),
  title: z.string().trim().min(1).max(200),
  difficulty: z.enum(['Easy', 'Medium', 'Hard']),
  category: z.literal('Database').default('Database'),
  source: webUrl,
  reference: webUrl.optional(),
  starter: z.string().max(20000),
  statementHtml: z.string().max(200000).optional(),
  summary: z.string().max(5000).optional(),
  rules: z.array(z.string().max(5000)).max(50).optional(),
  schema,
  example: z
    .object({ input, output: result, explanation: z.string().max(10000).optional() })
    .optional(),
  examples: z
    .array(
      z.union([
        z.object({ input, output: result, explanation: z.string().max(10000).optional() }),
        test,
      ]),
    )
    .max(30)
    .optional(),
  orderMatters: z.boolean().optional(),
  orderBy: z
    .array(z.object({ column: z.string().min(1).max(100), direction: z.enum(['asc', 'desc']) }))
    .max(20)
    .optional(),
  playlist: z.union([z.string().max(200), z.boolean()]).optional(),
  playlistIndex: z.number().int().optional(),
  playlistUrl: webUrl.optional(),
  videos: z
    .array(z.object({ videoId: z.string().max(100), playlistIndex: z.number().int(), url: webUrl }))
    .max(50)
    .optional(),
  collection: z.string().max(200).optional(),
  testNotes: z.string().max(5000).optional(),
  position: z.number().int().optional(),
  revision: z.number().int().optional(),
  practiceCases: z.array(test).max(200),
  submissionCases: z.array(test).max(200),
  references: z.object({ mysql: z.string().max(20000), postgresql: z.string().max(20000) }),
});
export function cleanStatement(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [
      'p',
      'br',
      'strong',
      'em',
      'b',
      'i',
      'u',
      'code',
      'pre',
      'ul',
      'ol',
      'li',
      'h2',
      'h3',
      'h4',
      'table',
      'thead',
      'tbody',
      'tr',
      'th',
      'td',
      'sup',
      'sub',
      'blockquote',
      'a',
      'img',
    ],
    allowedAttributes: { a: ['href', 'title'], img: ['src', 'alt', 'width', 'height'] },
    allowedSchemes: ['https'],
    allowProtocolRelative: false,
    exclusiveFilter: (frame) =>
      frame.tag === 'img' &&
      !/^\/problem-assets\/[^/]+\.(png|svg|jpg|webp)$/.test(frame.attribs.src || '') &&
      !/^https:\/\/(?:assets\.leetcode\.com|leetcode\.com)\//.test(frame.attribs.src || ''),
  });
}
export function parseDraft(value: unknown): Problem {
  const parsed = question.safeParse(value);
  if (!parsed.success)
    throw Object.assign(
      new Error(
        parsed.error.issues
          .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
          .slice(0, 5)
          .join('\n'),
      ),
      { status: 400 },
    );
  const problem = parsed.data as Problem;
  if (problem.statementHtml) problem.statementHtml = cleanStatement(problem.statementHtml);
  const unique = (names: string[]) =>
    new Set(names.map((name) => name.toLowerCase())).size === names.length;
  if (!unique(problem.schema.map((table) => table.name)))
    throw new Error('Table names must be unique.');
  for (const table of problem.schema) {
    if (!unique(table.columns.map((column) => column.name)))
      throw new Error(`${table.name}: column names must be unique.`);
    if (table.primaryKey?.some((name) => !table.columns.some((column) => column.name === name)))
      throw new Error(`${table.name}: primary key columns must exist.`);
  }
  if (!unique(problem.submissionCases.map((item) => item.id)))
    throw new Error('Test case IDs must be unique.');
  const visible = new Set(problem.practiceCases.map((item) => item.id));
  if (
    visible.size !== problem.practiceCases.length ||
    [...visible].some((id) => !problem.submissionCases.some((item) => item.id === id))
  )
    throw new Error('Every practice case must have a unique matching submission case.');
  problem.practiceCases = problem.submissionCases.filter((item) => visible.has(item.id));
  for (const item of problem.submissionCases) {
    validateInput(problem, item.input);
    if (item.expected?.rows.some((row) => row.length !== item.expected!.columns.length))
      throw new Error(`${item.name}: output row sizes must match the column names.`);
  }
  return problem;
}
export function requirePublishable(problem: Problem) {
  if (!problem.schema.length || (!problem.statementHtml?.trim() && !problem.summary?.trim()))
    throw new Error('Add the problem statement and table schema.');
  if (!problem.practiceCases.length || problem.submissionCases.length < 2)
    throw new Error('Add a visible example and at least one different edge case.');
  if (new Set(problem.submissionCases.map((item) => JSON.stringify(item.input))).size < 2)
    throw new Error('Add at least two different test inputs.');
  for (const engine of ['mysql', 'postgresql'] as const)
    checkStatement(problem.references[engine], engine);
  const columns = problem.submissionCases.find((test) => test.expected)?.expected?.columns;
  if (
    columns &&
    problem.orderBy?.some(
      (key) => !columns.some((column) => column.toLowerCase() === key.column.toLowerCase()),
    )
  )
    throw new Error('Sort columns must exist in the expected output.');
}
