import { useEffect, useRef } from 'react';

import { X } from 'lucide-react';

import IconButton from './IconButton.jsx';

import { cx } from '../lib/display.mjs';

export default function Modal({ title, children, onClose, className }) {
  const ref = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    const dialog = ref.current;
    dialog.showModal();
    return () => {
      dialog.close();
      previous?.focus?.();
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
