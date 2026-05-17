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

// ── Symbolic operations ───────────────────────────────

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
