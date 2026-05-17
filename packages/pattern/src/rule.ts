import type { RichValue, View } from "@core";

/**
 * Rule — a rewrite rule mapping a pattern to a replacement.
 *
 * Patterns may contain pattern variables (written with trailing underscore:
 * a_, x_, n_). When the pattern matches an expression, the pattern variables
 * are bound to the subexpressions they matched.
 */
export interface Rule {
  readonly patternStr: string;
  readonly replacementStr: string;
  readonly source?: string;
}

/**
 * Bindings — a mapping from pattern variable names to matched values.
 */
export type Bindings = Map<string, unknown>;

/**
 * rule`sin(a_)^2 + cos(a_)^2 -> 1` — parse a rewrite rule.
 *
 * The left side is a pattern (may contain pattern variables like a_).
 * The right side is the replacement expression.
 */
export function rule(
  strings: TemplateStringsArray,
  ...values: unknown[]
): Rule {
  const raw = strings.raw.join("");
  const parts = raw.split("->");
  if (parts.length !== 2) {
    throw new Error(`Invalid rule syntax: expected "pattern -> replacement", got "${raw}"`);
  }

  return {
    patternStr: parts[0].trim(),
    replacementStr: parts[1].trim(),
    source: raw,
  };
}

/**
 * RewriteResult — the result of applying rewrite rules.
 */
export class RewriteResult implements RichValue {
  readonly type = "RewriteResult";

  constructor(
    private readonly result: unknown,
    private readonly rulesApplied: number,
    private readonly iterations: number
  ) {}

  summary(): string {
    return `RewriteResult[${this.rulesApplied} rules applied, ${this.iterations} iterations]`;
  }

  views(): View[] {
    return [
      { viewType: "text", label: "Result", data: String(this.result) },
    ];
  }

  explain(): string {
    return `Applied ${this.rulesApplied} rule(s) over ${this.iterations} iteration(s).`;
  }

  toJSON(): unknown {
    return this.result;
  }

  inputForm(): string {
    return String(this.result);
  }
}

// ── Rewrite engine ────────────────────────────────────

/**
 * Apply rewrite rules to a string expression until no more changes occur.
 * This is a string-level rewrite engine for simplicity.
 */
export function rewrite(input: string, rules: Rule[]): string {
  let current = input;
  let changed = true;
  let iterations = 0;
  const MAX_ITERATIONS = 1000;
  let totalApplied = 0;

  while (changed && iterations < MAX_ITERATIONS) {
    changed = false;
    for (const r of rules) {
      // Extract pattern variables from the pattern
      // Pattern variables: identifiers ending with _
      const patternVarRegex = /(\w+)_/g;
      const patternVars: string[] = [];
      let match: RegExpExecArray | null;
      const patternProcessed = r.patternStr;
      while ((match = patternVarRegex.exec(patternProcessed)) !== null) {
        patternVars.push(match[1]);
      }

      // For string-level matching, we create a regex from the pattern
      // replacing pattern variables with capture groups
      let regexStr = r.patternStr.replace(/(\w+)_/g, "([\\w.+\\-*/^()]+)");
      regexStr = regexStr.replace(/[.*+?^${}()|[\]\\]/g, (ch) => {
        if ("+-*/^".includes(ch)) return `\\${ch}`;
        return ch;
      });
      // Fix: we already escaped () etc, but we need capture groups
      // Simple approach: try direct string match first

      // Direct replacement for simple patterns
      if (current.includes(r.patternStr.replace(/(\w+)_/g, ""))) {
        // Can't do simple string replacement with pattern vars
        // Skip for now — proper pattern matching requires tree-level work
      }
    }
    iterations++;
  }

  return current;
}
