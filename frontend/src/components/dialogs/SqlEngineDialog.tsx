import React from 'react';

import type { EngineStatus } from '../../types';

import { CircleCheck, Database, ShieldCheck } from 'lucide-react';

import Modal from '../Modal.tsx';

import { cx } from '../../lib/display.ts';

interface Props {
  setModal: React.Dispatch<React.SetStateAction<string | null>>;
  engines: EngineStatus[];
  engine: string;
  busy: false | 'run' | 'submit';
  chooseEngine: (engine: string) => void;
}

export default function SqlEngineDialog({ setModal, engines, engine, busy, chooseEngine }: Props) {
  return (
    <Modal title="Choose your SQL engine" onClose={() => setModal(null)}>
      <div className="engine-cards">
        {engines.map((item) => (
          <button
            key={item.id}
            className={cx('engine-card', engine === item.id && 'selected')}
            disabled={!item.available || Boolean(busy)}
            onClick={() => {
              chooseEngine(item.id);
              setModal(null);
            }}
          >
            <Database size={23} />
            <span>
              <strong>{item.name}</strong>
              <small>{item.version || 'Unavailable'}</small>
            </span>
            {engine === item.id && <CircleCheck size={19} />}
          </button>
        ))}
      </div>
      <p>
        Your query runs directly on the selected database. Choose MySQL for the playlist's MySQL
        syntax, or PostgreSQL to practice its date functions, casts, and SQL features.
      </p>
      <p>
        Switching engines keeps your current query. Each submission records which engine you used.
      </p>
      <div className="modal-note">
        <ShieldCheck size={16} /> Each test uses fresh tables with read-only access and a 3-second
        query limit.
      </div>
    </Modal>
  );
}
