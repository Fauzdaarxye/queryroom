import { cx } from '../lib/display.mjs';

export default function DataTable({ columns, rows, compact = false }) {
  return (
    <div className={cx('data-table-wrap', compact && 'compact')}>
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((col, i) => (
              <th key={i}>{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((value, j) => (
                <td key={j}>{value === null ? <em>NULL</em> : String(value)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <div className="empty-rows">No rows</div>}
    </div>
  );
}
