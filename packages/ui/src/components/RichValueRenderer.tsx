import { useState, useMemo } from "react";
import type { SerializedRichValue } from "@core";
import { DeserializedRichValue, type View } from "@core";

import { TextView } from "../renderers/TextView";
import { JsonView } from "../renderers/JsonView";
import { TypeofView } from "../renderers/TypeofView";
import { FallbackView } from "../renderers/PlaceholderViews";
import { ChartView } from "../renderers/ChartView";
import { TableView } from "../renderers/TableView";
import { SchemaView } from "../renderers/SchemaView";
import { LatexView, MathView, TreeView } from "../renderers/MathViews";
import { InteractiveView } from "../renderers/InteractiveView";
import { PropertiesView } from "../renderers/PropertiesView";
import { StatisticsView } from "../renderers/StatisticsView";

const viewRendererRegistry = new Map<string, React.ComponentType<{ data: unknown }>>();

viewRendererRegistry.set("text", TextView);
viewRendererRegistry.set("json", JsonView);
viewRendererRegistry.set("typeof", TypeofView);
viewRendererRegistry.set("latex", LatexView);
viewRendererRegistry.set("table", TableView);
viewRendererRegistry.set("schema", SchemaView);
viewRendererRegistry.set("chart", ChartView);
viewRendererRegistry.set("tree", TreeView);
viewRendererRegistry.set("math", MathView);
viewRendererRegistry.set("interactive", InteractiveView);
viewRendererRegistry.set("fullform", JsonView);
viewRendererRegistry.set("properties", PropertiesView);
viewRendererRegistry.set("statistics", StatisticsView);

/** Types that should use the serif math font for their summary */
const MATH_FONT_TYPES = new Set(["SymbolicExpr", "Quantity", "Plot"]);

interface RichValueRendererProps {
  value: SerializedRichValue;
  inputIndex: number;
}

export function RichValueRenderer({ value, inputIndex }: RichValueRendererProps) {
  const richValue = useMemo(() => new DeserializedRichValue(value), [value]);
  const views = richValue.views();
  const [activeViewIndex, setActiveViewIndex] = useState(0);
  const activeView = views[activeViewIndex];
  const Renderer = viewRendererRegistry.get(activeView.viewType) ?? FallbackView;

  const summaryFontClass = MATH_FONT_TYPES.has(value.type) ? "font-math" : "font-mono";

  return (
    <div className="rich-value mt-1">
      <div className="flex items-baseline gap-2">
        <span className="text-xs font-mono text-repl-muted shrink-0 w-16 text-right select-none">
          Out[{inputIndex}]=
        </span>
        <span className={"rich-value-summary text-sm text-repl-fg " + summaryFontClass}>
          {richValue.summary()}
        </span>
      </div>
      {views.length > 1 && (
        <div className="flex items-baseline gap-2 ml-[calc(4rem+0.5rem)]">
          <ViewSwitcher
            views={views}
            activeIndex={activeViewIndex}
            onSelect={setActiveViewIndex}
          />
        </div>
      )}
      <div className="rich-value-content ml-[calc(4rem+0.5rem)] mt-1">
        <Renderer data={activeView.data} />
      </div>
    </div>
  );
}

interface ViewSwitcherProps {
  views: View[];
  activeIndex: number;
  onSelect: (index: number) => void;
}

function ViewSwitcher({ views, activeIndex, onSelect }: ViewSwitcherProps) {
  return (
    <div className="view-switcher flex gap-1 text-xs">
      {views.map((view, i) => (
        <button
          key={view.viewType}
          onClick={() => onSelect(i)}
          className={"px-2 py-0.5 rounded transition-colors " + (
            i === activeIndex
              ? "bg-repl-accent/15 text-repl-accent font-medium"
              : "text-repl-muted hover:text-repl-fg hover:bg-repl-border/50"
          )}
        >
          {view.label}
        </button>
      ))}
    </div>
  );
}
