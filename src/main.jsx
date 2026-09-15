import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { basicSetup } from 'codemirror';
import { EditorView, keymap, placeholder } from '@codemirror/view';
import { EditorState, Compartment, Prec } from '@codemirror/state';
import { indentWithTab } from '@codemirror/commands';
import { sql, MySQL, PostgreSQL } from '@codemirror/lang-sql';
import { syntaxHighlighting, HighlightStyle } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, Braces, Check, CheckCheck, ChevronDown, ChevronLeft, ChevronRight, Circle, CircleCheck, CircleHelp, Clock3, Code2, Database, Expand, FileCode2, FileText, History, Keyboard, LayoutList, ListFilter, LoaderCircle, Maximize2, Minimize2, Moon, MoreHorizontal, Pause, Play, Plus, RotateCcw, Search, Send, ShieldCheck, Sparkles, Square, Star, StickyNote, Sun, Terminal, Trash2, X } from 'lucide-react';
import './styles.css';
import PlaylistDescription from './PlaylistDescription.jsx';
import ProblemTextControls from './ProblemTextControls.jsx';
import { createBrowserProgressStore } from './progress-store.mjs';
import { createAccountProgressStore } from './account-progress.mjs';
import Dashboard from './Dashboard.jsx';
import AccountMenu from './AccountMenu.jsx';
import QuestionLibrary from './QuestionLibrary.jsx';
import Leaderboard from './Leaderboard.jsx';
import { defaultLeaderboardOptions, readLeaderboardOptions, leaderboardQuery } from '../shared/leaderboard.mjs';
import { defaultLibraryOptions, readLibraryOptions, libraryQuery } from '../shared/questions.mjs';
import { LoginPage, OnboardingPage, ProfilePage, ProfileForm } from './AccountPages.jsx';
import { pagePath, resolvePage } from '../shared/navigation.mjs';
import { hasProgress } from '../shared/progress.mjs';
import { validateInput } from '../shared/input.mjs';

