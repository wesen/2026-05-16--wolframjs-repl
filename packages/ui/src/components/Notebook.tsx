import { useEffect } from "react";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { addCell } from "../store/notebookSlice";
import { Cell } from "./Cell";

export function Notebook() {
  const dispatch = useAppDispatch();
  const cells = useAppSelector((s) => s.notebook.cells);

  // Auto-create the first cell on mount
  useEffect(() => {
    if (cells.length === 0) {
      dispatch(addCell());
    }
  }, [cells.length, dispatch]);

  return (
    <div className="notebook max-w-[960px] mx-auto py-8 px-4">
      <header className="mb-8 text-center">
        <h1 className="text-xl font-sans font-light tracking-wide text-repl-fg">
          WolframJS REPL
        </h1>
        <p className="text-xs text-repl-muted mt-1">
          A JavaScript REPL with rich object representation
        </p>
      </header>
      <div className="cell-list flex flex-col gap-1">
        {cells.map((cell) => (
          <Cell key={cell.id} cell={cell} />
        ))}
      </div>
      <div className="mt-4 flex justify-center">
        <button
          onClick={() => dispatch(addCell())}
          className="text-xs text-repl-muted hover:text-repl-accent transition-colors px-3 py-1.5 rounded-md hover:bg-repl-border/30"
        >
          + New Cell
        </button>
      </div>
    </div>
  );
}
