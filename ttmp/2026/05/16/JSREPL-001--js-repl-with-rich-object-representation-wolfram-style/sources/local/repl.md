---
title: REPL Vision Document
doc-type: source
status: active
intent: reference
ticket: JSREPL-001
topics: javascript, repl, symbolic-computation, visualization
created: 2026-05-16
---

The interesting version is not “JavaScript with Mathematica syntax.” It is a **JS-native computational REPL** where values are not just printed, but *understood*, transformed, visualized, inspected, and composed.

Call it something like **WolframJS REPL**.

At the core, every REPL result becomes a rich object:

```js
> factor(x**4 - 1)

(x - 1)(x + 1)(x² + 1)
```

But also:

```js
> %.fullForm()

Times[
  Plus[x, -1],
  Plus[x, 1],
  Plus[Power[x, 2], 1]
]
```

The REPL would treat JS values, symbolic expressions, plots, datasets, graphs, images, promises, streams, and UI widgets as first-class results.

---

## Core idea

A normal JS REPL evaluates code and prints strings.

This REPL would evaluate code into a **semantic result object**:

```ts
type Result =
  | JSValue
  | SymbolicExpr
  | Dataset
  | Plot
  | Graph
  | Image
  | Audio
  | Table
  | InteractiveWidget
  | Promise<Result>
  | Stream<Result>
```

So instead of:

```js
> fetch(url)
Promise { <pending> }
```

You could get:

```js
> await fetch(url).json() |> dataset

Interactive Dataset[1203 rows × 18 columns]
```

Then:

```js
> %.groupBy("country").mean("revenue").barChart()
```

---

## Mathematica-like ideas mapped to JS

### 1. Symbolic expressions

JS has expressions, but they vanish after evaluation. This REPL would preserve symbolic forms when requested.

```js
> expr`x^2 + 2x + 1`

x² + 2x + 1
```

```js
> factor(%)

(x + 1)²
```

```js
> solve(expr`x^2 + 2x + 1 == 0`, x)

x = -1
```

Use tagged templates to avoid fighting JS syntax:

```js
expr`sin(x)^2 + cos(x)^2`
```

instead of trying to make raw JS parse mathematical notation.

---

### 2. Pattern matching and rewrite rules

Wolfram Language is built around symbolic rewriting. JS could get a version of that:

```js
> expr`sin(x)^2 + cos(x)^2`
  .replace(rule`sin(a_)^2 + cos(a_)^2 -> 1`)

1
```

Or more JS-like:

```js
rewrite(expr, [
  rule`sin(a_)^2 + cos(a_)^2 -> 1`,
  rule`x_ + 0 -> x`,
  rule`x_ * 1 -> x`
])
```

For JS ASTs:

```js
> js`array.map(x => f(x))`
  .replace(rule`$xs.map($f) -> map($f, $xs)`)
```

That makes the REPL useful not only for math, but also **code transformation**.

---

### 3. Rich display

Every value could have multiple views:

```js
> data

Dataset[5000 rows × 12 columns]
```

Then:

```js
> %.view("table")
> %.view("schema")
> %.view("summary")
> %.view("histogram")
> %.view("json")
```

A graph object could render visually:

```js
> graph.shortestPath("Berlin", "Paris")

Berlin → Frankfurt → Paris
```

An image could display inline and expose operations:

```js
> image("cat.png").edges().components()
```

A function could show source, inferred types, performance profile, examples, and tests:

```js
> inspect(myFunction)

Function myFunction(a, b)
Source: available
Types observed:
  number, number -> number
  string, string -> string
Calls: 18,203
Mean runtime: 0.08 ms
```

---

### 4. Persistent `%` results, but richer

Mathematica has `%`, `%%`, etc. JS could have numbered semantic outputs:

```js
In[12]: data = await csv("sales.csv")
Out[12]: Dataset[10000 rows × 8 columns]

In[13]: data.groupBy("region").sum("revenue")
Out[13]: Dataset[5 rows × 2 columns]
```

Then:

```js
> out[13].plot.bar()
> diff(out[12], out[13])
> explain(out[13])
```

The REPL history becomes a queryable object:

```js
> history.find({ type: "Plot" })
> history.where(x => x.result instanceof Dataset)
```

---

### 5. Assumptions

Mathematica’s assumptions are powerful. A JS version could support scoped assumptions:

