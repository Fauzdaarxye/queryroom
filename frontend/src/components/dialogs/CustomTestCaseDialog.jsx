import { Check } from 'lucide-react';

import Modal from '../Modal.jsx';

export default function CustomTestCaseDialog({
  setModal,
  problem,
  customDraft,
  setCustomDraft,
  customError,
  saveCustom,
}) {
  return (
    <Modal title="Try your own test case" className="custom-modal" onClose={() => setModal(null)}>
      <p>
        Use one array per table, with up to 100 rows each. Use JSON <code>null</code> for missing
        values, numbers for numeric columns, and quoted strings for text and dates.
      </p>
      <div className="custom-schema-guide">
        {problem.schema.map((t) => (
          <div key={t.name}>
            <strong>{t.name}</strong>
            <code>[{t.columns.map((c) => c.name).join(', ')}]</code>
          </div>
        ))}
      </div>
      <textarea
        className="custom-input"
        aria-label="Custom test case JSON"
        value={customDraft}
        onChange={(e) => setCustomDraft(e.target.value)}
        spellCheck={false}
      />
      {customError && (
        <p className="custom-error" role="alert">
          {customError}
        </p>
      )}
      <div className="modal-actions">
        <button className="secondary-button" onClick={() => setModal(null)}>
          Cancel
        </button>
        <button className="primary-button" onClick={saveCustom}>
          <Check size={15} /> Use this case
        </button>
      </div>
    </Modal>
  );
}
