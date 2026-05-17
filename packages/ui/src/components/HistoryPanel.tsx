import { useState, useMemo } from "react";
import { useAppSelector } from "../store/hooks";

/**
 * HistoryPanel — sidebar showing all Out[n] values with type badges.
 * Supports search/filter by type. Click to scroll to the corresponding cell.
 */
export function HistoryPanel({ onClose }: { onClose: () => void }) {
  const entries = useAppSelector((s) => s.history.entries);
  const [filter, setFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState<string | null>(null);

  // Compute unique types from history entries
  const typeCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const entry of entries) {
      counts.set(entry.resultType, (counts.get(entry.resultType) || 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [entries]);

  // Filter entries
  const filtered = useMemo(() => {
    let result = entries;
    if (typeFilter) {
      result = result.filter((e) => e.resultType === typeFilter);
    }
    if (filter.trim()) {
      const q = filter.toLowerCase();
      result = result.filter(
        (e) =>
          e.code.toLowerCase().includes(q) ||
          e.resultType.toLowerCase().includes(q) ||
          (e.result?.summary || "").toLowerCase().includes(q)
      );
    }
    return result;
  }, [entries, filter, typeFilter]);

  const scrollToCell = (inputIndex: number) => {
    const el = document.querySelector(`[data-input-index="${inputIndex}"]`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    onClose();
  };

  return (
    <div className="fixed inset-y-0 right-0 w-80 bg-repl-bg border-l border-repl-border shadow-xl z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-repl-border">
        <h2 className="text-sm font-sans font-medium text-repl-fg">History</h2>
        <button
          onClick={onClose}
          className="text-repl-muted hover:text-repl-fg text-sm transition-colors"
        >
          ✕
        </button>
      </div>

      {/* Search */}
      <div className="px-4 py-2 border-b border-repl-border">
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Search by code, type, or summary..."
          className="w-full text-xs font-mono bg-repl-border/30 text-repl-fg placeholder:text-repl-muted px-2 py-1.5 rounded border border-repl-border/50 focus:outline-none focus:border-repl-accent"
        />
      </div>

      {/* Type badges */}
      <div className="px-4 py-2 flex flex-wrap gap-1 border-b border-repl-border overflow-x-auto">
        <button
          onClick={() => setTypeFilter(null)}
          className={
            "px-2 py-0.5 rounded text-[10px] font-mono transition-colors " +
            (typeFilter === null
              ? "bg-repl-accent/15 text-repl-accent"
              : "text-repl-muted hover:text-repl-fg hover:bg-repl-border/50")
          }
        >
          all ({entries.length})
        </button>
        {typeCounts.map(([type, count]) => (
          <button
            key={type}
            onClick={() => setTypeFilter(type === typeFilter ? null : type)}
            className={
              "px-2 py-0.5 rounded text-[10px] font-mono transition-colors " +
              (typeFilter === type
                ? "bg-repl-accent/15 text-repl-accent"
                : "text-repl-muted hover:text-repl-fg hover:bg-repl-border/50")
            }
          >
            {type} ({count})
          </button>
        ))}
      </div>

      {/* Entries */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 && (
          <div className="px-4 py-8 text-xs text-repl-muted text-center">
            No history entries
          </div>
        )}
        {filtered.map((entry, i) => (
          <button
            key={i}
            onClick={() => scrollToCell(entry.inputIndex)}
            className="w-full text-left px-4 py-2 hover:bg-repl-border/20 transition-colors border-b border-repl-border/30"
          >
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-repl-muted shrink-0">
                Out[{entry.inputIndex}]
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-repl-border/40 text-repl-muted">
                {entry.resultType}
              </span>
            </div>
            <div className="text-xs font-mono text-repl-fg mt-0.5 truncate">
              {entry.result?.summary || "—"}
            </div>
            <div className="text-[10px] font-mono text-repl-muted mt-0.5 truncate">
              {entry.code}
            </div>
          </button>
        ))}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 text-[10px] text-repl-muted border-t border-repl-border text-center">
        {filtered.length} of {entries.length} entries
      </div>
    </div>
  );
}
