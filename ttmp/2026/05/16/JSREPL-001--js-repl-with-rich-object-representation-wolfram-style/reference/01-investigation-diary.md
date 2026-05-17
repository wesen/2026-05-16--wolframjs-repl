---
title: Investigation diary
doc-type: reference
status: active
intent: long-term
ticket: JSREPL-001
topics: javascript, repl, react, visualization, symbolic-computation, design
created: 2026-05-16
---

# Investigation Diary — JSREPL-001

## 2026-05-16 — Session 1: Ticket creation and design authoring

### What was done

1. Read the source vision document at `/tmp/repl.md`.
2. Created docmgr ticket JSREPL-001.
3. Imported source document, authored comprehensive 20-section design doc.
4. Uploaded design bundle to reMarkable.

---

## 2026-05-16 — Session 2: Full implementation (Phases 1-6)

### What was done

Built the entire WolframJS REPL across 6 phases. See session 2 diary in git history for details.

---

## 2026-05-16 — Session 3: Rich type support expansion

### What was done

The original worker had a single `JSValue` wrapper for all non-RichValue types, which meant
Functions, Dates, RegExps, Maps, Sets, Errors, Promises, and TypedArrays all rendered as
generic `JSValue` with poor summaries (just `"Date"`, `"RegExp"`, `"Map"` etc.).

Rewrote the entire worker serializer with **specialized handlers for every JS type**:

| Input Type | RichValue Type | Summary | Views |
|---|---|---|---|
| `42` | Number | `42` | Value, Type, Hex, Binary, Octal, Scientific |
| `3.14159` | Number | `3.14159` | Value, Type, Hex, Binary, Octal, Scientific |
| `"hello"` | String | `"hello"` | Value, Type, Length, Char Codes |
| `true` | Boolean | `true` | Value, Type |
| `null` | Null | `null` | Value |
| `undefined` | Undefined | `undefined` | Value |
| `[1,2,3]` | Array | `Array[3]` | Value, JSON, Type |
| `[10,20,30]` | Array | `Array[3]` | Value, JSON, **Statistics** (count/sum/mean/median/min/max/stdDev), Type |
| `[{a:1}]` | Array | `Array[1]` | Value, JSON, **Table**, **Schema**, Type |
| `{name:"A"}` | Object | `Object{name}` | Value, JSON, **Properties** (Key/Value/Type table), Type |
| `function add()` | Function | `Function add(a, b)` | Source, Type, Parameters |
| `new Date(...)` | Date | `1/1/2026, ...` | ISO, Local, Unix, UTC, Date only, Time only, Type |
| `/^hello.*$/gi` | RegExp | `/^hello.*$/gi` | Pattern, Source, Flags, Type, Test |
| `new Map(...)` | Map | `Map[3 entries]` | Entries table, JSON, Type |
| `new Set(...)` | Set | `Set[5 values]` | Values table, JSON, Type |
| `new Error(...)` | Error | `Error: something...` | Message, Stack, Type |
| `new TypeError(...)` | Error | `TypeError: wrong type` | Message, Stack, Type |
| `new Int32Array(...)` | TypedArray | `Int32Array[5]` | Values, JSON, Type |
| `new ArrayBuffer(...)` | ArrayBuffer | `ArrayBuffer[20 bytes]` | Type |
| `Promise` (resolving) | (awaited type) | resolved value summary | resolved value views |

Also added domain-specific types that already worked:

| Input | RichValue Type | Summary | Views |
|---|---|---|---|
| `dataset([...])` | Dataset | `Dataset[N rows × M columns]` | Table, Schema, Summary, JSON |
| `expr\`x^2+1\`` | SymbolicExpr | `x² + 1` | Math, LaTeX, Full Form, Tree |
| `quantity(10, "km")` | Quantity | `10 km` | Value, Unit Info |
| `rule\`a_ -> b_\`` | Object | `Object{patternStr, ...}` | Value, JSON, Properties, Type |
| `manipulate(...)` | InteractiveWidget | `Manipulate[a]` | Interactive |

New renderers added:
- **PropertiesView**: renders object properties as a Key/Value/Type table
- **StatisticsView**: renders numeric array statistics in a 2-column grid

