import React from 'react';

export default function GoogleButton({ onClick, disabled = false, compact = false }) {
  return <button type="button" className={`google-button${compact ? ' compact' : ''}`} onClick={onClick} disabled={disabled}>
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 48 48">
      <path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5h6.6c3.9-3.6 6.1-8.8 6.1-14.9Z"/>
      <path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.6l-6.6-5a12.3 12.3 0 0 1-18.3-6.5H5.8v5.2A20.4 20.4 0 0 0 24 44Z"/>
      <path fill="#FBBC05" d="M12.6 27.9a12.1 12.1 0 0 1 0-7.8v-5.2H5.8a20 20 0 0 0 0 18.2l6.8-5.2Z"/>
      <path fill="#EA4335" d="M24 12.1c3 0 5.7 1 7.9 3.1l5.9-5.9A19.8 19.8 0 0 0 24 4 20.4 20.4 0 0 0 5.8 14.9l6.8 5.2A12 12 0 0 1 24 12.1Z"/>
    </svg><span>Continue with Google</span>
  </button>;
}
