/**
 * Web Worker entry point for the WolframJS REPL evaluator.
 *
 * Evaluates JS code in a sandboxed Function scope and wraps results
 * as serialized RichValue objects for postMessage back to the main thread.
 *
 * Special handling for types that can't cross the worker boundary:
 * - Functions → capture source, name, length
 * - Promises → await and capture resolved value
 * - Dates → capture ISO string
 * - RegExps → capture source and flags
 * - Maps/Sets → capture entries
 * - Errors → capture message and stack
 */
import type { WorkerRequest, WorkerResponse } from "./worker-protocol";
import { createREPLGlobals } from "./globals";

// Build the globals once at worker startup
const globals = createREPLGlobals();
const globalNames = Object.keys(globals);
const globalValues = Object.values(globals);

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const msg = event.data;

  if (msg.type === "evaluate") {
    // Handle async code (top-level await) by detecting promises
    try {
      const result = evaluateCode(msg.code);

      // If the result is a promise, await it then respond
      if (result && typeof result === "object" && result instanceof Promise) {
        result
          .then((resolved) => {
            const value = wrapAndSerialize(resolved);
            const response: WorkerResponse = { type: "result", id: msg.id, value };
            self.postMessage(response);
          })
          .catch((err) => {
            const response: WorkerResponse = {
              type: "error",
              id: msg.id,
              error: err instanceof Error ? err.message : String(err),
              stack: err instanceof Error ? err.stack : undefined,
            };
            self.postMessage(response);
          });
      } else {
        const value = wrapAndSerialize(result);
        const response: WorkerResponse = { type: "result", id: msg.id, value };
        self.postMessage(response);
      }
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

  const fn = new Function(...globalNames, wrappedCode);
  return fn(...globalValues);
}

// ── RichValue wrapping ───────────────────────────────

function wrapAndSerialize(value: unknown): any {
  // Already a RichValue-like object with .type and .summary()
  if (value !== null && typeof value === "object" && "type" in (value as any) && typeof (value as any).summary === "function") {
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
      raw: typeof rv.toJSON === "function" ? rv.toJSON() : safeClone(value),
    };
  }

  // ── Specialized type handlers ────────────────────

  // Function
  if (typeof value === "function") {
    return serializeFunction(value);
  }

  // null / undefined
  if (value === null) return serializeNull();
  if (value === undefined) return serializeUndefined();

  // Date
  if (value instanceof Date) return serializeDate(value);

  // RegExp
  if (value instanceof RegExp) return serializeRegExp(value);

  // Map
  if (value instanceof Map) return serializeMap(value);

  // Set
  if (value instanceof Set) return serializeSet(value);

  // Error
  if (value instanceof Error) return serializeError(value);

  // Array
  if (Array.isArray(value)) return serializeArray(value);

  // TypedArray
  if (ArrayBuffer.isView(value)) return serializeTypedArray(value);

  // ArrayBuffer
  if (value instanceof ArrayBuffer) return serializeArrayBuffer(value);

  // Plain object
  if (typeof value === "object") return serializeObject(value);

  // Primitives (number, string, boolean, bigint, symbol)
  return serializePrimitive(value);
}

// ── Primitive serializers ─────────────────────────────

function serializePrimitive(value: unknown): any {
  const typeOf = typeof value;
  const type = typeOf === "bigint" ? "BigInt" : capitalize(typeOf);

  const views: any[] = [
    { viewType: "text", label: "Value", data: String(value) },
    { viewType: "typeof", label: "Type", data: { typeof: typeOf, value } },
  ];

  if (typeOf === "number") {
    views.push(
      { viewType: "text", label: "Hex", data: "0x" + (value as number).toString(16) },
      { viewType: "text", label: "Binary", data: "0b" + (value as number).toString(2) },
      { viewType: "text", label: "Octal", data: "0o" + (value as number).toString(8) },
    );
    if (Number.isFinite(value as number)) {
      views.push({ viewType: "text", label: "Scientific", data: (value as number).toExponential() });
    }
  }

  if (typeOf === "string") {
    views.push(
      { viewType: "text", label: "Length", data: `${(value as string).length} characters` },
      { viewType: "text", label: "Char Codes", data: Array.from(value as string).map(c => c.charCodeAt(0)) },
    );
  }

  return { type, summary: formatPrimitive(value), views, raw: value, inputForm: String(value) };
}

