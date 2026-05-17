import type { RichValue, View } from "@core";
import { Plot, barChartSpec, lineChartSpec, scatterSpec, histogramSpec } from "@viz";

/** Column metadata */
export interface Column {
  name: string;
  type: "number" | "string" | "boolean" | "date" | "null" | "unknown";
}

/** A row is a simple object mapping column names to values */
export type Row = Record<string, unknown>;

/** Schema info for a column */
export interface ColumnSchema {
  name: string;
  type: string;
  count: number;
  nullCount: number;
  uniqueCount: number;
  min?: unknown;
  max?: unknown;
  mean?: number;
}

/** Summary stats for a Dataset */
export interface DatasetSummary {
  rows: number;
  columns: number;
  columnSummaries: ColumnSchema[];
}

/**
 * Dataset — a DataFrame-like class implementing RichValue.
 * Supports chainable operations: filter, groupBy, sort, select, transform.
 * Each operation returns a new Dataset (immutable pattern).
 */
export class Dataset implements RichValue {
  readonly type = "Dataset";

  constructor(
    private readonly _columns: Column[],
    private readonly _rows: Row[],
    private readonly _name?: string
  ) {}

  get length(): number {
    return this._rows.length;
  }

  get columnNames(): string[] {
    return this._columns.map((c) => c.name);
  }

  get columns(): Column[] {
    return this._columns;
  }

  get rows(): Row[] {
    return this._rows;
  }

  // ── RichValue protocol ──────────────────────────────

  summary(): string {
    return `Dataset[${this._rows.length} rows × ${this._columns.length} columns]`;
  }

  views(): View[] {
    const views: View[] = [
      {
        viewType: "table",
        label: "Table",
        data: {
          columns: this._columns,
          rows: this._rows.slice(0, 200),
          totalRows: this._rows.length,
        },
      },
      {
        viewType: "schema",
        label: "Schema",
        data: this.inferSchema(),
      },
      {
        viewType: "summary",
        label: "Summary",
        data: this.computeSummary(),
      },
      {
        viewType: "json",
        label: "JSON",
        data: this._rows.slice(0, 50),
      },
    ];
    return views;
  }

  explain(): string {
    return `A dataset with ${this._rows.length} rows and ${this._columns.length} columns: ${this.columnNames.join(", ")}.`;
  }

  toJSON(): unknown {
    return this._rows;
  }

  inputForm(): string {
    return this.summary();
  }

  // ── Chainable operations ────────────────────────────

  /** Filter rows by predicate */
  filter(predicate: (row: Row) => boolean): Dataset {
    return new Dataset(
      this._columns,
      this._rows.filter(predicate),
      this._name
    );
  }

  /** Sort by column */
  sort(col: string, dir: "asc" | "desc" = "asc"): Dataset {
    const sorted = [...this._rows].sort((a, b) => {
      const av = a[col], bv = b[col];
      if (av === bv) return 0;
      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;
      const cmp = av > bv ? 1 : av < bv ? -1 : 0;
      return dir === "asc" ? cmp : -cmp;
    });
    return new Dataset(this._columns, sorted, this._name);
  }

  /** Select a subset of columns */
  select(...cols: string[]): Dataset {
    const newCols = this._columns.filter((c) => cols.includes(c.name));
    const newRows = this._rows.map((row) => {
      const newRow: Row = {};
      for (const col of cols) {
        newRow[col] = row[col];
      }
      return newRow;
    });
    return new Dataset(newCols, newRows, this._name);
  }

  /** Add or transform a column */
  withColumn(colName: string, fn: (row: Row) => unknown): Dataset {
    const hasCol = this._columns.some((c) => c.name === colName);
    const newCols = hasCol
      ? this._columns
      : [...this._columns, { name: colName, type: "unknown" as const }];
    const newRows = this._rows.map((row) => ({
      ...row,
      [colName]: fn(row),
    }));
    return new Dataset(newCols, newRows, this._name);
  }

  /** Group by a column and return a GroupedDataset */
  groupBy(col: string): GroupedDataset {
    const groups = new Map<string, Row[]>();
    for (const row of this._rows) {
      const key = String(row[col] ?? "");
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(row);
    }
    return new GroupedDataset(col, groups, this._columns);
  }

  /** Take first N rows */
  head(n: number): Dataset {
    return new Dataset(this._columns, this._rows.slice(0, n), this._name);
  }

