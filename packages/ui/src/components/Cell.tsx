import { useCallback } from "react";
import type { Cell as CellType } from "../store/types";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { evaluateCode, setActiveCell } from "../store/notebookSlice";
import { addEntry } from "../store/historySlice";
import { CellInput } from "./CellInput";
import { CellOutput } from "./CellOutput";
import type { WorkerResponse } from "@eval";

interface CellComponentProps {
  cell: CellType;
}

export function Cell({ cell }: CellComponentProps) {
  const dispatch = useAppDispatch();
  const activeCellId = useAppSelector((s) => s.notebook.activeCellId);
  const isActive = activeCellId === cell.id;

  const handleEvaluate = useCallback(
    (code: string) => {
      if (!code.trim()) return;
      dispatch(evaluateCode({ cellId: cell.id, code })).then(
        (action: any) => {
          const result = action.payload as WorkerResponse & { cellId: string };
          if (result?.type === "result") {
            dispatch(
              addEntry({
                inputIndex: cell.inputIndex,
                code,
                timestamp: Date.now(),
                result: result.value,
                resultType: result.value.type,
              })
            );
          } else if (result?.type === "error") {
            dispatch(
              addEntry({
                inputIndex: cell.inputIndex,
                code,
                timestamp: Date.now(),
                result: null,
                resultType: "error",
              })
            );
          }
          dispatch(setActiveCell(null));
        }
      );
    },
    [dispatch, cell.id, cell.inputIndex]
  );

  const handleClick = useCallback(() => {
    dispatch(setActiveCell(cell.id));
  }, [dispatch, cell.id]);

  return (
    <div
      className={`cell group rounded-lg transition-colors ${
        isActive ? "bg-repl-cell-bg shadow-sm" : "hover:bg-repl-cell-bg/50"
      } px-4 py-3`}
      onClick={handleClick}
    >
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <CellInput
            cellId={cell.id}
            code={cell.code}
            inputIndex={cell.inputIndex}
            onEvaluate={handleEvaluate}
            isActive={isActive}
          />
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            // Get code from the CodeMirror editor
            const cmEditor = document.querySelector(`[data-cell-id="${cell.id}"] .cm-content`) as HTMLElement;
            const code = cmEditor?.textContent ?? cell.code;
            handleEvaluate(code);
          }}
          className="run-button mt-1 px-2.5 py-1 text-xs font-mono rounded-md 
            bg-repl-accent/10 text-repl-accent hover:bg-repl-accent/20 
            transition-colors opacity-0 group-hover:opacity-100 shrink-0"
          title="Run (Shift+Enter)"
        >
          ▶ Run
        </button>
      </div>
      <CellOutput cell={cell} />
    </div>
  );
}