function serializeNull(): any {
  return {
    type: "Null",
    summary: "null",
    views: [{ viewType: "text", label: "Value", data: "null" }],
    explain: "The null value — intentionally absent value.",
    raw: null,
    inputForm: "null",
  };
}

function serializeUndefined(): any {
  return {
    type: "Undefined",
    summary: "undefined",
    views: [{ viewType: "text", label: "Value", data: "undefined" }],
    explain: "The undefined value — variable exists but has no value.",
    raw: null,
    inputForm: "undefined",
  };
}

function serializeFunction(fn: Function): any {
  const name = fn.name || "anonymous";
  const source = fn.toString();
  const paramCount = fn.length;

  const views: any[] = [
    { viewType: "text", label: "Source", data: source },
    { viewType: "typeof", label: "Type", data: { typeof: "function", name, paramCount } },
  ];

  // Try to extract JSDoc or parameter info
  const paramMatch = source.match(/^function\s*\w*\s*\(([^)]*)\)/);
  const params = paramMatch ? paramMatch[1].split(",").map(s => s.trim()).filter(Boolean) : [];

  if (params.length > 0) {
    views.push({ viewType: "text", label: "Parameters", data: params });
  }

  return {
    type: "Function",
    summary: `Function ${name}(${params.join(", ")})`,
    views,
    explain: `A function named '${name}' with ${paramCount} declared parameter(s).`,
    raw: { name, paramCount, source },
    inputForm: name,
  };
}

function serializeDate(date: Date): any {
  const iso = date.toISOString();
  const local = date.toLocaleString();
  const unix = date.getTime();

  const views: any[] = [
    { viewType: "text", label: "ISO", data: iso },
    { viewType: "text", label: "Local", data: local },
    { viewType: "text", label: "Unix", data: unix },
    { viewType: "text", label: "UTC", data: date.toUTCString() },
    { viewType: "text", label: "Date only", data: date.toISOString().split("T")[0] },
    { viewType: "text", label: "Time only", data: date.toISOString().split("T")[1] },
    { viewType: "typeof", label: "Type", data: { typeof: "object", constructor: "Date" } },
  ];

  return {
    type: "Date",
    summary: local,
    views,
    explain: `A Date object representing ${local} (Unix timestamp: ${unix}).`,
    raw: { iso, unix, local },
    inputForm: `new Date("${iso}")`,
  };
}

function serializeRegExp(regex: RegExp): any {
  const source = regex.source;
  const flags = regex.flags;

  const views: any[] = [
    { viewType: "text", label: "Pattern", data: `/${source}/${flags}` },
    { viewType: "text", label: "Source", data: source },
    { viewType: "text", label: "Flags", data: flags || "(none)" },
    { viewType: "typeof", label: "Type", data: { typeof: "object", constructor: "RegExp", source, flags } },
    { viewType: "regexp-test", label: "Test", data: { source, flags } },
  ];

  const flagDescriptions: string[] = [];
  if (flags.includes("g")) flagDescriptions.push("global");
  if (flags.includes("i")) flagDescriptions.push("case-insensitive");
  if (flags.includes("m")) flagDescriptions.push("multiline");
  if (flags.includes("s")) flagDescriptions.push("dotAll");
  if (flags.includes("u")) flagDescriptions.push("unicode");
  if (flags.includes("y")) flagDescriptions.push("sticky");

  return {
    type: "RegExp",
    summary: `/${source}/${flags}`,
    views,
    explain: `A regular expression: /${source}/${flags}. ${flagDescriptions.length > 0 ? "Flags: " + flagDescriptions.join(", ") + "." : "No flags."}`,
    raw: { source, flags },
    inputForm: `/${source}/${flags}`,
  };
}

function serializeMap(map: Map<any, any>): any {
  const entries = Array.from(map.entries());
  const size = map.size;

  const views: any[] = [
    { viewType: "table", label: "Entries", data: { columns: [{ name: "Key", type: "string" }, { name: "Value", type: "unknown" }], rows: entries.map(([k, v]) => ({ Key: String(k), Value: formatValue(v) })), totalRows: size } },
    { viewType: "json", label: "JSON", data: JSON.stringify(Object.fromEntries(entries.map(([k, v]) => [String(k), v])), null, 2) },
    { viewType: "typeof", label: "Type", data: { typeof: "object", constructor: "Map", size } },
  ];

  return {
    type: "Map",
    summary: `Map[${size} entries]`,
    views,
    explain: `A Map with ${size} key-value entries.`,
    raw: Object.fromEntries(entries.map(([k, v]) => [String(k), safeClone(v)])),
    inputForm: `new Map([${entries.map(([k, v]) => `[${JSON.stringify(k)}, ${JSON.stringify(v)}]`).join(", ")}])`,
  };
}

