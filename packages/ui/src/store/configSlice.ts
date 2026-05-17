import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import type { ConfigState } from "./types";

const initialState: ConfigState = {
  theme: "system",
  maxHistoryEntries: 1000,
};

const configSlice = createSlice({
  name: "config",
  initialState,
  reducers: {
    setTheme(state, action: PayloadAction<"light" | "dark" | "system">) {
      state.theme = action.payload;
    },
  },
});

export const { setTheme } = configSlice.actions;
export default configSlice.reducer;