  /** Take last N rows */
  tail(n: number): Dataset {
    return new Dataset(this._columns, this._rows.slice(-n), this._name);
  }

  /** Get unique values for a column */
  unique(col: string): unknown[] {
    const seen = new Set<unknown>();
    for (const row of this._rows) {
      seen.add(row[col]);
    }
    return [...seen];
  }

  /** Count rows */
  count(): number {
    return this._rows.length;
  }

  // ── Aggregation ─────────────────────────────────────

  /** Sum a numeric column */
  sum(col: string): number {
    return this._rows.reduce((acc, row) => {
      const v = Number(row[col]);
      return acc + (isNaN(v) ? 0 : v);
    }, 0);
  }

  /** Mean of a numeric column */
  mean(col: string): number {
    const vals = this._rows
      .map((r) => Number(r[col]))
      .filter((v) => !isNaN(v));
    return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  }

  /** Min of a column */
  min(col: string): unknown {
    return Math.min(...this._rows.map((r) => Number(r[col])).filter((v) => !isNaN(v)));
  }

  /** Max of a column */
  max(col: string): unknown {
    return Math.max(...this._rows.map((r) => Number(r[col])).filter((v) => !isNaN(v)));
  }

  // ── Visualization shortcuts ─────────────────────────

  /** Bar chart of a column */
  barChart(valueCol: string, categoryCol?: string): Plot {
    const catCol = categoryCol ?? this._columns.find(c => c.type === "string")?.name;
    if (!catCol) {
      // Count occurrences of each unique value in valueCol
      const counts: Record<string, number> = {};
      for (const row of this._rows) {
        const key = String(row[valueCol] ?? "");
        counts[key] = (counts[key] || 0) + 1;
      }
      const barData = Object.entries(counts).map(([key, count]) => ({ [valueCol]: key, count }));
      return new Plot(barChartSpec(barData, valueCol, "count"), barData, `Bar chart of ${valueCol}`);
    }
    return new Plot(
      barChartSpec(this._rows, catCol, valueCol),
      this._rows,
      `Bar chart of ${valueCol} by ${catCol}`
    );
  }

  /** Line chart */
  lineChart(x: string, y: string): Plot {
    return new Plot(
      lineChartSpec(this._rows, x, y),
      this._rows,
      `Line chart of ${y} vs ${x}`
    );
  }

  /** Scatter plot */
  scatter(x: string, y: string): Plot {
    return new Plot(
      scatterSpec(this._rows, x, y),
      this._rows,
      `Scatter plot of ${y} vs ${x}`
    );
  }

  /** Histogram */
  histogram(col: string): Plot {
    return new Plot(
      histogramSpec(this._rows, col),
      this._rows,
      `Histogram of ${col}`
    );
  }

  /** Auto-visualize based on data shape */
  visualize(): Plot | null {
    const numericCols = this._columns.filter(c => c.type === "number").map(c => c.name);
    const categoricalCols = this._columns.filter(c => c.type === "string").map(c => c.name);

    if (numericCols.length === 1) return this.histogram(numericCols[0]);
    if (numericCols.length >= 2) return this.scatter(numericCols[0], numericCols[1]);
    if (categoricalCols.length >= 1) return this.barChart(categoricalCols[0]);
    return null;
  }

  // ── Export ──────────────────────────────────────────

  /** Convert current operations to a SQL query (best-effort) */
  toSQL(tableName = "data"): string {
    return `SELECT * FROM ${tableName}; -- ${this._rows.length} rows`;
  }

  /** Convert to CSV string */
  toCSV(): string {
    const headers = this.columnNames.join(",");
    const rows = this._rows.map((row) =>
      this.columnNames.map((col) => {
        const val = row[col];
        if (typeof val === "string" && (val.includes(",") || val.includes('"'))) {
          return `"${val.replace(/"/g, '""')}"`;
        }
        return String(val ?? "");
      }).join(",")
    );
    return [headers, ...rows].join("\n");
  }

  // ── Schema inference ───────────────────────────────

