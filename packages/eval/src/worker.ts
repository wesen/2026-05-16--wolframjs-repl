/**
 * Web Worker entry point for the WolframJS REPL evaluator.
 *
 * This file is loaded as a Web Worker module. It must be self-contained
 * because path aliases (@core, @dataset, etc.) may not resolve in
 * the worker context during Vite dev mode.
 *
 * For production builds, Vite bundles worker modules correctly.
 * For dev mode, we keep this file simple and avoid deep imports.
 */
import type { WorkerRequest, WorkerResponse } from "./worker-protocol";

// Simple evaluator — just runs JS code with Function constructor.
// RichValue wrapping and domain engine integration happens through
// a post-evaluation step on the main thread for dev mode simplicity.

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const msg = event.data;

  if (msg.type === "evaluate") {
    try {
      // Evaluate the code using Function constructor
      const result = evaluateCode(msg.code);

      // Wrap the result as a simple serialized RichValue
      const value = wrapAndSerialize(result);

      const response: WorkerResponse = {
        type: "result",
        id: msg.id,
        value,
      };
      self.postMessage(response);
    } catch (err) {
      const response: WorkerResponse = {
        type: "error",
        id: msg.id,
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      };
      self.postMessage(response);
    }
  }
};

function evaluateCode(code: string): unknown {
  const lines = code.trimEnd().split("\n");
  const lastLine = lines[lines.length - 1];
  const bodyLines = lines.slice(0, -1);

  const statementKeywords = /^(const|let|var|function|class|if|for|while|switch|try|throw|return|import|export|break|continue)\b/;
  const isLastLineExpression = !statementKeywords.test(lastLine.trim()) && lastLine.trim().length > 0;

  let wrappedCode: string;
  if (isLastLineExpression && bodyLines.length > 0) {
    wrappedCode = `"use strict";\n${bodyLines.join("\n")}\nreturn ${lastLine};`;
  } else if (isLastLineExpression && bodyLines.length === 0) {
    wrappedCode = `"use strict";\nreturn (${code});`;
  } else {
    wrappedCode = `"use strict";\n${code}`;
  }

  const fn = new Function(wrappedCode);
  return fn();
}

/**
 * Wrap a JS value as a serialized RichValue.
 * This is a simplified version that works without importing @core.
 */
function wrapAndSerialize(value: unknown): any {
  // If it's already a RichValue-like object
  if (value !== null && typeof value === "object" && "type" in (value as any) && "summary" in (value as any)) {
    const rv = value as any;
    return {
      type: rv.type,
      summary: typeof rv.summary === "function" ? rv.summary() : String(rv.summary),
      views: typeof rv.views === "function" ? rv.views().map((v: any) => ({
        viewType: v.viewType,
        label: v.label,
        data: v.data,
      })) : [],
      explain: typeof rv.explain === "function" ? rv.explain() : undefined,
      toLatex: typeof rv.toLatex === "function" ? rv.toLatex() : undefined,
      inputForm: typeof rv.inputForm === "function" ? rv.inputForm() : undefined,
      raw: typeof rv.toJSON === "function" ? rv.toJSON() : value,
    };
  }

  // Default: wrap as JSValue
  return {
    type: "JSValue",
    summary: summarizeJSValue(value),
    views: buildJSValueViews(value),
    explain: `A JavaScript value of type ${typeof value}.`,
    inputForm: formatJSValue(value),
    raw: value,
  };
}

function summarizeJSValue(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value === "string") return `"${value}"`;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return `Array[${value.length}]`;
  if (typeof value === "object") {
    const ctor = (value as object).constructor?.name;
    if (ctor && ctor !== "Object") return `${ctor}`;
    const keys = Object.keys(value as object);
    return `Object{${keys.slice(0, 3).join(", ")}${keys.length > 3 ? ", ..." : ""}}`;
  }
  if (typeof value === "function") return `Function ${(value as Function).name || "anonymous"}`;
  return String(value);
}

function buildJSValueViews(value: unknown): any[] {
  const views: any[] = [];

  views.push({
    viewType: "text",
    label: "Value",
    data: formatJSValue(value),
  });

  if (value !== null && typeof value === "object" && !(value instanceof Error)) {
    try {
      views.push({
        viewType: "json",
        label: "JSON",
        data: JSON.stringify(value, null, 2),
      });
    } catch { /* circular reference */ }
  }

  views.push({
    viewType: "typeof",
    label: "Type",
    data: {
      typeof: typeof value,
      constructor: value !== null && typeof value === "object"
        ? (value as object).constructor?.name ?? "Object"
        : undefined,
      isArray: Array.isArray(value),
    },
  });

  return views;
}

function formatJSValue(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "function") return value.toString();
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
