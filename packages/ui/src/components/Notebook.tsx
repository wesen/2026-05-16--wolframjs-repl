import { useEffect, useCallback } from "react";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { addCell, setActiveCell, evaluateCode } from "../store/notebookSlice";
import { addEntry } from "../store/historySlice";
import { Cell } from "./Cell";
import type { WorkerResponse } from "@eval";

export function Notebook() {
  const dispatch = useAppDispatch();
  const cells = useAppSelector((s) => s.notebook.cells);
  const activeCellId = useAppSelector((s) => s.notebook.activeCellId);

  // Auto-create the first cell on mount
  useEffect(() => {
    if (cells.length === 0) {
      dispatch(addCell());
    }
  }, [cells.length, dispatch]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ctrl/Cmd + Enter: evaluate active cell
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        const activeCell = cells.find((c) => c.id === activeCellId);
        if (activeCell && activeCell.code.trim()) {
          dispatch(evaluateCode({ cellId: activeCell.id, code: activeCell.code })).then(
            (action: any) => {
              const result = action.payload as WorkerResponse & { cellId: string };
              if (result?.type === "result") {
                dispatch(
                  addEntry({
                    inputIndex: activeCell.inputIndex,
                    code: activeCell.code,
                    timestamp: Date.now(),
                    result: result.value,
                    resultType: result.value.type,
                  })
                );
              }
            }
          );
        }
      }

      // Ctrl/Cmd + Shift + N: new cell
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "N") {
        e.preventDefault();
        dispatch(addCell());
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [cells, activeCellId, dispatch]);

  const handleAddCell = useCallback(() => {
    dispatch(addCell());
  }, [dispatch]);

  return (
    <div className="notebook max-w-[960px] mx-auto py-8 px-4">
      <header className="mb-8 text-center">
        <h1 className="text-xl font-sans font-light tracking-wide text-repl-fg">
          WolframJS REPL
        </h1>
        <p className="text-xs text-repl-muted mt-1">
          A JavaScript REPL with rich object representation — Shift+Enter to evaluate
        </p>
      </header>
      <div className="cell-list flex flex-col gap-1">
        {cells.map((cell) => (
          <Cell key={cell.id} cell={cell} />
        ))}
      </div>
      <div className="mt-4 flex justify-center">
        <button
          onClick={handleAddCell}
          className="text-xs text-repl-muted hover:text-repl-accent transition-colors px-3 py-1.5 rounded-md hover:bg-repl-border/30"
        >
          + New Cell
        </button>
      </div>
      <footer className="mt-12 text-center text-xs text-repl-muted pb-8">
        <div className="space-y-1">
          <div>
            <kbd className="px-1 py-0.5 rounded bg-repl-border/50 text-repl-fg font-mono text-[10px]">Shift+Enter</kbd> evaluate
            &nbsp;&nbsp;
            <kbd className="px-1 py-0.5 rounded bg-repl-border/50 text-repl-fg font-mono text-[10px]">Enter</kbd> evaluate (single line)
          </div>
          <div>
            <kbd className="px-1 py-0.5 rounded bg-repl-border/50 text-repl-fg font-mono text-[10px]">Ctrl+Enter</kbd> evaluate active
            &nbsp;&nbsp;
            <kbd className="px-1 py-0.5 rounded bg-repl-border/50 text-repl-fg font-mono text-[10px]">Ctrl+Shift+N</kbd> new cell
          </div>
        </div>
      </footer>
    </div>
  );
}
