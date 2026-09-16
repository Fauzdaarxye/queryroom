import type { PublicProblem } from '../../../../shared/types';

import { cx } from '../../lib/display.ts';

export default function DifficultyFilters({
  value,
  onChange,
  problems,
}: {
  value: string;
  onChange(value: string): void;
  problems: PublicProblem[];
}) {
  return (
    <div className="difficulty-filters" role="group" aria-label="Question difficulty">
      {['all', 'Easy', 'Medium', 'Hard'].map((level) => {
        const count =
          level === 'all' ? problems.length : problems.filter((p) => p.difficulty === level).length;
        return (
          <button
            key={level}
            className={cx('difficulty-filter', level.toLowerCase(), value === level && 'selected')}
            aria-pressed={value === level}
            aria-label={
              level === 'all' ? 'Show all difficulties' : `Show ${level.toLowerCase()} questions`
            }
            onClick={() => onChange(level)}
          >
            {level === 'all' ? 'All levels' : level}
            <span className="difficulty-count">{count}</span>
          </button>
        );
      })}
    </div>
  );
}
