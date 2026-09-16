'use client';
import { useEffect, useState } from 'react';
import {
  Check,
  FilePlus2,
  LoaderCircle,
  Plus,
  Save,
  Search,
  ShieldCheck,
  Upload,
  X,
} from 'lucide-react';
import type { AdminQuestion, Problem, QuestionSummary, TestCase } from '../../../shared/types';
import '../styles/admin.css';

type Api = <T>(path: string, options?: RequestInit) => Promise<T>;
const pretty = (value: unknown) => JSON.stringify(value, null, 2);
export default function Admin({
  api,
  onPublished,
  onDirtyChange,
}: {
  api: Api;
  onPublished: () => Promise<void>;
  onDirtyChange: (value: boolean) => void;
}) {
  const [questions, setQuestions] = useState<QuestionSummary[]>([]),
    [search, setSearch] = useState('');
  const [selected, setSelected] = useState<AdminQuestion | null>(null),
    [problem, setProblem] = useState<Problem | null>(null);
  const [schema, setSchema] = useState('[]'),
    [tests, setTests] = useState('[]'),
    [orderBy, setOrderBy] = useState('[]');
  const [dirty, setDirty] = useState(false),
    [creating, setCreating] = useState(false),
    [tab, setTab] = useState('question');
  const [url, setUrl] = useState(''),
    [text, setText] = useState(''),
    [busy, setBusy] = useState(''),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const refresh = () => api<QuestionSummary[]>('/api/admin/questions').then(setQuestions);
  useEffect(() => {
    onDirtyChange(dirty);
    return () => onDirtyChange(false);
  }, [dirty, onDirtyChange]);
  useEffect(() => {
    refresh().catch((error) => setError(error.message));
  }, []);
  useEffect(() => {
    if (!dirty) return;
    const prevent = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', prevent);
    return () => window.removeEventListener('beforeunload', prevent);
  }, [dirty]);
  function load(value: AdminQuestion) {
    setSelected(value);
    setProblem(value.problem);
    setSchema(pretty(value.problem.schema));
    setOrderBy(pretty(value.problem.orderBy || []));
    const visible = new Set(value.problem.practiceCases.map((test) => test.id));
    setTests(
      pretty(
        value.problem.submissionCases.map((test) => ({ ...test, visible: visible.has(test.id) })),
      ),
    );
    setDirty(false);
    setCreating(false);
  }
  async function perform(label: string, action: () => Promise<void>) {
    setBusy(label);
    setError('');
    setNotice('');
    try {
      await action();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'This action could not be completed.');
    } finally {
      setBusy('');
    }
  }
  const patch = (value: Partial<Problem>) => {
    setProblem((previous) => (previous ? { ...previous, ...value } : null));
    setDirty(true);
  };
  async function open(id: string) {
    if (dirty && !window.confirm('Discard unsaved changes to this draft?')) return;
    await perform('Opening', async () => {
      load(await api<AdminQuestion>(`/api/admin/questions/${id}`));
      setTab('question');
    });
  }
  async function save() {
    await perform('Saving', async () => {
      const fixtures = JSON.parse(tests) as (TestCase & { visible?: boolean })[];
      if (!Array.isArray(fixtures)) throw new Error('Test cases must be a JSON array.');
      const clean = fixtures.map(({ visible, ...test }) => test);
      const value = {
        ...problem!,
        schema: JSON.parse(schema),
        orderBy: JSON.parse(orderBy),
        submissionCases: clean,
        practiceCases: clean.filter((_, i) => fixtures[i].visible),
      };
      load(
        await api<AdminQuestion>(`/api/admin/questions/${value.id}`, {
          method: 'PUT',
          body: JSON.stringify({ problem: value, revision: selected!.draftRevision }),
        }),
      );
      await refresh();
      setNotice('Draft saved. Validate both database engines before publishing.');
    });
  }
  async function action(name: 'validate' | 'publish') {
    await perform(name === 'validate' ? 'Validating both engines' : 'Publishing', async () => {
      const value = await api<AdminQuestion>(`/api/admin/questions/${problem!.id}/${name}`, {
        method: 'POST',
        body: JSON.stringify({ revision: selected!.draftRevision }),
      });
      load(value);
      await refresh();
      if (name === 'publish') {
        await onPublished();
        setNotice('Published. The question is available in the practice library.');
      } else
        setNotice(
          value.validation?.passed
            ? 'All tests passed on MySQL and PostgreSQL. Review the outputs, then publish.'
            : 'Validation found a problem. Review the results below and edit your draft.',
        );
    });
  }
  function addTest() {
    try {
      const fixtures = JSON.parse(tests),
        tables = JSON.parse(schema) as Problem['schema'];
      fixtures.push({
        id: `case-${crypto.randomUUID().slice(0, 8)}`,
        name: `Case ${fixtures.length + 1}`,
        kind: 'Edge case',
        description: '',
        visible: true,
        input: Object.fromEntries(tables.map((table) => [table.name, []])),
      });
      setTests(pretty(fixtures));
      setDirty(true);
    } catch {
      setError('Fix the schema and test JSON before adding a case.');
    }
  }
  return (
    <main className="admin-page">
      <div className="admin-top">
        <div>
          <span className="dashboard-eyebrow">QUESTION MANAGEMENT</span>
          <h1>Admin workspace</h1>
          <p>Import, review, test, and publish. Saved drafts stay private.</p>
        </div>
        <button
          className="primary-button"
          disabled={Boolean(busy)}
          onClick={() => {
            if (!dirty || window.confirm('Discard unsaved draft changes?')) {
              setCreating(true);
              setSelected(null);
              setProblem(null);
              setDirty(false);
              setError('');
            }
          }}
        >
          <FilePlus2 size={17} />
          Add question
        </button>
      </div>
      {error && (
        <div className="account-error" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <div className="admin-notice" role="status">
          {notice}
        </div>
      )}
      <div className="admin-layout">
        <aside className="admin-catalog">
          <label className="admin-search">
            <Search size={16} />
            <input
              aria-label="Search admin questions"
              placeholder="Search title or ID"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <p>{questions.length} questions</p>
          <div className="admin-question-list">
            {questions
              .filter((question) =>
                `${question.title} ${question.id}`.toLowerCase().includes(search.toLowerCase()),
              )
              .map((question) => (
                <button
                  className={problem?.id === question.id ? 'selected' : ''}
                  key={question.id}
                  disabled={Boolean(busy)}
                  onClick={() => open(question.id)}
                >
                  <span>
                    <strong>{question.title}</strong>
                    <small>
                      {question.id} ·{' '}
                      {question.publishedRevision === null
                        ? 'Draft'
                        : question.publishedRevision !== question.draftRevision
                          ? 'Unpublished changes'
                          : 'Published'}
                    </small>
                  </span>
                  <span className={`badge ${question.difficulty.toLowerCase()}`}>
                    {question.difficulty}
                  </span>
                </button>
              ))}
          </div>
        </aside>
        <section className="admin-editor" aria-label="Question editor">
          {creating ? (
            <form
              className="admin-create"
              onSubmit={(event) => {
                event.preventDefault();
                perform('Importing', async () => {
                  const value = await api<AdminQuestion & { notice: string }>('/api/admin/import', {
                    method: 'POST',
                    body: JSON.stringify({ url: url.trim() || undefined, text }),
                  });
                  load(value);
                  await refresh();
                  setNotice(value.notice);
                  setUrl('');
                  setText('');
                  setTab('question');
                });
              }}
            >
              <h2>Add a question</h2>
              <p>
                Paste a LeetCode link, question text, or both. The import creates a draft for your
                review.
              </p>
              <label>
                Question link
                <input
                  type="url"
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  placeholder="https://leetcode.com/problems/.../description/"
                />
              </label>
              <label>
                Question text or HTML
                <textarea
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  rows={12}
                  placeholder="Paste the complete statement, table definitions, examples, and constraints."
                />
              </label>
              <button
                className="primary-button"
                disabled={Boolean(busy) || (!url.trim() && !text.trim())}
              >
                {busy ? <LoaderCircle className="spin" size={16} /> : <Plus size={16} />}Create
                draft
              </button>
            </form>
          ) : !problem || !selected ? (
            <div className="admin-empty">
              <ShieldCheck size={32} />
              <h2>A reviewed question library</h2>
              <p>Choose a question to edit it, or add one from a link.</p>
              <p>Existing published revisions remain available while you work on a draft.</p>
            </div>
          ) : (
            <>
              <div className="admin-draft-heading">
                <div>
                  <small>
                    {problem.id} · Draft revision {selected.draftRevision}
                  </small>
                  <h2>{problem.title}</h2>
                  <p>
                    {dirty
                      ? 'Unsaved changes'
                      : selected.publishedRevision === selected.draftRevision
                        ? 'This revision is published'
                        : 'Private draft'}
                  </p>
                </div>
                <div className="admin-actions">
                  <button
                    className="secondary-button"
                    onClick={save}
                    disabled={Boolean(busy) || !dirty}
                  >
                    <Save size={15} />
                    Save draft
                  </button>
                  <button
                    className="secondary-button"
                    onClick={() => action('validate')}
                    disabled={Boolean(busy) || dirty}
                  >
                    <ShieldCheck size={15} />
                    Validate
                  </button>
                  <button
                    className="primary-button"
                    onClick={() => action('publish')}
                    disabled={
                      Boolean(busy) ||
                      dirty ||
                      !selected.validation?.passed ||
                      selected.publishedRevision === selected.draftRevision
                    }
                  >
                    <Upload size={15} />
                    Publish
                  </button>
                </div>
              </div>
              {busy && (
                <div className="admin-notice" role="status">
                  <LoaderCircle className="spin" size={16} />
                  {busy}…
                </div>
              )}
              <div className="admin-tabs" role="tablist">
                {['question', 'schema', 'tests', 'solutions'].map((name) => (
                  <button
                    key={name}
                    role="tab"
                    aria-selected={tab === name}
                    onClick={() => setTab(name)}
                  >
                    {name[0].toUpperCase() + name.slice(1)}
                  </button>
                ))}
              </div>
              <fieldset disabled={Boolean(busy)} className="admin-fields" role="tabpanel">
                {tab === 'question' && (
                  <>
                    <div className="admin-field-row">
                      <label>
                        Title
                        <input
                          value={problem.title}
                          onChange={(event) => patch({ title: event.target.value })}
                        />
                      </label>
                      <label>
                        Difficulty
                        <select
                          aria-label="Difficulty"
                          value={problem.difficulty}
                          onChange={(event) =>
                            patch({ difficulty: event.target.value as Problem['difficulty'] })
                          }
                        >
                          <option>Easy</option>
                          <option>Medium</option>
                          <option>Hard</option>
                        </select>
                      </label>
                    </div>
                    <label>
                      Source link
                      <input
                        value={problem.source}
                        onChange={(event) => patch({ source: event.target.value })}
                      />
                    </label>
                    <label>
                      Statement HTML
                      <textarea
                        rows={14}
                        value={problem.statementHtml || ''}
                        onChange={(event) => patch({ statementHtml: event.target.value })}
                      />
                    </label>
                    <details>
                      <summary>Preview saved statement</summary>
                      <div
                        className="imported-statement admin-preview"
                        dangerouslySetInnerHTML={{
                          __html: selected.problem.statementHtml || selected.problem.summary || '',
                        }}
                      />
                    </details>
                    <label>
                      Test coverage notes
                      <textarea
                        rows={3}
                        value={problem.testNotes || ''}
                        onChange={(event) => patch({ testNotes: event.target.value })}
                        placeholder="Explain which constraints and edge cases these tests cover."
                      />
                    </label>
                    <label>
                      Editor starter
                      <textarea
                        rows={3}
                        value={problem.starter}
                        onChange={(event) => patch({ starter: event.target.value })}
                      />
                    </label>
                  </>
                )}
                {tab === 'schema' && (
                  <>
                    <h3>Table definitions</h3>
                    <p>
                      Use INTEGER, REAL, or TEXT. Add displayType: date or datetime for date
                      columns. Mark primary keys to validate custom inputs.
                    </p>
                    <textarea
                      className="admin-code"
                      aria-label="Table schema JSON"
                      rows={22}
                      value={schema}
                      onChange={(event) => {
                        setSchema(event.target.value);
                        setDirty(true);
                      }}
                    />
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={() => {
                        try {
                          const tables = JSON.parse(schema);
                          tables.push({
                            name: `Table${tables.length + 1}`,
                            columns: [{ name: 'id', type: 'INTEGER', primaryKey: true }],
                          });
                          setSchema(pretty(tables));
                          setDirty(true);
                        } catch {
                          setError('Fix the schema JSON first.');
                        }
                      }}
                    >
                      <Plus size={15} />
                      Add table
                    </button>
                  </>
                )}
                {tab === 'tests' && (
                  <>
                    <div className="admin-field-row">
                      <div>
                        <h3>Examples and edge cases</h3>
                        <p>
                          Each input maps table names to rows in schema order. Set visible to true
                          for selectable practice cases. Provide expected output when known; missing
                          output is calculated from your reference solutions.
                        </p>
                      </div>
                      <button type="button" className="secondary-button" onClick={addTest}>
                        <Plus size={15} />
                        Add case
                      </button>
                    </div>
                    <textarea
                      className="admin-code"
                      aria-label="Test cases JSON"
                      rows={25}
                      value={tests}
                      onChange={(event) => {
                        setTests(event.target.value);
                        setDirty(true);
                      }}
                    />
                    <label className="admin-checkbox">
                      <input
                        type="checkbox"
                        checked={problem.orderMatters === true}
                        onChange={(event) => patch({ orderMatters: event.target.checked })}
                      />
                      Output order matters
                    </label>
                    <label>
                      Sort keys (optional)
                      <textarea
                        className="admin-code"
                        rows={3}
                        value={orderBy}
                        onChange={(event) => {
                          setOrderBy(event.target.value);
                          setDirty(true);
                        }}
                        placeholder={'[{"column":"id","direction":"asc"}]'}
                      />
                    </label>
                    <p>
                      Include a visible example and at least one distinct edge case. Add ties,
                      boundaries, missing matches, and other cases allowed by the question.
                    </p>
                  </>
                )}
                {tab === 'solutions' && (
                  <>
                    <h3>Private reference solutions</h3>
                    <p>
                      These solutions calculate expected results for custom inputs. Validation runs
                      every case on both engines and checks that their answers agree. Reference SQL
                      is never sent to the practice editor.
                    </p>
                    {(['mysql', 'postgresql'] as const).map((engine) => (
                      <label key={engine}>
                        {engine === 'mysql' ? 'MySQL' : 'PostgreSQL'}
                        <textarea
                          className="admin-code"
                          rows={12}
                          value={problem.references[engine]}
                          onChange={(event) =>
                            patch({
                              references: { ...problem.references, [engine]: event.target.value },
                            })
                          }
                          spellCheck={false}
                        />
                      </label>
                    ))}
                  </>
                )}
              </fieldset>
              {selected.validation && (
                <div className="admin-validation">
                  <h3>
                    {selected.validation.passed ? <Check size={17} /> : <X size={17} />}Validation
                    results
                  </h3>
                  {selected.validation.checks.map((check) => (
                    <div key={check.engine}>
                      <strong>{check.engine === 'mysql' ? 'MySQL' : 'PostgreSQL'}</strong>
                      <span>
                        {check.passed}/{check.total} tests passed
                      </span>
                      {check.error && <p className="error-text">{check.error}</p>}
                    </div>
                  ))}
                  <small>{new Date(selected.validation.checkedAt).toLocaleString()}</small>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  );
}
