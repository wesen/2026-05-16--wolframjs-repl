import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import type { ConfigState } from "./types";

/** Detect the system color scheme preference */
function getSystemTheme(): "light" | "dark" {
  if (typeof window !== "undefined" && window.matchMedia) {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return "light";
}

/** Apply theme class to the <html> element */
function applyThemeToDOM(theme: "light" | "dark" | "system") {
  const html = document.documentElement;
  html.classList.remove("light", "dark");

  if (theme === "dark") {
    html.classList.add("dark");
  } else if (theme === "light") {
    html.classList.add("light");
  } else {
    // "system" — apply the detected system preference
    const systemTheme = getSystemTheme();
    html.classList.add(systemTheme);
  }
}

// Read saved preference or default to "system"
function getInitialTheme(): "light" | "dark" | "system" {
  try {
    const saved = localStorage.getItem("repl-theme") as "light" | "dark" | "system" | null;
    if (saved && ["light", "dark", "system"].includes(saved)) return saved;
  } catch {}
  return "system";
}

const initialTheme = getInitialTheme();

const initialState: ConfigState = {
  theme: initialTheme,
  maxHistoryEntries: 1000,
};

// Apply initial theme to DOM immediately
if (typeof document !== "undefined") {
  applyThemeToDOM(initialTheme);
}

const configSlice = createSlice({
  name: "config",
  initialState,
  reducers: {
    setTheme(state, action: PayloadAction<"light" | "dark" | "system">) {
      state.theme = action.payload;
      applyThemeToDOM(action.payload);
    },
    cycleTheme(state) {
      const order: Array<"light" | "dark" | "system"> = ["system", "dark", "light"];
      const idx = order.indexOf(state.theme);
      const next = order[(idx + 1) % order.length];
      state.theme = next;
      applyThemeToDOM(next);
    },
  },
});

export const { setTheme, cycleTheme } = configSlice.actions;
export default configSlice.reducer;
