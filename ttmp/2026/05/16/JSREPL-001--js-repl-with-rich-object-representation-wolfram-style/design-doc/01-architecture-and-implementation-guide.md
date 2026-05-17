---
title: Architecture and Implementation Guide
doc-type: design-doc
status: active
intent: long-term
ticket: JSREPL-001
topics: javascript, repl, react, visualization, symbolic-computation, design
created: 2026-05-16
---

# JS REPL with Rich Object Representation — Architecture & Implementation Guide

**Ticket:** JSREPL-001
**Audience:** New intern joining the project. This document assumes you can write TypeScript and React, but you may not have used RTK Query, symbolic math systems, or built a REPL before. Everything is explained from first principles.

---

## 1. Executive Summary

We are building a **JavaScript-native computational REPL** inspired by Wolfram Mathematica's rich object model. In a normal JS REPL (Node, browser console, Deno), you type code, it evaluates, and you get a string printed back. In our REPL, every result becomes a **semantic object** that knows how to display itself, explain itself, transform itself, and compose with other results.

The stack is: **React + Vite + RTK Query + Tailwind CSS** on the frontend. The backend is a JS evaluation runtime (likely a Web Worker or sandboxed Node process). The crucial architectural insight is that the REPL's power comes from a **value protocol** — every result implements `RichValue`, which provides multiple views, explanations, transformations, and serializations.

This document covers every layer of the system, from the runtime evaluator to the React component tree, from the symbolic expression engine to the visualization pipeline. It is designed to be read top-to-bottom by someone who has never seen this codebase.

---

## 2. Problem Statement and Scope

### 2.1 The Problem

Standard JavaScript REPLs treat output as opaque strings. When you evaluate `[1,2,3].map(x => x*2)` you see `[2, 4, 6]` printed as text. You cannot:

- **Inspect** the value in multiple ways (table, chart, tree, raw JSON)
- **Explain** how the result was computed
- **Transform** it into another representation (SQL, LaTeX, SVG)
- **Compose** it into subsequent operations with rich semantics
- **Visualize** it automatically based on its type

Wolfram Mathematica solved this in the 1980s with its notebook interface and symbolic expression model. Every result in Mathematica is a symbolic expression that can be displayed in multiple forms, simplified, differentiated, plotted, or composed into larger computations. The result is a computational environment where the output of one cell becomes a rich, manipulable input to the next.

### 2.2 What We Are Building

A **browser-based JS REPL** where:

1. Every evaluation result becomes a `RichValue` object with multiple views
2. Symbolic math expressions can be entered via tagged template literals (`expr\`x^2+1\``)
3. Datasets support groupBy, filter, transform, and auto-visualization
4. Pattern matching and rewrite rules work on both symbolic and JS AST expressions
5. The REPL history is a queryable, persistent store of `RichValue` objects
6. Interactive widgets (sliders, live plots) are first-class outputs
7. The design is clean, elegant, and Mathematica-inspired — sparse, precise, beautiful

### 2.3 What We Are NOT Building (Yet)

- A full computer algebra system (CAS) competing with Mathematica or SymPy
- A production IDE or code editor
- A backend-for-frontend server — the REPL evaluates locally
- A mobile app
- A VS Code extension

---

## 3. What "Wolfram-Like" Means — Design Principles

Before diving into architecture, understand the aesthetic and interaction model we are targeting. This is not just a technical project; it is a **design project**. The visual and interaction quality matters as much as the functionality.

### 3.1 Mathematica's Design DNA

Mathematica's notebook interface has these qualities:

- **Sparse and precise**: Results sit in generous whitespace. No chrome, no clutter.
- **Structured output**: Every cell has an `In[n]:=` label and `Out[n]=` label. The numbering creates a computational narrative.
- **Multiple representations**: The same value can be shown as input form, output form, full form, traditional form, LaTeX, etc.
- **Inline rich content**: Plots, images, 3D graphics, and interactive widgets render inline in the notebook flow.
- **Composability**: `Out[n]` is addressable. You can write `%` or `Out[12]` to reference previous results.
- **Typographic care**: Mathematical notation uses proper symbols (√, ², →, ×), not ASCII approximations.

### 3.2 Our Design Language

We translate Mathematica's principles into a web-native design language:

- **Typography-first**: Use a math-capable font stack (STIX Two Math, Latin Modern Math, with KaTeX for rendering). Monospace for code, serif for math output, sans-serif for UI chrome.
- **Cell-based layout**: Each input-output pair is a "cell" — a vertical unit with generous padding. Cells are separated by thin horizontal rules, not boxes or cards.
- **Minimal chrome**: No toolbars, sidebars, or status bars unless the user asks for them. The content is the interface.
- **Subtle color**: A near-white background (`#FAFAFA`), dark text (`#1A1A1A`), with a single accent color for interactivity (e.g., a muted blue `#4A90D9`). Plots and visualizations bring their own color, but the UI frame stays neutral.
- **Responsive views**: Each output cell can expand to show alternate views (table, chart, tree, JSON). These transitions should be smooth and feel like "opening a drawer" rather than "navigating to a new page."
- **Mathematica cell labels**: `In[1]:` and `Out[1]=` in a muted gray, left-aligned, creating the computational narrative.

---

## 4. System Architecture — The Big Picture

The system has six logical layers. Data flows downward through evaluation and upward through display.

```
┌─────────────────────────────────────────────────────────┐
│  PRESENTATION LAYER (React + Tailwind)                   │
│  ┌───────────┐ ┌──────────┐ ┌───────────┐ ┌──────────┐  │
│  │ CellInput │ │CellOutput│ │ ViewSwitch│ │Inspector │  │
│  └───────────┘ └──────────┘ └───────────┘ └──────────┘  │
├─────────────────────────────────────────────────────────┤
│  STATE LAYER (Redux Toolkit + RTK Query)                  │
│  ┌──────────┐ ┌────────────┐ ┌────────────┐             │
│  │ CellSlice│ │ HistorySlice│ │ ConfigSlice│             │
│  └──────────┘ └────────────┘ └────────────┘             │
├─────────────────────────────────────────────────────────┤
│  VALUE PROTOCOL (RichValue interface)                      │
│  ┌───────────────────────────────────────────┐           │
│  │ summary() views() explain() toLatex()      │           │
│  │ toJSON() toHTML() transform()              │           │
│  └───────────────────────────────────────────┘           │
├─────────────────────────────────────────────────────────┤
│  DOMAIN ENGINES                                           │
│  ┌──────────┐ ┌──────┐ ┌──────┐ ┌───────┐ ┌─────────┐ │
│  │ Symbolic │ │Dataset│ │ Viz  │ │Pattern│ │Quantity │ │
│  │ Engine   │ │Engine │ │Engine│ │Engine │ │Engine   │ │
│  └──────────┘ └──────┘ └──────┘ └───────┘ └─────────┘ │
├─────────────────────────────────────────────────────────┤
│  EVALUATION LAYER (Web Worker sandbox)                    │
│  ┌───────────────────────────────────────────┐           │
│  │ JS Runtime + Instrumented Evaluator        │           │
│  │ (evaluates user code, wraps results)       │           │
│  └───────────────────────────────────────────┘           │
├─────────────────────────────────────────────────────────┤
│  PERSISTENCE LAYER (IndexedDB + OPFS)                     │
│  ┌──────────┐ ┌────────────┐ ┌──────────────┐          │
│  │ Notebook │ │ History    │ │ PackageCache │          │
│  │ Store    │ │ Store      │ │              │          │
│  └──────────┘ └────────────┘ └──────────────┘          │
└─────────────────────────────────────────────────────────┘
```

### 4.1 Layer Responsibilities

**Presentation Layer (React + Tailwind):** Renders cells, handles user input, displays rich output views. This is where all visual design lives. Components consume `RichValue` objects from the state layer and decide how to render them.

**State Layer (Redux Toolkit + RTK Query):** Manages notebook state (cells, their evaluation status, their outputs), REPL history, user preferences, and any async data fetching (e.g., loading notebooks from storage, fetching npm package metadata).

**Value Protocol (RichValue):** The central abstraction. Every result from evaluation is wrapped in an object that implements the `RichValue` interface. This is the contract between the evaluation layer and the display layer. It is language-agnostic — a `Dataset` and a `SymbolicExpr` both implement the same interface, but they render differently.

**Domain Engines:** Specialized subsystems for symbolic math, dataset manipulation, visualization, pattern matching, and unit/quantity handling. Each engine knows how to evaluate its domain, produce `RichValue` results, and render its outputs.

**Evaluation Layer:** Runs user code in a sandboxed Web Worker. The evaluator instruments the code to capture results and wrap them in `RichValue` objects. It also handles the tagged template literals (`expr`, `rule`, `unit`, etc.) by preprocessing them before standard JS evaluation.

