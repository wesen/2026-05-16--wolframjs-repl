interface PropsData {
  columns: { name: string; type: string }[];
  rows: Record<string, unknown>[];
  totalRows: number;
}

export function PropertiesView({ data }: { data: unknown }) {
  const d = data as PropsData;
  const { columns, rows } = d;

  return (
    <div className="props-view overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b border-repl-border">
            {columns.map((col) => (
              <th key={col.name} className="text-left px-2 py-1.5 font-medium text-repl-fg whitespace-nowrap">
                {col.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-repl-border/30 hover:bg-repl-cell-hover transition-colors">
              {columns.map((col) => (
                <td
                  key={col.name}
                  className={`px-2 py-1 whitespace-nowrap ${
                    col.name === "Key" ? "font-mono text-repl-accent" :
                    col.name === "Type" ? "text-repl-muted" : "font-mono"
                  }`}
                >
                  {formatPropCell(row[col.name])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatPropCell(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value === "object" && value !== null) {
    try {
      const s = JSON.stringify(value);
      return s.length > 80 ? s.substring(0, 77) + "..." : s;
    } catch {
      return String(value);
    }
  }
  return String(value);
}
