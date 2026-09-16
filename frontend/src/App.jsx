import AppHeader from './components/AppHeader.jsx';
import ProblemDrawer from './features/practice/ProblemDrawer.jsx';
import EditProfileDialog from './components/dialogs/EditProfileDialog.jsx';
import ImportProgressDialog from './components/dialogs/ImportProgressDialog.jsx';
import ResetQueryDialog from './components/dialogs/ResetQueryDialog.jsx';
import SqlEngineDialog from './components/dialogs/SqlEngineDialog.jsx';
import HelpDialog from './components/dialogs/HelpDialog.jsx';
import TestCoverageDialog from './components/dialogs/TestCoverageDialog.jsx';
import CustomTestCaseDialog from './components/dialogs/CustomTestCaseDialog.jsx';
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  ArrowUpRight,
  BookOpen,
  Braces,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  CircleCheck,
  CircleHelp,
  Clock3,
  Code2,
  Database,
  FileText,
  History,
  Keyboard,
  LayoutList,
  LoaderCircle,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Send,
  ShieldCheck,
  Sparkles,
  StickyNote,
  Terminal,
} from 'lucide-react';

import { createBrowserProgressStore } from './stores/progress-store.mjs';
import { createAccountProgressStore } from './stores/account-progress.mjs';
import Dashboard from './pages/Dashboard.jsx';

import QuestionLibrary from './pages/QuestionLibrary.jsx';
import Leaderboard from './pages/Leaderboard.jsx';
import {
  defaultLeaderboardOptions,
  readLeaderboardOptions,
  leaderboardQuery,
} from '../../shared/leaderboard.mjs';
import {
  defaultLibraryOptions,
  readLibraryOptions,
  libraryQuery,
} from '../../shared/questions.mjs';
import { LoginPage, OnboardingPage, ProfilePage } from './pages/AccountPages.jsx';
import { pagePath, resolvePage } from '../../shared/navigation.mjs';
import { hasProgress } from '../../shared/progress.mjs';
import { validateInput } from '../../shared/input.mjs';
import IconButton from './components/IconButton.jsx';
import DataTable from './components/DataTable.jsx';

import Description from './features/practice/Description.jsx';

import SQLEditor from './features/practice/SQLEditor.jsx';
import SubmissionHistory from './features/practice/SubmissionHistory.jsx';
import TestResults from './features/practice/TestResults.jsx';
import { cx } from './lib/display.mjs';

import { api } from './lib/api.mjs';
import { apiIdentity } from './lib/api.mjs';
import { localRead } from './lib/storage.mjs';
import { localWrite } from './lib/storage.mjs';

import './styles/styles.css';

const guestProgressStore = createBrowserProgressStore();

const pageView = (user = null) =>
  resolvePage(
    window.location.pathname,
    user,
    new URLSearchParams(window.location.search).has('problem'),
  );
const emptyProgress = { draft: null, notes: '', bookmarked: false, solved: false, submissions: [] };