**Persistence Layer:** Stores notebooks, history, and cached packages in IndexedDB (for structured data) and OPFS (Origin Private File System, for large binary blobs like images or datasets).

---

## 5. The Value Protocol — The Heart of the System

### 5.1 The RichValue Interface

```typescript
// packages/core/src/protocol.ts

/**
 * Every REPL result implements RichValue.
 * This is THE abstraction that makes the system work.
 * If you add a new result type, you implement this interface.
 */
interface RichValue {
  /** Unique discriminator for this value type */
  readonly type: string;

  /** Short one-line summary shown in Out[n] by default */
  summary(): string;

  /** All available views for this value */
  views(): View[];

  /** Optional: natural-language explanation of how this value was computed */
  explain?(): string;

  /** Optional: LaTeX representation (for math expressions) */
  toLatex?(): string;

  /** Optional: JSON serialization */
  toJSON?(): unknown;

  /** Optional: HTML representation (for custom widgets) */
  toHTML?(): string;

  /** Optional: apply a transformation, return new RichValue */
  transform?(op: Operation): RichValue;

  /** Optional: get the "full form" (AST-like representation) */
  fullForm?(): string;

  /** Optional: get an "input form" (round-trippable source text) */
  inputForm?(): string;
}

/**
 * A named view of a RichValue. Each view has a type that maps
 * to a React renderer component.
 */
interface View {
  readonly viewType: string;  // "table" | "chart" | "tree" | "json" | "latex" | ...
  readonly label: string;     // Human-readable label for the view switcher
  readonly data: unknown;     // View-specific payload consumed by the renderer
}

/**
 * A transformation that can be applied to a RichValue.
 */
interface Operation {
  readonly name: string;      // e.g., "toSQL", "toJS", "simplify", "factor"
  readonly args?: unknown[];  // Optional arguments to the operation
}
```

### 5.2 The Well-Known Symbol

Any JS object can opt into rich display by implementing a symbol method:

```typescript
// packages/core/src/protocol.ts

declare global {
  interface SymbolConstructor {
    readonly richDisplay: unique symbol;
  }
}

// Usage in user code or library code:
class Matrix implements RichValue {
  readonly type = "Matrix";

  [Symbol.richDisplay]() {
    return {
      summary: () => `Matrix[${this.rows} × ${this.cols}]`,
      views: () => [
        { viewType: "table", label: "Values", data: this.values },
        { viewType: "heatmap", label: "Heatmap", data: this.values },
        { viewType: "eigenvalues", label: "Eigenvalues", data: this.eigenvalues },
      ],
      explain: () => `A ${this.rows}×${this.cols} matrix with ${this.nnz} non-zero entries.`,
      toLatex: () => this.toLatexString(),
    };
  }

  // ... implement summary(), views(), etc. by delegating to [Symbol.richDisplay]
}
```

### 5.3 Why This Protocol Matters

The value protocol is the **single most important design decision** in the system. It creates a clean separation:

- **Evaluation layer** produces `RichValue` objects. It does not know or care how they will be rendered.
- **Presentation layer** consumes `RichValue` objects. It does not know or care how they were computed.
- **Domain engines** implement `RichValue`. Each engine is independently testable.
- **Third-party libraries** can implement `RichValue` via the symbol protocol, extending the REPL without modifying its core.

This is exactly how Mathematica works internally: everything is a symbolic expression (`SymbolicExpr`), and the display system knows how to render different types of expressions differently. We generalize this to any JS object, not just symbolic expressions.

---

## 6. Domain Engines — Detailed Design

### 6.1 Symbolic Expression Engine

#### What It Does

The symbolic engine allows users to enter mathematical expressions using tagged template literals and perform operations like simplification, differentiation, integration, factorization, and equation solving. It preserves the symbolic form rather than immediately reducing to a numeric value.

#### Core Data Structure

```typescript
// packages/symbolic/src/expr.ts

/**
 * A symbolic expression tree. This is the internal representation.
 * The user sees pretty-printed output; this is the AST behind it.
 *
 * Example: expr`x^2 + 2x + 1` becomes:
 *
 *   Expr {
 *     head: "Plus",
 *     args: [
 *       Expr { head: "Power", args: [Expr { head: "Symbol", name: "x" }, 2] },
 *       Expr { head: "Times", args: [2, Expr { head: "Symbol", name: "x" }] },
 *       1
 *     ]
 *   }
 */
class Expr implements RichValue {
  readonly type = "SymbolicExpr";
  readonly head: string;     // "Plus", "Times", "Power", "Sin", "Symbol", "Number", ...
  readonly args: ExprArg[];  // Expr | number | string | boolean

  summary(): string {
    return this.prettyPrint();
  }

  fullForm(): string {
    // Mathematica-style: Plus[Power[x, 2], Times[2, x], 1]
    return `${this.head}[${this.args.map(a => formatArg(a)).join(", ")}]`;
  }

  views(): View[] {
    return [
      { viewType: "math", label: "Math", data: this.prettyPrint() },
      { viewType: "latex", label: "LaTeX", data: this.toLatex() },
      { viewType: "tree", label: "Tree", data: this.toTree() },
      { viewType: "fullform", label: "Full Form", data: this.fullForm() },
    ];
  }

  toLatex(): string {
    // Convert expression tree to LaTeX string
    // Plus[Power[x,2], Times[2,x], 1] -> x^{2}+2x+1
    return latexify(this);
  }
}
```

#### Tagged Template Parser

The `expr` tagged template literal parses mathematical notation into an `Expr` tree. This is not JS syntax — it is a DSL embedded in JS via tagged templates.

```typescript
// packages/symbolic/src/template.ts

function expr(strings: TemplateStringsArray, ...values: unknown[]): Expr {
  const raw = strings.raw.join("");
  return parseMathNotation(raw);
}

// Parser steps:
// 1. Tokenize: "x^2 + 2x + 1" -> [SYMBOL:x, CARET, NUMBER:2, PLUS, NUMBER:2, SYMBOL:x, PLUS, NUMBER:1]
// 2. Build AST: operator precedence (power > multiply > add), implicit multiplication (2x -> 2*x)
// 3. Wrap in Expr tree

function parseMathNotation(input: string): Expr {
  const tokens = tokenizeMath(input);
  const ast = parseExpression(tokens, 0);
  return astToExpr(ast);
}
```

#### Operations

```typescript
// packages/symbolic/src/operations.ts

/** Factor a polynomial expression */
function factor(e: Expr): Expr { /* ... */ }

/** Simplify using rewrite rules */
function simplify(e: Expr, assumptions?: Assumptions): Expr { /* ... */ }

/** Symbolic differentiation */
function diff(e: Expr, variable: string): Expr { /* ... */ }

/** Symbolic integration (basic cases) */
function integrate(e: Expr, variable: string): Expr { /* ... */ }

/** Solve an equation */
function solve(equation: Expr, variable: string): Expr[] { /* ... */ }

/** Expand products and powers */
function expand(e: Expr): Expr { /* ... */ }
```

#### External Library Strategy

We should NOT build a CAS from scratch. Instead, we should integrate an existing JS symbolic math library and wrap its output in our `Expr` / `RichValue` protocol. Candidates:

- **math.js** (`mathjs` on npm): Has expression parsing, algebra, and symbolic operations. Its `math.parse()` returns a node tree we can wrap as `Expr`.
- **nerdamer** (`nerdamer` on npm): Symbolic math with solve, integrate, factor.
- **algebra.js** (`algebra.js` on npm): Lightweight, focuses on equations and expressions.

**Recommendation:** Start with `math.js` as the foundation. It has the most mature expression parser and node tree. Wrap its `math.Node` hierarchy in our `Expr` class that implements `RichValue`. Later, we can swap or supplement the backend if needed.

```typescript
// packages/symbolic/src/mathjs-bridge.ts

import * as math from "mathjs";

function parseWithMathJS(input: string): Expr {
  const node = math.parse(input);     // math.js Node tree
  return convertMathJSTree(node);      // Convert to our Expr tree
}

function convertMathJSTree(node: math.Node): Expr {
  switch (node.type) {
    case "OperatorNode":
      return new Expr(mapOperator(node.fn), node.args.map(convertMathJSTree));
    case "SymbolNode":
      return new Expr("Symbol", [], { name: node.name });
    case "ConstantNode":
      return new Expr("Number", [], { value: node.value });
    // ... handle all node types
  }
}
```

### 6.2 Dataset Engine

#### What It Does

The dataset engine provides a DataFrame-like API for structured data. It supports loading data from CSV, JSON, arrays, or API responses, and provides chainable operations: filter, groupBy, sort, select, transform, aggregate. Results are `Dataset` objects that implement `RichValue` with views for tables, summaries, schemas, and charts.

