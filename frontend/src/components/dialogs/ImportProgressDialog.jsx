import { Check, LoaderCircle } from 'lucide-react';

import Modal from '../Modal.jsx';

export default function ImportProgressDialog({
  importBusy,
  setModal,
  session,
  guestImport,
  importProgress,
}) {
  return (
    <Modal
      title="Bring your progress with you"
      className="import-modal"
      onClose={() => {
        if (!importBusy) setModal(null);
      }}
    >
      <p>
        This browser has existing practice progress. Add it to <strong>{session.user.email}</strong>{' '}
        so you can continue on any device.
      </p>
      <div className="import-summary">
        <span>{Object.keys(guestImport).length} questions with progress</span>
        <span>{Object.values(guestImport).filter((item) => item.solved).length} solved</span>
      </div>
      <p>
        Existing account drafts and notes are kept. Solved questions, bookmarks, and submission
        history are combined. Your guest copy stays in this browser.
      </p>
      <div className="modal-actions">
        <button
          className="secondary-button"
          disabled={importBusy}
          onClick={() => importProgress(true)}
        >
          Keep separate
        </button>
        <button
          className="primary-button"
          disabled={importBusy}
          onClick={() => importProgress(false)}
        >
          {importBusy ? <LoaderCircle className="spin" size={15} /> : <Check size={15} />}Import my
          progress
        </button>
      </div>
    </Modal>
  );
}