function serializeSet(set: Set<any>): any {
  const values = Array.from(set.values());
  const size = set.size;

  const views: any[] = [
    { viewType: "table", label: "Values", data: { columns: [{ name: "Value", type: "unknown" }], rows: values.map(v => ({ Value: formatValue(v) })), totalRows: size } },
    { viewType: "json", label: "JSON", data: JSON.stringify(values, null, 2) },
    { viewType: "typeof", label: "Type", data: { typeof: "object", constructor: "Set", size } },
  ];

  return {
    type: "Set",
    summary: `Set[${size} values]`,
    views,
    explain: `A Set with ${size} unique value(s).`,
    raw: values,
    inputForm: `new Set(${JSON.stringify(values)})`,
  };
}

function serializeError(error: Error): any {
  const name = error.name;
  const message = error.message;
  const stack = error.stack;

  const views: any[] = [
    { viewType: "text", label: "Message", data: `${name}: ${message}` },
    { viewType: "text", label: "Stack", data: stack || "(no stack trace)" },
    { viewType: "typeof", label: "Type", data: { typeof: "object", constructor: name, name, message } },
  ];

  return {
    type: "Error",
    summary: `${name}: ${message}`,
    views,
    explain: `An error of type '${name}': ${message}`,
    raw: { name, message, stack },
    inputForm: `new ${name}("${message}")`,
  };
}

function serializeArray(arr: any[]): any {
  const views: any[] = [
    { viewType: "text", label: "Value", data: JSON.stringify(arr, null, 2) },
    { viewType: "json", label: "JSON", data: JSON.stringify(arr, null, 2) },
  ];

  // If it's an array of numbers, add stats
  if (arr.length > 0 && arr.every(v => typeof v === "number" && Number.isFinite(v))) {
    const nums = arr as number[];
    const sum = nums.reduce((a, b) => a + b, 0);
    const mean = sum / nums.length;
    const sorted = [...nums].sort((a, b) => a - b);
    const median = nums.length % 2 === 0
      ? (sorted[nums.length / 2 - 1] + sorted[nums.length / 2]) / 2
      : sorted[Math.floor(nums.length / 2)];

    views.push({
      viewType: "text",
      label: "Statistics",
      data: {
        count: nums.length,
        sum,
        mean: mean.toFixed(4),
        median,
        min: sorted[0],
        max: sorted[sorted.length - 1],
        stdDev: Math.sqrt(nums.reduce((acc, n) => acc + (n - mean) ** 2, 0) / nums.length).toFixed(4),
      },
    });
  }

  // If it's an array of objects (potentially a Dataset), add table view
  if (arr.length > 0 && arr.every(v => typeof v === "object" && v !== null && !Array.isArray(v))) {
    const colNames = Object.keys(arr[0]);
    const columns = colNames.map(name => ({ name, type: inferTypeFromArray(arr, name) }));
    views.push({
      viewType: "table",
      label: "Table",
      data: { columns, rows: arr.slice(0, 200), totalRows: arr.length },
    });
    views.push({
      viewType: "schema",
      label: "Schema",
      data: columns.map(col => ({
        name: col.name,
        type: col.type,
        count: arr.length,
        nullCount: arr.filter(r => r[col.name] === null || r[col.name] === undefined).length,
        uniqueCount: new Set(arr.map(r => r[col.name])).size,
      })),
    });
  }

  views.push({
    viewType: "typeof",
    label: "Type",
    data: { typeof: "object", constructor: "Array", length: arr.length, isArray: true },
  });

  return {
    type: "Array",
    summary: `Array[${arr.length}]`,
    views,
    explain: `An Array with ${arr.length} element(s).`,
    raw: arr,
    inputForm: JSON.stringify(arr),
  };
}

