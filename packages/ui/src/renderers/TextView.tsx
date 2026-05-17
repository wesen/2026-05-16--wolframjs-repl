export function TextView({ data }: { data: unknown }) {
  if (typeof data !== "string") return <pre>{String(data)}</pre>;
  return (
    <div className="text-view text-sm font-mono text-repl-fg whitespace-pre-wrap break-words">
      {data}
    </div>
  );
}
