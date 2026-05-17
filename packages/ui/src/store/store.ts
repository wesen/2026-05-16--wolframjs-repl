import { configureStore } from "@reduxjs/toolkit";
import notebookReducer from "./notebookSlice";
import historyReducer from "./historySlice";
import configReducer from "./configSlice";

export const store = configureStore({
  reducer: {
    notebook: notebookReducer,
    history: historyReducer,
    config: configReducer,
  },
});

// Persist theme to localStorage on every config change
store.subscribe(() => {
  const state = store.getState();
  if (state.config.theme) {
    localStorage.setItem("repl-theme", state.config.theme);
  }
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
