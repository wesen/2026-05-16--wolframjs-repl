import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import type { HistoryState, HistoryEntry } from "./types";

const initialState: HistoryState = {
  entries: [],
};

const historySlice = createSlice({
  name: "history",
  initialState,
  reducers: {
    addEntry(state, action: PayloadAction<HistoryEntry>) {
      state.entries.push(action.payload);
    },
    clearHistory(state) {
      state.entries = [];
    },
  },
});

export const { addEntry, clearHistory } = historySlice.actions;
export default historySlice.reducer;
