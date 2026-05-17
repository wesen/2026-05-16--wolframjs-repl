import React, { useRef, useEffect, useCallback } from "react";
import { EditorView, keymap, lineNumbers, highlightActiveLine } from "@codemirror/view";
import { EditorState, Compartment } from "@codemirror/state";
import { javascript } from "@codemirror/lang-javascript";
import { oneDark } from "@codemirror/theme-one-dark";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching } from "@codemirror/language";
import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { updateCellCode } from "../store/notebookSlice";

interface CellInputProps {
  cellId: string;
  code: string;
  inputIndex: number;
  onEvaluate: (code: string) => void;
  onEvaluateAndNext: (code: string) => void;
  isActive: boolean;
}

const themeCompartment = new Compartment();

/** Light theme for CodeMirror matching our Mathematica aesthetic. */
const replLightTheme = EditorView.theme({
  "&": {
    fontSize: "14px",
    fontFamily: "var(--font-mono)",
    backgroundColor: "transparent",
  },
  ".cm-content": {
    caretColor: "var(--color-repl-fg)",
    fontFamily: "var(--font-mono)",
  },
  ".cm-cursor": {
    borderLeftColor: "var(--color-repl-accent)",
    borderLeftWidth: "2px",
  },
  ".cm-activeLine": {
    backgroundColor: "var(--color-repl-cell-hover)",
  },
  ".cm-gutters": {
    backgroundColor: "transparent",
    color: "var(--color-repl-muted)",
    border: "none",
  },
  ".cm-lineNumbers .cm-gutterElement": {
    fontSize: "12px",
  },
  "&.cm-focused": {
    outline: "none",
  },
});

export function CellInput({
  cellId,
  code,
  inputIndex,
  onEvaluate,
  onEvaluateAndNext,
  isActive,
}: CellInputProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onEvaluateRef = useRef(onEvaluate);
  const onEvaluateAndNextRef = useRef(onEvaluateAndNext);
  onEvaluateRef.current = onEvaluate;
  onEvaluateAndNextRef.current = onEvaluateAndNext;

  const dispatch = useAppDispatch();
  const theme = useAppSelector((s) => s.config.theme);

  // Create editor on mount or when cellId changes
  useEffect(() => {
    if (!editorRef.current) return;

    const isDark =
      theme === "dark" ||
      (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);

    const state = EditorState.create({
      doc: code,
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        history(),
        javascript(),
        bracketMatching(),
        closeBrackets(),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            dispatch(updateCellCode({ id: cellId, code: update.state.doc.toString() }));
          }
        }),
        keymap.of([
          // Custom REPL shortcuts must come before defaultKeymap, otherwise
          // CodeMirror's default Enter binding inserts a newline first.
          {
            key: "Shift-Enter",
            run: (view) => {
              const code = view.state.doc.toString();
              onEvaluateRef.current(code);
              return true;
            },
          },
          {
            key: "Mod-Enter",
            run: (view) => {
              const code = view.state.doc.toString();
              onEvaluateAndNextRef.current(code);
              return true;
            },
          },
          {
            key: "Ctrl-Enter",
            run: (view) => {
              const code = view.state.doc.toString();
              onEvaluateAndNextRef.current(code);
              return true;
            },
          },
          ...closeBracketsKeymap,
          ...defaultKeymap,
          ...historyKeymap,
        ]),
        replLightTheme,
        themeCompartment.of(isDark ? oneDark : []),
        EditorView.lineWrapping,
      ],
    });

    const view = new EditorView({
      state,
      parent: editorRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [cellId, dispatch]); // Only recreate when cell identity changes

  // Sync external code changes into the editor (e.g. from Redux after evaluateCode)
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    const currentDoc = view.state.doc.toString();
    if (code !== currentDoc) {
      view.dispatch({
        changes: { from: 0, to: currentDoc.length, insert: code },
      });
    }
  }, [code]);

  // Focus when becoming active
  useEffect(() => {
    if (isActive && viewRef.current) {
      viewRef.current.focus();
    }
  }, [isActive]);

  const handleClick = useCallback(() => {
    if (viewRef.current) {
      viewRef.current.focus();
    }
  }, []);

  return (
    <div className="cell-input-wrapper flex items-start gap-3">
      <span className="input-label text-xs font-mono text-repl-muted pt-2 select-none shrink-0 w-16 text-right">
        In[{inputIndex}]:=
      </span>
      <div
        ref={editorRef}
        data-cell-id={cellId}
        onClick={handleClick}
        className="cell-editor flex-1 min-h-[28px] cursor-text"
      />
    </div>
  );
}
