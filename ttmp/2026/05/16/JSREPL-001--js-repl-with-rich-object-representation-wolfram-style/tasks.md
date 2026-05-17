# Tasks

## TODO

- [x] Add tasks here

- [x] Write comprehensive design document for JS REPL with rich object representation
- [x] Upload design bundle to reMarkable
- [x] P1.1: Scaffold Vite + React + Tailwind + RTK project
- [x] P1.2: Implement RichValue protocol and JSValue wrapper (packages/core)
- [x] P1.3: Build Web Worker evaluator with serialization (packages/eval)
- [x] P1.4: Build core UI — Notebook, Cell, CellInput (CodeMirror), CellOutput
- [x] P1.5: Build RichValueRenderer with TextView and JsonView
- [x] P1.6: Wire Redux state — notebookSlice, historySlice, evalApi
- [x] P1.7: Implement history with % and Out[n] references
- [x] P1.8: Cell styling with In[n]/Out[n] labels, Mathematica aesthetic
- [x] P2.1: Implement Dataset class with core operations (packages/dataset)
- [x] P2.2: Build TableView renderer
- [x] P2.3: Add CSV and JSON data loading globals
- [x] P2.4: Dataset summary, schema inference, explain(), toSQL()
- [x] P3.1: Integrate Vega-Lite and react-vega, build ChartView
- [x] P3.2: Add chart shortcuts to Dataset, implement autoViz
- [x] P3.3: Implement manipulate() with live sliders
- [x] P4.1: Integrate math.js, implement expr tagged template (packages/symbolic)
- [x] P4.2: Build Expr class with RichValue, MathView, LatexView, TreeView
- [x] P4.3: Implement factor, expand, simplify, diff, solve
- [x] P5.1: Implement pattern matching and rewrite engine (packages/pattern)
- [x] P5.2: Implement Quantity class with unit arithmetic (packages/quantity)
- [x] P6.1: IndexedDB notebook persistence, polish, keyboard shortcuts

## Post-launch improvements

- [x] T1: Dataset operation tracking — track filter/groupBy/sort/select calls in an operation log, implement explain() to narrate the pipeline and toSQL() to emit a SQL query
- [x] T2: Rule implements RichValue — pattern rules render with Pattern/Replacement/Source/Variables views instead of falling through to the generic Object serializer
- [x] T3: Tree-level pattern matching — rewrite engine that matches against the math.js node tree, binds pattern variables to subexpressions, and applies replacements at the tree level
- [x] T4: History panel — sidebar showing all Out[n] values with type badges, search/filter by type, click to scroll to cell
- [x] T5: Dark mode toggle — implement theme switching using Tailwind dark: tokens, add toggle button in the header
- [x] T6: Code-split lazy loading — lazy-load Vega-Lite, KaTeX, and math.js per cell output to reduce initial bundle from 1.7 MB
