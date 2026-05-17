import { Provider } from "react-redux";
import { store } from "./store/store";
import { Notebook } from "./components/Notebook";

export function App() {
  return (
    <Provider store={store}>
      <div className="min-h-screen bg-repl-bg text-repl-fg">
        <Notebook />
      </div>
    </Provider>
  );
}