#### Core Data Structure

```typescript
// packages/dataset/src/dataset.ts

class Dataset implements RichValue {
  readonly type = "Dataset";

  constructor(
    private columns: Column[],
    private rows: Row[],
    private metadata?: DatasetMeta
  ) {}

  /** Total row count */
  get length(): number { return this.rows.length; }

  /** Column names */
  get columnNames(): string[] { return this.columns.map(c => c.name); }

  /** RichValue: one-line summary */
  summary(): string {
    return `Dataset[${this.rows.length} rows × ${this.columns.length} columns]`;
  }

  /** RichValue: available views */
  views(): View[] {
    return [
      { viewType: "table", label: "Table", data: { columns: this.columns, rows: this.rows.slice(0, 100) } },
      { viewType: "schema", label: "Schema", data: this.inferSchema() },
      { viewType: "summary", label: "Summary", data: this.computeSummary() },
      { viewType: "json", label: "JSON", data: this.rows },
    ];
  }

  /** Chainable operations — each returns a new Dataset */
  groupBy(col: string): GroupedDataset { /* ... */ }
  filter(predicate: (row: Row) => boolean): Dataset { /* ... */ }
  sort(col: string, dir?: "asc" | "desc"): Dataset { /* ... */ }
  select(...cols: string[]): Dataset { /* ... */ }
  transform(col: string, fn: (val: unknown) => unknown): Dataset { /* ... */ }

  /** Visualization shortcuts — return Plot objects */
  barChart(col: string): Plot { /* ... */ }
  lineChart(x: string, y: string): Plot { /* ... */ }
  histogram(col: string): Plot { /* ... */ }
  scatter(x: string, y: string): Plot { /* ... */ }

  /** Export operations */
  toSQL(): string { /* ... */ }
  toCSV(): string { /* ... */ }
}
```

#### Implementation Strategy

For the initial version, we implement the Dataset class from scratch using typed arrays and column-oriented storage. This gives us:

- Fast columnar operations (group, filter, aggregate)
- Efficient serialization for IndexedDB persistence
- No dependency on a heavy dataframe library

If performance becomes a concern with large datasets, we can later integrate **Arrow JS** (`apache-arrow` on npm) for zero-copy columnar data and WebAssembly-accelerated operations.

```typescript
// packages/dataset/src/columnar.ts

/**
 * Column-oriented storage for efficient operations.
 * Each column is stored as a typed array when possible.
 */
interface ColumnStore {
  name: string;
  type: "number" | "string" | "boolean" | "date" | "null";
  data: number[] | string[] | boolean[] | Date[] | null[];
}

class DatasetInternal {
  constructor(private stores: ColumnStore[]) {}

  /** Columnar groupBy — much faster than row-oriented for large datasets */
  groupBy(col: string): Map<unknown, number[]> {
    const store = this.getStore(col);
    const groups = new Map<unknown, number[]>();
    for (let i = 0; i < store.data.length; i++) {
      const key = store.data[i];
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(i);
    }
    return groups;
  }
}
```

### 6.3 Visualization Engine

#### What It Does

The visualization engine takes data (from a Dataset, an expression evaluation, or any RichValue with a `chart` view) and renders it as an interactive SVG/Canvas visualization. It produces `Plot` objects that implement `RichValue`.

#### Architecture Decision: Rendering Library

We need a charting library that:

- Renders SVG (for crisp scaling and DOM inspection)
- Supports interactive features (tooltips, zoom, pan, selection)
- Has a clean, minimal default aesthetic that we can style to match our Mathematica-inspired design
- Works well with React

**Recommendation:** Use **Vega-Lite** (`vega-lite` + `vega` on npm) as the chart specification engine, with `react-vega` for React integration.

Vega-Lite is declarative: you describe *what* you want (a bar chart of this column, a scatter of x vs y) and it figures out *how* to render it. This maps perfectly to our `Plot` object model, where each `Plot` is essentially a Vega-Lite specification.

```typescript
// packages/viz/src/plot.ts

import type { TopLevelSpec } from "vega-lite";

class Plot implements RichValue {
  readonly type = "Plot";

  constructor(
    private spec: TopLevelSpec,
    private data: unknown[]
  ) {}

  summary(): string {
    const mark = (this.spec as any).mark;
    return `Plot[${typeof mark === "string" ? mark : mark.type}]`;
  }

  views(): View[] {
    return [
      { viewType: "chart", label: "Chart", data: { spec: this.spec, data: this.data } },
      { viewType: "vegalite", label: "Vega-Lite Spec", data: this.spec },
      { viewType: "data", label: "Data", data: this.data },
    ];
  }

  toHTML(): string {
    // Return a <div> with data- attributes for the react-vega component to mount on
    return `<div class="plot-container" data-spec="${encodeURIComponent(JSON.stringify(this.spec))}"></div>`;
  }
}
```

#### Auto-Visualization

When a user calls `%.visualize()`, the system should pick a reasonable chart type based on the data's shape and types. This is the "smart defaults" feature that makes the REPL feel intelligent.

```typescript
// packages/viz/src/auto-viz.ts

function autoViz(value: RichValue): Plot | null {
  if (value.type === "Dataset") {
    const ds = value as Dataset;
    const schema = ds.inferSchema();
    const numericCols = schema.filter(c => c.type === "number").map(c => c.name);
    const categoricalCols = schema.filter(c => c.type === "string").map(c => c.name);

    if (numericCols.length === 1) {
      // Single numeric column -> histogram
      return ds.histogram(numericCols[0]);
    }
    if (numericCols.length === 2) {
      // Two numeric columns -> scatter
      return ds.scatter(numericCols[0], numericCols[1]);
    }
    if (categoricalCols.length >= 1 && numericCols.length >= 1) {
      // Categorical + numeric -> bar chart
      return ds.barChart(numericCols[0]);
    }
  }

  if (value.type === "SymbolicExpr") {
    // Try to plot the expression as a function
    // expr`x^2` -> Plot[x^2, {x, -10, 10}]
    return plotExpression(value as Expr, -10, 10);
  }

  return null;  // No auto-visualization available
}
```

### 6.4 Pattern Matching and Rewrite Engine

#### What It Does

The pattern engine allows users to define rewrite rules using the `rule` tagged template and apply them to symbolic expressions or JS ASTs. This is the mechanism behind `simplify`, `factor`, and custom user-defined transformations.

#### Core Concepts

A **pattern** is a symbolic expression that may contain **pattern variables** (written with trailing underscores in Mathematica notation, or with `$` prefix in JS notation). When a pattern matches an expression, the pattern variables are bound to the subexpressions they matched.

A **rule** is a pair: pattern → replacement. The replacement can reference the pattern variables.

```typescript
// packages/pattern/src/rule.ts

interface Rule {
  readonly pattern: Expr;       // Left-hand side pattern
  readonly replacement: Expr;   // Right-hand side (may reference pattern vars)
  readonly condition?: Expr;    // Optional guard condition
}

function rule(strings: TemplateStringsArray, ...values: unknown[]): Rule {
  const raw = strings.raw.join("");
  // Parse "sin(a_)^2 + cos(a_)^2 -> 1"
  const [patternStr, replacementStr] = raw.split("->");
  return {
    pattern: parsePattern(patternStr.trim()),
    replacement: parseMathNotation(replacementStr.trim()),
  };
}
```

#### Matching Algorithm

```typescript
// packages/pattern/src/match.ts

type Bindings = Map<string, Expr>;

/**
 * Try to match pattern against expression.
 * Returns bindings if successful, null if no match.
 */
function match(pattern: Expr, expr: Expr, bindings: Bindings = new Map()): Bindings | null {
  // Pattern variable: matches anything, binds to the name
  if (pattern.head === "PatternVariable") {
    const name = pattern.metadata.name;
    if (bindings.has(name)) {
      // Already bound: must match the same value
      return exprEquals(bindings.get(name)!, expr) ? bindings : null;
    }
    const newBindings = new Map(bindings);
    newBindings.set(name, expr);
    return newBindings;
  }

  // Literal match: head and arity must match
  if (pattern.head !== expr.head) return null;
  if (pattern.args.length !== expr.args.length) return null;

  // Recursively match all arguments
  let currentBindings = bindings;
  for (let i = 0; i < pattern.args.length; i++) {
    const result = match(pattern.args[i] as Expr, expr.args[i] as Expr, currentBindings);
    if (result === null) return null;
    currentBindings = result;
  }

  return currentBindings;
}
```

#### Applying Rules

