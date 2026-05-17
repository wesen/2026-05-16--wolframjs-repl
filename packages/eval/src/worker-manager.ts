/**
 * WorkerManager — manages the Web Worker lifecycle from the main thread.
 *
 * Provides a Promise-based API for evaluating code in the worker,
 * with timeout support and worker restart on error.
 */
import type { WorkerRequest, WorkerResponse } from "./worker-protocol";
import type { SerializedRichValue } from "@core";
import { nextEvalId } from "./worker-protocol";

interface PendingRequest {
  resolve: (value: WorkerResponse) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

export class WorkerManager {
  private worker: Worker | null = null;
  private pending = new Map<string, PendingRequest>();
  private timeoutMs: number;

  constructor(timeoutMs = 30_000) {
    this.timeoutMs = timeoutMs;
    this.ensureWorker();
  }

  private ensureWorker(): Worker {
    if (this.worker) return this.worker;

    this.worker = new Worker(
      new URL("./worker.ts", import.meta.url),
      { type: "module" }
    );

    this.worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const msg = event.data;
      const pending = this.pending.get(msg.id);
      if (pending) {
        clearTimeout(pending.timer);
        this.pending.delete(msg.id);
        pending.resolve(msg);
      }
    };

    this.worker.onerror = (event: ErrorEvent) => {
      // Reject all pending requests on worker error
      for (const [id, pending] of this.pending) {
        clearTimeout(pending.timer);
        pending.reject(new Error(`Worker error: ${event.message}`));
      }
      this.pending.clear();
      // Restart the worker
      this.restart();
    };

    return this.worker;
  }

  async evaluate(code: string): Promise<WorkerResponse> {
    const id = nextEvalId();
    const worker = this.ensureWorker();

    return new Promise<WorkerResponse>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Evaluation timed out after ${this.timeoutMs}ms`));
      }, this.timeoutMs);

      this.pending.set(id, { resolve, reject, timer });

      const request: WorkerRequest = { type: "evaluate", id, code };
      worker.postMessage(request);
    });
  }

  restart(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    // Next evaluate() call will recreate the worker
  }

  terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    for (const [, pending] of this.pending) {
      clearTimeout(pending.timer);
      pending.reject(new Error("Worker terminated"));
    }
    this.pending.clear();
  }
}

// Singleton instance for the app
let _instance: WorkerManager | null = null;

export function getWorkerManager(): WorkerManager {
  if (!_instance) {
    _instance = new WorkerManager();
  }
  return _instance;
}
