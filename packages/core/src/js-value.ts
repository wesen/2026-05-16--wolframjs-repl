import type { RichValue, View, SerializedRichValue } from "./protocol";
import { richDisplaySymbol } from "./protocol";

/**
 * JSValue — the default wrapper for plain JS values that don't implement RichValue.
 *
 * Wraps any JavaScript value and provides sensible default views:
 * - "text": toString() representation
 * - "json": JSON.stringify'd representation (for objects/arrays)
 * - "typeof": type information
 */
export class JSValue implements RichValue {
  readonly type = "JSValue";

  constructor(private readonly value: unknown) {}

  summary(): string {
    if (this.value === null) return "null";
    if (this.value === undefined) return "undefined";
    if (typeof this.value === "string") return `"${this.value}"`;
    if (typeof this.value === "number" || typeof this.value === "boolean") {
      return String(this.value);
    }
    if (Array.isArray(this.value)) {
      return `Array[${this.value.length}]`;
    }
    if (typeof this.value === "object") {
      const ctor = (this.value as object).constructor?.name;
      if (ctor && ctor !== "Object") return `${ctor}`;
      const keys = Object.keys(this.value as object);
      return `Object{${keys.slice(0, 3).join(", ")}${keys.length > 3 ? ", ..." : ""}}`;
    }
    if (typeof this.value === "function") {
      return `Function ${(this.value as Function).name || "anonymous"}`;
    }
    return String(this.value);
  }

  views(): View[] {
    const views: View[] = [];

    // Always provide a text view
    views.push({
      viewType: "text",
      label: "Value",
      data: this.formatValue(),
    });

    // JSON view for objects and arrays
    if (
      this.value !== null &&
      typeof this.value === "object" &&
      !(this.value instanceof Error)
    ) {
      try {
        views.push({
          viewType: "json",
          label: "JSON",
          data: JSON.stringify(this.value, null, 2),
        });
      } catch {
        // Circular reference — skip JSON view
      }
    }

    // Type info view
    views.push({
      viewType: "typeof",
      label: "Type",
      data: {
        typeof: typeof this.value,
        constructor: this.value !== null && typeof this.value === "object"
          ? (this.value as object).constructor?.name ?? "Object"
          : undefined,
        isArray: Array.isArray(this.value),
      },
    });

    return views;
  }

  explain(): string {
    return `A JavaScript value of type ${typeof this.value}.`;
  }

  toJSON(): unknown {
    return this.value;
  }

  inputForm(): string {
    if (typeof this.value === "string") return JSON.stringify(this.value);
    if (this.value === null || this.value === undefined) return String(this.value);
    if (typeof this.value === "object") {
      try {
        return JSON.stringify(this.value, null, 2);
      } catch {
        return String(this.value);
      }
    }
    return String(this.value);
  }

  private formatValue(): string {
    if (this.value === null) return "null";
    if (this.value === undefined) return "undefined";
    if (typeof this.value === "string") return this.value;
    if (typeof this.value === "number" || typeof this.value === "boolean") {
      return String(this.value);
    }
    if (typeof this.value === "function") {
      return this.value.toString();
    }
    try {
      return JSON.stringify(this.value, null, 2);
    } catch {
      return String(this.value);
    }
  }
}

/**
 * Rehydrate a SerializedRichValue back into a RichValue on the main thread.
 * View data is pre-computed, so no functions cross the boundary.
 */
export class DeserializedRichValue implements RichValue {
  readonly type: string;
  private readonly sViews: View[];
  private readonly sSummary: string;
  private readonly sExplain?: string;
  private readonly sToLatex?: string;
  private readonly sInputForm?: string;
  private readonly sRaw: unknown;

  constructor(sv: SerializedRichValue) {
    this.type = sv.type;
    this.sSummary = sv.summary;
    this.sViews = sv.views;
    this.sExplain = sv.explain;
    this.sToLatex = sv.toLatex;
    this.sInputForm = sv.inputForm;
    this.sRaw = sv.raw;
  }

  summary(): string {
    return this.sSummary;
  }

  views(): View[] {
    return this.sViews;
  }

  explain(): string {
    return this.sExplain ?? "";
  }

  toLatex(): string {
    return this.sToLatex ?? "";
  }

  inputForm(): string {
    return this.sInputForm ?? "";
  }

  toJSON(): unknown {
    return this.sRaw;
  }
}

/**
 * Wrap any JS value as a RichValue.
 * If it's already a RichValue, return it.
 * If it implements Symbol.richDisplay, use that.
 * Otherwise, wrap in JSValue.
 */
export function wrapAsRichValue(value: unknown): RichValue {
  // Already a RichValue
  if (isRichValue(value)) return value;

  // Implements Symbol.richDisplay
  if (
    value !== null &&
    typeof value === "object" &&
    (value as any)[richDisplaySymbol]
  ) {
    const display = (value as any)[richDisplaySymbol]();
    if (isRichValue(display)) return display;
  }

  return new JSValue(value);
}

function isRichValue(value: unknown): value is RichValue {
  return (
    value !== null &&
    typeof value === "object" &&
    "type" in value &&
    typeof (value as any).type === "string" &&
    "summary" in value &&
    typeof (value as any).summary === "function" &&
    "views" in value &&
    typeof (value as any).views === "function"
  );
}
