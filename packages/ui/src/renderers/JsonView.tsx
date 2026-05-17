export function JsonView({ data }: { data: unknown }) {
  const formatted = typeof data === "string" ? data : JSON.stringify(data, null, 2);
  return (
    <pre className="json-view text-xs font-mono text-repl-fg bg-repl-bg rounded px-3 py-2 overflow-x-auto max-h-[400px] overflow-y-auto whitespace-pre">
      {formatted}
    </pre>
  );
}