```js
> assuming({ x: positive, n: integer }, () =>
    simplify(expr`sqrt(x^2)`)
  )

x
```

Without assumptions:

```js
> simplify(expr`sqrt(x^2)`)

|x|
```

---

### 6. Units and quantities

```js
> quantity(10, "km") / quantity(45, "min")

13.333 km/h
```

```js
> %.to("mph")

8.285 mph
```

```js
> quantity(1, "cup").to("ml")
```

This should be built in, not delegated to random npm packages.

---

### 7. Interactive computation

Mathematica’s `Manipulate` is a killer feature. A JS REPL could expose:

```js
> manipulate(
    { a: slider(-5, 5), b: slider(-10, 10) },
    ({ a, b }) => plot(x => a * x + b, [-10, 10])
  )
```

Result: live sliders controlling a plot.

For async JS, this could become even more powerful:

```js
> watch(
    () => fetchJSON("/api/metrics"),
    data => data.plot.line("time", "latency")
  )
```

---

## What would make it feel truly Wolfram-like?

The REPL should understand that this:

```js
> data.groupBy("user").count().sortBy("count").last(10)
```

is not just an object chain. It is a **computational object** that can be explained, optimized, visualized, exported, or transformed.

So you could ask:

```js
> explain(%)

Grouped 10,482 rows by user.
Computed count per group.
Sorted ascending by count.
Selected final 10 rows.
```

Or:

```js
> %.toSQL()
```

```sql
SELECT user, COUNT(*) AS count
FROM data
GROUP BY user
ORDER BY count ASC
LIMIT 10
```

Or:

```js
> %.visualize()
```

And it chooses a reasonable chart.

---

## Possible syntax design

Keep JS as the host language.

Add a few REPL-native forms:

```js
expr`...`        // symbolic math expression
js`...`          // JavaScript AST expression
rule`...`        // rewrite rule
unit`...`        // physical quantity
data`...`        // inline dataset/table
query`...`       // structured query
```

Examples:

```js
> expr`D[x^3 + sin(x), x]`

3x² + cos(x)
```

```js
> js`for (let x of xs) ys.push(f(x))`
  .rewrite(rule`for (let $x of $xs) $ys.push($f($x)) -> const $ys = $xs.map($f)`)

const ys = xs.map(f)
```

```js
> query`
    from sales
    group by region
    select region, sum(revenue)
  `.run()
```

---

## Architecture sketch

The REPL would need several layers:

```txt
JS runtime
  ↓
Instrumented evaluator
  ↓
Semantic value protocol
  ↓
Rich display system
  ↓
Symbolic engine / CAS
  ↓
Dataset engine
  ↓
Visualization engine
  ↓
Rule/pattern engine
  ↓
Notebook/history store
```

The crucial abstraction is a display/evaluation protocol:

```ts
interface RichValue {
  type: string
  summary(): string
  views(): View[]
  explain?(): Explanation
  toLatex?(): string
  toJSON?(): unknown
  toHTML?(): HTMLElement
  transform?(op: Operation): RichValue
}
```

Any library could implement it:

```js
class Matrix {
  [Symbol.richDisplay]() {
    return {
      summary: () => `Matrix[${this.rows} × ${this.cols}]`,
      views: () => [
        tableView(this.values),
        heatmapView(this.values),
        eigenvalueView(this)
      ]
    }
  }
}
```

---

## The most powerful version

The deepest version would combine:

1. **JS REPL**
2. **Notebook interface**
3. **Symbolic computation**
4. **AST transformation**
5. **Dataframe/database engine**
6. **Visualization system**
7. **Reactive UI**
8. **Package-aware introspection**
9. **Natural language command layer**
10. **Persistent, queryable computational history**

Then the REPL becomes less like Node’s console and more like a live computational operating system.

Something like:

```js
> import { sales } from "./warehouse"

> sales.describe()

Dataset[4.2M rows × 27 columns]

> sales.groupBy("country").sum("revenue").geoPlot()

Interactive world map

> model = regression(sales, {
    target: "revenue",
    features: ["country", "channel", "season"]
  })

> model.explain()

Revenue is most strongly associated with channel and season.
Country explains 18.4% of variance after controlling for channel.

> model.toJS()

export function predictRevenue(input) {
  ...
}
```

That is the appealing endpoint: **a JavaScript REPL where every result is inspectable, transformable, explainable, visualizable, and composable.**