export default function App() {
  const [view, setView] = useState(pageView),
    [session, setSession] = useState({ user: null, googleConfigured: false });
  const [accountMenu, setAccountMenu] = useState(false),
    [guestImport, setGuestImport] = useState(null),
    [importBusy, setImportBusy] = useState(false);
  const [savingProblems, setSavingProblems] = useState(new Set());
  const [loginError, setLoginError] = useState('');
  const [libraryOptions, setLibraryOptions] = useState(() =>
    readLibraryOptions(window.location.search),
  );
  const [leaderboardOptions, setLeaderboardOptions] = useState(() =>
    readLeaderboardOptions(window.location.search),
  );
  const progressStoreRef = useRef(guestProgressStore);
  const progressStore = progressStoreRef.current;
  const savedLabel = session.user ? 'Saved to your account' : 'Saved in this browser';
  const [problems, setProblems] = useState([]),
    [progress, setProgress] = useState({}),
    [slug, setSlug] = useState('rectangles-area');
  const [loading, setLoading] = useState(true),
    [loadError, setLoadError] = useState('');
  const [query, setQuery] = useState(''),
    [notes, setNotes] = useState(''),
    [saveStatus, setSaveStatus] = useState('Saved in this browser');
  const [engine, setEngine] = useState(() =>
    localRead('queryroom-engine', 'mysql') === 'postgresql' ? 'postgresql' : 'mysql',
  );
  const [engines, setEngines] = useState([]);
  const [theme, setTheme] = useState(() => localRead('queryroom-theme', 'light'));
  const [problemFontSize, setProblemFontSize] = useState(() => {
    const saved = localRead('queryroom-problem-font-size', 100);
    return Number.isFinite(saved) ? Math.max(100, Math.min(200, saved)) : 100;
  });
  const [leftTab, setLeftTab] = useState('description'),
    [bottomTab, setBottomTab] = useState('testcases');
  const [caseId, setCaseId] = useState('example'),
    [custom, setCustom] = useState(null),
    [customDraft, setCustomDraft] = useState(''),
    [customError, setCustomError] = useState('');
  const [busy, setBusy] = useState(false),
    [result, setResult] = useState(null),
    [modal, setModal] = useState(null);
  const [drawer, setDrawer] = useState(false),
    [filter, setFilter] = useState('all'),
    [search, setSearch] = useState('');
  const difficulty = 'all';
  const [focused, setFocused] = useState(false),
    [bottomCollapsed, setBottomCollapsed] = useState(false),
    [cursor, setCursor] = useState({ line: 1, col: 1 });
  const [timerRunning, setTimerRunning] = useState(false),
    [elapsed, setElapsed] = useState(() => localRead('queryroom-timer', 0));
  const [leftWidth, setLeftWidth] = useState(45),
    [editorHeight, setEditorHeight] = useState(49),
    [toast, setToast] = useState('');
  const hydrated = useRef(false),
    workspaceRef = useRef(null),
    rightRef = useRef(null),
    executing = useRef(false);
  const savedSnapshots = useRef({}),
    draftValues = useRef({}),
    activeSlug = useRef(slug);
  activeSlug.current = slug;
  const persistDraft = (key, draft, draftNotes) => {
    const snapshot = { draft, notes: draftNotes };
    draftValues.current[key] = snapshot;
    return progressStore
      .saveDraft(key, draft, draftNotes)
      .then((saved) => {
        savedSnapshots.current[key] = snapshot;
        setProgress((prev) => ({ ...prev, [key]: saved }));
        if (activeSlug.current === key && draftValues.current[key] === snapshot)
          setSaveStatus(savedLabel);
      })
      .catch(() => {
        if (activeSlug.current === key && draftValues.current[key] === snapshot)
          setSaveStatus(
            session.user
              ? 'Sync pending · reconnect to save'
              : 'Not saved · browser storage unavailable',
          );
      });
  };
  const problem = problems.find((p) => p.slug === slug),
    currentProgress = progress[slug] || emptyProgress;
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localWrite('queryroom-theme', theme);
  }, [theme]);
  useEffect(() => {
    localWrite('queryroom-problem-font-size', problemFontSize);
  }, [problemFontSize]);
  useEffect(() => {
    Promise.all([api('/api/problems'), api('/api/engines'), api('/api/session')])
      .then(async ([p, available, profile]) => {
        apiIdentity.account = profile.user?.id || null;
        apiIdentity.csrf = profile.csrfToken;
        const store = profile.user
          ? createAccountProgressStore({ api, userId: profile.user.id })
          : guestProgressStore;
        progressStoreRef.current = store;
        // Recovery drafts are replayed after onboarding, when account writes are enabled.
        const saved =
          profile.user && !profile.user.profileComplete
            ? await api('/api/progress')
            : await store.read(p.map((item) => item.slug));
        setSession(profile);
        setEngines(available);
        setProblems(p);
        setProgress(saved);
        setSaveStatus(profile.user ? 'Saved to your account' : 'Saved in this browser');
        savedSnapshots.current = Object.fromEntries(
          p.map((item) => [
            item.slug,
            {
              draft: saved[item.slug]?.draft ?? item.starter,
              notes: saved[item.slug]?.notes || '',
            },
          ]),
        );
        const params = new URLSearchParams(window.location.search);
        const requested =
          params.get('problem') || localRead('queryroom-current-problem', 'rectangles-area');
        const first = p.find((item) => item.slug === requested) || p[0];
        const snapshot = savedSnapshots.current[first.slug];
        setSlug(first.slug);
        setQuery(snapshot.draft);
        setNotes(snapshot.notes);
        setCaseId(first.practiceCases[0].id);
        setCustom(localRead(`queryroom-custom-${first.slug}`, null));
        const authErrors = {
          unavailable: 'Google sign-in is not available yet. You can keep practising as a guest.',
          cancelled: 'Sign-in cancelled. Your guest progress is still here.',
          expired: 'That sign-in link expired. Please try Continue with Google again.',
          failed: 'Google sign-in could not be completed. Please try again.',
        };
        if (params.has('auth_error'))
          setLoginError(authErrors[params.get('auth_error')] || authErrors.failed);
        if (params.has('signed_in'))
          setToast(
            `Welcome, ${profile.user?.name?.split(' ')[0] || 'back'}. Your account is ready.`,
          );
        params.delete('auth_error');
        params.delete('signed_in');
        const nextView = pageView(profile.user);
        setView(nextView);
        const initialLibrary = readLibraryOptions(window.location.search);
        if (nextView === 'questions') setLibraryOptions(initialLibrary);
        const initialStandings = readLeaderboardOptions(window.location.search);
        if (nextView === 'leaderboard') setLeaderboardOptions(initialStandings);
        window.history.replaceState(
          null,
          '',
          pagePath(nextView) +
            (nextView === 'practice'
              ? `?problem=${encodeURIComponent(first.slug)}`
              : nextView === 'questions'
                ? libraryQuery(initialLibrary)
                : nextView === 'leaderboard'
                  ? leaderboardQuery(initialStandings)
                  : ''),
        );
        if (profile.user?.profileComplete && !profile.user.guestImportDone) {
          const browserSaved = await guestProgressStore
            .read(p.map((item) => item.slug))
            .catch(() => ({}));
          const items = Object.fromEntries(
            Object.entries(browserSaved).filter(([, item]) => hasProgress(item)),
          );
          if (Object.keys(items).length) {
            setGuestImport(items);
            setModal('import');
          }
        }
        hydrated.current = true;
        setLoading(false);
      })
      .catch((e) => {
        setLoadError(e.message);
        setLoading(false);
      });
  }, []);
  useEffect(() => {
    if (loading || loadError) return;
    let pending = false,
      disposed = false;
    const refresh = async () => {
      if (pending || disposed) return;
      pending = true;
      try {
        const [profile, available] = await Promise.all([api('/api/session'), api('/api/engines')]);
        if (disposed) return;
        if (
          (profile.user?.id || null) !== (session.user?.id || null) ||
          Boolean(profile.user?.profileComplete) !== Boolean(session.user?.profileComplete)
        ) {
          window.location.reload();
          return;
        }
        setSession(profile);
        apiIdentity.csrf = profile.csrfToken;
        setEngines(available);
        if (
          ['dashboard', 'questions', 'profile'].includes(view) &&
          !progressStoreRef.current.hasPending?.()
        ) {
          const saved = await progressStoreRef.current.read(problems.map((p) => p.slug));
          if (disposed || progressStoreRef.current.hasPending?.()) return;
          savedSnapshots.current = Object.fromEntries(
            problems.map((p) => [
              p.slug,
              { draft: saved[p.slug]?.draft ?? p.starter, notes: saved[p.slug]?.notes || '' },
            ]),
          );
          draftValues.current = {};
          setProgress(saved);
          const current = savedSnapshots.current[activeSlug.current];
          if (current) {
            setQuery(current.draft);
            setNotes(current.notes);
          }
        }
      } catch {
        if (!disposed)
          setEngines((previous) => previous.map((item) => ({ ...item, available: false })));
      } finally {
        pending = false;
      }
    };
    window.addEventListener('focus', refresh);
    if (['dashboard', 'questions', 'profile'].includes(view)) refresh();
    const interval = setInterval(refresh, 15000);
    return () => {
      disposed = true;
      window.removeEventListener('focus', refresh);
      clearInterval(interval);
    };
  }, [loading, loadError, session.user?.id, view, problems]);
  useEffect(() => {
    const onPop = () => {
      const next = pageView(session.user);
      const requested = new URLSearchParams(window.location.search).get('problem');
      if (next === 'practice' && requested) {
        const p = problems.find((item) => item.slug === requested);
        if (p) switchProblem(p, false);
      }
      setView(next);
      setDrawer(false);
      setAccountMenu(false);
      if (next === 'questions') setLibraryOptions(readLibraryOptions(window.location.search));
      else if (next === 'leaderboard')
        setLeaderboardOptions(readLeaderboardOptions(window.location.search));
      else if (next !== 'practice') window.history.replaceState(null, '', pagePath(next));
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  });
  useEffect(() => {
    if (!timerRunning) return;
    const interval = setInterval(() => setElapsed((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, [timerRunning]);
  useEffect(() => {
    localWrite('queryroom-timer', elapsed);
  }, [elapsed]);
  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(''), 3000);
    return () => clearTimeout(timeout);
  }, [toast]);
  useEffect(() => {
    if (!hydrated.current) return;
    const saved = savedSnapshots.current[slug];
    const pending = draftValues.current[slug] || saved;
    if (query === pending?.draft && notes === pending?.notes) {
      if (query === saved?.draft && notes === saved?.notes) setSaveStatus(savedLabel);
      return;
    }
    setSaveStatus('Saving…');
    persistDraft(slug, query, notes);
  }, [query, notes, slug]);
  useEffect(() => {
    const listener = (e) => {
      if (e.key === 'Escape') {
        setDrawer(false);
        setFocused(false);
      }
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, []);
  useEffect(() => {
    setAccountMenu(false);
  }, [view, slug, session.user?.id]);
  const run = useCallback(
    async (mode) => {
      if (!problem || view !== 'practice' || executing.current) return;
      if (!engines.some((item) => item.id === engine && item.available)) {
        setToast('The selected database is unavailable. Restart Queryroom and try again.');
        return;
      }
      executing.current = true;
      setBusy(mode);
      setBottomTab('results');
      setBottomCollapsed(false);
      try {
        const data = await api('/api/query', {
          method: 'POST',
          body: JSON.stringify({
            slug,
            sql: query,
            engine,
            mode,
            caseId,
            ...(caseId === 'custom' && mode === 'run' ? { customInput: custom } : {}),
          }),
        });
        setResult({ ...data, mode });
        if (data.submission) {
          try {
            const saved =
              data.progress || (await guestProgressStore.recordSubmission(slug, data.submission));
            setProgress((prev) => ({ ...prev, [slug]: saved }));
          } catch {
            setSaveStatus(
              session.user
                ? 'Sync pending · reconnect to save'
                : 'Not saved · browser storage unavailable',
            );
            setToast('Your query was checked, but progress could not be saved. Please try again.');
            return;
          }
        }
        if (mode === 'submit' && data.verdict === 'Accepted') {
          setTimerRunning(false);
          setToast(
            data.pointsEarned
              ? `Accepted! +${data.pointsEarned} leaderboard points.`
              : 'Nicely done. This question is marked as solved.',
          );
        }
      } catch (e) {
        setResult({
          verdict: 'Unable to run',
          error: e.message,
          passed: 0,
          total: 0,
          runtime: 0,
          results: [],
          mode,
        });
      } finally {
        setBusy(false);
        executing.current = false;
      }
    },
    [problem, query, slug, caseId, custom, engine, engines, view],
  );
  const chooseEngine = (id) => {
    if (executing.current) return;
    setEngine(id);
    localWrite('queryroom-engine', id);
    setResult(null);
  };
  const engineReady = engines.some((item) => item.id === engine && item.available);
  async function updateProblem(key, action) {
    if (savingProblems.has(key)) return;
    setSavingProblems((previous) => new Set(previous).add(key));
    try {
      const saved = await action();
      setProgress((previous) => ({ ...previous, [key]: saved }));
    } catch (error) {
      setToast(error.message || 'Your progress could not be saved. Please try again.');
    } finally {
      setSavingProblems((previous) => {
        const next = new Set(previous);
        next.delete(key);
        return next;
      });
    }
  }
  const onBookmark = (key = slug) => updateProblem(key, () => progressStore.toggleBookmark(key));
  const onSolved = (key, solved) => updateProblem(key, () => progressStore.patch(key, { solved }));
  async function continueGoogle() {
    if (executing.current) {
      setToast('Wait for your query to finish before signing in.');
      return;
    }
    setAccountMenu(false);
    setLoginError('');
    try {
      await progressStore.flush?.();
      window.location.assign('/api/auth/google');
    } catch (error) {
      setLoginError(error.message);
    }
  }
  function showLogin() {
    if (executing.current) {
      setToast('Wait for your query to finish.');
      return;
    }
    setView('login');
    setDrawer(false);
    setAccountMenu(false);
    setLoginError('');
    setTimerRunning(false);
    window.history.pushState(null, '', '/login');
  }
  function showProfile() {
    if (executing.current) {
      setToast('Wait for your query to finish.');
      return;
    }
    if (!session.user) {
      showLogin();
      return;
    }
    setView('profile');
    setDrawer(false);
    setFocused(false);
    setAccountMenu(false);
    setTimerRunning(false);
    window.history.pushState(null, '', '/profile');
  }
  async function saveProfile(fields) {
    const result = await api('/api/profile', { method: 'PUT', body: JSON.stringify(fields) });
    if (!session.user.profileComplete) {
      window.location.assign('/dashboard');
      return;
    }
    setSession((previous) => ({ ...previous, user: result.user }));
    setModal(null);
    setToast('Your profile has been updated.');
  }
  async function signOut() {
    if (executing.current) {
      setToast('Wait for your query to finish before signing out.');
      return;
    }
    try {
      await progressStore.flush?.();
      await api('/api/auth/logout', { method: 'POST' });
      window.location.assign('/login');
    } catch (error) {
      setToast(error.message);
    }
  }
  async function importProgress(skip) {
    setImportBusy(true);
    try {
      const result = await api('/api/progress/import', {
        method: 'POST',
        body: JSON.stringify(skip ? { skip: true } : { progress: guestImport }),
      });
      setSession((previous) => ({ ...previous, user: result.user }));
      setProgress(result.progress);
      savedSnapshots.current = Object.fromEntries(
        problems.map((p) => [
          p.slug,
          {
            draft: result.progress[p.slug]?.draft ?? p.starter,
            notes: result.progress[p.slug]?.notes || '',
          },
        ]),
      );
      draftValues.current = {};
      setQuery(savedSnapshots.current[slug].draft);
      setNotes(savedSnapshots.current[slug].notes);
      setModal(null);
      setGuestImport(null);
      setToast(
        skip
          ? 'Your browser progress remains separate.'
          : 'Browser progress added to your account.',
      );
    } catch (error) {
      setToast(error.message);
    } finally {
      setImportBusy(false);
    }
  }
  function updateLibraryOptions(patch, replaceOnly = false) {
    const next = { ...libraryOptions, ...patch };
    setLibraryOptions(next);
    const method =
      !replaceOnly && Object.keys(patch).length === 1 && 'page' in patch
        ? 'pushState'
        : 'replaceState';
    window.history[method](null, '', '/questions' + libraryQuery(next));
  }
  function showQuestions(preset) {
    if (executing.current) {
      setToast('Wait for your query to finish.');
      return;
    }
    const next = preset === undefined ? libraryOptions : { ...defaultLibraryOptions, ...preset };
    setLibraryOptions(next);
    setView('questions');
    setDrawer(false);
    setFocused(false);
    setAccountMenu(false);
    setTimerRunning(false);
    window.history.pushState(null, '', '/questions' + libraryQuery(next));
  }
  function updateLeaderboardOptions(patch, replaceOnly = false) {
    const next = { ...leaderboardOptions, ...patch };
    setLeaderboardOptions(next);
    const method =
      !replaceOnly && Object.keys(patch).length === 1 && 'page' in patch
        ? 'pushState'
        : 'replaceState';
    window.history[method](null, '', '/leaderboard' + leaderboardQuery(next));
  }
  function showLeaderboard() {
    if (executing.current) {
      setToast('Wait for your query to finish.');
      return;
    }
    setLeaderboardOptions({ ...defaultLeaderboardOptions });
    setView('leaderboard');
    setDrawer(false);
    setFocused(false);
    setAccountMenu(false);
    setTimerRunning(false);
    window.history.pushState(null, '', '/leaderboard');
  }
  function showDashboard(push = true) {
    if (executing.current) {
      setToast('Wait for your query to finish.');
      return;
    }
    setView('dashboard');
    setDrawer(false);
    setFocused(false);
    setTimerRunning(false);
    setAccountMenu(false);
    if (push) window.history.pushState(null, '', '/dashboard');
  }
  function resize(e, kind) {
    e.preventDefault();
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);
    const move = (event) => {
      const rect = (
        kind === 'horizontal' ? workspaceRef : rightRef
      ).current.getBoundingClientRect();
      if (kind === 'horizontal')
        setLeftWidth(Math.max(30, Math.min(65, ((event.clientX - rect.left) / rect.width) * 100)));
      else
        setEditorHeight(
          Math.max(28, Math.min(72, ((event.clientY - rect.top) / rect.height) * 100)),
        );
    };
    const end = () => {
      target.removeEventListener('pointermove', move);
      target.removeEventListener('pointerup', end);
      target.removeEventListener('pointercancel', end);
    };
    target.addEventListener('pointermove', move);
    target.addEventListener('pointerup', end);
    target.addEventListener('pointercancel', end);
  }
  function openCustom() {
    setCustomError('');
    setCustomDraft(JSON.stringify(custom || problem.example.input, null, 2));
    setModal('custom');
  }
  function saveCustom() {
    try {
      const data = JSON.parse(customDraft);
      validateInput(problem, data);
      localWrite(`queryroom-custom-${slug}`, data);
      setCustom(data);
      setCaseId('custom');
      setBottomTab('testcases');
      setModal(null);
      setToast('Custom test case is ready to run.');
    } catch (e) {
      setCustomError(
        e instanceof SyntaxError
          ? 'This is not valid JSON. Check your commas and brackets.'
          : e.message,
      );
    }
  }
  function switchProblem(p, push = true) {
    if (!p) return;
    if (p.slug === slug) {
      setView('practice');
      setDrawer(false);
      if (push)
        window.history.pushState(null, '', `/practice?problem=${encodeURIComponent(p.slug)}`);
      return;
    }
    if (executing.current) {
      setToast('Your query is still running. Please try again in a moment.');
      return;
    }
    if (
      query !== savedSnapshots.current[slug]?.draft ||
      notes !== savedSnapshots.current[slug]?.notes
    )
      persistDraft(slug, query, notes);
    const snapshot = draftValues.current[p.slug] ||
      savedSnapshots.current[p.slug] || {
        draft: progress[p.slug]?.draft ?? p.starter,
        notes: progress[p.slug]?.notes || '',
      };
    setSlug(p.slug);
    setQuery(snapshot.draft);
    setNotes(snapshot.notes);
    setCaseId(p.practiceCases[0].id);
    setCustom(localRead(`queryroom-custom-${p.slug}`, null));
    setResult(null);
    setLeftTab('description');
    setBottomTab('testcases');
    setDrawer(false);
    setCursor({ line: 1, col: 1 });
    localWrite('queryroom-current-problem', p.slug);
    setView('practice');
    if (push) window.history.pushState(null, '', `/practice?problem=${encodeURIComponent(p.slug)}`);
  }
  const matchesQuestion = (p) =>
    `${p.title} ${p.number} ${p.id}`.toLowerCase().includes(search.trim().toLowerCase()) &&
    (filter === 'all' ||
      (filter === 'playlist'
        ? Boolean(p.playlist)
        : filter === 'added'
          ? p.collection === 'Added questions'
          : filter === 'unsolved'
            ? !progress[p.slug]?.solved
            : filter === 'solved'
              ? progress[p.slug]?.solved
              : progress[p.slug]?.bookmarked));
  const matchingProblems = problems.filter(matchesQuestion);
  const visibleProblems = matchingProblems.filter(
    (p) => difficulty === 'all' || p.difficulty === difficulty,
  );
  const solvedCount = problems.filter((p) => progress[p.slug]?.solved).length;
  const activeCase =
    caseId === 'custom'
      ? {
          name: 'Custom case',
          description: 'Your own input data.',
          kind: 'Your test case',
          input: custom,
        }
      : problem?.practiceCases.find((c) => c.id === caseId);
  if (loading || loadError)
    return (
      <div className="loading-screen">
        <div className="brand-mark">
          <Braces size={25} />
        </div>
        <h1>
          queryroom<span>.</span>
        </h1>
        {loadError ? (
          <>
            <p>{loadError}</p>
            <button className="primary-button" onClick={() => window.location.reload()}>
              Try again
            </button>
          </>
        ) : (
          <>
            <LoaderCircle className="spin" size={22} />
            <p>Getting your workspace ready…</p>
          </>
        )}
      </div>
    );
  if (view === 'login')
    return (
      <LoginPage
        onGoogle={continueGoogle}
        onGuest={() => showDashboard()}
        error={loginError}
        questionCount={problems.length}
      />
    );
  if (view === 'onboarding')
    return (
      <div className="app-shell dashboard-shell">
        <header className="app-header account-header">
          <a className="brand" href="/login">
            <span className="brand-mark">
              <Braces size={21} />
            </span>
            <span>
              queryroom<span className="brand-period">.</span>
            </span>
          </a>
          <span className="onboarding-header-label">Your account, your progress.</span>
        </header>
        <OnboardingPage user={session.user} onSave={saveProfile} onSignOut={signOut} />
        {toast && (
          <div className="toast" role="status">
            {toast}
          </div>
        )}
      </div>
    );
  return (
    <div
      className={cx(
        'app-shell',
        ['dashboard', 'questions', 'leaderboard', 'profile'].includes(view) && 'dashboard-shell',
      )}
    >
      <AppHeader
        showDashboard={showDashboard}
        view={view}
        showQuestions={showQuestions}
        showLeaderboard={showLeaderboard}
        session={session}
        saveStatus={saveStatus}
        theme={theme}
        setTheme={setTheme}
        accountMenu={accountMenu}
        setAccountMenu={setAccountMenu}
        showProfile={showProfile}
        signOut={signOut}
        showLogin={showLogin}
      />
      {view === 'dashboard' ? (
        <Dashboard
          api={api}
          onLeaderboard={showLeaderboard}
          problems={problems}
          progress={progress}
          user={session.user}
          onOpen={switchProblem}
          onBrowse={showQuestions}
          onProfile={showProfile}
          onSignIn={continueGoogle}
          currentSlug={slug}
        />
      ) : view === 'questions' ? (
        <QuestionLibrary
          problems={problems}
          progress={progress}
          options={libraryOptions}
          onChange={updateLibraryOptions}
          onOpen={switchProblem}
          onSolved={onSolved}
          onBookmark={onBookmark}
          onDashboard={() => showDashboard()}
          saving={savingProblems}
        />
      ) : view === 'leaderboard' ? (
        <Leaderboard
          api={api}
          user={session.user}
          options={leaderboardOptions}
          onChange={updateLeaderboardOptions}
          onBrowse={() => showQuestions({})}
          onSignIn={continueGoogle}
        />
      ) : view === 'profile' ? (
        <ProfilePage
          user={session.user}
          problems={problems}
          progress={progress}
          onOpen={switchProblem}
          onDashboard={() => showDashboard()}
          onEdit={() => setModal('edit-profile')}
        />
      ) : (
        <>
          <div className="workspace-toolbar">
            <div className="problem-navigation">
              <button className="problem-list-button" onClick={() => setDrawer(true)}>
                <LayoutList size={17} />
                <span>Problem list</span>
                <ChevronDown size={13} />
              </button>
              <span className="toolbar-divider" />
              <IconButton
                label="Previous question"
                disabled={Boolean(busy) || problems.indexOf(problem) === 0}
                onClick={() => switchProblem(problems[problems.indexOf(problem) - 1])}
              >
                <ChevronLeft size={17} />
              </IconButton>
              <span className="problem-counter">
                {String(problems.indexOf(problem) + 1).padStart(2, '0')}{' '}
                <span>/ {String(problems.length).padStart(2, '0')}</span>
              </span>
              <IconButton
                label="Next question"
                disabled={Boolean(busy) || problems.indexOf(problem) === problems.length - 1}
                onClick={() => switchProblem(problems[problems.indexOf(problem) + 1])}
              >
                <ChevronRight size={17} />
              </IconButton>
            </div>
            <span className="pace-note current-question-title" title={problem.title}>
              {problem.title}
            </span>
            <div className="run-actions">
              <button
                className={cx('timer', timerRunning && 'running')}
                aria-label={timerRunning ? 'Pause practice timer' : 'Start practice timer'}
                title={timerRunning ? 'Pause timer' : 'Start timer'}
                onClick={() => setTimerRunning(!timerRunning)}
              >
                {timerRunning ? <Pause size={14} /> : <Clock3 size={15} />}
                <span>
                  {String(Math.floor(elapsed / 60)).padStart(2, '0')}:
                  {String(elapsed % 60).padStart(2, '0')}
                </span>
              </button>
              <button
                className="run-button"
                onClick={() => run('run')}
                disabled={Boolean(busy) || !engineReady}
                title="Run selected test · ⌘ Enter"
              >
                {busy === 'run' ? (
                  <LoaderCircle className="spin" size={15} />
                ) : (
                  <Play size={14} fill="currentColor" />
                )}
                Run<kbd>⌘ ↵</kbd>
              </button>
              <button
                className="primary-button submit-button"
                onClick={() => run('submit')}
                disabled={Boolean(busy) || !engineReady}
                title="Check all tests · ⌘ Shift Enter"
              >
                {busy === 'submit' ? (
                  <LoaderCircle className="spin" size={16} />
                ) : (
                  <Send size={15} />
                )}{' '}
                Submit
              </button>
            </div>
          </div>
          <main
            ref={workspaceRef}
            className={cx('workspace', focused && 'editor-focused')}
            style={{ '--left-width': `${leftWidth}%`, '--editor-height': `${editorHeight}%` }}
          >
            <section className="panel description-panel" aria-label="Problem details">
              <div className="panel-tabs" role="tablist" aria-label="Problem information">
                <button
                  role="tab"
                  aria-selected={leftTab === 'description'}
                  onClick={() => setLeftTab('description')}
                  className={cx(leftTab === 'description' && 'active')}
                >
                  <FileText size={15} />
                  Description
                </button>
                <button
                  role="tab"
                  aria-selected={leftTab === 'submissions'}
                  onClick={() => setLeftTab('submissions')}
                  className={cx(leftTab === 'submissions' && 'active')}
                >
                  <History size={15} />
                  Submissions
                  {currentProgress.submissions.length > 0 && (
                    <span className="tab-count">{currentProgress.submissions.length}</span>
                  )}
                </button>
                <button
                  role="tab"
                  aria-selected={leftTab === 'notes'}
                  onClick={() => setLeftTab('notes')}
                  className={cx(leftTab === 'notes' && 'active')}
                >
                  <StickyNote size={15} />
                  Notes
                </button>
              </div>
              <div
                key={slug}
                className="description-scroll"
                role="tabpanel"
                style={{ '--problem-font-scale': problemFontSize / 100 }}
              >
                {leftTab === 'description' && (
                  <Description
                    problem={problem}
                    progress={currentProgress}
                    onBookmark={() => onBookmark(slug)}
                    fontSize={problemFontSize}
                    onFontSize={setProblemFontSize}
                  />
                )}{' '}
                {leftTab === 'submissions' && (
                  <SubmissionHistory
                    submissions={currentProgress.submissions}
                    onRestore={(submission) => {
                      setQuery(submission.sql);
                      if (['mysql', 'postgresql'].includes(submission.engine))
                        chooseEngine(submission.engine);
                      setToast(
                        submission.engine && submission.engine !== 'sqlite'
                          ? 'Query and database restored.'
                          : 'Previous SQLite query restored. Review its syntax for your selected database.',
                      );
                    }}
                  />
                )}{' '}
                {leftTab === 'notes' && (
                  <div className="notes-panel">
                    <div className="section-heading">
                      <h2>Space to think</h2>
                      <StickyNote size={18} />
                    </div>
                    <p>Keep an idea, an observation, or something you learned.</p>
                    <textarea
                      aria-label="Your problem notes"
                      placeholder="What do you notice about this problem?"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      maxLength={20000}
                    />
                    <span className="note-saved">
                      <CheckCheck size={13} />
                      {saveStatus}
                    </span>
                  </div>
                )}
              </div>
              <div className="description-footer">
                <span>
                  <BookOpen size={13} /> Learn by doing
                </span>
                <button
                  className={cx('question-manual-status', currentProgress.solved && 'solved')}
                  disabled={savingProblems.has(slug)}
                  onClick={() => onSolved(slug, !currentProgress.solved)}
                >
                  {currentProgress.solved ? <CircleCheck size={12} /> : <Circle size={12} />}{' '}
                  {currentProgress.solved ? 'Mark unsolved' : 'Mark solved'}
                </button>
                <a href={problem.source} target="_blank" rel="noreferrer">
                  LeetCode #{problem.number}
                  <ArrowUpRight size={12} />
                </a>
              </div>
            </section>
            <div
              className="splitter horizontal-splitter"
              role="separator"
              tabIndex="0"
              aria-label="Resize problem and editor panels"
              aria-orientation="vertical"
              aria-valuemin="30"
              aria-valuemax="65"
              aria-valuenow={leftWidth}
              onPointerDown={(e) => resize(e, 'horizontal')}
              onKeyDown={(e) => {
                if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                  e.preventDefault();
                  setLeftWidth((w) =>
                    Math.max(30, Math.min(65, w + (e.key === 'ArrowRight' ? 2 : -2))),
                  );
                }
              }}
            >
              <span />
            </div>
            <div
              ref={rightRef}
              className={cx('right-workspace', bottomCollapsed && 'bottom-collapsed')}
            >
              <section className="panel editor-panel" aria-label="SQL editor">
                <div className="editor-panel-heading">
                  <span>
                    <Code2 size={16} />
                    <strong>Code</strong>
                  </span>
                  <div>
                    <IconButton label="Reset query to starter" onClick={() => setModal('reset')}>
                      <RotateCcw size={15} />
                    </IconButton>
                    <IconButton
                      label={focused ? 'Exit focus mode' : 'Focus on editor'}
                      onClick={() => setFocused(!focused)}
                    >
                      {focused ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
                    </IconButton>
                  </div>
                </div>
                <div className="editor-options">
                  <div className="engine-controls">
                    <label className="engine-selector">
                      <Database size={13} />
                      <select
                        aria-label="SQL database engine"
                        value={engine}
                        disabled={Boolean(busy)}
                        onChange={(e) => chooseEngine(e.target.value)}
                      >
                        <option value="mysql">MySQL</option>
                        <option value="postgresql">PostgreSQL</option>
                      </select>
                      <ChevronDown size={12} />
                    </label>
                    <IconButton label="About SQL engines" onClick={() => setModal('dialect')}>
                      <CircleHelp size={14} />
                    </IconButton>
                  </div>
                  <span className={engineReady ? '' : 'error-text'}>
                    <span className="small-dot" />{' '}
                    {engineReady ? 'Ready to query' : 'Database unavailable'}
                  </span>
                </div>
                <SQLEditor
                  key={slug}
                  value={query}
                  onChange={setQuery}
                  theme={theme}
                  onRun={() => run('run')}
                  onSubmit={() => run('submit')}
                  onCursor={setCursor}
                  schema={problem.schema}
                  engine={engine}
                />
                <div className="editor-status">
                  <span className={saveStatus.includes('unavailable') ? 'error-text' : ''}>
                    <CheckCheck size={13} />
                    {saveStatus}
                  </span>
                  <div>
                    <span>
                      Ln {cursor.line}, Col {cursor.col}
                    </span>
                    <IconButton label="Editor keyboard shortcuts" onClick={() => setModal('help')}>
                      <Keyboard size={15} />
                    </IconButton>
                  </div>
                </div>
              </section>
              <div
                className="splitter vertical-splitter"
                role="separator"
                tabIndex="0"
                aria-label="Resize code and test panels"
                aria-orientation="horizontal"
                aria-valuemin="28"
                aria-valuemax="72"
                aria-valuenow={editorHeight}
                onPointerDown={(e) => resize(e, 'vertical')}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                    e.preventDefault();
                    setEditorHeight((h) =>
                      Math.max(28, Math.min(72, h + (e.key === 'ArrowDown' ? 3 : -3))),
                    );
                  }
                }}
              >
                <span />
              </div>
              <section className="panel test-panel" aria-label="Test cases and results">
                <div className="test-panel-heading">
                  <div className="panel-tabs" role="tablist" aria-label="Test panel">
                    <button
                      role="tab"
                      aria-selected={bottomTab === 'testcases'}
                      className={cx(bottomTab === 'testcases' && 'active')}
                      onClick={() => {
                        setBottomTab('testcases');
                        setBottomCollapsed(false);
                      }}
                    >
                      <Braces size={15} />
                      Test cases
                      <span className="tab-count">
                        {problem.practiceCases.length + (custom ? 1 : 0)}
                      </span>
                    </button>
                    <button
                      role="tab"
                      aria-selected={bottomTab === 'results'}
                      className={cx(bottomTab === 'results' && 'active')}
                      onClick={() => {
                        setBottomTab('results');
                        setBottomCollapsed(false);
                      }}
                    >
                      <Terminal size={15} />
                      Test result
                      {result && (
                        <span
                          className={cx('result-dot', result.verdict === 'Accepted' && 'pass')}
                        />
                      )}
                    </button>
                  </div>
                  <IconButton
                    label={bottomCollapsed ? 'Expand test panel' : 'Collapse test panel'}
                    onClick={() => setBottomCollapsed(!bottomCollapsed)}
                  >
                    <ChevronDown size={16} className={bottomCollapsed ? 'rotate' : ''} />
                  </IconButton>
                </div>
                <div className="test-panel-content" role="tabpanel">
                  {bottomTab === 'results' ? (
                    <TestResults result={result} busy={busy} problem={problem} />
                  ) : (
                    <div className="testcases-content">
                      <div className="case-switcher">
                        {problem.practiceCases.slice(0, 3).map((c, i) => (
                          <button
                            className={cx('case-pill', caseId === c.id && 'selected')}
                            key={c.id}
                            onClick={() => setCaseId(c.id)}
                          >
                            <span className="small-dot" />
                            {i === 0 ? 'Example 1' : `Case ${i + 1}`}
                          </button>
                        ))}
                        <select
                          className={cx(
                            'more-cases',
                            !problem.practiceCases.slice(0, 3).some((c) => c.id === caseId) &&
                              'selected',
                          )}
                          aria-label="Select a test case"
                          value={
                            problem.practiceCases.slice(0, 3).some((c) => c.id === caseId)
                              ? 'more'
                              : caseId
                          }
                          onChange={(e) => setCaseId(e.target.value)}
                        >
                          <option disabled value="more">
                            {Math.max(0, problem.practiceCases.length - 3)} more cases
                          </option>
                          {problem.practiceCases.slice(3).map((c, i) => (
                            <option key={c.id} value={c.id}>
                              {i + 4}. {c.name}
                            </option>
                          ))}
                          {custom && <option value="custom">Custom case</option>}
                        </select>
                        <IconButton
                          label="Add or edit custom test case"
                          className="add-case"
                          onClick={openCustom}
                        >
                          <Plus size={17} />
                        </IconButton>
                      </div>
                      <div className="case-description">
                        <span>{activeCase?.name}</span>
                        <span>{activeCase?.kind}</span>
                      </div>
                      <p className="case-helper">{activeCase?.description}</p>
                      {activeCase &&
                        problem.schema.map((table) => (
                          <div className="case-table" key={table.name}>
                            <div className="table-heading">
                              <h3>
                                <Database size={13} />
                                {table.name}
                              </h3>
                              <span>{activeCase.input[table.name].length} rows</span>
                              {caseId === 'custom' && (
                                <button onClick={openCustom}>Edit data</button>
                              )}
                            </div>
                            <DataTable
                              columns={table.columns.map((c) => c.name)}
                              rows={activeCase.input[table.name]}
                              compact
                            />
                          </div>
                        ))}
                      <div className="case-bottom-note">
                        <ShieldCheck size={13} />
                        <span>Submit checks all {problem.totalTests} local tests.</span>
                        <button onClick={() => setModal('tests')}>
                          About the tests <ArrowUpRight size={11} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </section>
            </div>
          </main>
          <footer className="app-footer">
            <span>
              <span className="footer-dot" /> Your SQL workspace{' '}
              <span className="footer-separator">·</span>{' '}
              {session.user ? 'Progress saved to your account' : 'Progress stays in this browser'}
            </span>
            <span>
              Made for your next “aha.” <Sparkles size={12} />
            </span>
          </footer>
        </>
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={15} />
          {toast}
        </div>
      )}
      {drawer && (
        <ProblemDrawer
          setDrawer={setDrawer}
          solvedCount={solvedCount}
          problems={problems}
          search={search}
          setSearch={setSearch}
          filter={filter}
          setFilter={setFilter}
          visibleProblems={visibleProblems}
          slug={slug}
          switchProblem={switchProblem}
          progress={progress}
        />
      )}
      {modal === 'edit-profile' && (
        <EditProfileDialog setModal={setModal} session={session} saveProfile={saveProfile} />
      )}
      {modal === 'import' && guestImport && (
        <ImportProgressDialog
          importBusy={importBusy}
          setModal={setModal}
          session={session}
          guestImport={guestImport}
          importProgress={importProgress}
        />
      )}
      {modal === 'reset' && (
        <ResetQueryDialog
          setModal={setModal}
          setQuery={setQuery}
          problem={problem}
          setToast={setToast}
        />
      )}
      {modal === 'dialect' && (
        <SqlEngineDialog
          setModal={setModal}
          engines={engines}
          engine={engine}
          busy={busy}
          chooseEngine={chooseEngine}
        />
      )}
      {modal === 'help' && <HelpDialog setModal={setModal} />}
      {modal === 'tests' && <TestCoverageDialog setModal={setModal} problem={problem} />}
      {modal === 'custom' && (
        <CustomTestCaseDialog
          setModal={setModal}
          problem={problem}
          customDraft={customDraft}
          setCustomDraft={setCustomDraft}
          customError={customError}
          saveCustom={saveCustom}
        />
      )}
    </div>
  );
}
