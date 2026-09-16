import React from 'react';

import { cx } from '../lib/display.ts';

export default function IconButton({
  label,
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button className={cx('icon-button', className)} aria-label={label} title={label} {...props}>
      {children}
    </button>
  );
}