```typescript
// packages/pattern/src/rewrite.ts

function rewrite(expr: Expr, rules: Rule[]): Expr {
  let current = expr;

  // Apply rules repeatedly until no more changes (fixpoint)
  let changed = true;
  let iterations = 0;
  const MAX_ITERATIONS = 1000;

  while (changed && iterations < MAX_ITERATIONS) {
    changed = false;
    for (const rule of rules) {
      const result = tryApplyRule(current, rule);
      if (result !== null) {
        current = result;
        changed = true;
      }
    }
    iterations++;
  }

  return current;
}

function tryApplyRule(expr: Expr, rule: Rule): Expr | null {
  // Try matching at the root
  const bindings = match(rule.pattern, expr);
  if (bindings !== null && satisfiesCondition(rule.condition, bindings)) {
    return substitute(rule.replacement, bindings);
  }

  // Recurse into subexpressions
  const newArgs = expr.args.map(arg => {
    if (arg instanceof Expr) {
      const result = tryApplyRule(arg, rule);
      return result ?? arg;
    }
    return arg;
  });

  // Check if any argument changed
  const anyChanged = newArgs.some((arg, i) => arg !== expr.args[i]);
  return anyChanged ? new Expr(expr.head, newArgs, expr.metadata) : null;
}
```

### 6.5 Quantity and Units Engine

#### What It Does

Built-in support for physical quantities with units. Quantities can be combined arithmetically and converted between unit systems.

```typescript
// packages/quantity/src/quantity.ts

class Quantity implements RichValue {
  readonly type = "Quantity";

  constructor(
    readonly value: number,
    readonly unit: string  // e.g., "km", "kg", "km/h"
  ) {}

  summary(): string {
    // Smart formatting: round to reasonable precision
    return `${formatNumber(this.value)} ${this.unit}`;
  }

  views(): View[] {
    return [
      { viewType: "text", label: "Value", data: this.summary() },
      { viewType: "unit-info", label: "Unit Info", data: this.getUnitInfo() },
    ];
  }

  /** Convert to target unit */
  to(targetUnit: string): Quantity {
    const conversionFactor = getConversionFactor(this.unit, targetUnit);
    return new Quantity(this.value * conversionFactor, targetUnit);
  }

  /** Arithmetic: quantity + quantity (requires compatible units) */
  add(other: Quantity): Quantity { /* ... */ }
  sub(other: Quantity): Quantity { /* ... */ }
  mul(other: Quantity | number): Quantity { /* ... */ }
  div(other: Quantity | number): Quantity { /* ... */ }
}
```

Unit conversion data can come from a compact built-in table — we do not need an npm package for this. The SI base units cover 99% of use cases.

---

## 7. Evaluation Layer — The Sandbox

### 7.1 Why a Web Worker

User code must run in isolation. If user code throws an infinite loop, it must not freeze the UI. If user code accesses `window` or `document`, it should be controlled. A **Web Worker** provides:

- Separate thread (UI stays responsive)
- Isolated scope (no DOM access by default)
- Ability to terminate and restart
- Message-passing interface for sending results back

### 7.2 Architecture

```
┌──────────────────────┐      postMessage      ┌──────────────────────┐
│   MAIN THREAD         │ ◄───────────────────► │   WORKER THREAD      │
│                       │                       │                       │
│  React UI             │   evaluate(code) ───► │  eval(code)           │
│  Redux store          │                       │  wrapResult(value)    │
│  RichValue renderers  │  ◄── RichValue ────── │  postMessage(result) │
│                       │                       │                       │
└──────────────────────┘                       └──────────────────────┘
```

### 7.3 Worker Protocol

```typescript
// packages/eval/src/worker-protocol.ts

type WorkerRequest =
  | { type: "evaluate"; id: string; code: string }
  | { type: "cancel"; id: string }
  | { type: "import-package"; name: string; version: string };

type WorkerResponse =
  | { type: "result"; id: string; value: SerializedRichValue }
  | { type: "error"; id: string; error: string; stack?: string }
  | { type: "stream"; id: string; chunk: SerializedRichValue }
  | { type: "display"; id: string; value: SerializedRichValue };
```

### 7.4 The Instrumented Evaluator

Before evaluating user code, we wrap it in instrumentation that captures the result and wraps it in a `RichValue`. The key trick: the last expression's value is captured, and any intermediate `console.log` calls are intercepted as `DisplayValue` events.

```typescript
// packages/eval/src/evaluator.ts

function evaluateInWorker(code: string): WorkerResponse {
  try {
    // 1. Preprocess: wrap the code to capture the last expression result
    const wrappedCode = `
      (function() {
        const __result__ = (function() {
          ${code}
        })();
        return __result__;
      })()
    `;

    // 2. Evaluate with the REPL's global scope (including expr, rule, etc.)
    const result = eval(wrappedCode);

    // 3. Wrap the result as a RichValue
    const richValue = wrapAsRichValue(result);

    // 4. Serialize for postMessage
    return { type: "result", id: currentId, value: serializeRichValue(richValue) };
  } catch (err) {
    return { type: "error", id: currentId, error: String(err), stack: err.stack };
  }
}

function wrapAsRichValue(value: unknown): RichValue {
  // If it's already a RichValue, return it
  if (value && typeof value === "object" && "type" in value && "summary" in value) {
    return value as RichValue;
  }

  // If it implements Symbol.richDisplay, use that
  if (value && typeof value === "object" && Symbol.richDisplay in value) {
    return (value as any)[Symbol.richDisplay]();
  }

  // Otherwise, wrap in a default JSValue wrapper
  return new JSValue(value);
}
```

### 7.5 Serializing RichValue Across the Worker Boundary

Web Workers communicate via structured clone. `RichValue` objects may contain functions (like `summary()`), which cannot be cloned. We need a serialization format.

```typescript
// packages/eval/src/serialize.ts

interface SerializedRichValue {
  type: string;
  summary: string;           // Pre-computed on the worker side
  views: SerializedView[];   // View data (no functions)
  explain?: string;          // Pre-computed
  toLatex?: string;          // Pre-computed
  inputForm?: string;        // Pre-computed
  raw: unknown;              // The raw JS value for rehydration
}

function serializeRichValue(rv: RichValue): SerializedRichValue {
  return {
    type: rv.type,
    summary: rv.summary(),
    views: rv.views().map(v => ({ viewType: v.viewType, label: v.label, data: v.data })),
    explain: rv.explain?.(),
    toLatex: rv.toLatex?.(),
    inputForm: rv.inputForm?.(),
    raw: rv.toJSON?.() ?? rv,
  };
}

function deserializeRichValue(sv: SerializedRichValue): RichValue {
  // Reconstruct a RichValue on the main thread from serialized data
  // The views' data is sufficient for React renderers
  return new DeserializedRichValue(sv);
}
```

The key insight: **functions are evaluated on the worker side and their results are serialized.** The main thread only receives the data it needs to render. This means the main thread never runs user code.

---

## 8. Presentation Layer — React Component Architecture

### 8.1 Component Tree

```
<App>
  <Notebook>
    <CellList>
      <Cell id={1}>
        <CellInput />
        <CellOutput>
          <OutputLabel>In[1]:= Out[1]=</OutputLabel>
          <RichValueRenderer value={richValue}>
            <ViewSwitcher views={richValue.views} />
            <ViewRenderer view={activeView} />
          </RichValueRenderer>
        </CellOutput>
      </Cell>
      <Cell id={2}>...</Cell>
      ...
    </CellList>
    <NewCellPrompt />
  </Notebook>
</App>
```

### 8.2 Key Components

#### CellInput

A code editor for entering JS expressions. We use **CodeMirror 6** (`@codemirror/view` + `@codemirror/state`) because it is lightweight, extensible, and renders beautifully. It should support:

- Syntax highlighting for JS + our tagged templates
- Autocomplete for REPL globals (`expr`, `rule`, `dataset`, etc.)
- Multi-line editing with proper indentation
- Execution via Shift+Enter or a Run button

```typescript
// packages/ui/src/components/CellInput.tsx

interface CellInputProps {
  cellId: string;
  initialCode?: string;
  onEvaluate: (code: string) => void;
}

export function CellInput({ cellId, initialCode, onEvaluate }: CellInputProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView>();

  useEffect(() => {
    if (!editorRef.current) return;

    viewRef.current = new EditorView({
      state: EditorState.create({
        doc: initialCode ?? "",
        extensions: [
          javascript(),
          keymap.of([{ key: "Shift-Enter", run: () => {
            const code = viewRef.current!.state.doc.toString();
            onEvaluate(code);
            return true;
          }}]),
          replCompletions(),  // Custom completion source
          replTheme(),        // Custom theme matching our design language
        ],
      }),
      parent: editorRef.current,
    });

    return () => viewRef.current?.destroy();
  }, [cellId]);

  return <div ref={editorRef} className="cell-input" />;
}
```

#### CellOutput

Renders the evaluation result. Shows the `In[n]:=` / `Out[n]=` labels and delegates to `RichValueRenderer` for the actual display.

