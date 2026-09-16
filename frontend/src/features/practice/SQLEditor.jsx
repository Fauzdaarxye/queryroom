import { useEffect, useRef } from 'react';

import { basicSetup } from 'codemirror';
import { EditorView, keymap, placeholder } from '@codemirror/view';
import { EditorState, Compartment, Prec } from '@codemirror/state';
import { indentWithTab } from '@codemirror/commands';
import { sql, MySQL, PostgreSQL } from '@codemirror/lang-sql';
import { syntaxHighlighting, HighlightStyle } from '@codemirror/language';
import { tags } from '@lezer/highlight';

export default function SQLEditor({
  value,
  onChange,
  theme,
  onRun,
  onSubmit,
  onCursor,
  schema,
  engine,
}) {
  const element = useRef(null),
    editor = useRef(null),
    themeCompartment = useRef(new Compartment()),
    dialectCompartment = useRef(new Compartment());
  const callbacks = useRef({ onChange, onRun, onSubmit, onCursor });
  callbacks.current = { onChange, onRun, onSubmit, onCursor };
  function editorTheme(dark) {
    return [
      EditorView.theme(
        {
          '&': {
            height: '100%',
            background: 'var(--surface)',
            color: 'var(--text)',
            fontSize: '13px',
          },
          '.cm-scroller': {
            fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", monospace',
            lineHeight: '1.85',
            overflow: 'auto',
          },
          '.cm-content': { padding: '20px 0 60px', caretColor: 'var(--accent)' },
          '.cm-gutters': {
            background: 'var(--surface)',
            border: 'none',
            color: 'var(--faint)',
            paddingLeft: '12px',
            paddingRight: '12px',
          },
          '.cm-line': { paddingLeft: '8px' },
          // CodeMirror draws selections behind the text; an opaque line hides them.
          '.cm-activeLine': { backgroundColor: dark ? '#68c6a014' : '#15815f0a' },
          '.cm-activeLineGutter': { backgroundColor: 'var(--editor-line)' },
          '&.cm-focused': { outline: 'none' },
          '.cm-cursor': { borderLeftColor: 'var(--accent)' },
          '.cm-selectionBackground, &.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground':
            { backgroundColor: 'var(--selection)' },
          '.cm-tooltip': {
            background: 'var(--surface)',
            color: 'var(--text)',
            border: '1px solid var(--border)',
          },
          '.cm-placeholder': { color: 'var(--faint)' },
          '.cm-panels': { background: 'var(--surface-alt)', color: 'var(--text)' },
        },
        { dark },
      ),
      syntaxHighlighting(
        HighlightStyle.define([
          { tag: tags.keyword, color: dark ? '#b5a1ed' : '#825eb0' },
          { tag: tags.string, color: dark ? '#a7cf9b' : '#568343' },
          { tag: tags.number, color: dark ? '#e5b587' : '#a66830' },
          { tag: tags.comment, color: dark ? '#7e9389' : '#8b9992', fontStyle: 'italic' },
          { tag: tags.operator, color: dark ? '#9caeb9' : '#647889' },
          { tag: tags.typeName, color: '#4f989e' },
        ]),
      ),
    ];
  }
  useEffect(() => {
    const view = new EditorView({
      parent: element.current,
      state: EditorState.create({
        doc: value,
        extensions: [
          basicSetup,
          dialectCompartment.current.of(
            sql({
              dialect: engine === 'postgresql' ? PostgreSQL : MySQL,
              schema: Object.fromEntries(schema.map((t) => [t.name, t.columns.map((c) => c.name)])),
              upperCaseKeywords: true,
            }),
          ),
          Prec.highest(
            keymap.of([
              {
                key: 'Mod-Enter',
                run: () => {
                  callbacks.current.onRun();
                  return true;
                },
              },
              {
                key: 'Mod-Shift-Enter',
                run: () => {
                  callbacks.current.onSubmit();
                  return true;
                },
              },
              indentWithTab,
            ]),
          ),
          placeholder('Your next great query starts here.'),
          themeCompartment.current.of(editorTheme(theme === 'dark')),
          EditorView.contentAttributes.of({
            'aria-label': 'SQL query editor',
            spellcheck: 'false',
          }),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) callbacks.current.onChange(update.state.doc.toString());
            if (update.selectionSet || update.docChanged) {
              const pos = update.state.selection.main.head,
                line = update.state.doc.lineAt(pos);
              callbacks.current.onCursor({ line: line.number, col: pos - line.from + 1 });
            }
          }),
        ],
      }),
    });
    editor.current = view;
    return () => {
      view.destroy();
      editor.current = null;
    };
  }, []);
  useEffect(() => {
    const view = editor.current;
    if (view && view.state.doc.toString() !== value)
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } });
  }, [value]);
  useEffect(() => {
    editor.current?.dispatch({
      effects: themeCompartment.current.reconfigure(editorTheme(theme === 'dark')),
    });
  }, [theme]);
  useEffect(() => {
    editor.current?.dispatch({
      effects: dialectCompartment.current.reconfigure(
        sql({
          dialect: engine === 'postgresql' ? PostgreSQL : MySQL,
          schema: Object.fromEntries(schema.map((t) => [t.name, t.columns.map((c) => c.name)])),
          upperCaseKeywords: true,
        }),
      ),
    });
  }, [engine]);
  return <div className="sql-editor" ref={element} />;
}
