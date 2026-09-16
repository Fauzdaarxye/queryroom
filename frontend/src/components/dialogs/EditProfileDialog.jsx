import { ProfileForm } from '../../pages/AccountPages.jsx';

import Modal from '../Modal.jsx';

export default function EditProfileDialog({ setModal, session, saveProfile }) {
  return (
    <Modal title="Edit your profile" className="profile-edit-modal" onClose={() => setModal(null)}>
      <ProfileForm
        user={session.user}
        editing
        onSave={saveProfile}
        onCancel={() => setModal(null)}
      />
    </Modal>
  );
}
