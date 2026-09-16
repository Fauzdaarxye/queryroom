import React from 'react';
import type { PublicProblem, ProgressMap } from '../../../../shared/types';

import { placeholder } from '@codemirror/view';

import {
  ArrowUpRight,
  Braces,
  ChevronRight,
  Circle,
  CircleCheck,
  Play,
  Search,
  X,
} from 'lucide-react';

import IconButton from '../../components/IconButton.tsx';

import RememberedProblemList from './RememberedProblemList.tsx';
import DifficultyFilters from './DifficultyFilters.tsx';

import { cx } from '../../lib/display.ts';

interface Props {
  setDrawer: React.Dispatch<React.SetStateAction<boolean>>;
  solvedCount: number;
  problems: PublicProblem[];
  search: string;
  setSearch: React.Dispatch<React.SetStateAction<string>>;
  filter: string;
  setFilter: React.Dispatch<React.SetStateAction<string>>;
  difficulty: string;
  setDifficulty: React.Dispatch<React.SetStateAction<string>>;
  matchingProblems: PublicProblem[];
  visibleProblems: PublicProblem[];
  slug: string;
  problemListPosition: React.RefObject<{ viewKey: string; activeSlug: string; top: number } | null>;
  switchProblem: (problem: PublicProblem | undefined, push?: boolean) => void;
  progress: ProgressMap;
}

export default function ProblemDrawer({
  setDrawer,
  solvedCount,
  problems,
  search,
  setSearch,
  filter,
  setFilter,
  difficulty,
  setDifficulty,
  matchingProblems,
  visibleProblems,
  slug,
  problemListPosition,
  switchProblem,
  progress,
}: Props) {
  return (
    <div className="drawer-backdrop" onClick={() => setDrawer(false)}>
      <aside
        className="problem-drawer"
        aria-label="Problem list"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="drawer-title">
          <span className="brand-mark">
            <Braces size={20} />
          </span>
          <h2>Your practice list</h2>
          <IconButton label="Close problem list" onClick={() => setDrawer(false)}>
            <X size={18} />
          </IconButton>
        </div>
        <div className="progress-card">
          <div>
            <span>Small steps. Real progress.</span>
            <strong>
              {solvedCount} <span>/ {problems.length}</span>
            </strong>
          </div>
          <div className="progress-track">
            <span style={{ width: `${(solvedCount / problems.length) * 100}%` }} />
          </div>
          <p>
            {solvedCount ? 'Keep the momentum going.' : 'Your first solved question is waiting.'}
          </p>
        </div>
        <label className="problem-search">
          <Search size={16} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search your questions"
          />
        </label>
        <div className="drawer-filters">
          {['all', 'playlist', 'added', 'unsolved', 'solved', 'starred'].map((f) => (
            <button className={cx(filter === f && 'selected')} onClick={() => setFilter(f)} key={f}>
              {f === 'all'
                ? 'All'
                : f === 'playlist'
                  ? 'Playlist'
                  : f === 'added'
                    ? 'Added'
                    : f === 'unsolved'
                      ? 'Unsolved'
                      : f === 'solved'
                        ? 'Solved'
                        : 'Starred'}
            </button>
          ))}
        </div>
        <DifficultyFilters
          value={difficulty}
          onChange={setDifficulty}
          problems={matchingProblems}
        />
        <div className="collection-summary">
          {visibleProblems.length} {visibleProblems.length === 1 ? 'question' : 'questions'}
          <span>{filter === 'playlist' ? 'Playlist order' : 'Practice order'}</span>
        </div>
        <RememberedProblemList
          viewKey={JSON.stringify([filter, difficulty, search])}
          activeSlug={slug}
          position={problemListPosition}
        >
          {visibleProblems.map((p) => (
            <button
              className={cx('problem-card', p.slug === slug && 'current')}
              aria-current={p.slug === slug ? 'true' : undefined}
              onClick={() => switchProblem(p)}
              key={p.slug}
            >
              <span className="problem-card-check">
                {progress[p.slug]?.solved ? <CircleCheck size={17} /> : <Circle size={16} />}
              </span>
              <span>
                <small>
                  {p.number ? `#${p.number}` : p.id} ·{' '}
                  {p.playlist
                    ? `Lesson ${p.playlistIndex}`
                    : p.collection === 'Added questions'
                      ? 'Added question'
                      : 'Your first question'}
                </small>
                <strong>{p.title}</strong>
                <span className={`badge ${p.difficulty.toLowerCase()}`}>{p.difficulty}</span>
              </span>
              <ChevronRight size={16} />
            </button>
          ))}
          {visibleProblems.length === 0 && <p className="drawer-empty">No questions here yet.</p>}
        </RememberedProblemList>
        <div className="playlist-drawer-footer">
          <Play size={15} />
          <div>
            <strong>Leetcode SQL Hard</strong>
            <span>53 questions · 54 video lessons</span>
          </div>
          <a
            href="https://www.youtube.com/playlist?list=PLtfxzVLWb-B9M7Rx5BrZwZqSBP2_IzRMA"
            target="_blank"
            rel="noreferrer"
            aria-label="Open the source playlist"
          >
            <ArrowUpRight size={15} />
          </a>
        </div>
      </aside>
    </div>
  );
}
