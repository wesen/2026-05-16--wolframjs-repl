import type { RichValue, SerializedRichValue } from "@core";
import { wrapAsRichValue, serializeRichValue } from "@core";

/**
 * Evaluates user code and wraps the result as a RichValue.
 *
 * This runs inside the Web Worker. The code is evaluated in a scope
 * that includes REPL globals (expr, rule, etc. — added in later phases).
 */
export function evaluateCode(
  code: string,
  globals: Record<string, unknown>
): { value?: SerializedRichValue; error?: string; stack?: string } {
  try {
    // Build parameter names and values for the globals scope
    const globalNames = Object.keys(globals);
    const globalValues = Object.values(globals);

    // Wrap the user code in a function that returns the last expression.
    // We use indirect eval to run in global scope, but with our globals injected.
    const wrappedCode = `
      "use strict";
      return (function() {
        // Multiple statements: the last expression is the result
        // We detect if the code looks like a single expression or multiple statements
        const __code__ = ${JSON.stringify(code)};
        const __result__ = (0, eval)(__code__);
        return __result__;
      })();
    `;

    // Actually, we need a simpler approach: just eval the code directly
    // and capture whatever it returns.
    const fn = new Function(...globalNames, `"use strict"; return (function() { ${code} })()`);
    const result = fn(...globalValues);

    const richValue = wrapAsRichValue(result);
    return { value: serializeRichValue(richValue) };
  } catch (err: any) {
    return {
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    };
  }
}

/**
 * Enhanced evaluator that properly handles multi-statement code.
 * Wraps the code so the last expression's value is captured.
 */
export function evaluateCodeEnhanced(
  code: string,
  globals: Record<string, unknown>
): { value?: SerializedRichValue; error?: string; stack?: string } {
  try {
    const globalNames = Object.keys(globals);
    const globalValues = Object.values(globals);

    // We wrap the user's code so the last expression becomes the return value.
    // For multi-line code, we detect if the last line is an expression.
    const lines = code.trimEnd().split("\n");
    const lastLine = lines[lines.length - 1];
    const bodyLines = lines.slice(0, -1);

    // Heuristic: if the last line starts with a keyword, it's a statement, not an expression
    const statementKeywords = /^(const|let|var|function|class|if|for|while|switch|try|throw|return|import|export|break|continue)\b/;
    const isLastLineExpression = !statementKeywords.test(lastLine.trim()) && lastLine.trim().length > 0;

    let wrappedCode: string;
    if (isLastLineExpression && bodyLines.length > 0) {
      // Multi-statement with expression result
      wrappedCode = `"use strict";\n${bodyLines.join("\n")}\nreturn ${lastLine};`;
    } else if (isLastLineExpression && bodyLines.length === 0) {
      // Single expression
      wrappedCode = `"use strict";\nreturn (${code});`;
    } else {
      // Pure statements — return undefined
      wrappedCode = `"use strict";\n${code}`;
    }

    const fn = new Function(...globalNames, wrappedCode);
    const result = fn(...globalValues);

    const richValue = wrapAsRichValue(result);
    return { value: serializeRichValue(richValue) };
  } catch (err: any) {
    return {
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    };
  }
}
