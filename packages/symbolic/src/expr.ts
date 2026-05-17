import type { RichValue, View } from "@core";
import {
  type MathNode,
  parse,
  simplify,
  derivative,
  ConstantNode,
  SymbolNode,
  ParenthesisNode,
  OperatorNode,
  FunctionNode,
  AccessorNode,
} from "mathjs";

/**
 * Expr — a symbolic expression tree implementing RichValue.
 *
 * Internally wraps a math.js Node tree. The user sees pretty-printed
 * mathematical notation. Views include Math, LaTeX, Full Form, and Tree.
 */
export class Expr implements RichValue {
  readonly type = "SymbolicExpr";

  constructor(
    private readonly node: MathNode,
    private readonly _source?: string
  ) {}

  /** Get the underlying math.js node */
  getNode(): MathNode {
    return this.node;
  }

  /** Get the original source string */
  getSource(): string | undefined {
    return this._source;
  }

  // ── RichValue protocol ──────────────────────────────

  summary(): string {
    return this.prettyPrint();
  }

  views(): View[] {
    return [
      { viewType: "math", label: "Math", data: this.prettyPrint() },
      { viewType: "latex", label: "LaTeX", data: this.toLatex() },
      { viewType: "fullform", label: "Full Form", data: this.fullForm() },
      { viewType: "tree", label: "Tree", data: this.toTree() },
    ];
  }

  explain(): string {
    return `A symbolic expression: ${this.prettyPrint()}`;
  }

  toLatex(): string {
    try {
      return this.node.toTex();
    } catch {
      return this.prettyPrint();
    }
  }

  toJSON(): unknown {
    return {
      type: "SymbolicExpr",
      source: this._source,
      fullForm: this.fullForm(),
      latex: this.toLatex(),
    };
  }

  inputForm(): string {
    return this._source ?? this.node.toString();
  }

  fullForm(): string {
    return nodeToFullForm(this.node);
  }

  prettyPrint(): string {
    return nodeToPretty(this.node);
  }

  toTree(): object {
    return nodeToTree(this.node);
  }
}

// ── Full Form conversion ──────────────────────────────

function nodeToFullForm(node: MathNode): string {
  if (node instanceof ConstantNode) {
    return `Number[${node.value}]`;
  }
  if (node instanceof SymbolNode) {
    return `Symbol[${node.name}]`;
  }
  if (node instanceof ParenthesisNode) {
    return nodeToFullForm(node.content);
  }
  if (node instanceof OperatorNode) {
    const head = operatorHead(node.op);
    const args = node.args.map(nodeToFullForm).join(", ");
    return `${head}[${args}]`;
  }
  if (node instanceof FunctionNode) {
    const args = node.args.map(nodeToFullForm).join(", ");
    return `${capitalize(node.fn.name)}[${args}]`;
  }
  if (node instanceof AccessorNode) {
    return node.toString();
  }
  return node.toString();
}

