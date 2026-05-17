export function MathView({ data }: { data: unknown }) {
  // Math view is the pretty-printed representation
  // If the data looks like LaTeX, render with KaTeX; otherwise plain text
  const text = String(data ?? "");

  return (
    <div className="math-view text-base font-math text-repl-fg whitespace-pre-wrap overflow-x-auto">
      {text}
    </div>
  );
}

export function TreeView({ data }: { data: unknown }) {
  const treeObj = typeof data === "object" && data !== null ? data : null;
  const formatted = treeObj ? JSON.stringify(treeObj, null, 2) : String(data ?? "");

  return (
    <pre className="tree-view text-xs font-mono text-repl-fg whitespace-pre overflow-x-auto max-h-[300px] overflow-y-auto bg-repl-bg rounded px-3 py-2">
      {formatTree(treeObj, 0)}
    </pre>
  );
}

function formatTree(node: unknown, indent: number): string {
  if (node === null || node === undefined) return String(node);
  if (typeof node !== "object") return String(node);

  const obj = node as Record<string, unknown>;
  const prefix = "  ".repeat(indent);

  if ("type" in obj && "args" in obj) {
    const type = obj.type;
    const args = obj.args as unknown[];
    if (args.length === 0) {
      return `${prefix}${type}`;
    }
    const childStrs = args.map((a) => formatTree(a, indent + 1)).join("\n");
    return `${prefix}${type}[\n${childStrs}\n${prefix}]`;
  }

  if ("type" in obj && "value" in obj) {
    return `${prefix}${obj.type}[${obj.value}]`;
  }

  if ("type" in obj && "name" in obj) {
    return `${prefix}${obj.type}[${obj.name}]`;
  }

  return `${prefix}${JSON.stringify(obj)}`;
}