```typescript
// packages/ui/src/components/CellOutput.tsx

interface CellOutputProps {
  cellId: string;
  inputIndex: number;
  value: SerializedRichValue | null;
  error?: string;
  status: "idle" | "evaluating" | "done" | "error";
}

export function CellOutput({ cellId, inputIndex, value, error, status }: CellOutputProps) {
  if (status === "idle") return null;
  if (status === "evaluating") {
    return (
      <div className="cell-output evaluating">
        <span className="output-label">Out[{inputIndex}]=</span>
        <span className="evaluating-indicator">...</span>
      </div>
    );
  }
  if (status === "error") {
    return (
      <div className="cell-output error">
        <span className="output-label">Out[{inputIndex}]=</span>
        <pre className="error-message">{error}</pre>
      </div>
    );
  }

  const richValue = deserializeRichValue(value!);
  return (
    <div className="cell-output">
      <span className="output-label">Out[{inputIndex}]=</span>
      <RichValueRenderer value={richValue} />
    </div>
  );
}
```

#### RichValueRenderer

This is the component that maps `viewType` strings to React renderers. It is a registry pattern.

```typescript
// packages/ui/src/components/RichValueRenderer.tsx

const viewRendererRegistry = new Map<string, React.ComponentType<ViewRendererProps>>();

// Register built-in renderers
viewRendererRegistry.set("math", MathView);
viewRendererRegistry.set("latex", LatexView);
viewRendererRegistry.set("table", TableView);
viewRendererRegistry.set("chart", ChartView);
viewRendererRegistry.set("tree", TreeView);
viewRendererRegistry.set("json", JsonView);
viewRendererRegistry.set("text", TextView);
viewRendererRegistry.set("heatmap", HeatmapView);
viewRendererRegistry.set("vegalite", VegaLiteSpecView);

interface RichValueRendererProps {
  value: RichValue;
}

export function RichValueRenderer({ value }: RichValueRendererProps) {
  const views = value.views();
  const [activeViewIndex, setActiveViewIndex] = useState(0);
  const activeView = views[activeViewIndex];
  const Renderer = viewRendererRegistry.get(activeView.viewType) ?? FallbackView;

  return (
    <div className="rich-value">
      <div className="rich-value-summary">{value.summary()}</div>
      {views.length > 1 && (
        <ViewSwitcher
          views={views}
          activeIndex={activeViewIndex}
          onSelect={setActiveViewIndex}
        />
      )}
      <div className="rich-value-content">
        <Renderer data={activeView.data} />
      </div>
    </div>
  );
}
```

#### ViewSwitcher

A minimal tab bar that lets the user switch between available views. Designed to be unobtrusive — small, muted, Mathematica-style.

```typescript
// packages/ui/src/components/ViewSwitcher.tsx

export function ViewSwitcher({ views, activeIndex, onSelect }: ViewSwitcherProps) {
  return (
    <div className="view-switcher">
      {views.map((view, i) => (
        <button
          key={view.viewType}
          className={`view-switcher-tab ${i === activeIndex ? "active" : ""}`}
          onClick={() => onSelect(i)}
        >
          {view.label}
        </button>
      ))}
    </div>
  );
}
```

### 8.3 View Renderers

Each `viewType` maps to a dedicated React component. Here are the key ones:

#### MathView / LatexView

Renders mathematical expressions using **KaTeX** (`katex` on npm). KaTeX is fast, produces clean HTML, and handles all standard LaTeX math notation.

```typescript
// packages/ui/src/renderers/LatexView.tsx

import katex from "katex";

export function LatexView({ data }: { data: string }) {
  const html = katex.renderToString(data, {
    throwOnError: false,
    displayMode: true,
  });

  return (
    <div
      className="latex-output"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
```

#### TableView

Renders tabular data (from Datasets) as a scrollable, sortable, filterable HTML table. Uses Tailwind for minimal styling — thin borders, alternating row colors, monospaced numbers.

```typescript
// packages/ui/src/renderers/TableView.tsx

interface TableData {
  columns: Column[];
  rows: Row[];
}

export function TableView({ data }: { data: TableData }) {
  const { columns, rows } = data;
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const sortedRows = useMemo(() => {
    if (!sortCol) return rows;
    return [...rows].sort((a, b) => {
      const av = a[sortCol], bv = b[sortCol];
      return sortDir === "asc"
        ? (av > bv ? 1 : av < bv ? -1 : 0)
        : (av < bv ? 1 : av > bv ? -1 : 0);
    });
  }, [rows, sortCol, sortDir]);

  return (
    <div className="table-container">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map(col => (
              <th
                key={col.name}
                onClick={() => { setSortCol(col.name); setSortDir(d => d === "asc" ? "desc" : "asc"); }}
                className="sortable"
              >
                {col.name}
                {sortCol === col.name && (sortDir === "asc" ? " ↑" : " ↓")}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedRows.slice(0, 100).map((row, i) => (
            <tr key={i}>
              {columns.map(col => (
                <td key={col.name} className={typeof row[col.name] === "number" ? "numeric" : ""}>
                  {formatCell(row[col.name])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > 100 && (
        <div className="table-truncated">Showing 100 of {rows.length} rows</div>
      )}
    </div>
  );
}
```

#### ChartView

Renders Vega-Lite specifications using `react-vega`.

```typescript
// packages/ui/src/renderers/ChartView.tsx

import { VegaLite } from "react-vega";

interface ChartData {
  spec: TopLevelSpec;
  data: unknown[];
}

export function ChartView({ data }: { data: ChartData }) {
  const specWithData = {
    ...data.spec,
    data: { values: data.data },
  };

  return (
    <div className="chart-container">
      <VegaLite spec={specWithData} actions={false} />
    </div>
  );
}
```

---

## 9. State Layer — Redux Toolkit + RTK Query

### 9.1 Why Redux Toolkit

Redux Toolkit (RTK) provides:

- Predictable state updates via `createSlice`
- Async thunk management via `createAsyncThunk`
- Type-safe selectors via `createSelector`
- DevTools for debugging state changes

RTK Query adds:

- Built-in caching for async data
- Loading/error state management
- Automatic cache invalidation

### 9.2 Store Structure

```typescript
// packages/ui/src/store/store.ts

import { configureStore } from "@reduxjs/toolkit";

export const store = configureStore({
  reducer: {
    notebook: notebookReducer,
    history: historyReducer,
    config: configReducer,
    // RTK Query reducer for async operations
    [evalApi.reducerPath]: evalApi.reducer,
  },
  middleware: (getDefault) =>
    getDefault().concat(evalApi.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
```

### 9.3 Notebook Slice

Manages the cells in the current notebook — their code, status, and output.

```typescript
// packages/ui/src/store/notebookSlice.ts

import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";

interface Cell {
  id: string;
  inputIndex: number;        // The In[n] number
  code: string;
  status: "idle" | "evaluating" | "done" | "error";
  output: SerializedRichValue | null;
  error: string | null;
}

interface NotebookState {
  cells: Cell[];
  nextInputIndex: number;
  activeCellId: string | null;
}

const initialState: NotebookState = {
  cells: [],
  nextInputIndex: 1,
  activeCellId: null,
};

// Async thunk: evaluate code in the worker
export const evaluateCode = createAsyncThunk(
  "notebook/evaluate",
  async ({ cellId, code }: { cellId: string; code: string }, { getState }) => {
    const result = await worker.evaluate(code);
    return { cellId, result };
  }
);

const notebookSlice = createSlice({
  name: "notebook",
  initialState,
  reducers: {
    addCell(state) {
      const id = `cell-${Date.now()}`;
      state.cells.push({
        id,
        inputIndex: state.nextInputIndex++,
        code: "",
        status: "idle",
        output: null,
        error: null,
      });
      state.activeCellId = id;
    },
    updateCellCode(state, action: PayloadAction<{ id: string; code: string }>) {
      const cell = state.cells.find(c => c.id === action.payload.id);
      if (cell) cell.code = action.payload.code;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(evaluateCode.pending, (state, action) => {
        const cell = state.cells.find(c => c.id === action.meta.arg.cellId);
        if (cell) { cell.status = "evaluating"; cell.error = null; }
      })
      .addCase(evaluateCode.fulfilled, (state, action) => {
        const { cellId, result } = action.payload;
        const cell = state.cells.find(c => c.id === cellId);
        if (cell) {
          cell.status = result.type === "error" ? "error" : "done";
          cell.output = result.type === "error" ? null : result.value;
          cell.error = result.type === "error" ? result.error : null;
        }
      });
  },
});
```

### 9.4 History Slice

Stores the complete evaluation history — every `In[n]` / `Out[n]` pair. This enables the `%`, `%%`, `Out[n]`, and `history.find()` features.

