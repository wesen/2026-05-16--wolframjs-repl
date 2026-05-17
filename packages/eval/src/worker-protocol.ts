/**
 * Worker protocol types — shared between main thread and worker.
 * These define the message format for postMessage communication.
 */

export type WorkerRequest =
  | { type: "evaluate"; id: string; code: string }
  | { type: "cancel"; id: string };

export type WorkerResponse =
  | { type: "result"; id: string; value: import("@core").SerializedRichValue }
  | { type: "error"; id: string; error: string; stack?: string }
  | { type: "display"; id: string; value: import("@core").SerializedRichValue };

/** Incrementing ID for correlating requests and responses. */
let nextId = 0;
export function nextEvalId(): string {
  return `eval-${++nextId}`;
}