  inferSchema(): ColumnSchema[] {
    return this._columns.map((col) => {
      const values = this._rows.map((r) => r[col.name]);
      const nonNull = values.filter((v) => v !== null && v !== undefined);
      const unique = new Set(nonNull);
      const nums = nonNull.map(Number).filter((v) => !isNaN(v));

      const schema: ColumnSchema = {
        name: col.name,
        type: col.type,
        count: this._rows.length,
        nullCount: this._rows.length - nonNull.length,
        uniqueCount: unique.size,
      };

      if (col.type === "number" && nums.length > 0) {
        schema.min = Math.min(...nums);
        schema.max = Math.max(...nums);
        schema.mean = nums.reduce((a, b) => a + b, 0) / nums.length;
      }

      return schema;
    });
  }

  private computeSummary(): DatasetSummary {
    return {
      rows: this._rows.length,
      columns: this._columns.length,
      columnSummaries: this.inferSchema(),
    };
  }
}

/**
 * GroupedDataset — the result of a groupBy() operation.
 * Supports aggregation methods that produce a new Dataset.
 */
export class GroupedDataset {
  constructor(
    private readonly groupColumn: string,
    private readonly groups: Map<string, Row[]>,
    private readonly originalColumns: Column[]
  ) {}

  /** Count per group → Dataset */
  count(): Dataset {
    return this.aggregate("count", (rows) => rows.length);
  }

  /** Sum a column per group → Dataset */
  sum(col: string): Dataset {
    return this.aggregate(col, (rows) =>
      rows.reduce((acc, r) => acc + (Number(r[col]) || 0), 0)
    );
  }

  /** Mean of a column per group → Dataset */
  mean(col: string): Dataset {
    return this.aggregate(col, (rows) => {
      const vals = rows.map((r) => Number(r[col])).filter((v) => !isNaN(v));
      return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    });
  }

  /** Generic aggregation */
  private aggregate(
    valueCol: string,
    fn: (rows: Row[]) => unknown
  ): Dataset {
    const resultRows: Row[] = [];
    for (const [key, rows] of this.groups) {
      resultRows.push({
        [this.groupColumn]: key,
        [valueCol]: fn(rows),
      });
    }
    const columns: Column[] = [
      { name: this.groupColumn, type: "string" },
      {
        name: valueCol,
        type: valueCol === "count" ? "number" : "number",
      },
    ];
    return new Dataset(columns, resultRows);
  }

  /** Get group keys */
  keys(): string[] {
    return [...this.groups.keys()];
  }

  /** Get rows for a specific group */
  group(key: string): Dataset {
    const rows = this.groups.get(key) ?? [];
    return new Dataset(this.originalColumns, rows);
  }
}

// ── Factory functions ────────────────────────────────

/** Create a Dataset from an array of objects */
export function dataset(data: Row[], name?: string): Dataset {
  if (data.length === 0) {
    return new Dataset([], [], name);
  }
  const colNames = Object.keys(data[0]);
  const columns: Column[] = colNames.map((name) => ({
    name,
    type: inferType(data.map((r) => r[name])),
  }));
  return new Dataset(columns, data, name);
}

/** Create a Dataset from CSV text */
export function csv(text: string, name?: string): Dataset {
  const lines = text.trim().split("\n");
  if (lines.length === 0) return new Dataset([], [], name);

  const headers = parseCSVLine(lines[0]);
  const rows: Row[] = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const values = parseCSVLine(lines[i]);
    const row: Row = {};
    for (let j = 0; j < headers.length; j++) {
      const raw = values[j] ?? "";
      row[headers[j]] = isNaN(Number(raw)) || raw === "" ? raw : Number(raw);
    }
    rows.push(row);
  }

  const columns: Column[] = headers.map((name) => ({
    name,
    type: inferType(rows.map((r) => r[name])),
  }));

  return new Dataset(columns, rows, name);
}

/** Load JSON from a URL and create a Dataset */
export async function json(url: string, name?: string): Promise<Dataset> {
  const response = await fetch(url);
  const data = await response.json();
  if (Array.isArray(data)) return dataset(data, name);
  throw new Error("Expected JSON array for dataset conversion");
}

// ── Helpers ──────────────────────────────────────────

function inferType(values: unknown[]): Column["type"] {
  const nonNull = values.filter((v) => v !== null && v !== undefined);
  if (nonNull.length === 0) return "null";
  const types = new Set(nonNull.map((v) => typeof v));
  if (types.size === 1) {
    const t = [...types][0];
    if (t === "number") return "number";
    if (t === "string") return "string";
    if (t === "boolean") return "boolean";
  }
  return "unknown";
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        result.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
  }
  result.push(current);
  return result;
}
