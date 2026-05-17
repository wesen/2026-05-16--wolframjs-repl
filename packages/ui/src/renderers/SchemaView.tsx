interface ColumnSchema {
  name: string;
  type: string;
  count: number;
  nullCount: number;
  uniqueCount: number;
  min?: unknown;
  max?: unknown;
  mean?: number;
}

interface SchemaData {
  columns: ColumnSchema[];
}

export function SchemaView({ data }: { data: unknown }) {
  const d = data as ColumnSchema[];
  const schemas = Array.isArray(d) ? d : (data as SchemaData)?.columns ?? [];

  return (
    <div className="schema-view overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b border-repl-border">
            <th className="text-left px-2 py-1.5 font-medium text-repl-fg">Column</th>
            <th className="text-left px-2 py-1.5 font-medium text-repl-fg">Type</th>
            <th className="text-right px-2 py-1.5 font-medium text-repl-fg">Count</th>
            <th className="text-right px-2 py-1.5 font-medium text-repl-fg">Nulls</th>
            <th className="text-right px-2 py-1.5 font-medium text-repl-fg">Unique</th>
            <th className="text-right px-2 py-1.5 font-medium text-repl-fg">Min</th>
            <th className="text-right px-2 py-1.5 font-medium text-repl-fg">Max</th>
            <th className="text-right px-2 py-1.5 font-medium text-repl-fg">Mean</th>
          </tr>
        </thead>
        <tbody>
          {schemas.map((col) => (
            <tr
              key={col.name}
              className="border-b border-repl-border/30 hover:bg-repl-cell-hover transition-colors"
            >
              <td className="px-2 py-1 font-mono text-repl-accent">{col.name}</td>
              <td className="px-2 py-1">
                <span className="px-1.5 py-0.5 rounded bg-repl-accent/10 text-repl-accent text-xs">
                  {col.type}
                </span>
              </td>
              <td className="px-2 py-1 text-right font-mono">{col.count}</td>
              <td className="px-2 py-1 text-right font-mono">{col.nullCount}</td>
              <td className="px-2 py-1 text-right font-mono">{col.uniqueCount}</td>
              <td className="px-2 py-1 text-right font-mono">{col.min != null ? String(col.min) : "—"}</td>
              <td className="px-2 py-1 text-right font-mono">{col.max != null ? String(col.max) : "—"}</td>
              <td className="px-2 py-1 text-right font-mono">
                {col.mean !== undefined ? col.mean.toFixed(2) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
