import type { RichValue, View } from "@core";

/**
 * RuleObj — a rewrite rule mapping a pattern to a replacement.
 *
 * Implements RichValue so it renders with Pattern, Replacement, Source views
 * instead of falling through to the generic Object serializer.
 *
 * Patterns may contain pattern variables (written with trailing underscore:
 * a_, x_, n_). When the pattern matches an expression, the pattern variables
 * are bound to the subexpressions they matched.
 */
export class RuleObj implements RichValue {
  readonly type = "Rule";

  constructor(
    readonly patternStr: string,
    readonly replacementStr: string,
    readonly source?: string,
  ) {}

  /** Extract pattern variable names (identifiers ending with _) */
  patternVars(): string[] {
    const regex = /(\w+)_/g;
    const vars: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = regex.exec(this.patternStr)) !== null) {
      vars.push(m[1]);
    }
    return vars;
  }

  // ── RichValue protocol ──────────────────────────────

  summary(): string {
    return `${this.patternStr} -> ${this.replacementStr}`;
  }

  views(): View[] {
    return [
      { viewType: "text", label: "Pattern", data: this.patternStr },
      { viewType: "text", label: "Replacement", data: this.replacementStr },
      { viewType: "text", label: "Source", data: this.source || `${this.patternStr} -> ${this.replacementStr}` },
      { viewType: "text", label: "Variables", data: this.patternVars().length > 0 ? `Pattern variables: ${this.patternVars().join(", ")}` : "No pattern variables" },
    ];
  }

  explain(): string {
    const vars = this.patternVars();
    const varDesc = vars.length > 0 ? ` Pattern variables: ${vars.join(", ")}.` : "";
    return `A rewrite rule that matches '${this.patternStr}' and replaces it with '${this.replacementStr}'.${varDesc}`;
  }

  toJSON(): unknown {
    return { pattern: this.patternStr, replacement: this.replacementStr, source: this.source };
  }

  inputForm(): string {
    return this.source || `${this.patternStr} -> ${this.replacementStr}`;
  }
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
): RuleObj {
  const raw = strings.raw.join("");
  const parts = raw.split("->");
  if (parts.length !== 2) {
    throw new Error(`Invalid rule syntax: expected "pattern -> replacement", got "${raw}"`);
  }

  return new RuleObj(
    parts[0].trim(),
    parts[1].trim(),
    raw,
  );
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
export function rewrite(input: string, rules: RuleObj[]): string {
  let current = input;
  let changed = true;
  let iterations = 0;
  const MAX_ITERATIONS = 1000;
  let totalApplied = 0;

  while (changed && iterations < MAX_ITERATIONS) {
    changed = false;
    for (const r of rules) {
      // Extract pattern variables from the pattern
      const patternVars = r.patternVars();

      // For string-level matching, we create a regex from the pattern
      // replacing pattern variables with capture groups
      let regexStr = r.patternStr.replace(/(\w+)_/g, "([\\w.+\\-*/^()]+)");
      regexStr = regexStr.replace(/[.*+?^${}()|[\]\\]/g, (ch) => {
        if ("+-*/^".includes(ch)) return `\\${ch}`;
        return ch;
      });

      // Try regex match and replace
      try {
        const regex = new RegExp(regexStr);
        const match = regex.exec(current);
        if (match) {
          let replacement = r.replacementStr;
          // Replace pattern variable references in the replacement
          for (let i = 0; i < patternVars.length && i + 1 < match.length; i++) {
            replacement = replacement.replace(
              new RegExp(`\\b${patternVars[i]}_?\\b`, "g"),
              match[i + 1]
            );
          }
          current = current.replace(regex, replacement);
          changed = true;
          totalApplied++;
        }
      } catch {
        // Invalid regex — skip this rule
      }
    }
    iterations++;
  }

  return current;
}
