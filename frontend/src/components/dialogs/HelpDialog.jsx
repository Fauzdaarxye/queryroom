import Modal from '../Modal.jsx';

export default function HelpDialog({ setModal }) {
  return (
    <Modal title="Make yourself at home" onClose={() => setModal(null)}>
      <p>A little less setup. A little more SQL.</p>
      <div className="shortcut-list">
        <div>
          <span>Run the selected test</span>
          <span>
            <kbd>⌘ / Ctrl</kbd> <kbd>Enter</kbd>
          </span>
        </div>
        <div>
          <span>Submit against all tests</span>
          <span>
            <kbd>⌘ / Ctrl</kbd> <kbd>Shift</kbd> <kbd>Enter</kbd>
          </span>
        </div>
        <div>
          <span>Editor autocomplete</span>
          <span>
            <kbd>Ctrl</kbd> <kbd>Space</kbd>
          </span>
        </div>
        <div>
          <span>Find in your query</span>
          <span>
            <kbd>⌘ / Ctrl</kbd> <kbd>F</kbd>
          </span>
        </div>
        <div>
          <span>Undo an editor change</span>
          <span>
            <kbd>⌘ / Ctrl</kbd> <kbd>Z</kbd>
          </span>
        </div>
      </div>
      <p className="modal-note">
        Drag the dividers to resize your workspace. Guest progress saves in this browser. Continue
        with Google to save solved status, drafts, notes, bookmarks, and submissions to your account
        across devices. On your first sign-in, you can import your browser progress. Custom test
        cases and display preferences stay in this browser.
      </p>
    </Modal>
  );
}
