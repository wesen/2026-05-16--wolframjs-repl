export function LatexView({ data }: { data: unknown }) {
  // Placeholder — will use KaTeX in Phase 4
  return (
    <div className="latex-view text-sm font-math text-repl-fg italic">
      {String(data)}
    </div>
  );
}

export function MathView({ data }: { data: unknown }) {
  // Placeholder — will use KaTeX in Phase 4
  return (
    <div className="math-view text-base font-math text-repl-fg">
      {String(data)}
    </div>
  );
}

export function TreeView({ data }: { data: unknown }) {
  // Placeholder — will use a tree renderer in Phase 4
  return (
    <pre className="tree-view text-xs font-mono text-repl-fg whitespace-pre overflow-x-auto">
      {typeof data === "string" ? data : JSON.stringify(data, null, 2)}
    </pre>
  );
}

export function TableView({ data }: { data: unknown }) {
  // Placeholder — will be replaced with full Dataset TableView in Phase 2
  return (
    <pre className="table-view text-xs font-mono text-repl-fg whitespace-pre overflow-x-auto">
      {typeof data === "string" ? data : JSON.stringify(data, null, 2)}
    </pre>
  );
}

export function FallbackView({ data }: { data: unknown }) {
  return (
    <pre className="fallback-view text-xs font-mono text-repl-fg whitespace-pre-wrap overflow-x-auto">
      {typeof data === "string" ? data : JSON.stringify(data, null, 2)}
    </pre>
  );
}
