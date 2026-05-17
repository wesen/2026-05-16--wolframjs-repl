/**
 * The RichValue protocol — the central abstraction of the WolframJS REPL.
 *
 * Every REPL result implements this interface. The protocol creates a clean
 * separation: the evaluation layer produces RichValue objects, the presentation
 * layer consumes them. Domain engines implement RichValue independently.
 */

/** A named view of a RichValue, mapping to a React renderer component. */
export interface View {
  readonly viewType: string;
  readonly label: string;
  readonly data: unknown;
}

/** A transformation that can be applied to a RichValue. */
export interface Operation {
  readonly name: string;
  readonly args?: unknown[];
}

/** The core protocol — every REPL result implements this. */
export interface RichValue {
  readonly type: string;
  summary(): string;
  views(): View[];
  explain?(): string;
  toLatex?(): string;
  toJSON?(): unknown;
  toHTML?(): string;
  transform?(op: Operation): RichValue;
  fullForm?(): string;
  inputForm?(): string;
}

/** Serialized form for crossing the Web Worker boundary. */
export interface SerializedRichValue {
  type: string;
  summary: string;
  views: SerializedView[];
  explain?: string;
  toLatex?: string;
  inputForm?: string;
  raw: unknown;
}

export interface SerializedView {
  viewType: string;
  label: string;
  data: unknown;
}

/**
 * Well-known symbol for opt-in rich display.
 * Any JS object can implement this to provide RichValue metadata.
 */
export const richDisplaySymbol = Symbol.for("wolframjs.richDisplay");

/** Serialize a RichValue for postMessage across the worker boundary. */
export function serializeRichValue(rv: RichValue): SerializedRichValue {
  return {
    type: rv.type,
    summary: rv.summary(),
    views: rv.views().map((v) => ({
      viewType: v.viewType,
      label: v.label,
      data: v.data,
    })),
    explain: rv.explain?.(),
    toLatex: rv.toLatex?.(),
    inputForm: rv.inputForm?.(),
    raw: rv.toJSON?.() ?? null,
  };
}
