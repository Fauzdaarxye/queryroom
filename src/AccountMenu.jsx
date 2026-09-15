import { useEffect, useRef } from 'react';
import { ChevronDown, LogOut, UserRound } from 'lucide-react';

export default function AccountMenu({ user, open, onOpenChange, onProfile, profileActive, onSignOut }) {
  const container = useRef(null);
  const trigger = useRef(null);

  useEffect(() => {
    if (!open) return;
    const dismissOutside = event => {
      if (!container.current?.contains(event.target)) onOpenChange(false);
    };
    const dismissWithEscape = event => {
      if (event.key !== 'Escape') return;
      onOpenChange(false);
      trigger.current?.focus();
    };
    document.addEventListener('pointerdown', dismissOutside, true);
    document.addEventListener('focusin', dismissOutside);
    document.addEventListener('keydown', dismissWithEscape);
    return () => {
      document.removeEventListener('pointerdown', dismissOutside, true);
      document.removeEventListener('focusin', dismissOutside);
      document.removeEventListener('keydown', dismissWithEscape);
    };
  }, [open, onOpenChange]);

  return <div className="account-menu" ref={container}>
    <button ref={trigger} className="account-trigger" aria-label="Account menu"
      aria-expanded={open} aria-controls="account-popover" onClick={() => onOpenChange(!open)}>
      <span className="avatar">{user.name.slice(0, 1).toUpperCase()}</span>
      <span>{user.name.split(' ')[0]}</span><ChevronDown size={13}/>
    </button>
    {open && <div className="account-popover" id="account-popover" role="region" aria-label="Your account">
      <strong>{user.name}</strong>
      <p>{user.email}</p>
      <button aria-current={profileActive ? 'page' : undefined} onClick={() => { onOpenChange(false); onProfile(); }}><UserRound size={15}/>Profile</button>
      <button onClick={() => { onOpenChange(false); onSignOut(); }}><LogOut size={15}/>Sign out</button>
    </div>}
  </div>;
}
