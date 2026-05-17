import { dataset, csv, json } from "@dataset";

/**
 * REPL globals — these are injected into the worker's evaluation scope.
 * Users can reference them as unqualified names in the REPL.
 */
export function createREPLGlobals(): Record<string, unknown> {
  return {
    dataset,
    csv,
    json,
  };
}
