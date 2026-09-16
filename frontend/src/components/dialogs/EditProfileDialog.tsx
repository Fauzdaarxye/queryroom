import React from 'react';

import type { SessionInfo, ProfileFields } from '../../types';

import { ProfileForm } from '../../screens/AccountPages';

import Modal from '../Modal.tsx';

interface Props {
  setModal: React.Dispatch<React.SetStateAction<string | null>>;
  session: SessionInfo;
  saveProfile: (fields: ProfileFields) => Promise<void>;
}

export default function EditProfileDialog({ setModal, session, saveProfile }: Props) {
  return (
    <Modal title="Edit your profile" className="profile-edit-modal" onClose={() => setModal(null)}>
      <ProfileForm
        user={session.user!}
        editing
        onSave={saveProfile}
        onCancel={() => setModal(null)}
      />
    </Modal>
  );
}
