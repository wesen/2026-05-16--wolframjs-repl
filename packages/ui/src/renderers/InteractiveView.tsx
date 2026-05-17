import { useState, useCallback, useMemo } from "react";
import type { ControlDef } from "@viz";

interface InteractiveData {
  controls: Record<string, ControlDef>;
  renderSrc: string;
  paramNames: string[];
}

/**
 * InteractiveView — renders a Manipulate widget with live sliders.
 *
 * The render function's source was captured via .toString() in the worker.
 * We reconstruct it on the main thread using new Function() so the
 * sliders can re-evaluate it live.
 */
export function InteractiveView({ data }: { data: unknown }) {
  const d = data as InteractiveData;
  const controls = d.controls ?? {};
  const renderSrc = d.renderSrc ?? "";
  const paramNames = d.paramNames ?? [];

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

  // Reconstruct the render function from source
  const renderFn = useMemo(() => {
    if (!renderSrc) return null;
    try {
      // The source looks like "({ a, b }) => a * a" or "(params) => ..."
      // We need to wrap it in new Function
      // Strategy: replace the destructured params with a wrapper
      // "({ a, b }) => expr" becomes "function(__p) { const {a, b} = __p; return expr; }"
      // or for simple cases, just eval it

      // Try direct eval approach — create a function that takes params object
      // Transform: ({ a, b }) => a * b  →  (__p) => { with(__p) { return a * b; } }
      // Actually simpler: just wrap as (function(__p) { const {a, b} = __p; return <body>; })

      // Parse the arrow function body
      const arrowMatch = renderSrc.match(/^\s*\(?\s*\{([^}]*)\}\s*\)?\s*=>\s*({?.+}?)/s);
      const parensMatch = renderSrc.match(/^\s*\(([^)]*)\)\s*=>\s*({?.+}?)/s);

      if (arrowMatch) {
        // Destructured params: ({ a, b }) => expr
        const paramList = arrowMatch[1];
        const body = arrowMatch[2].trim();
        const fnBody = body.startsWith("{")
          ? `const {${paramList}} = __p; ${body}`
          : `const {${paramList}} = __p; return ${body};`;
        return new Function("__p", fnBody) as (p: Record<string, number>) => unknown;
      }

      if (parensMatch) {
        // Regular params: (params) => expr
        const paramName = parensMatch[1].trim();
        const body = parensMatch[2].trim();
        const fnBody = body.startsWith("{")
          ? `const ${paramName} = __p; ${body}`
          : `const ${paramName} = __p; return ${body};`;
        return new Function("__p", fnBody) as (p: Record<string, number>) => unknown;
      }

      // Fallback: try direct eval with params in scope
      return null;
    } catch {
      return null;
    }
  }, [renderSrc]);

  // Evaluate the render function with current params
  const rendered: unknown = useMemo(() => {
    if (!renderFn) return null;
    try {
      return renderFn(params);
    } catch {
      return "Error evaluating render function";
    }
  }, [renderFn, params]);

  // Format the rendered value for inline display
  const renderedText = useMemo(() => {
    if (rendered === null || rendered === undefined) return "—";
    if (typeof rendered === "number") {
      return Number.isInteger(rendered) ? rendered.toString() : rendered.toFixed(4);
    }
    if (typeof rendered === "string") return rendered;
    try {
      return JSON.stringify(rendered, null, 2);
    } catch {
      return String(rendered);
    }
  }, [rendered]);

  return (
    <div className="interactive-view space-y-2">
      {/* Slider controls */}
      <div className="controls flex flex-wrap gap-x-5 gap-y-2 p-3 bg-repl-bg rounded-md border border-repl-border">
        {Object.entries(controls).map(([key, ctrl]) => (
          <div key={key} className="control-group flex items-center gap-2">
            <label className="text-xs font-mono text-repl-muted">
              {key} =
            </label>
            {ctrl.kind === "slider" && (
              <>
                <input
                  type="range"
                  min={ctrl.min ?? 0}
                  max={ctrl.max ?? 1}
                  step={ctrl.step ?? 0.1}
                  value={params[key]}
                  onChange={(e) => handleChange(key, Number(e.target.value))}
                  className="w-32 accent-[var(--color-repl-accent)]"
                />
                <span className="text-xs font-mono text-repl-accent tabular-nums w-14 text-right">
                  {params[key].toFixed(2)}
                </span>
              </>
            )}
            {ctrl.kind === "number" && (
              <input
                type="number"
                value={params[key]}
                step={ctrl.step ?? 1}
                onChange={(e) => handleChange(key, Number(e.target.value))}
                className="w-20 px-2 py-1 text-xs font-mono border border-repl-border rounded bg-repl-cell-bg text-repl-fg"
              />
            )}
            {ctrl.kind === "select" && ctrl.options && (
              <select
                value={params[key]}
                onChange={(e) => handleChange(key, Number(e.target.value))}
                className="text-xs font-mono border border-repl-border rounded bg-repl-cell-bg text-repl-fg"
              >
                {ctrl.options.map((opt, i) => (
                  <option key={i} value={i}>{opt}</option>
                ))}
              </select>
            )}
          </div>
        ))}
      </div>

      {/* Rendered result */}
      <div className="rendered-output text-sm text-repl-fg font-mono p-2 bg-repl-bg rounded border border-repl-border/50">
        {renderedText}
      </div>
    </div>
  );
}
