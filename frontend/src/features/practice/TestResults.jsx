import { useEffect, useState } from 'react';

import {
  Check,
  ChevronDown,
  CircleCheck,
  CircleHelp,
  LoaderCircle,
  Sparkles,
  Terminal,
  X,
} from 'lucide-react';

import DataTable from '../../components/DataTable.jsx';

import { engineLabel } from '../../lib/display.mjs';

export default function TestResults({ result, busy, problem }) {
  const [selected, setSelected] = useState(0);
  useEffect(() => {
    if (result) {
      const failed = result.results.findIndex((r) => !r.passed);
      setSelected(failed >= 0 ? failed : 0);
    }
  }, [result]);
  if (busy)
    return (
      <div className="empty-state results-empty">
        <LoaderCircle className="spin" size={25} />
        <h3>{busy === 'submit' ? 'Checking every test case…' : 'Running your query…'}</h3>
        <p>Your tables start fresh for every test.</p>
      </div>
    );
  if (!result)
    return (
      <div className="empty-state results-empty">
        <div className="empty-icon">
          <Terminal size={24} />
        </div>
        <h3>Let’s see what your query returns</h3>
        <p>Run your code to compare it with the expected output.</p>
        <span className="keyboard-hint">
          <kbd>⌘</kbd> <kbd>↵</kbd> <span>to run</span>
        </span>
      </div>
    );
  const current = result.results[selected];
  return (
    <div className="test-results">
      <div className="result-summary">
        <div>
          <h2 className={result.verdict === 'Accepted' ? 'success-text' : 'error-text'}>
            {result.verdict === 'Accepted' ? <CircleCheck size={21} /> : <CircleHelp size={21} />}{' '}
            {result.verdict}
          </h2>
          <span>
            {result.passed} of {result.total} tests passed <i>·</i> {result.runtime} ms <i>·</i>{' '}
            {engineLabel(result.engine)}
          </span>
        </div>
        {result.verdict === 'Accepted' && (
          <span className="result-spark">
            <Sparkles size={21} />
          </span>
        )}
      </div>
      {result.mode === 'run' && result.verdict === 'Accepted' && (
        <div className="run-success-note">
          This case passed. Submit to check all {problem.totalTests} tests.
        </div>
      )}
      {result.error && (
        <div className="error-box">
          <strong>SQL runner</strong>
          <p>{result.error}</p>
        </div>
      )}
      {result.results.length > 1 && (
        <div className="result-case-selector">
          <label htmlFor="result-case">Test case</label>
          <select
            id="result-case"
            value={selected}
            onChange={(e) => setSelected(Number(e.target.value))}
          >
            {result.results.map((r, i) => (
              <option key={r.id} value={i}>
                {r.passed ? '✓' : '×'} {i + 1}. {r.name}
              </option>
            ))}
          </select>
        </div>
      )}
      {current && (
        <>
          <div className="result-case-title">
            <span className={current.passed ? 'success-text' : 'error-text'}>
              {current.passed ? <Check size={15} /> : <X size={15} />} {current.name}
            </span>
            <span>{current.runtime} ms</span>
          </div>
          {current.reason && (
            <div className={current.error ? 'error-box' : 'mismatch-note'}>{current.reason}</div>
          )}
          <details className="result-input">
            <summary>
              Input data <ChevronDown size={13} />
            </summary>
            {problem.schema.map((t) => (
              <div key={t.name}>
                <h3>{t.name}</h3>
                <DataTable
                  columns={t.columns.map((c) => c.name)}
                  rows={current.input[t.name]}
                  compact
                />
              </div>
            ))}
          </details>
          <div className="output-comparison">
            <div>
              <h3>
                Your output <span>{current.actual.rows.length} rows</span>
              </h3>
              {current.error ? (
                <div className="no-output">Query did not complete.</div>
              ) : (
                <DataTable columns={current.actual.columns} rows={current.actual.rows} compact />
              )}
            </div>
            <div>
              <h3>
                Expected output <span>{current.expected.rows.length} rows</span>
              </h3>
              <DataTable columns={current.expected.columns} rows={current.expected.rows} compact />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