function operatorHead(op: string): string {
  switch (op) {
    case "+": return "Plus";
    case "-": return "Subtract";
    case "*": return "Times";
    case "/": return "Divide";
    case "^": return "Power";
    case "!": return "Factorial";
    default: return `Op_${op}`;
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ── Pretty Print with Unicode ─────────────────────────

function nodeToPretty(node: MathNode): string {
  if (node instanceof ConstantNode) {
    const val = node.value;
    if (typeof val === "number" && !Number.isInteger(val)) {
      return val.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
    }
    return String(val);
  }
  if (node instanceof SymbolNode) {
    return node.name;
  }
  if (node instanceof ParenthesisNode) {
    return `(${nodeToPretty(node.content)})`;
  }
  if (node instanceof OperatorNode) {
    if (node.op === "^") {
      const base = node.args[0];
      const exp = node.args[1];
      const baseStr = needsParens(base) ? `(${nodeToPretty(base)})` : nodeToPretty(base);
      const expStr = nodeToPretty(exp);
      // Simple Unicode superscripts for common exponents
      if (expStr === "2") return `${baseStr}²`;
      if (expStr === "3") return `${baseStr}³`;
      if (expStr === "1") return baseStr;
      return `${baseStr}^${expStr}`;
    }
    if (node.op === "*") {
      const parts = node.args.map((a) => {
        const s = nodeToPretty(a);
        return needsParens(a) ? `(${s})` : s;
      });
      return parts.join("·");
    }
    const parts = node.args.map((a) => nodeToPretty(a));
    const sep = node.op === "+" ? " + " : node.op === "-" ? " - " : ` ${node.op} `;
    return parts.join(sep);
  }
  if (node instanceof FunctionNode) {
    const args = node.args.map(nodeToPretty).join(", ");
    return `${node.fn.name}(${args})`;
  }
  return node.toString();
}

function needsParens(node: MathNode): boolean {
  if (node instanceof OperatorNode) {
    return node.op === "+" || node.op === "-";
  }
  return false;
}

// ── Tree conversion ───────────────────────────────────

function nodeToTree(node: MathNode): object {
  if (node instanceof ConstantNode) {
    return { type: "Number", value: node.value };
  }
  if (node instanceof SymbolNode) {
    return { type: "Symbol", name: node.name };
  }
  if (node instanceof ParenthesisNode) {
    return nodeToTree(node.content);
  }
  if (node instanceof OperatorNode) {
    return {
      type: operatorHead(node.op),
      args: node.args.map(nodeToTree),
    };
  }
  if (node instanceof FunctionNode) {
    return {
      type: capitalize(node.fn.name),
      args: node.args.map(nodeToTree),
    };
  }
  return { type: "Unknown", value: node.toString() };
}

// ── Tagged Template Literal ───────────────────────────

/**
 * expr`x^2 + 1` — parse a symbolic math expression.
 */
export function expr(
  strings: TemplateStringsArray,
  ...values: unknown[]
): Expr {
  const raw = strings.raw.join("");
  return parseMath(raw);
}

/**
 * Parse a math expression string into an Expr tree.
 */
export function parseMath(input: string): Expr {
  try {
    const preprocessed = preprocessMath(input);
    const node = parse(preprocessed);
    return new Expr(node, input);
  } catch (err) {
    throw new Error(
      `Parse error in "${input}": ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

/**
 * Pre-process math notation for math.js:
 * - Insert implicit multiplication: 2x -> 2*x, xy -> x*y
 */
function preprocessMath(input: string): string {
  const knownFunctions = new Set([
    "sin", "cos", "tan", "sqrt", "log", "exp", "abs",
    "factorial", "asin", "acos", "atan", "ln",
  ]);

  let s = input.trim();
  let result = "";

  for (let i = 0; i < s.length; i++) {
    result += s[i];
    if (i < s.length - 1) {
      const curr = s[i];
      const next = s[i + 1];

      // number followed by letter
      if (/\d/.test(curr) && /[a-zA-Z]/.test(next)) {
        result += "*";
      }
      // closing paren followed by letter or number
      else if (curr === ")" && /[a-zA-Z0-9]/.test(next)) {
        result += "*";
      }
      // letter or number followed by opening paren — but not a function call
      else if (/[a-zA-Z0-9]/.test(curr) && next === "(") {
        let isFuncCall = false;
        for (const fn of knownFunctions) {
          if (result.endsWith(fn)) {
            isFuncCall = true;
            break;
          }
        }
        if (!isFuncCall) {
          result += "*";
        }
      }
    }
  }

  return result;
}

// ── Tree-level pattern matching ──────────────────────

/**
 * Result of matching a pattern against a node.
 * bindings maps pattern variable names to matched sub-trees.
 */
export interface MatchResult {
  matched: boolean;
  bindings: Map<string, MathNode>;
}

/**
 * Match a pattern tree against an expression tree.
 *
 * Pattern variables are SymbolNodes whose name ends with '_'.
 * A pattern variable matches any single sub-tree.
 * Non-variable nodes must match exactly (operator, function name, arity).
 */
export function matchTree(pattern: MathNode, expr: MathNode): MatchResult {
  const bindings = new Map<string, MathNode>();
  const ok = matchNode(pattern, expr, bindings);
  return { matched: ok, bindings };
}

function matchNode(
  pattern: MathNode,
  expr: MathNode,
  bindings: Map<string, MathNode>
): boolean {
  // Pattern variable: symbol ending with _
  if (pattern instanceof SymbolNode) {
    if (pattern.name.endsWith("_")) {
      const varName = pattern.name.slice(0, -1);
      if (bindings.has(varName)) {
        // Already bound — must match the same tree
        return treeEqual(bindings.get(varName)!, expr);
      }
      bindings.set(varName, expr);
      return true;
    }
    // Regular symbol — must match exactly
    return expr instanceof SymbolNode && expr.name === pattern.name;
  }

  // Constant
  if (pattern instanceof ConstantNode) {
    if (!(expr instanceof ConstantNode)) return false;
    return pattern.value === expr.value;
  }

  // Parenthesis — unwrap
  if (pattern instanceof ParenthesisNode) {
    return matchNode(pattern.content, expr, bindings);
  }
  if (expr instanceof ParenthesisNode) {
    return matchNode(pattern, expr.content, bindings);
  }

  // Operator node
  if (pattern instanceof OperatorNode) {
    if (!(expr instanceof OperatorNode)) return false;
    if (pattern.op !== expr.op) return false;
    if (pattern.args.length !== expr.args.length) return false;
    for (let i = 0; i < pattern.args.length; i++) {
      if (!matchNode(pattern.args[i], expr.args[i], bindings)) return false;
    }
    return true;
  }

  // Function node
  if (pattern instanceof FunctionNode) {
    if (!(expr instanceof FunctionNode)) return false;
    if (pattern.fn.name !== expr.fn.name) return false;
    if (pattern.args.length !== expr.args.length) return false;
    for (let i = 0; i < pattern.args.length; i++) {
      if (!matchNode(pattern.args[i], expr.args[i], bindings)) return false;
    }
    return true;
  }

  // Fallback: structural equality
  return pattern.toString() === expr.toString();
}

/** Check structural equality of two nodes (shallow, no simplification). */
function treeEqual(a: MathNode, b: MathNode): boolean {
  return a.toString() === b.toString();
}

/**
 * Apply bindings to a replacement template tree.
 * Pattern variables (name_) in the template are replaced by their bound values.
 */
export function applyBindings(template: MathNode, bindings: Map<string, MathNode>): MathNode {
  return transformNode(template, (node) => {
    if (node instanceof SymbolNode && node.name.endsWith("_")) {
      const varName = node.name.slice(0, -1);
      if (bindings.has(varName)) {
        return bindings.get(varName)!;
      }
    }
    return node;
  });
}

/**
 * Transform a node tree: apply a function to every node bottom-up.
 * If the function returns a different node, replace it.
 */
function transformNode(
  node: MathNode,
  fn: (node: MathNode) => MathNode
): MathNode {
  // First, recursively transform children
  let transformed: MathNode = node;

  if (node instanceof OperatorNode) {
    const newArgs = node.args.map((a) => transformNode(a, fn));
    if (newArgs.some((a, i) => a !== node.args[i])) {
      transformed = new OperatorNode(node.op, node.fn, newArgs as [MathNode, MathNode]);
    }
  } else if (node instanceof FunctionNode) {
    const newArgs = node.args.map((a) => transformNode(a, fn));
    if (newArgs.some((a, i) => a !== node.args[i])) {
      transformed = new FunctionNode(node.fn, newArgs);
    }
  } else if (node instanceof ParenthesisNode) {
    const newContent = transformNode(node.content, fn);
    if (newContent !== node.content) {
      transformed = new ParenthesisNode(newContent);
    }
  }

  // Then apply the transformation function to the (possibly updated) node
  return fn(transformed);
}

/**
 * Rewrite an Expr by applying a list of tree-level pattern rules.
 * Returns a new Expr if any rule matched, or the original Expr if not.
 */
export function rewriteExpr(e: Expr, rules: Array<{ patternStr: string; replacementStr: string }>): Expr {
  let currentNode = e.getNode();
  let changed = false;
  let iterations = 0;
  const MAX_ITERATIONS = 100;

  while (iterations < MAX_ITERATIONS) {
    let anyMatch = false;

    for (const rule of rules) {
      try {
        const patternNode = parse(preprocessMath(rule.patternStr));
        const replacementNode = parse(preprocessMath(rule.replacementStr));

        // Try matching at every sub-tree position
        const result = rewriteAtAnyPosition(currentNode, patternNode, replacementNode);
        if (result !== null) {
          currentNode = result;
          anyMatch = true;
          changed = true;
        }
      } catch {
        // Pattern or replacement didn't parse — skip this rule
      }
    }

    if (!anyMatch) break;
    iterations++;
  }

  if (changed) {
    return new Expr(currentNode, `rewrite(${e.inputForm()})`);
  }
  return e;
}

/**
 * Try to rewrite a pattern at any position in the tree (top-down, left-to-right).
 * Returns the rewritten tree if a match was found, or null.
 */
function rewriteAtAnyPosition(
  node: MathNode,
  pattern: MathNode,
  replacement: MathNode
): MathNode | null {
  // Try matching at this position
  const { matched, bindings } = matchTree(pattern, node);
  if (matched) {
    return applyBindings(replacement, bindings);
  }

  // Recurse into children
  if (node instanceof OperatorNode) {
    for (let i = 0; i < node.args.length; i++) {
      const result = rewriteAtAnyPosition(node.args[i], pattern, replacement);
      if (result !== null) {
        const newArgs = [...node.args];
        newArgs[i] = result;
        return new OperatorNode(node.op, node.fn, newArgs as [MathNode, MathNode]);
      }
    }
  } else if (node instanceof FunctionNode) {
    for (let i = 0; i < node.args.length; i++) {
      const result = rewriteAtAnyPosition(node.args[i], pattern, replacement);
      if (result !== null) {
        const newArgs = [...node.args];
        newArgs[i] = result;
        return new FunctionNode(node.fn, newArgs);
      }
    }
  } else if (node instanceof ParenthesisNode) {
    const result = rewriteAtAnyPosition(node.content, pattern, replacement);
    if (result !== null) {
      return new ParenthesisNode(result);
    }
  }

  return null;
}


/** Simplify an expression */
export function simplifyExpr(e: Expr): Expr {
  try {
    const result = simplify(e.getNode());
    return new Expr(result, `simplify(${e.inputForm()})`);
  } catch {
    return e;
  }
}

/** Factor a polynomial expression */
export function factor(e: Expr): Expr {
  try {
    const result = simplify(e.getNode());
    return new Expr(result, `factor(${e.inputForm()})`);
  } catch {
    return e;
  }
}

/** Symbolic differentiation */
export function diff(e: Expr, variable: string): Expr {
  try {
    const result = derivative(e.getNode(), variable);
    return new Expr(result, `diff(${e.inputForm()}, ${variable})`);
  } catch (err) {
    throw new Error(
      `Cannot differentiate: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

/** Evaluate an expression numerically */
export function evaluate(e: Expr, scope?: Record<string, unknown>): unknown {
  try {
    return e.getNode().evaluate(scope ?? {});
  } catch (err) {
    throw new Error(
      `Cannot evaluate: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

/** Expand products and powers */
export function expand(e: Expr): Expr {
  try {
    const result = simplify(e.getNode(), [
      "n*(n1+n2) -> n*n1 + n*n2",
      "(n1+n2)*n -> n1*n + n2*n",
    ]);
    return new Expr(result, `expand(${e.inputForm()})`);
  } catch {
    return e;
  }
}

/** Solve an equation (placeholder) */
export function solve(equation: Expr, variable: string): Expr {
  try {
    const node = equation.getNode();
    return new Expr(node, `solve(${equation.inputForm()}, ${variable})`);
  } catch {
    return equation;
  }
}
