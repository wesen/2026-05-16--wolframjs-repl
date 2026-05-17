interface TypeData {
  typeof: string;
  constructor?: string;
  isArray?: boolean;
}

export function TypeofView({ data }: { data: unknown }) {
  const d = data as TypeData;
  return (
    <div className="typeof-view text-xs font-mono text-repl-muted space-y-0.5">
      <div>
        <span className="text-repl-fg font-medium">typeof:</span>{" "}
        <span className="text-repl-accent">{d.typeof}</span>
      </div>
      {d.constructor && (
        <div>
          <span className="text-repl-fg font-medium">constructor:</span>{" "}
          <span className="text-repl-accent">{d.constructor}</span>
        </div>
      )}
      {d.isArray && (
        <div>
          <span className="text-repl-accent">Array</span>
        </div>
      )}
    </div>
  );
}
