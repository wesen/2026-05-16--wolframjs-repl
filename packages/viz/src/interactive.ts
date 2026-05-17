import type { RichValue, View } from "@core";

/**
 * InteractiveWidget — a live interactive control (sliders, inputs)
 * that dynamically re-renders a computation. Inspired by Mathematica's Manipulate.
 */
export class InteractiveWidget implements RichValue {
  readonly type = "InteractiveWidget";

  constructor(
    private readonly controls: Record<string, ControlDef>,
    private readonly renderFn: (params: Record<string, number>) => unknown
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
          renderFn: this.renderFn,
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
    };
  }

  inputForm(): string {
    return this.summary();
  }
}

export interface ControlDef {
  kind: "slider" | "number" | "select";
  min?: number;
  max?: number;
  step?: number;
  value?: number;
  options?: string[];
}

/**
 * manipulate({ a: slider(-5, 5) }, ({ a }) => ...)
 * Creates an interactive widget with live controls.
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
  return new InteractiveWidget(normalized, renderFn);
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
    private readonly source: () => Promise<unknown>,
    private readonly renderFn: (data: unknown) => unknown,
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
 * watch(source, render, interval?)
 * Creates a live data watcher.
 */
export function watch(
  source: () => Promise<unknown>,
  render: (data: unknown) => unknown,
  intervalMs = 5000
): StreamWatch {
  return new StreamWatch(source, render, intervalMs);
}
