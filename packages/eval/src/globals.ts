/**
 * REPL globals — these are injected into the worker's evaluation scope.
 * Users can reference them as unqualified names in the REPL.
 *
 * Phase 1: only basic utility globals.
 * Later phases add: expr, rule, dataset, etc.
 */

export function createREPLGlobals(): Record<string, unknown> {
  return {
    // Will be populated by domain engines in later phases
  };
}
