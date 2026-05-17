import { useMemo, useState } from "react";

interface RegExpTestData {
  source: string;
  flags: string;
}

export function RegExpTestView({ data }: { data: unknown }) {
  const { source, flags } = data as RegExpTestData;
  const [input, setInput] = useState("https://example.com");

  const result = useMemo(() => {
    try {
      // Create a fresh RegExp for every test so global/sticky lastIndex state
      // cannot affect repeated checks.
      const re = new RegExp(source, flags);
      const match = re.exec(input);
      return {
        ok: match !== null,
        groups: match ? Array.from(match) : [],
        error: null as string | null,
      };
    } catch (err) {
      return {
        ok: false,
        groups: [],
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }, [source, flags, input]);

  return (
    <div className="regexp-test-view space-y-2 max-w-xl">
      <div className="text-xs font-mono text-repl-muted">
        /{source}/{flags}
      </div>
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Enter a string to test..."
        className="w-full text-sm font-mono bg-repl-bg text-repl-fg border border-repl-border rounded px-2 py-1.5 focus:outline-none focus:border-repl-accent"
      />
      {result.error ? (
        <div className="text-xs font-mono text-repl-error">Invalid RegExp: {result.error}</div>
      ) : (
        <div className="text-xs font-mono">
          <span className={result.ok ? "text-repl-accent" : "text-repl-muted"}>
            {result.ok ? "match" : "no match"}
          </span>
          {result.groups.length > 0 && (
            <pre className="mt-2 bg-repl-bg border border-repl-border rounded px-2 py-1 overflow-x-auto">
              {JSON.stringify(result.groups, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
