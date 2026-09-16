import type { PublicProblem, Progress } from '../../../../shared/types';

import {
  ArrowUpRight,
  Circle,
  CircleCheck,
  Database,
  ListFilter,
  ShieldCheck,
  Star,
} from 'lucide-react';
import PlaylistDescription from './PlaylistDescription';
import ProblemTextControls from './ProblemTextControls';

import DataTable from '../../components/DataTable.tsx';

import PointDiagram from './PointDiagram.tsx';

import { cx } from '../../lib/display.ts';

export default function Description({
  problem,
  progress,
  onBookmark,
  fontSize,
  onFontSize,
}: {
  problem: PublicProblem;
  progress: Progress;
  onBookmark(): void;
  fontSize: number;
  onFontSize(size: number): void;
}) {
  if (problem.slug !== 'rectangles-area' || problem.statementHtml)
    return (
      <PlaylistDescription
        problem={problem}
        progress={progress}
        onBookmark={onBookmark}
        fontSize={fontSize}
        onFontSize={onFontSize}
      />
    );
  return (
    <div className="description-content">
      <div className="problem-eyebrow">
        <span>DATABASE</span>
        <span className="eyebrow-dot">/</span>
        <span title="Queryroom question ID">{problem.id}</span>
        <ProblemTextControls value={fontSize} onChange={onFontSize} />
        <button
          className={cx('bookmark', progress.bookmarked && 'is-bookmarked')}
          onClick={onBookmark}
          aria-label={progress.bookmarked ? 'Remove bookmark' : 'Bookmark question'}
          title="Bookmark question"
        >
          <Star size={17} fill={progress.bookmarked ? 'currentColor' : 'none'} />
        </button>
      </div>
      <h1>{problem.title}</h1>
      <div className="problem-badges">
        <span className="badge medium">{problem.difficulty}</span>
        <span className="badge tag">
          <Database size={12} /> SQL
        </span>
        <span className={cx('problem-status', progress.solved && 'solved')}>
          {progress.solved ? <CircleCheck size={14} /> : <Circle size={13} />}{' '}
          {progress.solved ? 'Solved' : 'Unsolved'}
        </span>
      </div>
      <p className="intro">{problem.summary}</p>
      <section className="schema-section">
        <div className="section-label">
          <Database size={15} />
          <h2>
            Table: <code>Points</code>
          </h2>
        </div>
        <div className="schema-table">
          <table>
            <thead>
              <tr>
                <th>Column name</th>
                <th>Type</th>
              </tr>
            </thead>
            <tbody>
              {problem.schema[0].columns.map((c) => (
                <tr key={c.name}>
                  <td>
                    <code>{c.name}</code>
                    {c.primaryKey && <span className="primary-key">PRIMARY KEY</span>}
                  </td>
                  <td>
                    <span className="type-text">int</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="schema-note">{problem.schema[0].note}</p>
      </section>
      <section className="task-section">
        <h2>Your task</h2>
        <p>
          Each row in your result should contain <code>p1</code>, <code>p2</code>, and{' '}
          <code>area</code>.
        </p>
        <ul className="rules-list">
          {problem.rules!.map((rule, i) => (
            <li key={i}>{rule}</li>
          ))}
        </ul>
        <div className="ordering-note">
          <ListFilter size={16} />
          <div>
            <strong>Order matters</strong>
            <span>area ↓ &nbsp; then p1 ↑ &nbsp; then p2 ↑</span>
          </div>
        </div>
      </section>
      <section className="example-section">
        <div className="section-heading">
          <h2>Example 1</h2>
          <span className="subtle-badge">Published example</span>
        </div>
        <div className="example-tables">
          <div>
            <h3>
              Input <span>Points</span>
            </h3>
            <DataTable
              columns={problem.schema[0].columns.map((c) => c.name)}
              rows={problem.example!.input.Points}
            />
          </div>
          <div>
            <h3>Expected output</h3>
            <DataTable
              columns={problem.example!.output.columns}
              rows={problem.example!.output.rows}
            />
          </div>
        </div>
        <PointDiagram />
        <h3>Explanation</h3>
        <p className="explanation">{problem.example!.explanation}</p>
      </section>
      <div className="practice-note">
        <ShieldCheck size={17} />
        <p>
          The published example is included. Extra cases are created for this workspace; LeetCode’s
          private tests are not available.
        </p>
      </div>
      <a className="source-link" href={problem.source} target="_blank" rel="noreferrer">
        View original on LeetCode <ArrowUpRight size={14} />
      </a>
    </div>
  );
}
