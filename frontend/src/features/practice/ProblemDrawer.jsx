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

import IconButton from '../../components/IconButton.jsx';

import { cx } from '../../lib/display.mjs';

export default function ProblemDrawer({
  setDrawer,
  solvedCount,
  problems,
  search,
  setSearch,
  filter,
  setFilter,
  visibleProblems,
  slug,
  switchProblem,
  progress,
}) {
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
        <div className="collection-summary">
          {visibleProblems.length} {visibleProblems.length === 1 ? 'question' : 'questions'}
          <span>{filter === 'playlist' ? 'Playlist order' : 'Practice order'}</span>
        </div>
        <div className="drawer-problems">
          {visibleProblems.map((p) => (
            <button
              className={cx('problem-card', p.slug === slug && 'current')}
              onClick={() => switchProblem(p)}
              key={p.slug}
            >
              <span className="problem-card-check">
                {progress[p.slug]?.solved ? <CircleCheck size={17} /> : <Circle size={16} />}
              </span>
              <span>
                <small>
                  #{p.number} ·{' '}
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
        </div>
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
