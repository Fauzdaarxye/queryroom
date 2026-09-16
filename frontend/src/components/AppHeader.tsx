import React from 'react';

import type { SessionInfo, LibraryOptions } from '../types';

import { ArrowRight, Braces, Moon, Sun } from 'lucide-react';

import AccountMenu from './AccountMenu';

import IconButton from './IconButton.tsx';

import { cx } from '../lib/display.ts';

interface Props {
  showDashboard: (push?: boolean) => void;
  view: string;
  showQuestions: (preset?: Partial<LibraryOptions>) => void;
  showLeaderboard: () => void;
  session: SessionInfo;
  saveStatus: string;
  theme: string;
  setTheme: React.Dispatch<React.SetStateAction<string>>;
  accountMenu: boolean;
  setAccountMenu: React.Dispatch<React.SetStateAction<boolean>>;
  showProfile: () => void;
  showAdmin: () => void;
  signOut: () => Promise<void>;
  showLogin: () => void;
}

export default function AppHeader({
  showDashboard,
  view,
  showQuestions,
  showLeaderboard,
  session,
  saveStatus,
  theme,
  setTheme,
  accountMenu,
  setAccountMenu,
  showProfile,
  showAdmin,
  signOut,
  showLogin,
}: Props) {
  return (
    <header className="app-header account-header">
      <a
        className="brand"
        href="/dashboard"
        aria-label="Queryroom home"
        onClick={(e) => {
          e.preventDefault();
          showDashboard();
        }}
      >
        <span className="brand-mark">
          <Braces size={21} />
        </span>
        <span>
          queryroom<span className="brand-period">.</span>
        </span>
      </a>
      <nav className="dashboard-nav" aria-label="Main navigation">
        <button className={view === 'dashboard' ? 'active' : ''} onClick={() => showDashboard()}>
          Dashboard
        </button>
        <button
          className={['questions', 'practice'].includes(view) ? 'active' : ''}
          onClick={() => showQuestions()}
        >
          Questions
        </button>
        <button className={view === 'leaderboard' ? 'active' : ''} onClick={showLeaderboard}>
          Leaderboard
        </button>
      </nav>
      <div className="header-right">
        <span className={cx('account-state', !session.user && 'guest')}>
          <span />
          {session.user
            ? saveStatus.includes('pending')
              ? 'Sync pending'
              : saveStatus === 'Saving…'
                ? 'Saving…'
                : 'Account synced'
            : 'Guest workspace'}
        </span>
        <IconButton
          label={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
          onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
        >
          {theme === 'light' ? <Moon size={17} /> : <Sun size={18} />}
        </IconButton>
        {session.user ? (
          <AccountMenu
            user={session.user}
            open={accountMenu}
            onOpenChange={setAccountMenu}
            onProfile={showProfile}
            onAdmin={showAdmin}
            adminActive={view === 'admin'}
            profileActive={view === 'profile'}
            onSignOut={signOut}
          />
        ) : (
          <button className="header-signin" onClick={showLogin}>
            Sign in
            <ArrowRight size={13} />
          </button>
        )}
      </div>
    </header>
  );
}
