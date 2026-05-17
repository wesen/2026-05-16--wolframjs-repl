import { useCallback } from "react";
import type { Cell } from "../store/types";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { evaluateCode, setActiveCell } from "../store/notebookSlice";
import { addEntry } from "../store/historySlice";
import { CellInput } from "./CellInput";
import { CellOutput } from "./CellOutput";
import type { WorkerResponse } from "@eval";

interface CellComponentProps {
  cell: Cell;
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
      <CellInput
        cellId={cell.id}
        inputIndex={cell.inputIndex}
        onEvaluate={handleEvaluate}
        isActive={isActive}
      />
      <CellOutput cell={cell} />
    </div>
  );
}
