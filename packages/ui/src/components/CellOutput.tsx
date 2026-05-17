import type { Cell } from "../store/types";
import { CellInput } from "./CellInput";
import { RichValueRenderer } from "./RichValueRenderer";

interface CellOutputProps {
  cell: Cell;
}

export function CellOutput({ cell }: CellOutputProps) {
  if (cell.status === "idle") return null;

  if (cell.status === "evaluating") {
    return (
      <div className="cell-output flex items-baseline gap-2 mt-1">
        <span className="text-xs font-mono text-repl-muted shrink-0 w-16 text-right">
          Out[{cell.inputIndex}]=
        </span>
        <span className="evaluating-indicator text-repl-evaluating text-sm animate-pulse">
          ...
        </span>
      </div>
    );
  }

  if (cell.status === "error") {
    return (
      <div className="cell-output mt-1">
        <div className="flex items-baseline gap-2">
          <span className="text-xs font-mono text-repl-muted shrink-0 w-16 text-right">
            Out[{cell.inputIndex}]=
          </span>
          <span className="text-repl-error text-sm font-medium">Error</span>
        </div>
        <div className="ml-[calc(4rem+0.5rem)] mt-1">
          <pre className="text-xs font-mono text-repl-error bg-repl-error/5 rounded px-3 py-2 overflow-x-auto whitespace-pre-wrap">
            {cell.error}
          </pre>
          {cell.errorStack && (
            <details className="mt-1 text-xs text-repl-muted">
              <summary className="cursor-pointer hover:text-repl-fg">Stack trace</summary>
              <pre className="mt-1 text-xs whitespace-pre-wrap">{cell.errorStack}</pre>
            </details>
          )}
        </div>
      </div>
    );
  }

  if (cell.output) {
    return <RichValueRenderer value={cell.output} inputIndex={cell.inputIndex} />;
  }

  return null;
}
