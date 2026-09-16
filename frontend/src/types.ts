import type { PublicProblem, User, ProgressMap, Progress } from '../../shared/types';
export type ApiClient = <T = any>(path: string, options?: RequestInit) => Promise<T>;
export interface SessionInfo {
  user: User | null;
  googleConfigured: boolean;
  csrfToken?: string | null;
}
export interface EngineStatus {
  id: string;
  name: string;
  available: boolean;
  version?: string;
}
export interface LibraryOptions {
  search: string;
  difficulty: string;
  status: string;
  bookmarked: boolean;
  sort: string;
  page: number;
  pageSize: number;
}
export interface LeaderboardOptions {
  search: string;
  page: number;
}
export interface LeaderboardEntry {
  rank: number;
  username: string;
  points: number;
  solved: number;
  easy: number;
  medium: number;
  hard: number;
  isYou: boolean;
}
export interface LeaderboardData {
  entries: LeaderboardEntry[];
  currentUser: LeaderboardEntry | null;
  totalUsers: number;
  totalResults: number;
  page: number;
  pages: number;
  pageSize: number;
}
export interface ProgressStore {
  read(slugs: string[]): Promise<ProgressMap>;
  saveDraft(slug: string, draft: string, notes: string): Promise<Progress>;
  patch(slug: string, patch: Partial<Progress>): Promise<Progress>;
  toggleBookmark(slug: string): Promise<Progress>;
  flush?(): Promise<unknown>;
  hasPending?(): boolean;
}
export interface QuestionProps {
  problems: PublicProblem[];
  progress: ProgressMap;
  onOpen(problem: PublicProblem): void;
}
export type ProfileFields = { username: string; fullName: string; age: number; profession: string };
