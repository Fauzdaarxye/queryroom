import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { basicSetup } from 'codemirror';
import { EditorView, keymap, placeholder } from '@codemirror/view';
import { EditorState, Compartment, Prec } from '@codemirror/state';
import { indentWithTab } from '@codemirror/commands';
import { sql, MySQL, PostgreSQL } from '@codemirror/lang-sql';
import { syntaxHighlighting, HighlightStyle } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, Braces, Check, CheckCheck, ChevronDown, ChevronLeft, ChevronRight, Circle, CircleCheck, CircleHelp, Clock3, Code2, Database, Expand, FileCode2, FileText, History, Keyboard, LayoutList, ListFilter, LoaderCircle, LockKeyhole, Maximize2, Minimize2, Moon, MoreHorizontal, Pause, Play, Plus, RotateCcw, Search, Send, ShieldCheck, Sparkles, Square, Star, StickyNote, Sun, Terminal, Trash2, X } from 'lucide-react';
import './styles.css';
import PlaylistDescription from './PlaylistDescription.jsx';
import ProblemTextControls from './ProblemTextControls.jsx';
import WorkspaceLogin from './WorkspaceLogin.jsx';
import { validateInput } from '../shared/input.mjs';

const cx = (...items) => items.filter(Boolean).join(' ');
const engineLabel = engine => ({mysql:'MySQL',postgresql:'PostgreSQL',sqlite:'SQLite (previous engine)'}[engine] || 'SQLite (previous engine)');
const emptyProgress = { draft: null, notes: '', bookmarked: false, solved: false, submissions: [] };
async function api(path, options) {
  const response = await fetch(path, options && { ...options, headers: { 'Content-Type': 'application/json' } });
  const data = await response.json();
  if (!response.ok) { if(response.status===401) window.dispatchEvent(new Event('queryroom:locked')); throw new Error(data.error || 'Could not connect to the workspace server.'); }
  return data;
}
function localRead(key, fallback) { try { const value = localStorage.getItem(key); return value === null ? fallback : JSON.parse(value); } catch { return fallback; } }
function localWrite(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} }
function IconButton({ label, children, className, ...props }) { return <button className={cx('icon-button', className)} aria-label={label} title={label} {...props}>{children}</button>; }
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
    <div className="problem-eyebrow"><span>DATABASE</span><span className="eyebrow-dot">/</span><span>#{problem.number}</span><ProblemTextControls value={fontSize} onChange={onFontSize}/><button className={cx('bookmark', progress.bookmarked && 'is-bookmarked')} onClick={onBookmark} aria-label={progress.bookmarked ? 'Remove bookmark' : 'Bookmark question'} title="Bookmark question"><Star size={17} fill={progress.bookmarked ? 'currentColor' : 'none'} /></button></div>
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
      '.cm-line': { paddingLeft: '8px' }, '.cm-activeLine, .cm-activeLineGutter': { background: 'var(--editor-line)' },
      '&.cm-focused': { outline: 'none' }, '.cm-cursor': { borderLeftColor: 'var(--accent)' },
      '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': { background: 'var(--selection)' },
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
  const [problems, setProblems] = useState([]), [progress, setProgress] = useState({}), [slug, setSlug] = useState('rectangles-area');
  const [needsLogin,setNeedsLogin]=useState(false),[protectedWorkspace,setProtectedWorkspace]=useState(false),[hosted,setHosted]=useState(false);
  const [loading, setLoading] = useState(true), [loadError, setLoadError] = useState('');
  const [query, setQuery] = useState(''), [notes, setNotes] = useState(''), [saveStatus, setSaveStatus] = useState('Saved locally');
  const [engine, setEngine] = useState(()=>localRead('queryroom-engine','mysql') === 'postgresql' ? 'postgresql' : 'mysql');
  const [engines,setEngines] = useState([]);
  const [theme, setTheme] = useState(() => localRead('queryroom-theme', 'light'));
  const [problemFontSize, setProblemFontSize] = useState(() => { const saved=localRead('queryroom-problem-font-size',100); return Number.isFinite(saved) ? Math.max(100,Math.min(200,saved)) : 100; });
  const [leftTab, setLeftTab] = useState('description'), [bottomTab, setBottomTab] = useState('testcases');
  const [caseId, setCaseId] = useState('example'), [custom, setCustom] = useState(null), [customDraft, setCustomDraft] = useState(''), [customError, setCustomError] = useState('');
  const [busy, setBusy] = useState(false), [result, setResult] = useState(null), [modal, setModal] = useState(null);
  const [drawer, setDrawer] = useState(false), [filter, setFilter] = useState('all'), [search, setSearch] = useState('');
  const [focused, setFocused] = useState(false), [bottomCollapsed, setBottomCollapsed] = useState(false), [cursor, setCursor] = useState({ line: 1, col: 1 });
  const [timerRunning, setTimerRunning] = useState(false), [elapsed, setElapsed] = useState(() => localRead('queryroom-timer', 0));
  const [leftWidth, setLeftWidth] = useState(45), [editorHeight, setEditorHeight] = useState(49), [toast, setToast] = useState('');
  const hydrated = useRef(false), workspaceRef = useRef(null), rightRef = useRef(null), executing = useRef(false);
  const savedSnapshots = useRef({}), saveChains = useRef({}), activeSlug = useRef(slug);
  activeSlug.current = slug;
  const persistDraft = (key, draft, draftNotes) => {
    const snapshot = { draft, notes: draftNotes };
    const pending = (saveChains.current[key] || Promise.resolve()).catch(()=>{}).then(()=>api(`/api/state/${key}`, {method:'PUT',body:JSON.stringify(snapshot)}));
    saveChains.current[key] = pending;
    pending.then(()=>{
      savedSnapshots.current[key] = snapshot;
      const backup = localRead(`queryroom-draft-${key}`,null);
      if (backup?.value===draft && backup?.notes===draftNotes) {
        localWrite(`queryroom-draft-${key}`, {value:draft,notes:draftNotes,dirty:false});
        if (activeSlug.current===key) setSaveStatus('Saved locally');
      }
    }).catch(()=>{ if(activeSlug.current===key) setSaveStatus('Saved in browser · server unavailable'); });
    return pending;
  };
  const problem = problems.find(p => p.slug === slug), currentProgress = progress[slug] || emptyProgress;
  useEffect(() => { document.documentElement.dataset.theme = theme; localWrite('queryroom-theme', theme); }, [theme]);
  useEffect(() => { localWrite('queryroom-problem-font-size',problemFontSize); },[problemFontSize]);
  useEffect(() => {
    api('/api/session').then(session=>{
      setHosted(session.hosted);setProtectedWorkspace(session.required);
      if(!session.authenticated) {setNeedsLogin(true);setLoading(false);return;}
      return Promise.all([api('/api/problems'),api('/api/state'),api('/api/engines')]).then(([p,saved,available])=>{
      setEngines(available);
      setProblems(p); setProgress(saved);
      savedSnapshots.current=Object.fromEntries(p.map(item=>[item.slug,{draft:saved[item.slug]?.draft ?? item.starter,notes:saved[item.slug]?.notes || ''}]));
      const requested=new URLSearchParams(window.location.search).get('problem') || localRead('queryroom-current-problem','rectangles-area');
      const first=p.find(item=>item.slug===requested)||p[0];
      const local=localRead(`queryroom-draft-${first.slug}`,null), snapshot=savedSnapshots.current[first.slug];
      setSlug(first.slug); setQuery(local?.dirty ? local.value : snapshot.draft); setNotes(local?.dirty ? local.notes ?? snapshot.notes : snapshot.notes);
      setCaseId(first.practiceCases[0].id); setCustom(localRead(`queryroom-custom-${first.slug}`,null));
      hydrated.current=true; setLoading(false);
      });
    }).catch(e=>{setLoadError(e.message);setLoading(false);});
  }, []);
  useEffect(()=>{const lock=()=>setNeedsLogin(true);window.addEventListener('queryroom:locked',lock);return()=>window.removeEventListener('queryroom:locked',lock);},[]);
  useEffect(() => { if (!timerRunning) return; const interval = setInterval(() => setElapsed(t => t + 1), 1000); return () => clearInterval(interval); }, [timerRunning]);
  useEffect(() => { localWrite('queryroom-timer', elapsed); }, [elapsed]);
  useEffect(() => { if (!toast) return; const timeout = setTimeout(() => setToast(''), 3000); return () => clearTimeout(timeout); }, [toast]);
  useEffect(() => {
    if (!hydrated.current) return;
    const saved=savedSnapshots.current[slug];
    if (query===saved?.draft && notes===saved?.notes) { setSaveStatus('Saved locally'); return; }
    localWrite(`queryroom-draft-${slug}`,{value:query,notes,dirty:true});
    setSaveStatus('Saving…');
    const timeout=setTimeout(()=>persistDraft(slug,query,notes),550);
    return ()=>clearTimeout(timeout);
  }, [query,notes,slug]);
  useEffect(() => { const listener = e => { if (e.key === 'Escape') { setDrawer(false); setFocused(false); } }; window.addEventListener('keydown', listener); return () => window.removeEventListener('keydown', listener); }, []);
  const run = useCallback(async mode => {
    if (!problem || executing.current) return;
    if (!engines.some(item=>item.id===engine && item.available)) {setToast('The selected database is unavailable. Restart Queryroom and try again.');return;}
    executing.current = true; setBusy(mode); setBottomTab('results'); setBottomCollapsed(false);
    try {
      const data = await api('/api/query', { method: 'POST', body: JSON.stringify({ slug, sql: query, engine, mode, caseId, ...(caseId === 'custom' && mode === 'run' ? { customInput: custom } : {}) }) });
      setResult({ ...data, mode });
      if (data.submission) setProgress(prev => ({ ...prev, [slug]: { ...prev[slug], solved: data.solved, submissions: [data.submission, ...(prev[slug]?.submissions || [])].slice(0, 100) } }));
      if (mode === 'submit' && data.verdict === 'Accepted') { setTimerRunning(false); setToast('Nicely done. This question is marked as solved.'); }
    } catch (e) { setResult({ verdict: 'Unable to run', error: e.message, passed: 0, total: 0, runtime: 0, results: [], mode }); }
    finally { setBusy(false); executing.current = false; }
  }, [problem, query, slug, caseId, custom, engine, engines]);
  const chooseEngine = id => { if(executing.current) return; setEngine(id); localWrite('queryroom-engine',id); setResult(null); };
  const engineReady = engines.some(item=>item.id===engine && item.available);
  const onBookmark = async () => {
    const bookmarked = !currentProgress.bookmarked;
    setProgress(prev => ({ ...prev, [slug]: { ...prev[slug], bookmarked } }));
    try { await api(`/api/state/${slug}`, { method: 'PUT', body: JSON.stringify({ bookmarked }) }); } catch { setProgress(prev => ({ ...prev, [slug]: { ...prev[slug], bookmarked: !bookmarked } })); setToast('Could not save your bookmark. Please try again.'); }
  };
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
  function switchProblem(p) {
    if (!p || p.slug===slug) {setDrawer(false);return;}
    if (executing.current) {setToast('Your query is still running. Please try again in a moment.');return;}
    const draft={value:query,notes,dirty:query!==savedSnapshots.current[slug]?.draft || notes!==savedSnapshots.current[slug]?.notes};
    localWrite(`queryroom-draft-${slug}`,draft);
    setProgress(prev=>({...prev,[slug]:{...prev[slug],draft:query,notes}}));
    if(draft.dirty) persistDraft(slug,query,notes);
    const nextLocal=localRead(`queryroom-draft-${p.slug}`,null);
    const snapshot=nextLocal?.dirty ? {draft:nextLocal.value,notes:nextLocal.notes || ''} : savedSnapshots.current[p.slug] || {draft:progress[p.slug]?.draft ?? p.starter,notes:progress[p.slug]?.notes || ''};
    setSlug(p.slug); setQuery(snapshot.draft); setNotes(snapshot.notes);
    setCaseId(p.practiceCases[0].id); setCustom(localRead(`queryroom-custom-${p.slug}`,null)); setResult(null); setLeftTab('description'); setBottomTab('testcases'); setDrawer(false); setCursor({line:1,col:1});
    localWrite('queryroom-current-problem',p.slug);
    window.history.replaceState(null,'',`?problem=${encodeURIComponent(p.slug)}`);
  }
  const matchesQuestion=p=>`${p.title} ${p.number}`.toLowerCase().includes(search.toLowerCase()) && (filter==='all' || (filter==='playlist' ? Boolean(p.playlist) : filter==='added' ? p.collection==='Added questions' : filter==='unsolved' ? !progress[p.slug]?.solved : filter==='solved' ? progress[p.slug]?.solved : progress[p.slug]?.bookmarked));
  const visibleProblems=problems.filter(matchesQuestion);
  const solvedCount = problems.filter(p => progress[p.slug]?.solved).length;
  const activeCase = caseId === 'custom' ? { name: 'Custom case', description: 'Your own input data.', kind: 'Your test case', input: custom } : problem?.practiceCases.find(c => c.id === caseId);
  if(needsLogin) return <WorkspaceLogin onUnlock={password=>api('/api/login',{method:'POST',body:JSON.stringify({password})})}/>;
  if (loading || loadError) return <div className="loading-screen"><div className="brand-mark"><Braces size={25}/></div><h1>queryroom<span>.</span></h1>{loadError ? <><p>{loadError}</p><button className="primary-button" onClick={() => window.location.reload()}>Try again</button></> : <><LoaderCircle className="spin" size={22}/><p>Getting your workspace ready…</p></>}</div>;
  return <div className="app-shell">
    <header className="app-header"><a className="brand" href="/" aria-label="Queryroom home"><span className="brand-mark"><Braces size={21}/></span><span>queryroom<span className="brand-period">.</span></span></a><div className="header-divider"/><span className="workspace-label">Your SQL practice space</span><div className="header-right"><span className="local-indicator"><span/> {hosted?'Private workspace':'Local workspace'}</span><IconButton label={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'} onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>{theme === 'light' ? <Moon size={17}/> : <Sun size={18}/>}</IconButton><IconButton label="Help and keyboard shortcuts" onClick={() => setModal('help')}><CircleHelp size={18}/></IconButton>{protectedWorkspace && <IconButton label="Lock workspace" disabled={Boolean(busy)} onClick={async()=>{await persistDraft(slug,query,notes).catch(()=>{});await api('/api/logout',{method:'POST',body:'{}'});setNeedsLogin(true);}}><LockKeyhole size={16}/></IconButton>}<span className="avatar" title="Your personal workspace">Y</span></div></header>
    <div className="workspace-toolbar"><div className="problem-navigation"><button className="problem-list-button" onClick={() => setDrawer(true)}><LayoutList size={17}/><span>Problem list</span><ChevronDown size={13}/></button><span className="toolbar-divider"/><IconButton label="Previous question" disabled={Boolean(busy) || problems.indexOf(problem) === 0} onClick={() => switchProblem(problems[problems.indexOf(problem) - 1])}><ChevronLeft size={17}/></IconButton><span className="problem-counter">{String(problems.indexOf(problem) + 1).padStart(2, '0')} <span>/ {String(problems.length).padStart(2, '0')}</span></span><IconButton label="Next question" disabled={Boolean(busy) || problems.indexOf(problem) === problems.length - 1} onClick={() => switchProblem(problems[problems.indexOf(problem) + 1])}><ChevronRight size={17}/></IconButton></div><span className="pace-note current-question-title" title={problem.title}>{problem.title}</span><div className="run-actions"><button className={cx('timer', timerRunning && 'running')} aria-label={timerRunning ? 'Pause practice timer' : 'Start practice timer'} title={timerRunning ? 'Pause timer' : 'Start timer'} onClick={() => setTimerRunning(!timerRunning)}>{timerRunning ? <Pause size={14}/> : <Clock3 size={15}/>}<span>{String(Math.floor(elapsed / 60)).padStart(2, '0')}:{String(elapsed % 60).padStart(2, '0')}</span></button><button className="run-button" onClick={() => run('run')} disabled={Boolean(busy) || !engineReady} title="Run selected test · ⌘ Enter">{busy === 'run' ? <LoaderCircle className="spin" size={15}/> : <Play size={14} fill="currentColor"/>}Run<kbd>⌘ ↵</kbd></button><button className="primary-button submit-button" onClick={() => run('submit')} disabled={Boolean(busy) || !engineReady} title="Check all tests · ⌘ Shift Enter">{busy === 'submit' ? <LoaderCircle className="spin" size={16}/> : <Send size={15}/>} Submit</button></div></div>
    <main ref={workspaceRef} className={cx('workspace', focused && 'editor-focused')} style={{ '--left-width': `${leftWidth}%`, '--editor-height': `${editorHeight}%` }}>
      <section className="panel description-panel" aria-label="Problem details"><div className="panel-tabs" role="tablist" aria-label="Problem information"><button role="tab" aria-selected={leftTab === 'description'} onClick={() => setLeftTab('description')} className={cx(leftTab === 'description' && 'active')}><FileText size={15}/>Description</button><button role="tab" aria-selected={leftTab === 'submissions'} onClick={() => setLeftTab('submissions')} className={cx(leftTab === 'submissions' && 'active')}><History size={15}/>Submissions{currentProgress.submissions.length > 0 && <span className="tab-count">{currentProgress.submissions.length}</span>}</button><button role="tab" aria-selected={leftTab === 'notes'} onClick={() => setLeftTab('notes')} className={cx(leftTab === 'notes' && 'active')}><StickyNote size={15}/>Notes</button></div><div key={slug} className="description-scroll" role="tabpanel" style={{'--problem-font-scale':problemFontSize/100}}>{leftTab === 'description' && <Description problem={problem} progress={currentProgress} onBookmark={onBookmark} fontSize={problemFontSize} onFontSize={setProblemFontSize}/>} {leftTab === 'submissions' && <SubmissionHistory submissions={currentProgress.submissions} onRestore={submission => { setQuery(submission.sql); if(['mysql','postgresql'].includes(submission.engine)) chooseEngine(submission.engine); setToast(submission.engine && submission.engine!=='sqlite' ? 'Query and database restored.' : 'Previous SQLite query restored. Review its syntax for your selected database.'); }}/>} {leftTab === 'notes' && <div className="notes-panel"><div className="section-heading"><h2>Space to think</h2><StickyNote size={18}/></div><p>Keep an idea, an observation, or something you learned.</p><textarea aria-label="Your problem notes" placeholder="What do you notice about this problem?" value={notes} onChange={e => setNotes(e.target.value)} maxLength={20000}/><span className="note-saved"><CheckCheck size={13}/>{hosted && saveStatus==='Saved locally' ? 'Saved to your workspace' : saveStatus}</span></div>}</div><div className="description-footer"><span><BookOpen size={13}/> Learn by doing</span><a href={problem.source} target="_blank" rel="noreferrer">LeetCode #{problem.number}<ArrowUpRight size={12}/></a></div></section>
      <div className="splitter horizontal-splitter" role="separator" tabIndex="0" aria-label="Resize problem and editor panels" aria-orientation="vertical" aria-valuemin="30" aria-valuemax="65" aria-valuenow={leftWidth} onPointerDown={e => resize(e, 'horizontal')} onKeyDown={e => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); setLeftWidth(w => Math.max(30, Math.min(65, w + (e.key === 'ArrowRight' ? 2 : -2)))); } }}><span/></div>
      <div ref={rightRef} className={cx('right-workspace', bottomCollapsed && 'bottom-collapsed')}>
        <section className="panel editor-panel" aria-label="SQL editor"><div className="editor-panel-heading"><span><Code2 size={16}/><strong>Code</strong></span><div><IconButton label="Reset query to starter" onClick={() => setModal('reset')}><RotateCcw size={15}/></IconButton><IconButton label={focused ? 'Exit focus mode' : 'Focus on editor'} onClick={() => setFocused(!focused)}>{focused ? <Minimize2 size={15}/> : <Maximize2 size={15}/>}</IconButton></div></div><div className="editor-options"><div className="engine-controls"><label className="engine-selector"><Database size={13}/><select aria-label="SQL database engine" value={engine} disabled={Boolean(busy)} onChange={e=>chooseEngine(e.target.value)}><option value="mysql">MySQL</option><option value="postgresql">PostgreSQL</option></select><ChevronDown size={12}/></label><IconButton label="About SQL engines" onClick={()=>setModal('dialect')}><CircleHelp size={14}/></IconButton></div><span className={engineReady ? '' : 'error-text'}><span className="small-dot"/> {engineReady ? 'Ready to query' : 'Database unavailable'}</span></div><SQLEditor key={slug} value={query} onChange={setQuery} theme={theme} onRun={() => run('run')} onSubmit={() => run('submit')} onCursor={setCursor} schema={problem.schema} engine={engine}/><div className="editor-status"><span className={saveStatus.includes('unavailable') ? 'error-text' : ''}><CheckCheck size={13}/>{hosted && saveStatus==='Saved locally' ? 'Saved to your workspace' : saveStatus}</span><div><span>Ln {cursor.line}, Col {cursor.col}</span><IconButton label="Editor keyboard shortcuts" onClick={() => setModal('help')}><Keyboard size={15}/></IconButton></div></div></section>
        <div className="splitter vertical-splitter" role="separator" tabIndex="0" aria-label="Resize code and test panels" aria-orientation="horizontal" aria-valuemin="28" aria-valuemax="72" aria-valuenow={editorHeight} onPointerDown={e => resize(e, 'vertical')} onKeyDown={e => { if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); setEditorHeight(h => Math.max(28, Math.min(72, h + (e.key === 'ArrowDown' ? 3 : -3)))); } }}><span/></div>
        <section className="panel test-panel" aria-label="Test cases and results"><div className="test-panel-heading"><div className="panel-tabs" role="tablist" aria-label="Test panel"><button role="tab" aria-selected={bottomTab === 'testcases'} className={cx(bottomTab === 'testcases' && 'active')} onClick={() => { setBottomTab('testcases'); setBottomCollapsed(false); }}><Braces size={15}/>Test cases<span className="tab-count">{problem.practiceCases.length + (custom ? 1 : 0)}</span></button><button role="tab" aria-selected={bottomTab === 'results'} className={cx(bottomTab === 'results' && 'active')} onClick={() => { setBottomTab('results'); setBottomCollapsed(false); }}><Terminal size={15}/>Test result{result && <span className={cx('result-dot', result.verdict === 'Accepted' && 'pass')}/>}</button></div><IconButton label={bottomCollapsed ? 'Expand test panel' : 'Collapse test panel'} onClick={() => setBottomCollapsed(!bottomCollapsed)}><ChevronDown size={16} className={bottomCollapsed ? 'rotate' : ''}/></IconButton></div><div className="test-panel-content" role="tabpanel">{bottomTab === 'results' ? <TestResults result={result} busy={busy} problem={problem}/> : <div className="testcases-content"><div className="case-switcher">{problem.practiceCases.slice(0, 3).map((c, i) => <button className={cx('case-pill', caseId === c.id && 'selected')} key={c.id} onClick={() => setCaseId(c.id)}><span className="small-dot"/>{i === 0 ? 'Example 1' : `Case ${i + 1}`}</button>)}<select className={cx('more-cases', !problem.practiceCases.slice(0, 3).some(c => c.id === caseId) && 'selected')} aria-label="Select a test case" value={problem.practiceCases.slice(0, 3).some(c => c.id === caseId) ? 'more' : caseId} onChange={e => setCaseId(e.target.value)}><option disabled value="more">{Math.max(0,problem.practiceCases.length-3)} more cases</option>{problem.practiceCases.slice(3).map((c, i) => <option key={c.id} value={c.id}>{i + 4}. {c.name}</option>)}{custom && <option value="custom">Custom case</option>}</select><IconButton label="Add or edit custom test case" className="add-case" onClick={openCustom}><Plus size={17}/></IconButton></div><div className="case-description"><span>{activeCase?.name}</span><span>{activeCase?.kind}</span></div><p className="case-helper">{activeCase?.description}</p>{activeCase && problem.schema.map(table => <div className="case-table" key={table.name}><div className="table-heading"><h3><Database size={13}/>{table.name}</h3><span>{activeCase.input[table.name].length} rows</span>{caseId === 'custom' && <button onClick={openCustom}>Edit data</button>}</div><DataTable columns={table.columns.map(c => c.name)} rows={activeCase.input[table.name]} compact/></div>)}<div className="case-bottom-note"><ShieldCheck size={13}/><span>Submit checks all {problem.totalTests} local tests.</span><button onClick={() => setModal('tests')}>About the tests <ArrowUpRight size={11}/></button></div></div>}</div></section>
      </div>
    </main>
    <footer className="app-footer"><span><span className="footer-dot"/> {hosted?'Private SQL workspace':'All systems local'} <span className="footer-separator">·</span> {hosted?'Progress saved to your workspace':'Your progress stays on this device'}</span><span>Made for your next “aha.” <Sparkles size={12}/></span></footer>
    {toast && <div className="toast" role="status"><Check size={15}/>{toast}</div>}
    {drawer && <div className="drawer-backdrop" onClick={() => setDrawer(false)}><aside className="problem-drawer" aria-label="Problem list" onClick={e => e.stopPropagation()}><div className="drawer-title"><span className="brand-mark"><Braces size={20}/></span><h2>Your practice list</h2><IconButton label="Close problem list" onClick={() => setDrawer(false)}><X size={18}/></IconButton></div><div className="progress-card"><div><span>Small steps. Real progress.</span><strong>{solvedCount} <span>/ {problems.length}</span></strong></div><div className="progress-track"><span style={{ width: `${solvedCount / problems.length * 100}%` }}/></div><p>{solvedCount ? 'Keep the momentum going.' : 'Your first solved question is waiting.'}</p></div><label className="problem-search"><Search size={16}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search your questions"/></label><div className="drawer-filters">{['all', 'playlist', 'added', 'unsolved', 'solved', 'starred'].map(f => <button className={cx(filter === f && 'selected')} onClick={() => setFilter(f)} key={f}>{f === 'all' ? 'All' : f === 'playlist' ? 'Playlist' : f === 'added' ? 'Added' : f === 'unsolved' ? 'Unsolved' : f === 'solved' ? 'Solved' : 'Starred'}</button>)}</div><div className="collection-summary">{visibleProblems.length} {visibleProblems.length === 1 ? 'question' : 'questions'}<span>{filter==='playlist' ? 'Playlist order' : 'Practice order'}</span></div><div className="drawer-problems">{visibleProblems.map(p => <button className={cx('problem-card', p.slug === slug && 'current')} onClick={() => switchProblem(p)} key={p.slug}><span className="problem-card-check">{progress[p.slug]?.solved ? <CircleCheck size={17}/> : <Circle size={16}/>}</span><span><small>#{p.number} · {p.playlist ? `Lesson ${p.playlistIndex}` : p.collection==='Added questions' ? 'Added question' : 'Your first question'}</small><strong>{p.title}</strong><span className={`badge ${p.difficulty.toLowerCase()}`}>{p.difficulty}</span></span><ChevronRight size={16}/></button>)}{visibleProblems.length===0 && <p className="drawer-empty">No questions here yet.</p>}</div><div className="playlist-drawer-footer"><Play size={15}/><div><strong>Leetcode SQL Hard</strong><span>53 questions · 54 video lessons</span></div><a href="https://www.youtube.com/playlist?list=PLtfxzVLWb-B9M7Rx5BrZwZqSBP2_IzRMA" target="_blank" rel="noreferrer" aria-label="Open the source playlist"><ArrowUpRight size={15}/></a></div></aside></div>}
    {modal === 'reset' && <Modal title="Start with a clean editor?" onClose={() => setModal(null)}><p>This replaces your current draft with the starter. Submitted queries stay in your history.</p><div className="modal-actions"><button className="secondary-button" onClick={() => setModal(null)}>Keep my draft</button><button className="primary-button" onClick={() => { setQuery(problem.starter); setModal(null); setToast('Editor reset. You can undo with ⌘ Z.'); }}>Reset editor</button></div></Modal>}
    {modal === 'dialect' && <Modal title="Choose your SQL engine" onClose={() => setModal(null)}><div className="engine-cards">{engines.map(item=><button key={item.id} className={cx('engine-card',engine===item.id&&'selected')} disabled={!item.available || Boolean(busy)} onClick={()=>{chooseEngine(item.id);setModal(null);}}><Database size={23}/><span><strong>{item.name}</strong><small>{item.version || 'Unavailable'}</small></span>{engine===item.id&&<CircleCheck size={19}/>}</button>)}</div><p>Your query runs directly on the selected database. Choose MySQL for the playlist's MySQL syntax, or PostgreSQL to practice its date functions, casts, and SQL features.</p><p>Switching engines keeps your current query. Each submission records which engine you used.</p><div className="modal-note"><ShieldCheck size={16}/> Each test uses fresh tables with read-only access and a 3-second query limit.</div></Modal>}
    {modal === 'help' && <Modal title="Make yourself at home" onClose={() => setModal(null)}><p>A little less setup. A little more SQL.</p><div className="shortcut-list"><div><span>Run the selected test</span><span><kbd>⌘ / Ctrl</kbd> <kbd>Enter</kbd></span></div><div><span>Submit against all tests</span><span><kbd>⌘ / Ctrl</kbd> <kbd>Shift</kbd> <kbd>Enter</kbd></span></div><div><span>Editor autocomplete</span><span><kbd>Ctrl</kbd> <kbd>Space</kbd></span></div><div><span>Find in your query</span><span><kbd>⌘ / Ctrl</kbd> <kbd>F</kbd></span></div><div><span>Undo an editor change</span><span><kbd>⌘ / Ctrl</kbd> <kbd>Z</kbd></span></div></div><p className="modal-note">Drag the dividers to resize your workspace. Drafts, notes, bookmarks, and submissions save automatically to your workspace.</p></Modal>}
    {modal === 'tests' && <Modal title="Built to test your thinking" onClose={() => setModal(null)}><div className="test-stats"><div><strong>{problem.practiceCases.length}</strong><span>Selectable cases</span></div><div><strong>{problem.totalTests-problem.practiceCases.length}</strong><span>Additional checks</span></div><div><strong>{problem.totalTests}</strong><span>Tests on Submit</span></div></div><p><strong>Run</strong> checks the selected case, or your custom input. <strong>Submit</strong> checks all {problem.totalTests} built-in cases and saves the result to your history.</p><p>{problem.testNotes || 'The published example is reproduced from the question. Extra cases cover zero areas, negative coordinates, duplicate locations, large values, and sorting ties.'}</p><p className="modal-note">These are local practice tests. They are not LeetCode’s private test suite. {problem.orderMatters===false ? 'This question accepts results in any row order. Values and duplicate counts must match.' : 'Values and the specified sorting must match.'}</p></Modal>}
    {modal === 'custom' && <Modal title="Try your own test case" className="custom-modal" onClose={() => setModal(null)}><p>Use one array per table, with up to 100 rows each. Use JSON <code>null</code> for missing values, numbers for numeric columns, and quoted strings for text and dates.</p><div className="custom-schema-guide">{problem.schema.map(t=><div key={t.name}><strong>{t.name}</strong><code>[{t.columns.map(c=>c.name).join(', ')}]</code></div>)}</div><textarea className="custom-input" aria-label="Custom test case JSON" value={customDraft} onChange={e => setCustomDraft(e.target.value)} spellCheck={false}/>{customError && <p className="custom-error" role="alert">{customError}</p>}<div className="modal-actions"><button className="secondary-button" onClick={() => setModal(null)}>Cancel</button><button className="primary-button" onClick={saveCustom}><Check size={15}/> Use this case</button></div></Modal>}
  </div>;
}

createRoot(document.getElementById('root')).render(<App/>);
