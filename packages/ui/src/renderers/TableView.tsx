import { useState, useMemo } from "react";

interface Column {
  name: string;
  type: string;
}

interface TableData {
  columns: Column[];
  rows: Record<string, unknown>[];
  totalRows: number;
}

export function TableView({ data }: { data: unknown }) {
  const d = data as TableData;
  const { columns, rows, totalRows } = d;
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const sortedRows = useMemo(() => {
    if (!sortCol) return rows;
    return [...rows].sort((a, b) => {
      const av = a[sortCol], bv = b[sortCol];
      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;
      const cmp = av > bv ? 1 : av < bv ? -1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [rows, sortCol, sortDir]);

  const handleSort = (colName: string) => {
    if (sortCol === colName) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(colName);
      setSortDir("asc");
    }
  };

  return (
    <div className="table-view overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b border-repl-border">
            {columns.map((col) => (
              <th
                key={col.name}
                onClick={() => handleSort(col.name)}
                className="text-left px-2 py-1.5 font-medium text-repl-fg cursor-pointer hover:text-repl-accent select-none whitespace-nowrap"
              >
                {col.name}
                {sortCol === col.name && (
                  <span className="ml-1 text-repl-muted">
                    {sortDir === "asc" ? "↑" : "↓"}
                  </span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row, i) => (
            <tr
              key={i}
              className="border-b border-repl-border/30 hover:bg-repl-cell-hover transition-colors"
            >
              {columns.map((col) => (
                <td
                  key={col.name}
                  className={`px-2 py-1 whitespace-nowrap ${
                    col.type === "number" ? "text-right font-mono tabular-nums" : ""
                  }`}
                >
                  {formatCell(row[col.name])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {totalRows > rows.length && (
        <div className="text-xs text-repl-muted mt-2 px-2">
          Showing {rows.length} of {totalRows} rows
        </div>
      )}
    </div>
  );
}

function formatCell(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "";
  if (typeof value === "number") {
    return Number.isInteger(value) ? value.toString() : value.toFixed(3);
  }
  return String(value);
}
