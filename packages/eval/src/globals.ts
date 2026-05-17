import { dataset, csv, json } from "@dataset";
import { autoViz } from "@viz";
import { expr, factor, simplify, diff, evaluate, expand, solve } from "@symbolic";
import { rule, rewrite } from "@pattern";
import { quantity } from "@quantity";

/**
 * REPL globals — these are injected into the worker's evaluation scope.
 * Users can reference them as unqualified names in the REPL.
 */
export function createREPLGlobals(): Record<string, unknown> {
  return {
    // Dataset
    dataset,
    csv,
    json,
    visualize: autoViz,

    // Symbolic math
    expr,
    factor,
    simplify,
    diff,
    evaluate,
    expand,
    solve,

    // Pattern matching
    rule,
    rewrite,

    // Quantities
    quantity,
  };
}
