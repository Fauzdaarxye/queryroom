import { useState } from 'react';

import { ArrowLeft, Check, ChevronRight, Code2, History, RotateCcw } from 'lucide-react';

import { cx } from '../../lib/display.mjs';
import { engineLabel } from '../../lib/display.mjs';

export default function SubmissionHistory({ submissions, onRestore }) {
  const [selected, setSelected] = useState(null);
  if (selected)
    return (
      <div className="history-detail">
        <button className="text-button" onClick={() => setSelected(null)}>
          <ArrowLeft size={14} /> All submissions
        </button>
        <div className="history-detail-title">
          <h2 className={selected.verdict === 'Accepted' ? 'success-text' : 'error-text'}>
            {selected.verdict}
          </h2>
          <span>
            {selected.passed} / {selected.total} tests passed
          </span>
        </div>
        <p className="muted">
          {new Date(selected.date).toLocaleString()} · {selected.runtime} ms ·{' '}
          {engineLabel(selected.engine)}
        </p>
        <pre className="query-preview">{selected.sql}</pre>
        <button className="secondary-button" onClick={() => onRestore(selected)}>
          <RotateCcw size={14} /> Restore this query
        </button>
      </div>
    );
  if (!submissions.length)
    return (
      <div className="empty-state history-empty">
        <div className="empty-icon">
          <History size={25} />
        </div>
        <h2>A fresh start</h2>
        <p>
          Your submissions will appear here.
          <br />
          Write a query and submit when you’re ready.
        </p>
      </div>
    );
  return (
    <div className="history-list">
      <div className="section-heading">
        <h2>Your submissions</h2>
        <span className="subtle-badge">{submissions.length} attempts</span>
      </div>
      {submissions.map((s) => (
        <button key={s.id} className="submission-row" onClick={() => setSelected(s)}>
          <span className={cx('submission-icon', s.verdict === 'Accepted' && 'accepted')}>
            {s.verdict === 'Accepted' ? <Check size={17} /> : <Code2 size={17} />}
          </span>
          <span>
            <strong className={s.verdict === 'Accepted' ? 'success-text' : 'error-text'}>
              {s.verdict}
            </strong>
            <small>
              {new Date(s.date).toLocaleString()} · {engineLabel(s.engine)}
            </small>
          </span>
          <span className="submission-meta">
            {s.passed}/{s.total}
            <small>tests passed</small>
          </span>
          <ChevronRight size={16} />
        </button>
      ))}
    </div>
  );
}