const cx = (...items) => items.filter(Boolean).join(' ');
const engineLabel = engine => ({mysql:'MySQL',postgresql:'PostgreSQL',sqlite:'SQLite (previous engine)'}[engine] || 'SQLite (previous engine)');
const guestProgressStore = createBrowserProgressStore();
const apiIdentity = { account: null, csrf: null };
const pageView = (user = null) => resolvePage(window.location.pathname, user, new URLSearchParams(window.location.search).has('problem'));
const emptyProgress = { draft: null, notes: '', bookmarked: false, solved: false, submissions: [] };
async function api(path, options) {
  const response = await fetch(path, { ...options, headers: { 'Content-Type': 'application/json', ...(apiIdentity.account ? { 'X-Queryroom-Account': apiIdentity.account, 'X-Queryroom-CSRF': apiIdentity.csrf } : {}), ...options?.headers } });
  const data = await response.json();
  if (!response.ok) throw Object.assign(new Error(data.error || 'Could not connect to the workspace server.'), { status: response.status });
  return data;
}
function localRead(key, fallback) { try { const value = localStorage.getItem(key); return value === null ? fallback : JSON.parse(value); } catch { return fallback; } }
function localWrite(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} }
function IconButton({ label, children, className, ...props }) { return <button className={cx('icon-button', className)} aria-label={label} title={label} {...props}>{children}</button>; }
function RememberedProblemList({ viewKey, activeSlug, position, children }) {
  const list = useRef(null);
  const remember = useCallback(node => {
    const saved = { viewKey, activeSlug, top: node.scrollTop };
    position.current = saved;
    localWrite('queryroom-problem-list-position', saved);
  }, [viewKey, activeSlug, position]);
  useLayoutEffect(() => {
    const node = list.current;
    const saved = position.current || localRead('queryroom-problem-list-position', null);
    // Restore before paint, so reopening the drawer doesn't flash its first row.
    node.scrollTop = saved?.viewKey === viewKey && Number.isFinite(saved.top) ? Math.max(0, saved.top) : 0;
    // A fresh visit or navigation with Previous/Next should reveal the current question.
    // Otherwise preserve the exact place where the user was browsing.
    if (!saved || saved.activeSlug !== activeSlug) {
      const active = node.querySelector('[aria-current="true"]');
      if (active) {
        const viewport = node.getBoundingClientRect(), card = active.getBoundingClientRect();
        if (card.top < viewport.top || card.bottom > viewport.bottom) {
          node.scrollTop += card.top - viewport.top - Math.max(0, (node.clientHeight - card.height) / 2);
        }
      }
    }
    remember(node);
    return () => remember(node);
  }, [viewKey, activeSlug, position, remember]);
  return <div className="drawer-problems" ref={list} onScroll={event => remember(event.currentTarget)}>{children}</div>;
}
function DifficultyFilters({ value, onChange, problems }) {
  return <div className="difficulty-filters" role="group" aria-label="Question difficulty">
    {['all', 'Easy', 'Medium', 'Hard'].map(level => {
      const count = level === 'all' ? problems.length : problems.filter(p => p.difficulty === level).length;
      return <button key={level} className={cx('difficulty-filter', level.toLowerCase(), value === level && 'selected')} aria-pressed={value === level} aria-label={level === 'all' ? 'Show all difficulties' : `Show ${level.toLowerCase()} questions`} onClick={() => onChange(level)}>
        {level === 'all' ? 'All levels' : level}<span className="difficulty-count">{count}</span>
      </button>;
    })}
  </div>;
}
function DataTable({ columns, rows, compact = false }) {
  return <div className={cx('data-table-wrap', compact && 'compact')}><table className="data-table"><thead><tr>{columns.map((col, i) => <th key={i}>{col}</th>)}</tr></thead><tbody>{rows.map((row, i) => <tr key={i}>{row.map((value, j) => <td key={j}>{value === null ? <em>NULL</em> : String(value)}</td>)}</tr>)}</tbody></table>{rows.length === 0 && <div className="empty-rows">No rows</div>}</div>;
}
function PointDiagram() {
  return <div className="diagram"><div className="diagram-heading"><span>THE EXAMPLE, VISUALIZED</span><span><i className="legend-dot" /> Valid rectangles</span></div><svg viewBox="0 0 470 203" role="img" aria-label="Points 1 at (2,7), 2 at (4,8), and 3 at (2,10). Two valid rectangles have areas 2 and 4.">
    <defs><pattern id="grid" width="34" height="34" patternUnits="userSpaceOnUse"><path d="M 34 0 L 0 0 0 34" fill="none" stroke="var(--diagram-grid)" strokeWidth="1" /></pattern></defs>
    <rect x="45" y="15" width="238" height="170" fill="url(#grid)" />
    <path d="M57 16V180H295" fill="none" stroke="var(--muted)" strokeWidth="1" opacity=".5" />
    <path d="M54 21L57 15L60 21M289 177L295 180L289 183" fill="none" stroke="var(--muted)" opacity=".5" />
    <rect x="113" y="45" width="126" height="68" rx="2" fill="var(--accent)" fillOpacity=".10" stroke="var(--accent)" strokeWidth="1.5" strokeDasharray="4 4" />
    <rect x="113" y="113" width="126" height="34" rx="2" fill="#b28b46" fillOpacity=".09" stroke="#b28b46" strokeWidth="1.5" strokeDasharray="4 4" />
    <g fill="var(--accent)" stroke="var(--surface)" strokeWidth="3"><circle cx="113" cy="45" r="5.5"/><circle cx="239" cy="113" r="5.5"/><circle cx="113" cy="147" r="5.5"/></g>
    <g fontFamily="inherit" fontSize="11" fill="var(--text)"><text x="125" y="36">3 (2, 10)</text><text x="250" y="115">2 (4, 8)</text><text x="125" y="165">1 (2, 7)</text></g>
    <g fontFamily="inherit" fontSize="12" fontWeight="600"><text x="155" y="84" fill="var(--accent)">area = 4</text><text x="155" y="135" fill="#a17b35">area = 2</text></g>
    <g fontFamily="inherit" fontSize="10" fill="var(--muted)"><text x="43" y="12">y</text><text x="304" y="184">x</text></g>
    <path d="M320 66H335" stroke="var(--border)"/><g fontFamily="inherit" fontSize="11" fill="var(--muted)"><text x="330" y="89">Two opposite corners.</text><text x="330" y="106">One rectangle.</text></g>
  </svg></div>;
}
function Description({ problem, progress, onBookmark, fontSize, onFontSize }) {
  if (problem.statementHtml) return <PlaylistDescription problem={problem} progress={progress} onBookmark={onBookmark} fontSize={fontSize} onFontSize={onFontSize}/>;
  return <div className="description-content">
    <div className="problem-eyebrow"><span>DATABASE</span><span className="eyebrow-dot">/</span><span title="Queryroom question ID">{problem.id}</span><ProblemTextControls value={fontSize} onChange={onFontSize}/><button className={cx('bookmark', progress.bookmarked && 'is-bookmarked')} onClick={onBookmark} aria-label={progress.bookmarked ? 'Remove bookmark' : 'Bookmark question'} title="Bookmark question"><Star size={17} fill={progress.bookmarked ? 'currentColor' : 'none'} /></button></div>
    <h1>{problem.title}</h1>
    <div className="problem-badges"><span className="badge medium">{problem.difficulty}</span><span className="badge tag"><Database size={12} /> SQL</span><span className={cx('problem-status', progress.solved && 'solved')}>{progress.solved ? <CircleCheck size={14} /> : <Circle size={13} />} {progress.solved ? 'Solved' : 'Unsolved'}</span></div>
    <p className="intro">{problem.summary}</p>
    <section className="schema-section"><div className="section-label"><Database size={15} /><h2>Table: <code>Points</code></h2></div><div className="schema-table"><table><thead><tr><th>Column name</th><th>Type</th></tr></thead><tbody>{problem.schema[0].columns.map(c => <tr key={c.name}><td><code>{c.name}</code>{c.primaryKey && <span className="primary-key">PRIMARY KEY</span>}</td><td><span className="type-text">int</span></td></tr>)}</tbody></table></div><p className="schema-note">{problem.schema[0].note}</p></section>
    <section className="task-section"><h2>Your task</h2><p>Each row in your result should contain <code>p1</code>, <code>p2</code>, and <code>area</code>.</p><ul className="rules-list">{problem.rules.map((rule, i) => <li key={i}>{rule}</li>)}</ul><div className="ordering-note"><ListFilter size={16}/><div><strong>Order matters</strong><span>area ↓ &nbsp; then p1 ↑ &nbsp; then p2 ↑</span></div></div></section>
    <section className="example-section"><div className="section-heading"><h2>Example 1</h2><span className="subtle-badge">Published example</span></div><div className="example-tables"><div><h3>Input <span>Points</span></h3><DataTable columns={problem.schema[0].columns.map(c => c.name)} rows={problem.example.input.Points}/></div><div><h3>Expected output</h3><DataTable columns={problem.example.output.columns} rows={problem.example.output.rows}/></div></div><PointDiagram/><h3>Explanation</h3><p className="explanation">{problem.example.explanation}</p></section>
    <div className="practice-note"><ShieldCheck size={17}/><p>The published example is included. Extra cases are created for this workspace; LeetCode’s private tests are not available.</p></div>
    <a className="source-link" href={problem.source} target="_blank" rel="noreferrer">View original on LeetCode <ArrowUpRight size={14}/></a>
  </div>;
}
function SQLEditor({ value, onChange, theme, onRun, onSubmit, onCursor, schema, engine }) {
  const element = useRef(null), editor = useRef(null), themeCompartment = useRef(new Compartment()), dialectCompartment = useRef(new Compartment());
  const callbacks = useRef({ onChange, onRun, onSubmit, onCursor });
  callbacks.current = { onChange, onRun, onSubmit, onCursor };
  function editorTheme(dark) {
    return [EditorView.theme({
      '&': { height: '100%', background: 'var(--surface)', color: 'var(--text)', fontSize: '13px' },
      '.cm-scroller': { fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", monospace', lineHeight: '1.85', overflow: 'auto' },
      '.cm-content': { padding: '20px 0 60px', caretColor: 'var(--accent)' },
      '.cm-gutters': { background: 'var(--surface)', border: 'none', color: 'var(--faint)', paddingLeft: '12px', paddingRight: '12px' },
      '.cm-line': { paddingLeft: '8px' },
      // CodeMirror draws selections behind the text; an opaque line hides them.
      '.cm-activeLine': { backgroundColor: dark ? '#68c6a014' : '#15815f0a' },
      '.cm-activeLineGutter': { backgroundColor: 'var(--editor-line)' },
      '&.cm-focused': { outline: 'none' }, '.cm-cursor': { borderLeftColor: 'var(--accent)' },
      '.cm-selectionBackground, &.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground': { backgroundColor: 'var(--selection)' },
      '.cm-tooltip': { background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)' },
      '.cm-placeholder': { color: 'var(--faint)' }, '.cm-panels': { background: 'var(--surface-alt)', color: 'var(--text)' },
    }, { dark }), syntaxHighlighting(HighlightStyle.define([
      { tag: tags.keyword, color: dark ? '#b5a1ed' : '#825eb0' }, { tag: tags.string, color: dark ? '#a7cf9b' : '#568343' },
      { tag: tags.number, color: dark ? '#e5b587' : '#a66830' }, { tag: tags.comment, color: dark ? '#7e9389' : '#8b9992', fontStyle: 'italic' },
      { tag: tags.operator, color: dark ? '#9caeb9' : '#647889' }, { tag: tags.typeName, color: '#4f989e' },
    ]))];
  }
  useEffect(() => {
    const view = new EditorView({ parent: element.current, state: EditorState.create({ doc: value, extensions: [
      basicSetup, dialectCompartment.current.of(sql({ dialect: engine === 'postgresql' ? PostgreSQL : MySQL, schema: Object.fromEntries(schema.map(t => [t.name, t.columns.map(c => c.name)])), upperCaseKeywords: true })),
      Prec.highest(keymap.of([{ key: 'Mod-Enter', run: () => { callbacks.current.onRun(); return true; } }, { key: 'Mod-Shift-Enter', run: () => { callbacks.current.onSubmit(); return true; } }, indentWithTab])),
      placeholder('Your next great query starts here.'), themeCompartment.current.of(editorTheme(theme === 'dark')),
      EditorView.contentAttributes.of({ 'aria-label': 'SQL query editor', 'spellcheck': 'false' }),
      EditorView.updateListener.of(update => { if (update.docChanged) callbacks.current.onChange(update.state.doc.toString()); if (update.selectionSet || update.docChanged) { const pos = update.state.selection.main.head, line = update.state.doc.lineAt(pos); callbacks.current.onCursor({ line: line.number, col: pos - line.from + 1 }); } }),
    ] }) });
    editor.current = view; return () => { view.destroy(); editor.current = null; };
  }, []);
  useEffect(() => { const view = editor.current; if (view && view.state.doc.toString() !== value) view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } }); }, [value]);
  useEffect(() => { editor.current?.dispatch({ effects: themeCompartment.current.reconfigure(editorTheme(theme === 'dark')) }); }, [theme]);
  useEffect(() => { editor.current?.dispatch({effects:dialectCompartment.current.reconfigure(sql({dialect:engine==='postgresql'?PostgreSQL:MySQL,schema:Object.fromEntries(schema.map(t=>[t.name,t.columns.map(c=>c.name)])),upperCaseKeywords:true}))}); },[engine]);
  return <div className="sql-editor" ref={element} />;
}
function Modal({ title, children, onClose, className }) {
  const ref = useRef(null);
  useEffect(() => { const previous = document.activeElement; const dialog = ref.current; dialog.showModal(); return () => { dialog.close(); previous?.focus?.(); }; }, []);
  return <dialog ref={ref} className={cx('modal', className)} onCancel={onClose} onClick={e => { if (e.target === ref.current) onClose(); }}><div className="modal-heading"><h2>{title}</h2><IconButton label="Close dialog" onClick={onClose}><X size={18}/></IconButton></div>{children}</dialog>;
}
function SubmissionHistory({ submissions, onRestore }) {
  const [selected, setSelected] = useState(null);
  if (selected) return <div className="history-detail"><button className="text-button" onClick={() => setSelected(null)}><ArrowLeft size={14}/> All submissions</button><div className="history-detail-title"><h2 className={selected.verdict === 'Accepted' ? 'success-text' : 'error-text'}>{selected.verdict}</h2><span>{selected.passed} / {selected.total} tests passed</span></div><p className="muted">{new Date(selected.date).toLocaleString()} · {selected.runtime} ms · {engineLabel(selected.engine)}</p><pre className="query-preview">{selected.sql}</pre><button className="secondary-button" onClick={() => onRestore(selected)}><RotateCcw size={14}/> Restore this query</button></div>;
  if (!submissions.length) return <div className="empty-state history-empty"><div className="empty-icon"><History size={25}/></div><h2>A fresh start</h2><p>Your submissions will appear here.<br/>Write a query and submit when you’re ready.</p></div>;
  return <div className="history-list"><div className="section-heading"><h2>Your submissions</h2><span className="subtle-badge">{submissions.length} attempts</span></div>{submissions.map(s => <button key={s.id} className="submission-row" onClick={() => setSelected(s)}><span className={cx('submission-icon', s.verdict === 'Accepted' && 'accepted')}>{s.verdict === 'Accepted' ? <Check size={17}/> : <Code2 size={17}/>}</span><span><strong className={s.verdict === 'Accepted' ? 'success-text' : 'error-text'}>{s.verdict}</strong><small>{new Date(s.date).toLocaleString()} · {engineLabel(s.engine)}</small></span><span className="submission-meta">{s.passed}/{s.total}<small>tests passed</small></span><ChevronRight size={16}/></button>)}</div>;
}
function TestResults({ result, busy, problem }) {
  const [selected, setSelected] = useState(0);
  useEffect(() => { if (result) { const failed = result.results.findIndex(r => !r.passed); setSelected(failed >= 0 ? failed : 0); } }, [result]);
  if (busy) return <div className="empty-state results-empty"><LoaderCircle className="spin" size={25}/><h3>{busy === 'submit' ? 'Checking every test case…' : 'Running your query…'}</h3><p>Your tables start fresh for every test.</p></div>;
  if (!result) return <div className="empty-state results-empty"><div className="empty-icon"><Terminal size={24}/></div><h3>Let’s see what your query returns</h3><p>Run your code to compare it with the expected output.</p><span className="keyboard-hint"><kbd>⌘</kbd> <kbd>↵</kbd> <span>to run</span></span></div>;
  const current = result.results[selected];
  return <div className="test-results"><div className="result-summary"><div><h2 className={result.verdict === 'Accepted' ? 'success-text' : 'error-text'}>{result.verdict === 'Accepted' ? <CircleCheck size={21}/> : <CircleHelp size={21}/>} {result.verdict}</h2><span>{result.passed} of {result.total} tests passed <i>·</i> {result.runtime} ms <i>·</i> {engineLabel(result.engine)}</span></div>{result.verdict === 'Accepted' && <span className="result-spark"><Sparkles size={21}/></span>}</div>
    {result.mode === 'run' && result.verdict === 'Accepted' && <div className="run-success-note">This case passed. Submit to check all {problem.totalTests} tests.</div>}
    {result.error && <div className="error-box"><strong>SQL runner</strong><p>{result.error}</p></div>}
    {result.results.length > 1 && <div className="result-case-selector"><label htmlFor="result-case">Test case</label><select id="result-case" value={selected} onChange={e => setSelected(Number(e.target.value))}>{result.results.map((r, i) => <option key={r.id} value={i}>{r.passed ? '✓' : '×'} {i + 1}. {r.name}</option>)}</select></div>}
    {current && <><div className="result-case-title"><span className={current.passed ? 'success-text' : 'error-text'}>{current.passed ? <Check size={15}/> : <X size={15}/>} {current.name}</span><span>{current.runtime} ms</span></div>{current.reason && <div className={current.error ? 'error-box' : 'mismatch-note'}>{current.reason}</div>}
      <details className="result-input"><summary>Input data <ChevronDown size={13}/></summary>{problem.schema.map(t => <div key={t.name}><h3>{t.name}</h3><DataTable columns={t.columns.map(c => c.name)} rows={current.input[t.name]} compact/></div>)}</details>
      <div className="output-comparison"><div><h3>Your output <span>{current.actual.rows.length} rows</span></h3>{current.error ? <div className="no-output">Query did not complete.</div> : <DataTable columns={current.actual.columns} rows={current.actual.rows} compact/>}</div><div><h3>Expected output <span>{current.expected.rows.length} rows</span></h3><DataTable columns={current.expected.columns} rows={current.expected.rows} compact/></div></div>
    </>}
  </div>;
}
function App() {
  const [view, setView] = useState(pageView), [session, setSession] = useState({ user: null, googleConfigured: false });
  const [accountMenu, setAccountMenu] = useState(false), [guestImport, setGuestImport] = useState(null), [importBusy, setImportBusy] = useState(false);
  const [savingProblems, setSavingProblems] = useState(new Set());
  const [loginError, setLoginError] = useState('');
  const [libraryOptions, setLibraryOptions] = useState(() => readLibraryOptions(window.location.search));
  const [leaderboardOptions, setLeaderboardOptions] = useState(() => readLeaderboardOptions(window.location.search));
  const progressStoreRef = useRef(guestProgressStore);
  const progressStore = progressStoreRef.current;
  const savedLabel = session.user ? 'Saved to your account' : 'Saved in this browser';
  const [problems, setProblems] = useState([]), [progress, setProgress] = useState({}), [slug, setSlug] = useState('rectangles-area');
  const [loading, setLoading] = useState(true), [loadError, setLoadError] = useState('');
  const [query, setQuery] = useState(''), [notes, setNotes] = useState(''), [saveStatus, setSaveStatus] = useState('Saved in this browser');
  const [engine, setEngine] = useState(()=>localRead('queryroom-engine','mysql') === 'postgresql' ? 'postgresql' : 'mysql');
  const [engines,setEngines] = useState([]);
  const [theme, setTheme] = useState(() => localRead('queryroom-theme', 'light'));
  const [problemFontSize, setProblemFontSize] = useState(() => { const saved=localRead('queryroom-problem-font-size',100); return Number.isFinite(saved) ? Math.max(100,Math.min(200,saved)) : 100; });
  const [leftTab, setLeftTab] = useState('description'), [bottomTab, setBottomTab] = useState('testcases');
  const [caseId, setCaseId] = useState('example'), [custom, setCustom] = useState(null), [customDraft, setCustomDraft] = useState(''), [customError, setCustomError] = useState('');
  const [busy, setBusy] = useState(false), [result, setResult] = useState(null), [modal, setModal] = useState(null);
  const [drawer, setDrawer] = useState(false), [filter, setFilter] = useState('all'), [search, setSearch] = useState('');
  const [difficulty, setDifficulty] = useState('all');
  const [focused, setFocused] = useState(false), [bottomCollapsed, setBottomCollapsed] = useState(false), [cursor, setCursor] = useState({ line: 1, col: 1 });
  const [timerRunning, setTimerRunning] = useState(false), [elapsed, setElapsed] = useState(() => localRead('queryroom-timer', 0));
  const [leftWidth, setLeftWidth] = useState(45), [editorHeight, setEditorHeight] = useState(49), [toast, setToast] = useState('');
  const hydrated = useRef(false), workspaceRef = useRef(null), rightRef = useRef(null), executing = useRef(false);
  const problemListPosition = useRef(null);
  const savedSnapshots = useRef({}), draftValues = useRef({}), activeSlug = useRef(slug);
  activeSlug.current = slug;
  const persistDraft = (key, draft, draftNotes) => {
    const snapshot = { draft, notes: draftNotes };
    draftValues.current[key] = snapshot;
    return progressStore.saveDraft(key, draft, draftNotes).then(saved => {
      savedSnapshots.current[key] = snapshot;
      setProgress(prev => ({ ...prev, [key]: saved }));
      if (activeSlug.current === key && draftValues.current[key] === snapshot) setSaveStatus(savedLabel);
    }).catch(() => {
      if (activeSlug.current === key && draftValues.current[key] === snapshot) setSaveStatus(session.user ? 'Sync pending · reconnect to save' : 'Not saved · browser storage unavailable');
    });
  };
  const problem = problems.find(p => p.slug === slug), currentProgress = progress[slug] || emptyProgress;
  useEffect(() => { document.documentElement.dataset.theme = theme; localWrite('queryroom-theme', theme); }, [theme]);
  useEffect(() => { localWrite('queryroom-problem-font-size',problemFontSize); },[problemFontSize]);
  useEffect(() => {
    Promise.all([api('/api/problems'), api('/api/engines'), api('/api/session')]).then(async ([p, available, profile]) => {
      apiIdentity.account = profile.user?.id || null; apiIdentity.csrf = profile.csrfToken;
      const store = profile.user ? createAccountProgressStore({ api, userId: profile.user.id }) : guestProgressStore;
      progressStoreRef.current = store;
      // Recovery drafts are replayed after onboarding, when account writes are enabled.
      const saved = profile.user && !profile.user.profileComplete ? await api('/api/progress') : await store.read(p.map(item => item.slug));
      setSession(profile); setEngines(available); setProblems(p); setProgress(saved);
      setSaveStatus(profile.user ? 'Saved to your account' : 'Saved in this browser');
      savedSnapshots.current = Object.fromEntries(p.map(item => [item.slug, { draft: saved[item.slug]?.draft ?? item.starter, notes: saved[item.slug]?.notes || '' }]));
      const params = new URLSearchParams(window.location.search);
      const requested = params.get('problem') || localRead('queryroom-current-problem', 'rectangles-area');
      const first = p.find(item => item.slug === requested) || p[0];
      const snapshot = savedSnapshots.current[first.slug];
      setSlug(first.slug); setQuery(snapshot.draft); setNotes(snapshot.notes);
      setCaseId(first.practiceCases[0].id); setCustom(localRead(`queryroom-custom-${first.slug}`, null));
      const authErrors = { unavailable: 'Google sign-in is not available yet. You can keep practising as a guest.', cancelled: 'Sign-in cancelled. Your guest progress is still here.', expired: 'That sign-in link expired. Please try Continue with Google again.', failed: 'Google sign-in could not be completed. Please try again.' };
      if (params.has('auth_error')) setLoginError(authErrors[params.get('auth_error')] || authErrors.failed);
      if (params.has('signed_in')) setToast(`Welcome, ${profile.user?.name?.split(' ')[0] || 'back'}. Your account is ready.`);
      params.delete('auth_error'); params.delete('signed_in');
      const nextView = pageView(profile.user);
      setView(nextView);
      const initialLibrary = readLibraryOptions(window.location.search);
      if (nextView === 'questions') setLibraryOptions(initialLibrary);
      const initialStandings = readLeaderboardOptions(window.location.search);
      if (nextView === 'leaderboard') setLeaderboardOptions(initialStandings);
      window.history.replaceState(null, '', pagePath(nextView) + (nextView === 'practice' ? `?problem=${encodeURIComponent(first.slug)}` : nextView === 'questions' ? libraryQuery(initialLibrary) : nextView === 'leaderboard' ? leaderboardQuery(initialStandings) : ''));
      if (profile.user?.profileComplete && !profile.user.guestImportDone) {
        const browserSaved = await guestProgressStore.read(p.map(item => item.slug)).catch(() => ({}));
        const items = Object.fromEntries(Object.entries(browserSaved).filter(([, item]) => hasProgress(item)));
        if (Object.keys(items).length) { setGuestImport(items); setModal('import'); }
      }
      hydrated.current = true; setLoading(false);
    }).catch(e => { setLoadError(e.message); setLoading(false); });
  }, []);
  useEffect(() => {
    if (loading || loadError) return;
    let pending = false, disposed = false;
    const refresh = async () => {
      if (pending || disposed) return;
      pending = true;
      try {
        const [profile, available] = await Promise.all([api('/api/session'), api('/api/engines')]);
        if (disposed) return;
        if ((profile.user?.id || null) !== (session.user?.id || null) || Boolean(profile.user?.profileComplete) !== Boolean(session.user?.profileComplete)) { window.location.reload(); return; }
        setSession(profile);
        apiIdentity.csrf = profile.csrfToken;
        setEngines(available);
        if (['dashboard', 'questions', 'profile'].includes(view) && !progressStoreRef.current.hasPending?.()) {
          const saved = await progressStoreRef.current.read(problems.map(p => p.slug));
          if (disposed || progressStoreRef.current.hasPending?.()) return;
          savedSnapshots.current = Object.fromEntries(problems.map(p => [p.slug, { draft: saved[p.slug]?.draft ?? p.starter, notes: saved[p.slug]?.notes || '' }]));
          draftValues.current = {};
          setProgress(saved);
          const current = savedSnapshots.current[activeSlug.current];
          if (current) { setQuery(current.draft); setNotes(current.notes); }
        }
      } catch { if (!disposed) setEngines(previous => previous.map(item => ({ ...item, available: false }))); }
      finally { pending = false; }
    };
    window.addEventListener('focus', refresh);
    if (['dashboard', 'questions', 'profile'].includes(view)) refresh();
    const interval = setInterval(refresh, 15000);
    return () => { disposed = true; window.removeEventListener('focus', refresh); clearInterval(interval); };
  }, [loading, loadError, session.user?.id, view, problems]);
  useEffect(() => {
    const onPop = () => {
      const next = pageView(session.user);
      const requested = new URLSearchParams(window.location.search).get('problem');
      if (next === 'practice' && requested) { const p = problems.find(item => item.slug === requested); if (p) switchProblem(p, false); }
      setView(next); setDrawer(false); setAccountMenu(false);
      if (next === 'questions') setLibraryOptions(readLibraryOptions(window.location.search));
      else if (next === 'leaderboard') setLeaderboardOptions(readLeaderboardOptions(window.location.search));
      else if (next !== 'practice') window.history.replaceState(null, '', pagePath(next));
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  });
  useEffect(() => { if (!timerRunning) return; const interval = setInterval(() => setElapsed(t => t + 1), 1000); return () => clearInterval(interval); }, [timerRunning]);
  useEffect(() => { localWrite('queryroom-timer', elapsed); }, [elapsed]);
  useEffect(() => { if (!toast) return; const timeout = setTimeout(() => setToast(''), 3000); return () => clearTimeout(timeout); }, [toast]);
  useEffect(() => {
    if (!hydrated.current) return;
    const saved=savedSnapshots.current[slug];
    const pending = draftValues.current[slug] || saved;
    if (query===pending?.draft && notes===pending?.notes) {
      if (query===saved?.draft && notes===saved?.notes) setSaveStatus(savedLabel);
      return;
    }
    setSaveStatus('Saving…');
    persistDraft(slug,query,notes);
  }, [query,notes,slug]);
  useEffect(() => { const listener = e => { if (e.key === 'Escape') { setDrawer(false); setFocused(false); } }; window.addEventListener('keydown', listener); return () => window.removeEventListener('keydown', listener); }, []);
  useEffect(() => { setAccountMenu(false); }, [view, slug, session.user?.id]);
  const run = useCallback(async mode => {
    if (!problem || view !== 'practice' || executing.current) return;
    if (!engines.some(item=>item.id===engine && item.available)) {setToast('The selected database is unavailable. Restart Queryroom and try again.');return;}
    executing.current = true; setBusy(mode); setBottomTab('results'); setBottomCollapsed(false);
    try {
      const data = await api('/api/query', { method: 'POST', body: JSON.stringify({ slug, sql: query, engine, mode, caseId, ...(caseId === 'custom' && mode === 'run' ? { customInput: custom } : {}) }) });
      setResult({ ...data, mode });
      if (data.submission) {
        try {
          const saved = data.progress || await guestProgressStore.recordSubmission(slug, data.submission);
          setProgress(prev => ({ ...prev, [slug]: saved }));
        } catch {
          setSaveStatus(session.user ? 'Sync pending · reconnect to save' : 'Not saved · browser storage unavailable');
          setToast('Your query was checked, but progress could not be saved. Please try again.');
          return;
        }
      }
      if (mode === 'submit' && data.verdict === 'Accepted') { setTimerRunning(false); setToast(data.pointsEarned ? `Accepted! +${data.pointsEarned} leaderboard points.` : 'Nicely done. This question is marked as solved.'); }
    } catch (e) { setResult({ verdict: 'Unable to run', error: e.message, passed: 0, total: 0, runtime: 0, results: [], mode }); }
    finally { setBusy(false); executing.current = false; }
  }, [problem, query, slug, caseId, custom, engine, engines, view]);
  const chooseEngine = id => { if(executing.current) return; setEngine(id); localWrite('queryroom-engine',id); setResult(null); };
  const engineReady = engines.some(item=>item.id===engine && item.available);
  async function updateProblem(key, action) {
    if (savingProblems.has(key)) return;
    setSavingProblems(previous => new Set(previous).add(key));
    try { const saved = await action(); setProgress(previous => ({ ...previous, [key]: saved })); }
    catch (error) { setToast(error.message || 'Your progress could not be saved. Please try again.'); }
    finally { setSavingProblems(previous => { const next = new Set(previous); next.delete(key); return next; }); }
  }
  const onBookmark = (key = slug) => updateProblem(key, () => progressStore.toggleBookmark(key));
  const onSolved = (key, solved) => updateProblem(key, () => progressStore.patch(key, { solved }));
  async function continueGoogle() {
    if (executing.current) { setToast('Wait for your query to finish before signing in.'); return; }
    setAccountMenu(false); setLoginError('');
    try { await progressStore.flush?.(); window.location.assign('/api/auth/google'); }
    catch (error) { setLoginError(error.message); }
  }
  function showLogin() {
    if (executing.current) { setToast('Wait for your query to finish.'); return; }
    setView('login'); setDrawer(false); setAccountMenu(false); setLoginError(''); setTimerRunning(false);
    window.history.pushState(null, '', '/login');
  }
  function showProfile() {
    if (executing.current) { setToast('Wait for your query to finish.'); return; }
    if (!session.user) { showLogin(); return; }
    setView('profile'); setDrawer(false); setFocused(false); setAccountMenu(false); setTimerRunning(false);
    window.history.pushState(null, '', '/profile');
  }
  async function saveProfile(fields) {
    const result = await api('/api/profile', {method: 'PUT', body: JSON.stringify(fields)});
    if (!session.user.profileComplete) { window.location.assign('/dashboard'); return; }
    setSession(previous => ({...previous, user: result.user})); setModal(null); setToast('Your profile has been updated.');
  }
  async function signOut() {
    if (executing.current) { setToast('Wait for your query to finish before signing out.'); return; }
    try { await progressStore.flush?.(); await api('/api/auth/logout', { method: 'POST' }); window.location.assign('/login'); }
    catch (error) { setToast(error.message); }
  }
  async function importProgress(skip) {
    setImportBusy(true);
    try {
      const result = await api('/api/progress/import', { method: 'POST', body: JSON.stringify(skip ? { skip: true } : { progress: guestImport }) });
      setSession(previous => ({ ...previous, user: result.user })); setProgress(result.progress);
      savedSnapshots.current = Object.fromEntries(problems.map(p => [p.slug, { draft: result.progress[p.slug]?.draft ?? p.starter, notes: result.progress[p.slug]?.notes || '' }]));
      draftValues.current = {};
      setQuery(savedSnapshots.current[slug].draft); setNotes(savedSnapshots.current[slug].notes);
      setModal(null); setGuestImport(null); setToast(skip ? 'Your browser progress remains separate.' : 'Browser progress added to your account.');
    } catch (error) { setToast(error.message); }
    finally { setImportBusy(false); }
  }
  function updateLibraryOptions(patch, replaceOnly = false) {
    const next = {...libraryOptions, ...patch};
    setLibraryOptions(next);
    const method = !replaceOnly && Object.keys(patch).length === 1 && 'page' in patch ? 'pushState' : 'replaceState';
    window.history[method](null, '', '/questions' + libraryQuery(next));
  }
  function showQuestions(preset) {
    if (executing.current) { setToast('Wait for your query to finish.'); return; }
    const next = preset === undefined ? libraryOptions : {...defaultLibraryOptions, ...preset};
    setLibraryOptions(next); setView('questions'); setDrawer(false); setFocused(false); setAccountMenu(false); setTimerRunning(false);
    window.history.pushState(null, '', '/questions' + libraryQuery(next));
  }
  function updateLeaderboardOptions(patch, replaceOnly = false) {
    const next = {...leaderboardOptions, ...patch};
    setLeaderboardOptions(next);
    const method = !replaceOnly && Object.keys(patch).length === 1 && 'page' in patch ? 'pushState' : 'replaceState';
    window.history[method](null, '', '/leaderboard' + leaderboardQuery(next));
  }
  function showLeaderboard() {
    if (executing.current) { setToast('Wait for your query to finish.'); return; }
    setLeaderboardOptions({...defaultLeaderboardOptions});
    setView('leaderboard'); setDrawer(false); setFocused(false); setAccountMenu(false); setTimerRunning(false);
    window.history.pushState(null, '', '/leaderboard');
  }
  function showDashboard(push = true) {
    if (executing.current) { setToast('Wait for your query to finish.'); return; }
    setView('dashboard'); setDrawer(false); setFocused(false); setTimerRunning(false); setAccountMenu(false);
    if (push) window.history.pushState(null, '', '/dashboard');
  }
  function resize(e, kind) {
    e.preventDefault(); const target = e.currentTarget; target.setPointerCapture(e.pointerId);
    const move = event => { const rect = (kind === 'horizontal' ? workspaceRef : rightRef).current.getBoundingClientRect(); if (kind === 'horizontal') setLeftWidth(Math.max(30, Math.min(65, ((event.clientX - rect.left) / rect.width) * 100))); else setEditorHeight(Math.max(28, Math.min(72, ((event.clientY - rect.top) / rect.height) * 100))); };
    const end = () => { target.removeEventListener('pointermove', move); target.removeEventListener('pointerup', end); target.removeEventListener('pointercancel', end); };
    target.addEventListener('pointermove', move); target.addEventListener('pointerup', end); target.addEventListener('pointercancel', end);
  }
  function openCustom() { setCustomError(''); setCustomDraft(JSON.stringify(custom || problem.example.input, null, 2)); setModal('custom'); }
  function saveCustom() {
    try {
      const data = JSON.parse(customDraft);
      validateInput(problem,data);
      localWrite(`queryroom-custom-${slug}`,data);
      setCustom(data); setCaseId('custom'); setBottomTab('testcases'); setModal(null); setToast('Custom test case is ready to run.');
    } catch (e) { setCustomError(e instanceof SyntaxError ? 'This is not valid JSON. Check your commas and brackets.' : e.message); }
  }
  function switchProblem(p, push = true) {
    if (!p) return;
    if (p.slug === slug) { setView('practice'); setDrawer(false); if (push) window.history.pushState(null, '', `/practice?problem=${encodeURIComponent(p.slug)}`); return; }
    if (executing.current) {setToast('Your query is still running. Please try again in a moment.');return;}
    if (query!==savedSnapshots.current[slug]?.draft || notes!==savedSnapshots.current[slug]?.notes) persistDraft(slug,query,notes);
    const snapshot=draftValues.current[p.slug] || savedSnapshots.current[p.slug] || {draft:progress[p.slug]?.draft ?? p.starter,notes:progress[p.slug]?.notes || ''};
    setSlug(p.slug); setQuery(snapshot.draft); setNotes(snapshot.notes);
    setCaseId(p.practiceCases[0].id); setCustom(localRead(`queryroom-custom-${p.slug}`,null)); setResult(null); setLeftTab('description'); setBottomTab('testcases'); setDrawer(false); setCursor({line:1,col:1});
    localWrite('queryroom-current-problem',p.slug);
    setView('practice');
    if (push) window.history.pushState(null, '', `/practice?problem=${encodeURIComponent(p.slug)}`);
  }
  const matchesQuestion=p=>`${p.title} ${p.number} ${p.id}`.toLowerCase().includes(search.trim().toLowerCase()) && (filter==='all' || (filter==='playlist' ? Boolean(p.playlist) : filter==='added' ? p.collection==='Added questions' : filter==='unsolved' ? !progress[p.slug]?.solved : filter==='solved' ? progress[p.slug]?.solved : progress[p.slug]?.bookmarked));
  const matchingProblems=problems.filter(matchesQuestion);
  const visibleProblems=matchingProblems.filter(p=>difficulty==='all' || p.difficulty===difficulty);
  const solvedCount = problems.filter(p => progress[p.slug]?.solved).length;
  const activeCase = caseId === 'custom' ? { name: 'Custom case', description: 'Your own input data.', kind: 'Your test case', input: custom } : problem?.practiceCases.find(c => c.id === caseId);
  if (loading || loadError) return <div className="loading-screen"><div className="brand-mark"><Braces size={25}/></div><h1>queryroom<span>.</span></h1>{loadError ? <><p>{loadError}</p><button className="primary-button" onClick={() => window.location.reload()}>Try again</button></> : <><LoaderCircle className="spin" size={22}/><p>Getting your workspace ready…</p></>}</div>;
  if (view === 'login') return <LoginPage onGoogle={continueGoogle} onGuest={() => showDashboard()} error={loginError} questionCount={problems.length}/>;
  if (view === 'onboarding') return <div className="app-shell dashboard-shell"><header className="app-header account-header"><a className="brand" href="/login"><span className="brand-mark"><Braces size={21}/></span><span>queryroom<span className="brand-period">.</span></span></a><span className="onboarding-header-label">Your account, your progress.</span></header><OnboardingPage user={session.user} onSave={saveProfile} onSignOut={signOut}/>{toast && <div className="toast" role="status">{toast}</div>}</div>;
  return <div className={cx("app-shell", ['dashboard','questions','leaderboard','profile'].includes(view) && "dashboard-shell")}>
    <header className="app-header account-header"><a className="brand" href="/dashboard" aria-label="Queryroom home" onClick={e => { e.preventDefault(); showDashboard(); }}><span className="brand-mark"><Braces size={21}/></span><span>queryroom<span className="brand-period">.</span></span></a>
      <nav className="dashboard-nav" aria-label="Main navigation"><button className={view === 'dashboard' ? 'active' : ''} onClick={() => showDashboard()}>Dashboard</button><button className={['questions','practice'].includes(view) ? 'active' : ''} onClick={() => showQuestions()}>Questions</button><button className={view === 'leaderboard' ? 'active' : ''} onClick={showLeaderboard}>Leaderboard</button></nav>
      <div className="header-right"><span className={cx('account-state', !session.user && 'guest')}><span/>{session.user ? (saveStatus.includes('pending') ? 'Sync pending' : saveStatus === 'Saving…' ? 'Saving…' : 'Account synced') : 'Guest workspace'}</span><IconButton label={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'} onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>{theme === 'light' ? <Moon size={17}/> : <Sun size={18}/>}</IconButton>
      {session.user ? <AccountMenu user={session.user} open={accountMenu} onOpenChange={setAccountMenu} onProfile={showProfile} profileActive={view === 'profile'} onSignOut={signOut}/> : <button className="header-signin" onClick={showLogin}>Sign in<ArrowRight size={13}/></button>}</div>
    </header>
    {view === 'dashboard' ? <Dashboard api={api} onLeaderboard={showLeaderboard} problems={problems} progress={progress} user={session.user} onOpen={switchProblem} onBrowse={showQuestions} onProfile={showProfile} onSignIn={continueGoogle} currentSlug={slug}/> : view === 'questions' ? <QuestionLibrary problems={problems} progress={progress} options={libraryOptions} onChange={updateLibraryOptions} onOpen={switchProblem} onSolved={onSolved} onBookmark={onBookmark} onDashboard={() => showDashboard()} saving={savingProblems}/> : view === 'leaderboard' ? <Leaderboard api={api} user={session.user} options={leaderboardOptions} onChange={updateLeaderboardOptions} onBrowse={() => showQuestions({})} onSignIn={continueGoogle}/> : view === 'profile' ? <ProfilePage user={session.user} problems={problems} progress={progress} onOpen={switchProblem} onDashboard={() => showDashboard()} onEdit={() => setModal('edit-profile')}/> : <>
    <div className="workspace-toolbar"><div className="problem-navigation"><button className="problem-list-button" onClick={() => setDrawer(true)}><LayoutList size={17}/><span>Problem list</span><ChevronDown size={13}/></button><span className="toolbar-divider"/><IconButton label="Previous question" disabled={Boolean(busy) || problems.indexOf(problem) === 0} onClick={() => switchProblem(problems[problems.indexOf(problem) - 1])}><ChevronLeft size={17}/></IconButton><span className="problem-counter">{String(problems.indexOf(problem) + 1).padStart(2, '0')} <span>/ {String(problems.length).padStart(2, '0')}</span></span><IconButton label="Next question" disabled={Boolean(busy) || problems.indexOf(problem) === problems.length - 1} onClick={() => switchProblem(problems[problems.indexOf(problem) + 1])}><ChevronRight size={17}/></IconButton></div><span className="pace-note current-question-title" title={problem.title}>{problem.title}</span><div className="run-actions"><button className={cx('timer', timerRunning && 'running')} aria-label={timerRunning ? 'Pause practice timer' : 'Start practice timer'} title={timerRunning ? 'Pause timer' : 'Start timer'} onClick={() => setTimerRunning(!timerRunning)}>{timerRunning ? <Pause size={14}/> : <Clock3 size={15}/>}<span>{String(Math.floor(elapsed / 60)).padStart(2, '0')}:{String(elapsed % 60).padStart(2, '0')}</span></button><button className="run-button" onClick={() => run('run')} disabled={Boolean(busy) || !engineReady} title="Run selected test · ⌘ Enter">{busy === 'run' ? <LoaderCircle className="spin" size={15}/> : <Play size={14} fill="currentColor"/>}Run<kbd>⌘ ↵</kbd></button><button className="primary-button submit-button" onClick={() => run('submit')} disabled={Boolean(busy) || !engineReady} title="Check all tests · ⌘ Shift Enter">{busy === 'submit' ? <LoaderCircle className="spin" size={16}/> : <Send size={15}/>} Submit</button></div></div>
    <main ref={workspaceRef} className={cx('workspace', focused && 'editor-focused')} style={{ '--left-width': `${leftWidth}%`, '--editor-height': `${editorHeight}%` }}>
      <section className="panel description-panel" aria-label="Problem details"><div className="panel-tabs" role="tablist" aria-label="Problem information"><button role="tab" aria-selected={leftTab === 'description'} onClick={() => setLeftTab('description')} className={cx(leftTab === 'description' && 'active')}><FileText size={15}/>Description</button><button role="tab" aria-selected={leftTab === 'submissions'} onClick={() => setLeftTab('submissions')} className={cx(leftTab === 'submissions' && 'active')}><History size={15}/>Submissions{currentProgress.submissions.length > 0 && <span className="tab-count">{currentProgress.submissions.length}</span>}</button><button role="tab" aria-selected={leftTab === 'notes'} onClick={() => setLeftTab('notes')} className={cx(leftTab === 'notes' && 'active')}><StickyNote size={15}/>Notes</button></div><div key={slug} className="description-scroll" role="tabpanel" style={{'--problem-font-scale':problemFontSize/100}}>{leftTab === 'description' && <Description problem={problem} progress={currentProgress} onBookmark={() => onBookmark(slug)} fontSize={problemFontSize} onFontSize={setProblemFontSize}/>} {leftTab === 'submissions' && <SubmissionHistory submissions={currentProgress.submissions} onRestore={submission => { setQuery(submission.sql); if(['mysql','postgresql'].includes(submission.engine)) chooseEngine(submission.engine); setToast(submission.engine && submission.engine!=='sqlite' ? 'Query and database restored.' : 'Previous SQLite query restored. Review its syntax for your selected database.'); }}/>} {leftTab === 'notes' && <div className="notes-panel"><div className="section-heading"><h2>Space to think</h2><StickyNote size={18}/></div><p>Keep an idea, an observation, or something you learned.</p><textarea aria-label="Your problem notes" placeholder="What do you notice about this problem?" value={notes} onChange={e => setNotes(e.target.value)} maxLength={20000}/><span className="note-saved"><CheckCheck size={13}/>{saveStatus}</span></div>}</div><div className="description-footer"><span><BookOpen size={13}/> Learn by doing</span><button className={cx("question-manual-status", currentProgress.solved && "solved")} disabled={savingProblems.has(slug)} onClick={() => onSolved(slug, !currentProgress.solved)}>{currentProgress.solved ? <CircleCheck size={12}/> : <Circle size={12}/>} {currentProgress.solved ? "Mark unsolved" : "Mark solved"}</button><a href={problem.source} target="_blank" rel="noreferrer">LeetCode #{problem.number}<ArrowUpRight size={12}/></a></div></section>
      <div className="splitter horizontal-splitter" role="separator" tabIndex="0" aria-label="Resize problem and editor panels" aria-orientation="vertical" aria-valuemin="30" aria-valuemax="65" aria-valuenow={leftWidth} onPointerDown={e => resize(e, 'horizontal')} onKeyDown={e => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); setLeftWidth(w => Math.max(30, Math.min(65, w + (e.key === 'ArrowRight' ? 2 : -2)))); } }}><span/></div>
      <div ref={rightRef} className={cx('right-workspace', bottomCollapsed && 'bottom-collapsed')}>
        <section className="panel editor-panel" aria-label="SQL editor"><div className="editor-panel-heading"><span><Code2 size={16}/><strong>Code</strong></span><div><IconButton label="Reset query to starter" onClick={() => setModal('reset')}><RotateCcw size={15}/></IconButton><IconButton label={focused ? 'Exit focus mode' : 'Focus on editor'} onClick={() => setFocused(!focused)}>{focused ? <Minimize2 size={15}/> : <Maximize2 size={15}/>}</IconButton></div></div><div className="editor-options"><div className="engine-controls"><label className="engine-selector"><Database size={13}/><select aria-label="SQL database engine" value={engine} disabled={Boolean(busy)} onChange={e=>chooseEngine(e.target.value)}><option value="mysql">MySQL</option><option value="postgresql">PostgreSQL</option></select><ChevronDown size={12}/></label><IconButton label="About SQL engines" onClick={()=>setModal('dialect')}><CircleHelp size={14}/></IconButton></div><span className={engineReady ? '' : 'error-text'}><span className="small-dot"/> {engineReady ? 'Ready to query' : 'Database unavailable'}</span></div><SQLEditor key={slug} value={query} onChange={setQuery} theme={theme} onRun={() => run('run')} onSubmit={() => run('submit')} onCursor={setCursor} schema={problem.schema} engine={engine}/><div className="editor-status"><span className={saveStatus.includes('unavailable') ? 'error-text' : ''}><CheckCheck size={13}/>{saveStatus}</span><div><span>Ln {cursor.line}, Col {cursor.col}</span><IconButton label="Editor keyboard shortcuts" onClick={() => setModal('help')}><Keyboard size={15}/></IconButton></div></div></section>
        <div className="splitter vertical-splitter" role="separator" tabIndex="0" aria-label="Resize code and test panels" aria-orientation="horizontal" aria-valuemin="28" aria-valuemax="72" aria-valuenow={editorHeight} onPointerDown={e => resize(e, 'vertical')} onKeyDown={e => { if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); setEditorHeight(h => Math.max(28, Math.min(72, h + (e.key === 'ArrowDown' ? 3 : -3)))); } }}><span/></div>
        <section className="panel test-panel" aria-label="Test cases and results"><div className="test-panel-heading"><div className="panel-tabs" role="tablist" aria-label="Test panel"><button role="tab" aria-selected={bottomTab === 'testcases'} className={cx(bottomTab === 'testcases' && 'active')} onClick={() => { setBottomTab('testcases'); setBottomCollapsed(false); }}><Braces size={15}/>Test cases<span className="tab-count">{problem.practiceCases.length + (custom ? 1 : 0)}</span></button><button role="tab" aria-selected={bottomTab === 'results'} className={cx(bottomTab === 'results' && 'active')} onClick={() => { setBottomTab('results'); setBottomCollapsed(false); }}><Terminal size={15}/>Test result{result && <span className={cx('result-dot', result.verdict === 'Accepted' && 'pass')}/>}</button></div><IconButton label={bottomCollapsed ? 'Expand test panel' : 'Collapse test panel'} onClick={() => setBottomCollapsed(!bottomCollapsed)}><ChevronDown size={16} className={bottomCollapsed ? 'rotate' : ''}/></IconButton></div><div className="test-panel-content" role="tabpanel">{bottomTab === 'results' ? <TestResults result={result} busy={busy} problem={problem}/> : <div className="testcases-content"><div className="case-switcher">{problem.practiceCases.slice(0, 3).map((c, i) => <button className={cx('case-pill', caseId === c.id && 'selected')} key={c.id} onClick={() => setCaseId(c.id)}><span className="small-dot"/>{i === 0 ? 'Example 1' : `Case ${i + 1}`}</button>)}<select className={cx('more-cases', !problem.practiceCases.slice(0, 3).some(c => c.id === caseId) && 'selected')} aria-label="Select a test case" value={problem.practiceCases.slice(0, 3).some(c => c.id === caseId) ? 'more' : caseId} onChange={e => setCaseId(e.target.value)}><option disabled value="more">{Math.max(0,problem.practiceCases.length-3)} more cases</option>{problem.practiceCases.slice(3).map((c, i) => <option key={c.id} value={c.id}>{i + 4}. {c.name}</option>)}{custom && <option value="custom">Custom case</option>}</select><IconButton label="Add or edit custom test case" className="add-case" onClick={openCustom}><Plus size={17}/></IconButton></div><div className="case-description"><span>{activeCase?.name}</span><span>{activeCase?.kind}</span></div><p className="case-helper">{activeCase?.description}</p>{activeCase && problem.schema.map(table => <div className="case-table" key={table.name}><div className="table-heading"><h3><Database size={13}/>{table.name}</h3><span>{activeCase.input[table.name].length} rows</span>{caseId === 'custom' && <button onClick={openCustom}>Edit data</button>}</div><DataTable columns={table.columns.map(c => c.name)} rows={activeCase.input[table.name]} compact/></div>)}<div className="case-bottom-note"><ShieldCheck size={13}/><span>Submit checks all {problem.totalTests} local tests.</span><button onClick={() => setModal('tests')}>About the tests <ArrowUpRight size={11}/></button></div></div>}</div></section>
      </div>
    </main>
    <footer className="app-footer"><span><span className="footer-dot"/> Your SQL workspace <span className="footer-separator">·</span> {session.user ? "Progress saved to your account" : "Progress stays in this browser"}</span><span>Made for your next “aha.” <Sparkles size={12}/></span></footer>
    </>}
    {toast && <div className="toast" role="status"><Check size={15}/>{toast}</div>}
    {drawer && <div className="drawer-backdrop" onClick={() => setDrawer(false)}><aside className="problem-drawer" aria-label="Problem list" onClick={e => e.stopPropagation()}><div className="drawer-title"><span className="brand-mark"><Braces size={20}/></span><h2>Your practice list</h2><IconButton label="Close problem list" onClick={() => setDrawer(false)}><X size={18}/></IconButton></div><div className="progress-card"><div><span>Small steps. Real progress.</span><strong>{solvedCount} <span>/ {problems.length}</span></strong></div><div className="progress-track"><span style={{ width: `${solvedCount / problems.length * 100}%` }}/></div><p>{solvedCount ? 'Keep the momentum going.' : 'Your first solved question is waiting.'}</p></div><label className="problem-search"><Search size={16}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search your questions"/></label><div className="drawer-filters">{['all', 'playlist', 'added', 'unsolved', 'solved', 'starred'].map(f => <button className={cx(filter === f && 'selected')} onClick={() => setFilter(f)} key={f}>{f === 'all' ? 'All' : f === 'playlist' ? 'Playlist' : f === 'added' ? 'Added' : f === 'unsolved' ? 'Unsolved' : f === 'solved' ? 'Solved' : 'Starred'}</button>)}</div><div className="collection-summary">{visibleProblems.length} {visibleProblems.length === 1 ? 'question' : 'questions'}<span>{filter==='playlist' ? 'Playlist order' : 'Practice order'}</span></div><div className="drawer-problems">{visibleProblems.map(p => <button className={cx('problem-card', p.slug === slug && 'current')} onClick={() => switchProblem(p)} key={p.slug}><span className="problem-card-check">{progress[p.slug]?.solved ? <CircleCheck size={17}/> : <Circle size={16}/>}</span><span><small>#{p.number} · {p.playlist ? `Lesson ${p.playlistIndex}` : p.collection==='Added questions' ? 'Added question' : 'Your first question'}</small><strong>{p.title}</strong><span className={`badge ${p.difficulty.toLowerCase()}`}>{p.difficulty}</span></span><ChevronRight size={16}/></button>)}{visibleProblems.length===0 && <p className="drawer-empty">No questions here yet.</p>}</div><div className="playlist-drawer-footer"><Play size={15}/><div><strong>Leetcode SQL Hard</strong><span>53 questions · 54 video lessons</span></div><a href="https://www.youtube.com/playlist?list=PLtfxzVLWb-B9M7Rx5BrZwZqSBP2_IzRMA" target="_blank" rel="noreferrer" aria-label="Open the source playlist"><ArrowUpRight size={15}/></a></div></aside></div>}
    {modal === 'edit-profile' && <Modal title="Edit your profile" className="profile-edit-modal" onClose={() => setModal(null)}><ProfileForm user={session.user} editing onSave={saveProfile} onCancel={() => setModal(null)}/></Modal>}
    {modal === 'import' && guestImport && <Modal title="Bring your progress with you" className="import-modal" onClose={() => { if (!importBusy) setModal(null); }}><p>This browser has existing practice progress. Add it to <strong>{session.user.email}</strong> so you can continue on any device.</p><div className="import-summary"><span>{Object.keys(guestImport).length} questions with progress</span><span>{Object.values(guestImport).filter(item => item.solved).length} solved</span></div><p>Existing account drafts and notes are kept. Solved questions, bookmarks, and submission history are combined. Your guest copy stays in this browser.</p><div className="modal-actions"><button className="secondary-button" disabled={importBusy} onClick={() => importProgress(true)}>Keep separate</button><button className="primary-button" disabled={importBusy} onClick={() => importProgress(false)}>{importBusy ? <LoaderCircle className="spin" size={15}/> : <Check size={15}/>}Import my progress</button></div></Modal>}
    {modal === 'reset' && <Modal title="Start with a clean editor?" onClose={() => setModal(null)}><p>This replaces your current draft with the starter. Submitted queries stay in your history.</p><div className="modal-actions"><button className="secondary-button" onClick={() => setModal(null)}>Keep my draft</button><button className="primary-button" onClick={() => { setQuery(problem.starter); setModal(null); setToast('Editor reset. You can undo with ⌘ Z.'); }}>Reset editor</button></div></Modal>}
    {modal === 'dialect' && <Modal title="Choose your SQL engine" onClose={() => setModal(null)}><div className="engine-cards">{engines.map(item=><button key={item.id} className={cx('engine-card',engine===item.id&&'selected')} disabled={!item.available || Boolean(busy)} onClick={()=>{chooseEngine(item.id);setModal(null);}}><Database size={23}/><span><strong>{item.name}</strong><small>{item.version || 'Unavailable'}</small></span>{engine===item.id&&<CircleCheck size={19}/>}</button>)}</div><p>Your query runs directly on the selected database. Choose MySQL for the playlist's MySQL syntax, or PostgreSQL to practice its date functions, casts, and SQL features.</p><p>Switching engines keeps your current query. Each submission records which engine you used.</p><div className="modal-note"><ShieldCheck size={16}/> Each test uses fresh tables with read-only access and a 3-second query limit.</div></Modal>}
    {modal === 'help' && <Modal title="Make yourself at home" onClose={() => setModal(null)}><p>A little less setup. A little more SQL.</p><div className="shortcut-list"><div><span>Run the selected test</span><span><kbd>⌘ / Ctrl</kbd> <kbd>Enter</kbd></span></div><div><span>Submit against all tests</span><span><kbd>⌘ / Ctrl</kbd> <kbd>Shift</kbd> <kbd>Enter</kbd></span></div><div><span>Editor autocomplete</span><span><kbd>Ctrl</kbd> <kbd>Space</kbd></span></div><div><span>Find in your query</span><span><kbd>⌘ / Ctrl</kbd> <kbd>F</kbd></span></div><div><span>Undo an editor change</span><span><kbd>⌘ / Ctrl</kbd> <kbd>Z</kbd></span></div></div><p className="modal-note">Drag the dividers to resize your workspace. Guest progress saves in this browser. Continue with Google to save solved status, drafts, notes, bookmarks, and submissions to your account across devices. On your first sign-in, you can import your browser progress. Custom test cases and display preferences stay in this browser.</p></Modal>}
    {modal === 'tests' && <Modal title="Built to test your thinking" onClose={() => setModal(null)}><div className="test-stats"><div><strong>{problem.practiceCases.length}</strong><span>Selectable cases</span></div><div><strong>{problem.totalTests-problem.practiceCases.length}</strong><span>Additional checks</span></div><div><strong>{problem.totalTests}</strong><span>Tests on Submit</span></div></div><p><strong>Run</strong> checks the selected case, or your custom input. <strong>Submit</strong> checks all {problem.totalTests} built-in cases and saves the result to your history.</p><p>{problem.testNotes || 'The published example is reproduced from the question. Extra cases cover zero areas, negative coordinates, duplicate locations, large values, and sorting ties.'}</p><p className="modal-note">These are local practice tests. They are not LeetCode’s private test suite. {problem.orderMatters===false ? 'This question accepts results in any row order. Values and duplicate counts must match.' : 'Values and the specified sorting must match.'}</p></Modal>}
    {modal === 'custom' && <Modal title="Try your own test case" className="custom-modal" onClose={() => setModal(null)}><p>Use one array per table, with up to 100 rows each. Use JSON <code>null</code> for missing values, numbers for numeric columns, and quoted strings for text and dates.</p><div className="custom-schema-guide">{problem.schema.map(t=><div key={t.name}><strong>{t.name}</strong><code>[{t.columns.map(c=>c.name).join(', ')}]</code></div>)}</div><textarea className="custom-input" aria-label="Custom test case JSON" value={customDraft} onChange={e => setCustomDraft(e.target.value)} spellCheck={false}/>{customError && <p className="custom-error" role="alert">{customError}</p>}<div className="modal-actions"><button className="secondary-button" onClick={() => setModal(null)}>Cancel</button><button className="primary-button" onClick={saveCustom}><Check size={15}/> Use this case</button></div></Modal>}
  </div>;
}

createRoot(document.getElementById('root')).render(<App/>);