```typescript
// packages/ui/src/store/historySlice.ts

interface HistoryEntry {
  inputIndex: number;
  code: string;
  timestamp: number;
  result: SerializedRichValue;
  resultType: string;  // The RichValue.type for quick filtering
}

interface HistoryState {
  entries: HistoryEntry[];
}

const historySlice = createSlice({
  name: "history",
  initialState: { entries: [] } as HistoryState,
  reducers: {
    addEntry(state, action: PayloadAction<HistoryEntry>) {
      state.entries.push(action.payload);
    },
    clearHistory(state) {
      state.entries = [];
    },
  },
});

// Selectors
const selectEntriesByType = (type: string) =>
  createSelector(
    (state: RootState) => state.history.entries,
    (entries) => entries.filter(e => e.resultType === type)
  );
```

### 9.5 RTK Query — Eval API

RTK Query manages the async communication with the Web Worker. While Web Workers use `postMessage` (not HTTP), we can model the eval API as an RTK Query "base query" with a custom query function.

```typescript
// packages/ui/src/store/evalApi.ts

import { createApi, fakeBaseQuery } from "@reduxjs/toolkit/query/react";

export const evalApi = createApi({
  reducerPath: "evalApi",
  baseQuery: fakeBaseQuery(),
  endpoints: (builder) => ({
    evaluate: builder.mutation<WorkerResponse, { code: string }>({
      queryFn: async ({ code }, { dispatch }) => {
        try {
          const result = await workerManager.evaluate(code);
          // Also add to history
          dispatch(addEntry({
            inputIndex: result.id,
            code,
            timestamp: Date.now(),
            result: result.value,
            resultType: result.value?.type ?? "unknown",
          }));
          return { data: result };
        } catch (err) {
          return { error: { error: String(err), data: undefined } };
        }
      },
    }),
    importPackage: builder.mutation<{ success: boolean }, { name: string; version: string }>({
      queryFn: async ({ name, version }) => {
        const result = await workerManager.importPackage(name, version);
        return { data: result };
      },
    }),
  }),
});
```

---

## 10. Persistence Layer

### 10.1 Notebook Storage

Notebooks are saved to **IndexedDB** via a thin wrapper. Each notebook is a record containing:

- Metadata (name, created, modified, tags)
- Cell data (code, output snapshots)
- History entries

```typescript
// packages/persistence/src/notebook-store.ts

const DB_NAME = "wolframjs-repl";
const DB_VERSION = 1;
const NOTEBOOKS_STORE = "notebooks";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(NOTEBOOKS_STORE)) {
        db.createObjectStore(NOTEBOOKS_STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveNotebook(notebook: NotebookData): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(NOTEBOOKS_STORE, "readwrite");
  const store = tx.objectStore(NOTEBOOKS_STORE);
  store.put({ id: notebook.id, ...notebook, modified: Date.now() });
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadNotebook(id: string): Promise<NotebookData | null> {
  const db = await openDB();
  const tx = db.transaction(NOTEBOOKS_STORE, "readonly");
  const store = tx.objectStore(NOTEBOOKS_STORE);
  const request = store.get(id);
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error);
  });
}
```

### 10.2 Package Cache

When the user imports an npm package in the REPL (e.g., `import lodash from "lodash"`), we need to fetch, cache, and serve it. We use **esm.sh** as a CDN that provides ES module versions of npm packages, and cache the responses in the **Cache API** (service worker cache).

```typescript
// packages/eval/src/package-loader.ts

async function loadPackage(name: string, version: string): Promise<string> {
  const url = `https://esm.sh/${name}@${version}`;
  const cache = await caches.open("repl-packages");

  // Check cache first
  const cached = await cache.match(url);
  if (cached) return await cached.text();

  // Fetch from esm.sh
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to load ${name}@${version}`);

  // Cache for future use
  await cache.put(url, response.clone());
  return await response.text();
}
```

---

## 11. Project Structure — File Layout

```
wolframjs-repl/
├── index.html                          # Vite entry
├── vite.config.ts                      # Vite configuration
├── tailwind.config.ts                  # Tailwind configuration
├── tsconfig.json                       # TypeScript configuration
├── package.json                        # Dependencies
│
├── packages/
│   ├── core/                           # Core abstractions (RichValue protocol)
│   │   ├── src/
│   │   │   ├── protocol.ts             # RichValue, View, Operation interfaces
│   │   │   ├── js-value.ts            # Default JSValue wrapper
│   │   │   ├── serialization.ts       # Serialize/deserialize for worker boundary
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── symbolic/                       # Symbolic expression engine
│   │   ├── src/
│   │   │   ├── expr.ts                 # Expr class (implements RichValue)
│   │   │   ├── template.ts            # expr`` tagged template parser
│   │   │   ├── operations.ts          # factor, simplify, diff, solve, etc.
│   │   │   ├── mathjs-bridge.ts       # Wrapper around math.js
│   │   │   ├── latexify.ts           # Expr -> LaTeX conversion
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── dataset/                        # Dataset engine
│   │   ├── src/
│   │   │   ├── dataset.ts             # Dataset class (implements RichValue)
│   │   │   ├── columnar.ts            # Column-oriented storage
│   │   │   ├── operations.ts          # groupBy, filter, sort, etc.
│   │   │   ├── schema.ts             # Type inference for columns
│   │   │   ├── csv-parser.ts         # CSV import
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── viz/                             # Visualization engine
│   │   ├── src/
│   │   │   ├── plot.ts                # Plot class (implements RichValue)
│   │   │   ├── auto-viz.ts           # Auto-visualization logic
│   │   │   ├── vega-specs.ts         # Vega-Lite spec builders
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── pattern/                        # Pattern matching and rewrite engine
│   │   ├── src/
│   │   │   ├── rule.ts               # Rule class, rule`` tagged template
│   │   │   ├── match.ts              # Pattern matching algorithm
│   │   │   ├── rewrite.ts            # Rule application (fixpoint rewriting)
│   │   │   ├── js-ast.ts             # JS AST pattern matching
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── quantity/                        # Units and quantities
│   │   ├── src/
│   │   │   ├── quantity.ts            # Quantity class (implements RichValue)
│   │   │   ├── units.ts              # Unit definitions and conversions
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── eval/                            # Evaluation layer
│   │   ├── src/
│   │   │   ├── worker.ts             # Web Worker entry point
│   │   │   ├── evaluator.ts          # Code evaluation and result wrapping
│   │   │   ├── globals.ts            # REPL globals (expr, rule, dataset, etc.)
│   │   │   ├── package-loader.ts     # npm package import via esm.sh
│   │   │   ├── serialize.ts          # RichValue serialization
│   │   │   └── worker-protocol.ts    # Message types
│   │   └── package.json
│   │
│   ├── persistence/                    # Persistence layer
│   │   ├── src/
│   │   │   ├── notebook-store.ts     # IndexedDB notebook storage
│   │   │   ├── history-store.ts      # IndexedDB history storage
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   └── ui/                             # React UI
│       ├── src/
│       │   ├── App.tsx                # Root component
│       │   ├── main.tsx              # Vite entry
│       │   ├── store/
│       │   │   ├── store.ts          # Redux store configuration
│       │   │   ├── notebookSlice.ts  # Notebook state management
│       │   │   ├── historySlice.ts   # History state management
│       │   │   ├── configSlice.ts    # User preferences
│       │   │   ├── evalApi.ts        # RTK Query eval API
│       │   │   └── hooks.ts          # Typed Redux hooks
│       │   ├── components/
│       │   │   ├── Notebook.tsx       # Notebook container
│       │   │   ├── CellList.tsx       # Cell list
│       │   │   ├── Cell.tsx          # Single cell (input + output)
│       │   │   ├── CellInput.tsx     # CodeMirror editor
│       │   │   ├── CellOutput.tsx    # Result display
│       │   │   ├── RichValueRenderer.tsx  # Value renderer with view switcher
│       │   │   ├── ViewSwitcher.tsx  # Tab bar for view selection
│       │   │   └── NewCellPrompt.tsx # Add cell button
│       │   ├── renderers/
│       │   │   ├── MathView.tsx      # Pretty math display
│       │   │   ├── LatexView.tsx     # KaTeX rendering
│       │   │   ├── TableView.tsx     # Dataset table view
│       │   │   ├── ChartView.tsx     # Vega-Lite chart rendering
│       │   │   ├── TreeView.tsx      # Expression tree visualization
│       │   │   ├── JsonView.tsx      # JSON inspection view
│       │   │   ├── TextView.tsx     # Plain text view
│       │   │   └── FallbackView.tsx  # Fallback for unknown view types
│       │   └── styles/
│       │       ├── globals.css       # Tailwind base + custom properties
│       │       └── theme.css         # CSS custom properties for theming
│       └── package.json
│
├── public/
│   └── fonts/                          # STIX Two Math, Latin Modern Math
│
└── scripts/
    └── seed-vocabulary.js             # Vocabulary seed for REPL functions
```

