import { useEffect, useRef, useState } from "react";
import embed from "vega-embed";
import type { TopLevelSpec } from "vega-lite";

interface ChartData {
  spec: TopLevelSpec;
  data: unknown[];
}

export function ChartView({ data }: { data: unknown }) {
  const d = data as ChartData;
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  const specWithData = {
    ...d?.spec,
    data: { values: d?.data ?? [] },
    width: "container" as const,
    height: 200,
    padding: 8,
    config: {
      view: { stroke: "transparent" },
      axis: {
        labelFont: "Inter, system-ui, sans-serif",
        labelFontSize: 11,
        titleFont: "Inter, system-ui, sans-serif",
        titleFontSize: 12,
        grid: true,
        gridColor: "#E5E5E5",
      },
      mark: { font: "Inter, system-ui, sans-serif" },
      title: { font: "Inter, system-ui, sans-serif", fontSize: 13 },
    },
  } as TopLevelSpec;

  useEffect(() => {
    if (!containerRef.current || !specWithData) return;

    let cancelled = false;
    setError(null);

    embed(containerRef.current, specWithData, {
      actions: false,
      renderer: "svg",
    })
      .then(() => {
        if (!cancelled) setError(null);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });

    return () => {
      cancelled = true;
    };
  }, [d?.spec, d?.data]);

  if (error) {
    return (
      <div className="text-xs text-repl-error p-2">
        Chart rendering error: {error}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="chart-view bg-white rounded-md overflow-hidden"
    />
  );
}
