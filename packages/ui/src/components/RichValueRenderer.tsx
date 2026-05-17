import { useState, useMemo } from "react";
import type { SerializedRichValue } from "@core";
import { DeserializedRichValue, type View } from "@core";

/** Registry of view renderers — maps viewType to a React component. */
import { TextView } from "../renderers/TextView";
import { JsonView } from "../renderers/JsonView";
import { TypeofView } from "../renderers/TypeofView";
import { FallbackView } from "../renderers/PlaceholderViews";
import { ChartView } from "../renderers/ChartView";
import { TableView } from "../renderers/TableView";
import { SchemaView } from "../renderers/SchemaView";
import { LatexView, MathView, TreeView } from "../renderers/MathViews";
import { InteractiveView } from "../renderers/InteractiveView";

const viewRendererRegistry = new Map<string, React.ComponentType<{ data: unknown }>>();

// Register built-in renderers
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

  return (
    <div className="rich-value mt-1">
      <div className="flex items-baseline gap-2">
        <span className="text-xs font-mono text-repl-muted shrink-0 w-16 text-right">
          Out[{inputIndex}]=
        </span>
        <span className="rich-value-summary text-sm font-math text-repl-fg">
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
          className={`px-2 py-0.5 rounded transition-colors ${
            i === activeIndex
              ? "bg-repl-accent/15 text-repl-accent font-medium"
              : "text-repl-muted hover:text-repl-fg hover:bg-repl-border/50"
          }`}
        >
          {view.label}
        </button>
      ))}
    </div>
  );
}