---

## 12. Tailwind Configuration — Design System

```typescript
// tailwind.config.ts

import type { Config } from "tailwindcss";

export default {
  content: ["./packages/ui/src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Mathematica-inspired palette
        "repl-bg": "#FAFAFA",
        "repl-fg": "#1A1A1A",
        "repl-muted": "#8B8B8B",
        "repl-accent": "#4A90D9",
        "repl-border": "#E5E5E5",
        "repl-error": "#D94452",
        "repl-evaluating": "#F5A623",
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', "Menlo", "monospace"],
        math: ['"STIX Two Math"', '"Latin Modern Math"', "serif"],
        sans: ['"Inter"', "system-ui", "sans-serif"],
      },
      spacing: {
        cell: "2rem",         // Padding around each cell
        "cell-gap": "0.5rem", // Gap between cells
      },
      maxWidth: {
        notebook: "960px",   // Max width of the notebook content
      },
    },
  },
  plugins: [],
} satisfies Config;
```

### 12.1 CSS Custom Properties for Theming

```css
/* packages/ui/src/styles/theme.css */

:root {
  --repl-bg: theme("colors.repl-bg");
  --repl-fg: theme("colors.repl-fg");
  --repl-muted: theme("colors.repl-muted");
  --repl-accent: theme("colors.repl-accent");
  --repl-border: theme("colors.repl-border");
  --repl-error: theme("colors.repl-error");
  --repl-evaluating: theme("colors.repl-evaluating");

  --cell-padding: theme("spacing.cell");
  --notebook-max-width: theme("maxWidth.notebook");

  --font-mono: theme("fontFamily.mono");
  --font-math: theme("fontFamily.math");
  --font-sans: theme("fontFamily.sans");
}

/* Dark mode (user preference) */
@media (prefers-color-scheme: dark) {
  :root {
    --repl-bg: #1A1A1A;
    --repl-fg: #E5E5E5;
    --repl-muted: #6B6B6B;
    --repl-accent: #5BA3E6;
    --repl-border: #333333;
  }
}
```

---

## 13. Vite Configuration

```typescript
// vite.config.ts

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  worker: {
    format: "es",
  },
  build: {
    target: "esnext",
    rollupOptions: {
      input: {
        main: "./index.html",
        worker: "./packages/eval/src/worker.ts",
      },
    },
  },
  optimizeDeps: {
    include: ["react", "react-dom", "@reduxjs/toolkit", "mathjs", "katex", "vega-lite"],
  },
});
```

---

## 14. Tagged Template Literals — The REPL DSL

The REPL extends JS with domain-specific syntax via tagged template literals. These are standard JS — any JS parser can handle them. The tags are functions registered in the evaluation scope.

### 14.1 The Tag Functions

```typescript
// packages/eval/src/globals.ts

/**
 * These functions are injected into the worker's global scope
 * before user code runs. They are available as unqualified names.
 */
const replGlobals = {
  /** Parse a symbolic math expression */
  expr: (strings: TemplateStringsArray, ...values: unknown[]) => {
    const raw = strings.raw.join("");
    return parseMathNotation(raw);  // Returns Expr
  },

  /** Parse a rewrite rule */
  rule: (strings: TemplateStringsArray, ...values: unknown[]) => {
    const raw = strings.raw.join("");
    const [patternStr, replacementStr] = raw.split("->");
    return {
      pattern: parsePattern(patternStr.trim()),
      replacement: parseMathNotation(replacementStr.trim()),
    };
  },

  /** Parse a JS AST expression for pattern matching */
  js: (strings: TemplateStringsArray, ...values: unknown[]) => {
    const raw = strings.raw.join("");
    return parseJSAST(raw);  // Returns JSASTExpr implementing RichValue
  },

  /** Create a physical quantity */
  unit: (strings: TemplateStringsArray, ...values: unknown[]) => {
    const raw = strings.raw.join("");
    return parseQuantity(raw);  // Returns Quantity
  },

  /** Parse an inline dataset */
  data: (strings: TemplateStringsArray, ...values: unknown[]) => {
    const raw = strings.raw.join("");
    return parseInlineData(raw);  // Returns Dataset
  },

  /** Parse a structured query */
  query: (strings: TemplateStringsArray, ...values: unknown[]) => {
    const raw = strings.raw.join("");
    return parseQuery(raw);  // Returns QueryBuilder
  },

  /** Operations on the last result */
  "%": null as RichValue | null,  // Set after each evaluation

  /** Reference a numbered output */
  out: new Proxy({}, {
    get: (_, index) => history.get(Number(index)),
  }),

  /** Create an interactive manipulation */
  manipulate: (controls: Record<string, Control>, render: (params: Record<string, number>) => RichValue) => {
    return new InteractiveWidget(controls, render);
  },

  /** Watch an async source */
  watch: (source: () => Promise<unknown>, render: (data: unknown) => RichValue) => {
    return new StreamWatch(source, render);
  },

  /** Explain a result */
  explain: (value: RichValue) => value.explain?.() ?? "No explanation available.",

  /** Set assumptions for symbolic operations */
  assuming: (assumptions: Record<string, string>, body: () => RichValue) => {
    withAssumptions(assumptions, body);
  },
};
```

### 14.2 Syntax Summary

| Tag | Purpose | Example | Result Type |
|-----|---------|---------|-------------|
| `expr` | Symbolic math | `expr\`x^2 + 1\`` | `Expr` |
| `rule` | Rewrite rule | `rule\`a_ + 0 -> a\`` | `Rule` |
| `js` | JS AST | `js\`xs.map(f)\`` | `JSASTExpr` |
| `unit` | Physical quantity | `unit\`10 km\`` | `Quantity` |
| `data` | Inline data | `data\`x,y 1,2\`` | `Dataset` |
| `query` | Structured query | `query\`from t select x\`` | `QueryBuilder` |

---

## 15. Implementation Phases

### Phase 1: Foundation (Week 1-2)

**Goal:** A working REPL that evaluates JS code and displays rich output. No symbolic math yet.

1. Set up Vite + React + Tailwind + Redux Toolkit project
2. Implement the `RichValue` protocol and `JSValue` default wrapper
3. Build the Web Worker evaluator (evaluate code, wrap results, serialize)
4. Build the core UI: `Notebook`, `Cell`, `CellInput` (CodeMirror), `CellOutput`
5. Build `RichValueRenderer` with `TextView` and `JsonView`
6. Wire Redux state: add cells, evaluate code, display results
7. Implement history store with `%` and `Out[n]` references
8. Add `In[n]:=` / `Out[n]=` labels and cell styling

**Validation:** At the end of Phase 1, you should be able to type `[1,2,3].map(x => x*2)` in the REPL and see a nicely rendered JSON view of the result, with proper cell labels and a working history.

### Phase 2: Dataset Engine (Week 3-4)

**Goal:** Data loading, manipulation, and table visualization.

1. Implement the `Dataset` class with core operations (filter, groupBy, sort, select)
2. Build `TableView` renderer
3. Add CSV and JSON data loading (`csv()` and `json()` globals)
4. Implement `Dataset.summary()` and `Dataset.inferSchema()`
5. Add the `SchemaView` and `SummaryView` renderers
6. Implement `explain()` for Dataset operations
7. Add `toSQL()` export

**Validation:** At the end of Phase 2, you should be able to load a CSV, group it, and see a table with the results.

### Phase 3: Visualization (Week 5-6)

**Goal:** Charts and auto-visualization.

1. Integrate Vega-Lite and `react-vega`
2. Build `ChartView` renderer
3. Add chart shortcuts to `Dataset` (`barChart()`, `lineChart()`, `histogram()`, `scatter()`)
4. Implement `autoViz()` — pick a chart based on data shape
5. Build `Plot` class implementing `RichValue`
6. Add interactive tooltips and zoom to charts
7. Implement `manipulate()` with live sliders

**Validation:** At the end of Phase 3, you should be able to call `data.barChart("revenue")` and see a bar chart inline in the REPL, and `manipulate({a: slider(-5,5)}, ({a}) => plot(x => a*x, [-10,10]))` should show a live slider + plot.

### Phase 4: Symbolic Math (Week 7-8)

**Goal:** Symbolic expressions and operations.

1. Integrate `math.js` as the CAS backend
2. Implement `expr\`\`` tagged template parser
3. Build `Expr` class implementing `RichValue`
4. Build `MathView` and `LatexView` renderers (KaTeX)
5. Build `TreeView` renderer for expression trees
6. Implement `factor()`, `expand()`, `simplify()`
7. Implement `diff()`, `integrate()`, `solve()`
8. Implement `fullForm()` and `inputForm()`
9. Add `assuming()` for scoped assumptions

