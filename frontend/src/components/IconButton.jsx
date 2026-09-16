import { cx } from '../lib/display.mjs';

export default function IconButton({ label, children, className, ...props }) {
  return (
    <button className={cx('icon-button', className)} aria-label={label} title={label} {...props}>
      {children}
    </button>
  );
}
