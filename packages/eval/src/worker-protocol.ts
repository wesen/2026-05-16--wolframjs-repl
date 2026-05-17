/**
 * Worker protocol types — self-contained (no alias imports) for the worker.
 * These must match the types in worker-protocol.ts.
 */
export type WorkerRequest =
  | { type: "evaluate"; id: string; code: string }
  | { type: "cancel"; id: string };

export type WorkerResponse =
  | { type: "result"; id: string; value: any }
  | { type: "error"; id: string; error: string; stack?: string };

let nextId = 0;
export function nextEvalId(): string {
  return `eval-${++nextId}`;
}
