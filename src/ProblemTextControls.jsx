import React from 'react';

export default function ProblemTextControls({ value, onChange }) {
  return <div className="problem-font-controls" role="group" aria-label="Problem text size">
    <button aria-label="Decrease problem font size" title="Smaller text" disabled={value <= 100} onClick={() => onChange(value - 10)}>A−</button>
    <button className="font-size-reset" aria-label="Reset problem font size" title="Reset to 100%" onClick={() => onChange(100)}><span aria-live="polite">{value}%</span></button>
    <button aria-label="Increase problem font size" title="Larger text" disabled={value >= 200} onClick={() => onChange(value + 10)}>A+</button>
  </div>;
}
