import React, { useEffect, useRef } from 'react';

import { X } from 'lucide-react';

import IconButton from './IconButton.tsx';

import { cx } from '../lib/display.ts';

export default function Modal({
  title,
  children,
  onClose,
  className,
}: {
  title: string;
  children: React.ReactNode;
  onClose(): void;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement;
    const dialog = ref.current!;
    dialog.showModal();
    return () => {
      dialog.close();
      (previous as HTMLElement | null)?.focus?.();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={cx('modal', className)}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="modal-heading">
        <h2>{title}</h2>
        <IconButton label="Close dialog" onClick={onClose}>
          <X size={18} />
        </IconButton>
      </div>
      {children}
    </dialog>
  );
}
