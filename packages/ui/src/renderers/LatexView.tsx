import katex from "katex";
import "katex/dist/katex.min.css";

export function LatexView({ data }: { data: unknown }) {
  const latex = String(data ?? "");

  try {
    const html = katex.renderToString(latex, {
      throwOnError: false,
      displayMode: true,
      trust: true,
    });

    return (
      <div
        className="latex-view text-base font-math overflow-x-auto"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  } catch {
    // Fallback: render as plain text
    return (
      <div className="latex-view text-sm font-mono text-repl-fg whitespace-pre-wrap">
        {latex}
      </div>
    );
  }
}
