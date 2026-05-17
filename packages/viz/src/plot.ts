import type { RichValue, View } from "@core";
import type { TopLevelSpec } from "vega-lite";

/**
 * Plot — a chart specification implementing RichValue.
 * Backed by Vega-Lite for declarative visualization.
 */
export class Plot implements RichValue {
  readonly type = "Plot";

  constructor(
    private readonly spec: TopLevelSpec,
    private readonly _data: unknown[],
    private readonly _description?: string
  ) {}

  summary(): string {
    const mark = (this.spec as any).mark;
    const markType = typeof mark === "string" ? mark : mark?.type ?? "unknown";
    return `Plot[${markType}]`;
  }

  views(): View[] {
    return [
      {
        viewType: "chart",
        label: "Chart",
        data: { spec: this.spec, data: this._data },
      },
      {
        viewType: "json",
        label: "Vega-Lite Spec",
        data: JSON.stringify(this.spec, null, 2),
      },
    ];
  }

  explain(): string {
    return this._description ?? `A ${this.summary()} visualization.`;
  }

  toJSON(): unknown {
    return { spec: this.spec, data: this._data };
  }

  inputForm(): string {
    return this.summary();
  }
}

// ── Chart builders (called from Dataset shortcuts) ──────────

/** Build a bar chart spec */
export function barChartSpec(
  data: unknown[],
  category: string,
  value: string
): TopLevelSpec {
  return {
    mark: "bar",
    encoding: {
      x: { field: category, type: "nominal" },
      y: { field: value, type: "quantitative" },
    },
    data: { values: data },
  } as TopLevelSpec;
}

/** Build a line chart spec */
export function lineChartSpec(
  data: unknown[],
  x: string,
  y: string
): TopLevelSpec {
  return {
    mark: "line",
    encoding: {
      x: { field: x, type: "quantitative" },
      y: { field: y, type: "quantitative" },
    },
    data: { values: data },
  } as TopLevelSpec;
}

/** Build a scatter plot spec */
export function scatterSpec(
  data: unknown[],
  x: string,
  y: string
): TopLevelSpec {
  return {
    mark: "point",
    encoding: {
      x: { field: x, type: "quantitative" },
      y: { field: y, type: "quantitative" },
    },
    data: { values: data },
  } as TopLevelSpec;
}

/** Build a histogram spec */
export function histogramSpec(data: unknown[], field: string): TopLevelSpec {
  return {
    mark: "bar",
    encoding: {
      x: { field, type: "quantitative", bin: true },
      y: { aggregate: "count", type: "quantitative" },
    },
    data: { values: data },
  } as TopLevelSpec;
}

// ── Auto-visualization ─────────────────────────────

/**
 * Pick a reasonable chart type based on the data's shape and types.
 * Returns a Plot if visualization is possible, or null.
 */
export function autoViz(
  value: { type: string; summary?: string; toJSON?: () => unknown; views?: () => View[] }
): Plot | null {
  // For Dataset types, we try to auto-pick a chart
  if (value.type === "Dataset") {
    const raw = value.toJSON?.();
    if (!Array.isArray(raw)) return null;

    const data = raw as Record<string, unknown>[];
    if (data.length === 0) return null;

    // Get column types from first row
    const sample = data[0];
    const numericCols: string[] = [];
    const categoricalCols: string[] = [];

    for (const [key, val] of Object.entries(sample)) {
      if (typeof val === "number") numericCols.push(key);
      else categoricalCols.push(key);
    }

    if (numericCols.length === 1) {
      return new Plot(
        histogramSpec(data, numericCols[0]),
        data,
        `Histogram of ${numericCols[0]}`
      );
    }
    if (numericCols.length >= 2) {
      return new Plot(
        scatterSpec(data, numericCols[0], numericCols[1]),
        data,
        `Scatter plot of ${numericCols[0]} vs ${numericCols[1]}`
      );
    }
    if (categoricalCols.length >= 1) {
      // Count by first categorical column
      const counts: Record<string, number> = {};
      for (const row of data) {
        const key = String(row[categoricalCols[0]] ?? "");
        counts[key] = (counts[key] || 0) + 1;
      }
      const barData = Object.entries(counts).map(([key, count]) => ({
        [categoricalCols[0]]: key,
        count,
      }));
      return new Plot(
        barChartSpec(barData, categoricalCols[0], "count"),
        barData,
        `Bar chart of ${categoricalCols[0]} counts`
      );
    }
  }

  return null;
}
