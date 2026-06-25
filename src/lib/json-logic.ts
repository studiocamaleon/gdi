type JsonLogicContext = Record<string, unknown>;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readPath(context: JsonLogicContext, path: string, fallback?: unknown) {
  if (!path) return context;
  const value = path.split(".").reduce<unknown>((current, part) => {
    if (!isPlainObject(current) && !Array.isArray(current)) return undefined;
    return (current as Record<string, unknown>)[part];
  }, context);
  return value === undefined ? fallback : value;
}

function toNumber(value: unknown) {
  const number = typeof value === "string" ? Number(value) : Number(value);
  return Number.isFinite(number) ? number : 0;
}

function isTruthy(value: unknown) {
  if (Array.isArray(value) && value.length === 0) return false;
  return Boolean(value);
}

function evaluate(rule: unknown, context: JsonLogicContext): unknown {
  if (!isPlainObject(rule)) return rule;
  const entries = Object.entries(rule);
  if (entries.length !== 1) return rule;

  const [operator, rawOperands] = entries[0];
  const operands = Array.isArray(rawOperands) ? rawOperands : [rawOperands];
  const values = () => operands.map((operand) => evaluate(operand, context));

  switch (operator) {
    case "var": {
      const [path, fallback] = operands;
      if (typeof path === "string") return readPath(context, path, fallback);
      return fallback;
    }
    case "and": {
      let last: unknown = true;
      for (const operand of operands) {
        last = evaluate(operand, context);
        if (!isTruthy(last)) return last;
      }
      return last;
    }
    case "or": {
      let last: unknown = false;
      for (const operand of operands) {
        last = evaluate(operand, context);
        if (isTruthy(last)) return last;
      }
      return last;
    }
    case "!":
      return !isTruthy(evaluate(operands[0], context));
    case "!!":
      return isTruthy(evaluate(operands[0], context));
    case "==": {
      const [a, b] = values();
      return a == b;
    }
    case "===": {
      const [a, b] = values();
      return a === b;
    }
    case "!=": {
      const [a, b] = values();
      return a != b;
    }
    case "!==": {
      const [a, b] = values();
      return a !== b;
    }
    case ">": {
      const [a, b] = values();
      return toNumber(a) > toNumber(b);
    }
    case ">=": {
      const [a, b] = values();
      return toNumber(a) >= toNumber(b);
    }
    case "<": {
      const [a, b] = values();
      return toNumber(a) < toNumber(b);
    }
    case "<=": {
      const [a, b] = values();
      return toNumber(a) <= toNumber(b);
    }
    case "+":
      return values().reduce<number>((sum, value) => sum + toNumber(value), 0);
    case "-": {
      const nums = values().map(toNumber);
      if (nums.length === 1) return -nums[0];
      return nums.slice(1).reduce((acc, value) => acc - value, nums[0] ?? 0);
    }
    case "*":
      return values().reduce<number>((product, value) => product * toNumber(value), 1);
    case "/": {
      const nums = values().map(toNumber);
      return nums.slice(1).reduce((acc, value) => acc / value, nums[0] ?? 0);
    }
    case "in": {
      const [needle, haystack] = values();
      if (Array.isArray(haystack)) return haystack.includes(needle);
      if (typeof haystack === "string") return haystack.includes(String(needle));
      return false;
    }
    default:
      return undefined;
  }
}

export function evaluarJsonLogicBoolean(
  rule: unknown,
  context: JsonLogicContext,
  defaultIfError = false,
) {
  if (rule === null || rule === undefined) return true;
  if (isPlainObject(rule) && Object.keys(rule).length === 0) return true;

  try {
    return Boolean(evaluate(rule, context));
  } catch {
    return defaultIfError;
  }
}
