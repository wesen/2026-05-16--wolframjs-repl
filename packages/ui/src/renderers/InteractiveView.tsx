import { useState, useCallback } from "react";
import type { ControlDef } from "@viz";

interface InteractiveData {
  controls: Record<string, ControlDef>;
  renderFn: (params: Record<string, number>) => unknown;
}

export function InteractiveView({ data }: { data: unknown }) {
  const d = data as InteractiveData;
  const controls = d.controls ?? {};

  // Initialize state from control defaults
  const [params, setParams] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    for (const [key, ctrl] of Object.entries(controls)) {
      initial[key] = ctrl.value ?? ctrl.min ?? 0;
    }
    return initial;
  });

  const handleChange = useCallback((key: string, value: number) => {
    setParams((prev) => ({ ...prev, [key]: value }));
  }, []);

  // Render the result with current params
  let rendered: unknown = null;
  try {
    rendered = d.renderFn(params);
  } catch {
    rendered = "Error in render function";
  }

  return (
    <div className="interactive-view space-y-3">
      <div className="controls flex flex-wrap gap-4 p-3 bg-repl-bg rounded-md border border-repl-border">
        {Object.entries(controls).map(([key, ctrl]) => (
          <div key={key} className="control-group">
            <label className="text-xs font-mono text-repl-muted block mb-1">
              {key} = <span className="text-repl-accent">{params[key].toFixed(2)}</span>
            </label>
            {ctrl.kind === "slider" && (
              <input
                type="range"
                min={ctrl.min ?? 0}
                max={ctrl.max ?? 1}
                step={ctrl.step ?? 0.1}
                value={params[key]}
                onChange={(e) => handleChange(key, Number(e.target.value))}
                className="w-40 accent-[var(--color-repl-accent)]"
              />
            )}
            {ctrl.kind === "number" && (
              <input
                type="number"
                value={params[key]}
                onChange={(e) => handleChange(key, Number(e.target.value))}
                className="w-20 px-2 py-1 text-xs font-mono border border-repl-border rounded bg-repl-cell-bg"
              />
            )}
          </div>
        ))}
      </div>
      <div className="rendered-output text-sm text-repl-fg p-2">
        {typeof rendered === "string" ? (
          <span>{rendered}</span>
        ) : (
          <pre className="text-xs font-mono whitespace-pre-wrap">
            {JSON.stringify(rendered, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}
