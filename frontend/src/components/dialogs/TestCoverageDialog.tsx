import React from 'react';
import type { PublicProblem } from '../../../../shared/types';

import Modal from '../Modal.tsx';

interface Props {
  setModal: React.Dispatch<React.SetStateAction<string | null>>;
  problem: PublicProblem;
}

export default function TestCoverageDialog({ setModal, problem }: Props) {
  return (
    <Modal title="Built to test your thinking" onClose={() => setModal(null)}>
      <div className="test-stats">
        <div>
          <strong>{problem.practiceCases.length}</strong>
          <span>Selectable cases</span>
        </div>
        <div>
          <strong>{problem.totalTests - problem.practiceCases.length}</strong>
          <span>Additional checks</span>
        </div>
        <div>
          <strong>{problem.totalTests}</strong>
          <span>Tests on Submit</span>
        </div>
      </div>
      <p>
        <strong>Run</strong> checks the selected case, or your custom input. <strong>Submit</strong>{' '}
        checks all {problem.totalTests} built-in cases and saves the result to your history.
      </p>
      <p>
        {problem.testNotes ||
          'The published example is reproduced from the question. Extra cases cover zero areas, negative coordinates, duplicate locations, large values, and sorting ties.'}
      </p>
      <p className="modal-note">
        These are local practice tests. They are not LeetCode’s private test suite.{' '}
        {problem.orderMatters === false
          ? 'This question accepts results in any row order. Values and duplicate counts must match.'
          : 'Values and the specified sorting must match.'}
      </p>
    </Modal>
  );
}
