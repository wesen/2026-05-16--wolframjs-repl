import type { SerializedRichValue } from "@core";

/** A single cell in the notebook. */
export interface Cell {
  readonly id: string;
  inputIndex: number;
  code: string;
  status: "idle" | "evaluating" | "done" | "error";
  output: SerializedRichValue | null;
  error: string | null;
  errorStack: string | null;
}

/** The full notebook state. */
export interface NotebookState {
  cells: Cell[];
  nextInputIndex: number;
  activeCellId: string | null;
}

/** A history entry for the queryable Out[n] store. */
export interface HistoryEntry {
  inputIndex: number;
  code: string;
  timestamp: number;
  result: SerializedRichValue | null;
  resultType: string;
}

/** The history state. */
export interface HistoryState {
  entries: HistoryEntry[];
}

/** User preferences. */
export interface ConfigState {
  theme: "light" | "dark" | "system";
  maxHistoryEntries: number;
}