**Validation:** At the end of Phase 4, you should be able to type `factor(expr\`x^4 - 1\`)` and see `(x-1)(x+1)(x²+1)` rendered in beautiful math notation, with view switching to LaTeX, Full Form, and Tree.

### Phase 5: Pattern Matching and Units (Week 9-10)

**Goal:** Rewrite rules and physical quantities.

1. Implement the pattern matching algorithm
2. Build the `rule\`\`` tagged template parser
3. Implement `rewrite()` with fixpoint iteration
4. Add JS AST pattern matching (`js\`\`` tag)
5. Implement `Quantity` class with unit arithmetic
6. Implement `unit\`\`` tagged template parser
7. Build unit conversion table (SI base + common derived units)
8. Add `Quantity` views

**Validation:** `rewrite(expr\`sin(x)^2 + cos(x)^2\`, [rule\`sin(a_)^2 + cos(a_)^2 -> 1\`])` should return `1`. `quantity(10, "km") / quantity(45, "min")` should return `13.333 km/h`.

### Phase 6: Polish and Persistence (Week 11-12)

**Goal:** Notebook saving, package import, and design polish.

1. Implement IndexedDB notebook storage
2. Implement notebook load/save UI
3. Implement npm package import via esm.sh
4. Polish all CSS — ensure the Mathematica aesthetic is consistent
5. Add keyboard shortcuts (run cell, new cell, navigate cells)
6. Add export (notebook to markdown, to HTML)
7. Performance profiling and optimization
8. Write documentation and examples

---

## 16. Testing Strategy

### 16.1 Unit Tests

Every domain engine has unit tests:

```bash
packages/symbolic/src/__tests__/expr.test.ts      # Expr parsing, operations
packages/dataset/src/__tests__/dataset.test.ts     # Dataset operations
packages/viz/src/__tests__/auto-viz.test.ts        # Auto-visualization logic
packages/pattern/src/__tests__/match.test.ts       # Pattern matching
packages/pattern/src/__tests__/rewrite.test.ts     # Rule rewriting
packages/quantity/src/__tests__/quantity.test.ts   # Unit arithmetic, conversion
```

### 16.2 Integration Tests

Test the full pipeline: user code → evaluation → RichValue → serialization → rendering.

```bash
packages/eval/src/__tests__/evaluator.test.ts      # End-to-end eval
packages/ui/src/__tests__/cell.test.tsx            # Cell component with mocked worker
```

### 16.3 Visual Regression Tests

Use Playwright to screenshot cells with different output types and compare against baselines. This catches unintended styling changes.

### 16.4 Property-Based Tests

For the symbolic engine and pattern matcher, use **fast-check** (`fast-check` on npm) to generate random expressions and verify invariants:

- `simplify(expr) = simplify(simplify(expr))` (idempotence)
- `factor(expand(expr)) = expr` (round-trip for polynomials)
- Pattern matching always terminates (bounded iterations)

---

## 17. Key Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `react` | 19.x | UI framework |
| `react-dom` | 19.x | DOM rendering |
| `@reduxjs/toolkit` | 2.x | State management + RTK Query |
| `react-vega` | 7.x | Vega-Lite React integration |
| `vega-lite` | 5.x | Declarative chart specification |
| `mathjs` | 13.x | Symbolic math backend |
| `katex` | 0.16.x | LaTeX math rendering |
| `@codemirror/view` | 6.x | Code editor |
| `@codemirror/state` | 6.x | Editor state management |
| `@codemirror/lang-javascript` | 6.x | JS syntax highlighting |
| `tailwindcss` | 4.x | Utility-first CSS |
| `vite` | 6.x | Build tool and dev server |
| `typescript` | 5.x | Type system |
| `vitest` | 3.x | Test runner |
| `fast-check` | 3.x | Property-based testing |
| `playwright` | 1.x | Visual regression tests |
| `idb` | 8.x | IndexedDB wrapper (lightweight) |

---

## 18. Risks and Alternatives

### 18.1 Risks

1. **Serialization complexity:** RichValue objects with functions cannot cross the worker boundary. Pre-computing all view data on the worker side increases evaluation latency for results with many views. **Mitigation:** lazy view computation — only compute a view when the user selects it.

2. **CAS completeness:** math.js is not Mathematica. It lacks many advanced symbolic operations (definite integration, differential equations, assumption-driven simplification). **Mitigation:** scope the MVP clearly. Phase 4 targets polynomial manipulation and basic calculus, not the full CAS.

3. **Performance with large datasets:** Columnar JS operations on 10M+ rows will be slow. **Mitigation:** Arrow JS + WebAssembly for hot paths, or push computation to a server.

4. **CodeMirror 6 learning curve:** CM6 has a steep learning curve for custom extensions. **Mitigation:** start with the basic setup and add features incrementally. The `@codemirror/basic-setup` package covers 90% of needs.

5. **Design consistency:** The Mathematica aesthetic is hard to nail. Without a dedicated designer, the UI may drift toward "generic React app." **Mitigation:** create a Figma mockup before implementation. Define the design tokens (colors, spacing, typography) in Tailwind config and enforce them. Regular visual reviews.

### 18.2 Alternatives Considered

1. **Observable-style reactive cells** instead of sequential cells. Observable (observablehq.com) uses reactive dataflow where a cell's value updates when its dependencies change. This is powerful but more complex. **Decision:** start with sequential Mathematica-style cells. Reactive cells can be added later as a cell mode.

2. **Jupyter-style kernel protocol** with a backend server. **Decision:** pure client-side for the MVP. A backend kernel can be added later for heavy computation.

3. **Svelte instead of React.** Svelte has less overhead and simpler reactivity. **Decision:** the team knows React and RTK Query. The React ecosystem has richer charting libraries. We can revisit if bundle size becomes a concern.

4. **D3.js instead of Vega-Lite.** D3 is more flexible but lower-level. Vega-Lite gives us declarative chart specs for free. **Decision:** Vega-Lite for standard charts, D3 only if we need custom visualizations that Vega-Lite cannot express.

---

## 19. Open Questions

1. **How to handle async results (Promises, streams)?** The current design serializes the final resolved value. Should we show intermediate states? A `Promise` could render as `Pending...` → `Resolved: value` with an animation.

2. **Should the REPL support multi-statement cells?** Mathematica evaluates one expression per cell. JS often needs multiple statements. **Proposal:** allow multi-statement cells where the last expression's value is the result.

3. **How to handle side effects (console.log, DOM manipulation)?** The worker has no DOM. `console.log` can be intercepted and displayed as `DisplayValue` events. But what about `document.getElementById`? **Proposal:** error on DOM access in the worker, provide a separate "browser mode" that runs in the main thread (no isolation).

4. **How to implement `watch()` for live data?** `watch()` sets up an interval that fetches data and re-renders. This needs careful lifecycle management in React. **Proposal:** use RTK Query's polling feature with `pollingInterval`.

5. **Should we support Mathematica-style `//` postfix function application?** E.g., `x^2 + 1 // Factor`. This is not valid JS. **Proposal:** no — we use pipe operator (`|>`) which is a JS Stage 2 proposal, or chain methods.

---

## 20. References

### Source Material

- `/tmp/repl.md` — Original vision document describing the WolframJS REPL concept (imported into ticket as `sources/local/repl.md`)

### Technology Documentation

- [Wolfram Language Documentation](https://reference.wolfram.com/language/) — The canonical reference for Mathematica's symbolic expression model, pattern matching, and display forms
- [math.js Documentation](https://mathjs.org/docs/) — Expression parser, algebra, and symbolic operations
- [Vega-Lite Documentation](https://vega.github.io/vega-lite/) — Declarative visualization grammar
- [KaTeX Documentation](https://katex.org/) — Fast LaTeX math rendering for the web
- [CodeMirror 6 Documentation](https://codemirror.net/docs/guide/) — Code editor framework
- [Redux Toolkit Documentation](https://redux-toolkit.js.org/) — State management with RTK Query
- [RTK Query Overview](https://redux-toolkit.js.org/rtk-query/overview) — Data fetching and caching
- [Web Workers API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API) — MDN reference for worker threads
- [IndexedDB API](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API) — Client-side structured storage
- [esm.sh](https://esm.sh/) — ES module CDN for npm packages

### Inspirations

- [Observable](https://observablehq.com/) — Reactive notebook-style JS REPL
- [Jupyter](https://jupyter.org/) — Multi-language notebook system
- [Wolfram Alpha](https://www.wolframalpha.com/) — Natural language computational knowledge engine
- [Mathics](https://mathics.org/) — Open-source Mathematica implementation in Python

---

*This document is the primary design reference for JSREPL-001. It should be read before writing any implementation code. All architectural decisions documented here are binding unless superseded by a later design document.*
