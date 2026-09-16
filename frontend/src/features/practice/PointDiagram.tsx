import { cx } from '../../lib/display.ts';

export default function PointDiagram() {
  return (
    <div className="diagram">
      <div className="diagram-heading">
        <span>THE EXAMPLE, VISUALIZED</span>
        <span>
          <i className="legend-dot" /> Valid rectangles
        </span>
      </div>
      <svg
        viewBox="0 0 470 203"
        role="img"
        aria-label="Points 1 at (2,7), 2 at (4,8), and 3 at (2,10). Two valid rectangles have areas 2 and 4."
      >
        <defs>
          <pattern id="grid" width="34" height="34" patternUnits="userSpaceOnUse">
            <path d="M 34 0 L 0 0 0 34" fill="none" stroke="var(--diagram-grid)" strokeWidth="1" />
          </pattern>
        </defs>
        <rect x="45" y="15" width="238" height="170" fill="url(#grid)" />
        <path d="M57 16V180H295" fill="none" stroke="var(--muted)" strokeWidth="1" opacity=".5" />
        <path
          d="M54 21L57 15L60 21M289 177L295 180L289 183"
          fill="none"
          stroke="var(--muted)"
          opacity=".5"
        />
        <rect
          x="113"
          y="45"
          width="126"
          height="68"
          rx="2"
          fill="var(--accent)"
          fillOpacity=".10"
          stroke="var(--accent)"
          strokeWidth="1.5"
          strokeDasharray="4 4"
        />
        <rect
          x="113"
          y="113"
          width="126"
          height="34"
          rx="2"
          fill="#b28b46"
          fillOpacity=".09"
          stroke="#b28b46"
          strokeWidth="1.5"
          strokeDasharray="4 4"
        />
        <g fill="var(--accent)" stroke="var(--surface)" strokeWidth="3">
          <circle cx="113" cy="45" r="5.5" />
          <circle cx="239" cy="113" r="5.5" />
          <circle cx="113" cy="147" r="5.5" />
        </g>
        <g fontFamily="inherit" fontSize="11" fill="var(--text)">
          <text x="125" y="36">
            3 (2, 10)
          </text>
          <text x="250" y="115">
            2 (4, 8)
          </text>
          <text x="125" y="165">
            1 (2, 7)
          </text>
        </g>
        <g fontFamily="inherit" fontSize="12" fontWeight="600">
          <text x="155" y="84" fill="var(--accent)">
            area = 4
          </text>
          <text x="155" y="135" fill="#a17b35">
            area = 2
          </text>
        </g>
        <g fontFamily="inherit" fontSize="10" fill="var(--muted)">
          <text x="43" y="12">
            y
          </text>
          <text x="304" y="184">
            x
          </text>
        </g>
        <path d="M320 66H335" stroke="var(--border)" />
        <g fontFamily="inherit" fontSize="11" fill="var(--muted)">
          <text x="330" y="89">
            Two opposite corners.
          </text>
          <text x="330" y="106">
            One rectangle.
          </text>
        </g>
      </svg>
    </div>
  );
}
