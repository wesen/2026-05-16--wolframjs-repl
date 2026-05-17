import { Provider } from "react-redux";
import { store } from "./store/store";
import { Notebook } from "./components/Notebook";

// Expose store for debugging
(window as any).__store = store;

export function App() {
  return (
    <Provider store={store}>
      <div className="min-h-screen bg-repl-bg text-repl-fg">
        <Notebook />
      </div>
    </Provider>
  );
}
