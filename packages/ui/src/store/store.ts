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

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
