/**
 * Web Worker entry point for the WolframJS REPL evaluator.
 *
 * Receives code to evaluate, runs it in a sandboxed scope,
 * and posts back the serialized RichValue result.
 */
import type { WorkerRequest, WorkerResponse } from "./worker-protocol";
import { evaluateCodeEnhanced } from "./evaluator";
import { createREPLGlobals } from "./globals";

const globals = createREPLGlobals();

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const msg = event.data;

  if (msg.type === "evaluate") {
    const result = evaluateCodeEnhanced(msg.code, globals);

    if (result.value) {
      const response: WorkerResponse = {
        type: "result",
        id: msg.id,
        value: result.value,
      };
      self.postMessage(response);
    } else {
      const response: WorkerResponse = {
        type: "error",
        id: msg.id,
        error: result.error ?? "Unknown error",
        stack: result.stack,
      };
      self.postMessage(response);
    }
  } else if (msg.type === "cancel") {
    // Worker termination is handled by the main thread
    // (terminating and restarting the worker)
  }
};
