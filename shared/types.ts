export type Engine = 'mysql' | 'postgresql';
export type Difficulty = 'Easy' | 'Medium' | 'Hard';
export type Cell = string | number | null;
export type InputData = Record<string, Cell[][]>;
export interface ResultTable { columns: string[]; rows: Cell[][] }
export interface Column { name: string; type: 'INTEGER' | 'REAL' | 'TEXT'; displayType?: string; primaryKey?: boolean }
export interface TableSchema { name: string; columns: Column[]; primaryKey?: string[]; note?: string }
export interface TestCase { id: string; name: string; kind: string; description?: string; input: InputData; expected?: ResultTable }
export interface Problem {
  id: string; slug: string; number: number; title: string; difficulty: Difficulty; category: string;
  source: string; schema: TableSchema[]; starter: string; statementHtml?: string;
  summary?: string; rules?: string[]; reference?: string;
  example?: { input: InputData; output: ResultTable; explanation?: string };
  examples?: unknown[]; orderMatters?: boolean; orderBy?: { column: string; direction: 'asc' | 'desc' }[];
  playlist?: string | boolean; playlistIndex?: number; playlistUrl?: string; videos?: {videoId: string; playlistIndex: number; url: string}[];
  collection?: string; testNotes?: string; position?: number; revision?: number;
  practiceCases: TestCase[]; submissionCases: TestCase[]; references: Record<Engine, string>;
  totalTests?: number;
}
export type PublicProblem = Omit<Problem, 'submissionCases' | 'references'> & { totalTests: number };
export interface ValidationReport { passed: boolean; checks: { engine: Engine; passed: number; total: number; error?: string }[]; checkedAt: string }
export interface AdminQuestion { problem: Problem; draftRevision: number; publishedRevision: number | null; validation: ValidationReport | null }
export interface QuestionSummary { id: string; slug: string; title: string; difficulty: Difficulty; draftRevision: number; publishedRevision: number | null; updatedAt: string }
export interface User { id: string; email: string; name: string; role: 'admin' | 'user'; username: string | null; fullName: string | null; age: number | null; profession: string | null; profileComplete: boolean; guestImportDone: boolean; joinedAt: string }
export interface Submission { id: string; date: string; sql: string; engine: Engine | 'sqlite'; verdict: string; passed: number; total: number; runtime: number }
export interface Progress { draft: string | null; notes: string; bookmarked: boolean; solved: boolean; submissions: Submission[] }
export type ProgressMap = Record<string, Progress>;
export interface CaseResult extends TestCase { expected: ResultTable; actual: ResultTable; passed: boolean; error: string | null; reason: string | null; runtime: number }
export interface QueryResult { verdict: string; passed: number; total: number; runtime: number; results: CaseResult[]; engine?: Engine | 'sqlite'; error?: string; submission?: Submission; progress?: Progress; pointsEarned?: number; mode?: 'run' | 'submit' }
export interface QueryRequest { slug: string; sql: string; engine?: Engine | 'sqlite'; mode?: 'run' | 'submit'; caseId?: string; customInput?: InputData; revision?: number }
