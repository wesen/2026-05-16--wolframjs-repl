interface StatsData {
  count: number;
  sum: number;
  mean: string;
  median: number;
  min: number;
  max: number;
  stdDev: string;
}

export function StatisticsView({ data }: { data: unknown }) {
  const d = data as StatsData | Record<string, unknown>;

  const entries = d && typeof d === "object" && !Array.isArray(d)
    ? Object.entries(d)
    : [];

  return (
    <div className="stats-view">
      <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
        {entries.map(([key, value]) => (
          <div key={key} className="flex justify-between">
            <span className="text-repl-muted font-mono">{key}:</span>
            <span className="text-repl-fg font-mono tabular-nums">{formatStat(value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatStat(value: unknown): string {
  if (typeof value === "number") {
    return Number.isInteger(value) ? value.toString() : value.toFixed(4);
  }
  return String(value);
}