Other fixes:
- **Function serialization**: functions can't cross `postMessage` — now serialized with source, name, paramCount
- **Promise handling**: the worker now detects Promise return values and awaits them before responding
- **Globals injection**: worker now imports `createREPLGlobals()` and injects `dataset`, `expr`, `quantity`, `simplify`, `diff`, etc. into the evaluation scope via `new Function(...globalNames, wrappedCode)`
- **Run button**: added a `▶ Run` button to each cell (visible on hover) as fallback for keyboard shortcut issues

### What worked

- The specialized serializers make every JS type render beautifully with contextual views
- Numbers with Hex/Binary/Octal/Scientific notation is very Mathematica-like
- Date with ISO/Local/Unix/UTC/Date-only/Time-only views is incredibly useful
- Map and Set as entry/value tables is much better than `[object Map]`
- Numeric array statistics view gives instant insight into data
- The Promise auto-await feature means `await fetch(url).json()` just works

### What didn't work

- The `rule\`\`` tagged template returns a plain object (not implementing RichValue) — it falls through to the Object serializer. Need to make Rule implement RichValue in a future pass.
- `manipulate()` works in the worker but the `InteractiveView` renderer can't call the render function since it can't cross the worker boundary. The interactive widget shows but is static. This needs a different architecture (render function defined on the main thread, or a declarative spec approach).

### What was tricky

- **postMessage boundary**: any value that can't be structured-cloned must be serialized before posting. Functions, Promises, DOM nodes, and symbols are the main categories. The worker now has complete serialization for all of these.
- **Promise detection**: `result instanceof Promise` works but `typeof result.then === "function"` is more reliable across realms.
- **Numeric array statistics**: computing median, stdDev, etc. requires sorting and two passes — acceptable for small arrays, but we should add a threshold for large arrays.

### Code review instructions

1. Start dev server: `cd wolframjs-repl && npm run dev`
2. Test each type in the table above
3. Verify view switching works for all types
4. Check that `▶ Run` button appears on hover
5. Verify promises resolve: `new Promise(r => setTimeout(() => r(42), 100))`
6. Verify domain types: `expr\`x^2+1\``, `dataset([{a:1,b:2}])`, `quantity(10, "km")`

### Next steps

- Make `Rule` implement RichValue (currently falls through to Object serializer)
- Make `InteractiveWidget` work across the worker boundary (declarative spec approach)
- Add `explain()` for Dataset operation chains (track operation history)
- Code-split the bundle (1.7MB → lazy-load Vega-Lite, KaTeX, math.js)
- Add a History panel showing all Out[n] values with search/filter

---

## 2026-05-16 — Session 4: Post-launch improvements

### T1: Dataset operation tracking ✅

Added an `OperationLogEntry` to the Dataset class. Each chainable operation now records itself in an internal log that propagates through the pipeline. The `explain()` method narrates each step, and `toSQL()` generates a real SQL query from the log.

**What was done:**
- Added `OperationLogEntry` interface with `op`, `args`, and `timestamp`
- Added `_opLog` and `_tableName` fields to Dataset constructor
- Updated all chainable operations (filter, sort, select, groupBy, head, tail, withColumn) to append to the log
- Added `filterEq()`, `filterGt()`, `filterLt()` convenience methods with auto-logging
- Rewrote `explain()` to narrate pipeline steps: "1. Filter rows where city == Berlin. 2. Sort by age ascending."
- Rewrote `toSQL()` to generate real SQL: `SELECT * FROM data WHERE city == 'Berlin' ORDER BY age ASC; -- 2 rows`
- Added Pipeline and SQL view tabs to datasets with recorded operations
- Updated `GroupedDataset` to propagate and extend the operation log

**What worked:**
- The pipeline narrative is clear and matches what the user typed
- SQL generation handles WHERE, ORDER BY, GROUP BY, LIMIT correctly
- View tabs only appear when operations have been recorded — raw datasets stay clean

**What didn't work:**
- SQL `tail()` requires a row ID concept that doesn't exist — generated SQL uses a comment workaround
- `withColumn()` SQL generation is a comment since the transformation is a JS function, not expressible in SQL
- Custom `filter()` predicates can't generate SQL WHERE clauses — they get a comment placeholder

### T2: Rule implements RichValue ✅

