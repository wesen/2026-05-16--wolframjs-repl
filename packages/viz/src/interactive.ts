import type { RichValue, View } from "@core";

/**
 * ControlDef — defines a single interactive control (slider, number input, etc.)
 */
export interface ControlDef {
  kind: "slider" | "number" | "select";
  min?: number;
  max?: number;
  step?: number;
  value?: number;
  options?: string[];
}

/**
 * InteractiveWidget — a live interactive control that dynamically
 * re-evaluates a computation. Inspired by Mathematica's Manipulate.
 *
 * The render function is captured as source code so it can cross
 * the Web Worker boundary and be re-evaluated on the main thread.
 */
export class InteractiveWidget implements RichValue {
  readonly type = "InteractiveWidget";

  constructor(
    private readonly controls: Record<string, ControlDef>,
    /** The render function's source code as a string */
    private readonly renderSrc: string,
    /** Parameter names extracted from the render function */
    private readonly paramNames: string[]
  ) {}

  summary(): string {
    const controlNames = Object.keys(this.controls);
    return `Manipulate[${controlNames.join(", ")}]`;
  }

  views(): View[] {
    return [
      {
        viewType: "interactive",
        label: "Interactive",
        data: {
          controls: this.controls,
          renderSrc: this.renderSrc,
          paramNames: this.paramNames,
        },
      },
    ];
  }

  explain(): string {
    return `An interactive widget with controls: ${Object.keys(this.controls).join(", ")}. Move the sliders to see the result change.`;
  }

  toJSON(): unknown {
    return {
      type: "InteractiveWidget",
      controls: this.controls,
      renderSrc: this.renderSrc,
      paramNames: this.paramNames,
    };
  }

  inputForm(): string {
    return this.summary();
  }
}

/**
 * manipulate({ a: slider(-5, 5) }, ({ a }) => a * a)
 *
 * Creates an interactive widget with live controls.
 * The render function's source is captured via .toString() so it
 * can be serialized across the worker boundary.
 */
export function manipulate(
  controls: Record<string, ControlDef | { min: number; max: number; step?: number }>,
  renderFn: (params: Record<string, number>) => unknown
): InteractiveWidget {
  // Normalize controls
  const normalized: Record<string, ControlDef> = {};
  for (const [key, val] of Object.entries(controls)) {
    if ("kind" in val) {
      normalized[key] = val;
    } else {
      normalized[key] = {
        kind: "slider",
        min: val.min,
        max: val.max,
        step: val.step ?? 0.1,
        value: (val.min + val.max) / 2,
      };
    }
  }

  // Capture the render function's source code
  const renderSrc = renderFn.toString();

  // Extract parameter names from the destructured param: ({ a, b }) => ...
  // or from (params) => ...
  const paramMatch = renderSrc.match(/\(\s*\{\s*([^}]+)\s*\}\s*\)/);
  const paramNames = paramMatch
    ? paramMatch[1].split(",").map(s => s.trim().split("=")[0].trim()).filter(Boolean)
    : Object.keys(normalized);

  return new InteractiveWidget(normalized, renderSrc, paramNames);
}

/** Create a slider control definition */
export function slider(min: number, max: number, step = 0.1): ControlDef {
  return { kind: "slider", min, max, step, value: (min + max) / 2 };
}

/**
 * StreamWatch — watches an async data source and re-renders.
 */
export class StreamWatch implements RichValue {
  readonly type = "StreamWatch";

  constructor(
    private readonly intervalMs: number
  ) {}

  summary(): string {
    return `Watch[interval=${this.intervalMs}ms]`;
  }

  views(): View[] {
    return [
      { viewType: "text", label: "Status", data: `Watching (every ${this.intervalMs}ms)` },
    ];
  }

  explain(): string {
    return `A live data watcher that refreshes every ${this.intervalMs} milliseconds.`;
  }

  toJSON(): unknown {
    return { type: "StreamWatch", interval: this.intervalMs };
  }

  inputForm(): string {
    return this.summary();
  }
}

/**
 * watch(intervalMs?)
 * Creates a live data watcher placeholder.
 */
export function watch(intervalMs = 5000): StreamWatch {
  return new StreamWatch(intervalMs);
}
