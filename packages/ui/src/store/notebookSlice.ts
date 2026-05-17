import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import type { NotebookState, Cell } from "./types";
import type { WorkerResponse } from "@eval";
import { getWorkerManager } from "@eval";

const initialState: NotebookState = {
  cells: [],
  nextInputIndex: 1,
  activeCellId: null,
};

/** Async thunk: evaluate code in the Web Worker. */
export const evaluateCode = createAsyncThunk<
  WorkerResponse & { cellId: string },
  { cellId: string; code: string },
  { state: { notebook: NotebookState } }
>("notebook/evaluate", async ({ cellId, code }) => {
  const worker = getWorkerManager();
  const response = await worker.evaluate(code);
  return { ...response, cellId };
});

let cellCounter = 0;

const notebookSlice = createSlice({
  name: "notebook",
  initialState,
  reducers: {
    addCell(state) {
      const id = `cell-${++cellCounter}-${Date.now()}`;
      state.cells.push({
        id,
        inputIndex: state.nextInputIndex,
        code: "",
        status: "idle",
        output: null,
        error: null,
        errorStack: null,
      });
      state.activeCellId = id;
    },
    updateCellCode(state, action: PayloadAction<{ id: string; code: string }>) {
      const cell = state.cells.find((c) => c.id === action.payload.id);
      if (cell) cell.code = action.payload.code;
    },
    setActiveCell(state, action: PayloadAction<string | null>) {
      state.activeCellId = action.payload;
    },
    focusNextCell(state, action: PayloadAction<{ currentCellId: string }>) {
      const idx = state.cells.findIndex((c) => c.id === action.payload.currentCellId);
      if (idx >= 0 && idx < state.cells.length - 1) {
        state.activeCellId = state.cells[idx + 1].id;
      } else if (idx === state.cells.length - 1) {
        // Last cell — add a new one
        const id = `cell-${++cellCounter}-${Date.now()}`;
        state.cells.push({
          id,
          inputIndex: state.nextInputIndex,
          code: "",
          status: "idle",
          output: null,
          error: null,
          errorStack: null,
        });
        state.activeCellId = id;
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(evaluateCode.pending, (state, action) => {
        const cell = state.cells.find((c) => c.id === action.meta.arg.cellId);
        if (cell) {
          cell.status = "evaluating";
          cell.code = action.meta.arg.code;
          cell.error = null;
          cell.errorStack = null;
          cell.inputIndex = state.nextInputIndex++;
        }
      })
      .addCase(evaluateCode.fulfilled, (state, action) => {
        const { cellId } = action.meta.arg;
        const cell = state.cells.find((c) => c.id === cellId);
        if (!cell) return;

        if (action.payload.type === "result") {
          cell.status = "done";
          cell.output = action.payload.value;
          cell.error = null;
        } else if (action.payload.type === "error") {
          cell.status = "error";
          cell.error = action.payload.error;
          cell.errorStack = action.payload.stack ?? null;
        }
      })
      .addCase(evaluateCode.rejected, (state, action) => {
        const cell = state.cells.find((c) => c.id === action.meta.arg.cellId);
        if (cell) {
          cell.status = "error";
          cell.error = action.error.message ?? "Evaluation failed";
          cell.errorStack = null;
        }
      });
  },
});

export const { addCell, updateCellCode, setActiveCell, focusNextCell } =
  notebookSlice.actions;
export default notebookSlice.reducer;