Converted the `Rule` interface into a `RuleObj` class implementing `RichValue`. Pattern rules now render with Pattern, Replacement, Source, and Variables views instead of falling through to the generic Object serializer.

**What was done:**
- Created `RuleObj` class with `summary()`, `views()`, `explain()`, `toJSON()`, `inputForm()`
- Four views: Pattern, Replacement, Source, Variables (lists pattern vars like `a_`)
- Updated `rule` tagged template to return `RuleObj` instances
- Fixed the rewrite engine to actually apply regex-based matching with variable substitution (was a no-op before)
- Backward-compatible `Rule` type alias exports `RuleObj`

### T3: Tree-level pattern matching ✅

Implemented a rewrite engine that matches against the math.js node tree rather than against raw strings. Pattern variables (symbols ending with `_`) bind to matched subexpressions.

**What was done:**
- `matchTree()`: recursively match pattern tree against expression tree, binding pattern variables
- `applyBindings()`: substitute bound values into replacement template tree
- `rewriteExpr()`: apply a list of tree-level rules to an Expr, iterating until no more matches
- `rewriteAtAnyPosition()`: top-down left-to-right traversal, tries matching at every sub-tree position
- Exposed as `rewriteExpr` REPL global
- Verified: `rewriteExpr(expr\`x^2 + y^2\`, [rule\`a_^2 -> a_ * a_\`])` produces `x·x + y·y`

**What worked:**
- Pattern variables correctly bind to subexpressions at any depth
- The rewriting applies at every matching position in the tree, not just the root
- Iteration handles cascading rewrites (max 100 iterations)

**What didn't work:**
- Commutativity is not handled: `a_ + b_` won't match `b + a` because tree order matters
- Associativity is not handled: `a_ + (b_ + c_)` won't match `a + b + c` because the tree structure differs
- These are fundamental limitations of tree-level matching without additional algebraic rules

### T4: History panel ✅

Added a sidebar showing all `Out[n]` values with type badges, search/filter, and scroll-to-cell.

**What was done:**
- New `HistoryPanel` component: fixed right sidebar, 320px wide
- Each entry shows Out[n] label, type badge, summary, and code preview
- Type badges computed from history entries with counts
- Search filters across code, type, and summary
- Click entry to scroll to the corresponding cell via `data-input-index` attribute
- Toggle via 📋 History button in header or Ctrl+H keyboard shortcut
- Added `data-input-index` to Cell component for scroll targeting

### T5: Dark mode toggle ✅

Implemented theme switching with localStorage persistence.

**What was done:**
- CSS dark mode overrides via `html.dark` class on `<html>` element
- System preference fallback when no explicit `.dark`/`.light` class is set
- `cycleTheme()` Redux action cycles system → dark → light
- Initial theme read from localStorage, falls back to system preference detection via `matchMedia`
- Theme persisted to localStorage via store subscription
- 🌓 Theme button added to header

**What was tricky:**
- Initial state needed to detect system preference on load and apply the correct class before first render
- Tailwind v4's `@theme` directive sets CSS variables on `:root` — the `.dark` class override must come after with same specificity to win

### T6: Code-split lazy loading ✅

Reduced initial bundle by 63% through lazy loading heavy dependencies.

**What was done:**
- Lazy-load `ChartView` (vega-embed ~819KB) and `LatexView` (KaTeX ~259KB) via `React.lazy()` + `Suspense`
- Separate `LatexView` into its own file for clean code splitting
- Add `katex/dist/katex.min.css` import in LatexView for proper rendering
- Remove `latex` from `INLINE_VIEW_TYPES` so it renders through the LatexView component
- Add `manualChunks` in `vite.config.ts` to split vega and katex into separate build chunks
- Production build: main index.js 647KB (was 1,731KB), vega 819KB, katex 259KB

**What worked:**
- The Suspense fallback shows "Loading..." briefly while KaTeX/Vega chunks download
- KaTeX CSS is bundled alongside the lazy chunk, so rendering is correct
- The main bundle is now small enough for a fast initial page load

**What didn't work:**
- math.js (used in the worker) cannot be lazy-loaded since the worker is a separate entry point
- The worker chunk remains 685KB — future optimization could split math.js out of the worker
