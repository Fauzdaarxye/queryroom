import Modal from '../Modal.jsx';

export default function ResetQueryDialog({ setModal, setQuery, problem, setToast }) {
  return (
    <Modal title="Start with a clean editor?" onClose={() => setModal(null)}>
      <p>
        This replaces your current draft with the starter. Submitted queries stay in your history.
      </p>
      <div className="modal-actions">
        <button className="secondary-button" onClick={() => setModal(null)}>
          Keep my draft
        </button>
        <button
          className="primary-button"
          onClick={() => {
            setQuery(problem.starter);
            setModal(null);
            setToast('Editor reset. You can undo with ⌘ Z.');
          }}
        >
          Reset editor
        </button>
      </div>
    </Modal>
  );
}