function serializeTypedArray(arr: ArrayBufferView): any {
  const constructor = arr.constructor.name;
  const length = (arr as any).length;
  const bytes = arr.byteLength;

  // Convert to regular array for display
  const values = Array.from(arr as any as ArrayLike<number>);

  const views: any[] = [
    { viewType: "text", label: "Values", data: `[${values.join(", ")}]` },
    { viewType: "json", label: "JSON", data: values },
    { viewType: "typeof", label: "Type", data: { typeof: "object", constructor, length, byteLength: bytes } },
  ];

  return {
    type: "TypedArray",
    summary: `${constructor}[${length}]`,
    views,
    explain: `A ${constructor} with ${length} elements (${bytes} bytes).`,
    raw: values,
    inputForm: `new ${constructor}([${values.join(", ")}])`,
  };
}

function serializeArrayBuffer(buf: ArrayBuffer): any {
  const bytes = buf.byteLength;

  const views: any[] = [
    { viewType: "typeof", label: "Type", data: { typeof: "object", constructor: "ArrayBuffer", byteLength: bytes } },
  ];

  return {
    type: "ArrayBuffer",
    summary: `ArrayBuffer[${bytes} bytes]`,
    views,
    explain: `An ArrayBuffer of ${bytes} bytes.`,
    raw: { byteLength: bytes },
    inputForm: `new ArrayBuffer(${bytes})`,
  };
}

function serializeObject(obj: object): any {
  const ctor = obj.constructor?.name;
  const type = ctor && ctor !== "Object" ? ctor : "Object";
  const keys = Object.keys(obj);
  const entries = Object.entries(obj);

  const views: any[] = [
    { viewType: "text", label: "Value", data: JSON.stringify(obj, safeReplacer, 2) },
    { viewType: "json", label: "JSON", data: JSON.stringify(obj, safeReplacer, 2) },
  ];

  // If it looks like a dataset (array of objects), add table/schema views
  // Keys view for all objects
  views.push({
    viewType: "table",
    label: "Properties",
    data: {
      columns: [{ name: "Key", type: "string" }, { name: "Value", type: "unknown" }, { name: "Type", type: "string" }],
      rows: entries.map(([k, v]) => ({ Key: k, Value: formatValue(v), Type: typeof v })),
      totalRows: entries.length,
    },
  });

  views.push({
    viewType: "typeof",
    label: "Type",
    data: { typeof: "object", constructor: type, keyCount: keys.length },
  });

  const summaryKeys = keys.slice(0, 4).join(", ");
  const suffix = keys.length > 4 ? ", ..." : "";

  return {
    type,
    summary: `${type}{${summaryKeys}${suffix}}`,
    views,
    explain: `An object of type '${type}' with ${keys.length} properties: ${keys.join(", ")}.`,
    raw: safeClone(obj),
    inputForm: JSON.stringify(obj, safeReplacer),
  };
}

// ── Helpers ──────────────────────────────────────────

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatPrimitive(value: unknown): string {
  if (typeof value === "string") return `"${value}"`;
  if (typeof value === "bigint") return `${value}n`;
  return String(value);
}

function formatValue(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value === "string") return `"${value}"`;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "function") return `function ${value.name || "anonymous"}`;
  if (Array.isArray(value)) return `Array[${value.length}]`;
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Map) return `Map[${value.size}]`;
  if (value instanceof Set) return `Set[${value.size}]`;
  if (value instanceof Error) return `${value.name}: ${value.message}`;
  if (value instanceof RegExp) return `/${value.source}/${value.flags}`;
  if (typeof value === "object") {
    const ctor = value.constructor?.name;
    return ctor && ctor !== "Object" ? ctor : `Object{${Object.keys(value).length} keys}`;
  }
  return String(value);
}

function safeReplacer(key: string, value: unknown): unknown {
  if (typeof value === "function") return `[Function: ${value.name || "anonymous"}]`;
  if (value instanceof Map) return Object.fromEntries(Array.from(value.entries()));
  if (value instanceof Set) return Array.from(value.values());
  if (value instanceof Date) return value.toISOString();
  if (value instanceof RegExp) return `/${value.source}/${value.flags}`;
  if (value instanceof Error) return { name: value.name, message: value.message };
  if (typeof value === "bigint") return `${value}n`;
  if (typeof value === "symbol") return value.toString();
  return value;
}

function safeClone(value: unknown): unknown {
  try {
    return JSON.parse(JSON.stringify(value, safeReplacer));
  } catch {
    return String(value);
  }
}

function inferTypeFromArray(arr: any[], col: string): string {
  const types = new Set(arr.map(r => typeof r[col]));
  if (types.size === 1) return [...types][0];
  return "mixed";
}
