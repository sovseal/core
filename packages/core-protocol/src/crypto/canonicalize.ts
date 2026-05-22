/**
 * RFC 8785-style JSON Canonicalization Scheme (JCS) — minimal implementation
 * sized for AgentPayload values.
 *
 * Rules:
 *   - Object keys sorted lexicographically (UTF-16 code unit order).
 *   - No insignificant whitespace.
 *   - Numbers serialized in shortest round-trip form via Number.prototype.toString.
 *   - Strings JSON-escaped per RFC 8259.
 *   - Recurse into nested objects and arrays.
 *
 * Sufficient for hashing AgentPayloads. Not a substitute for full RFC 8785
 * (e.g. it does not normalize floats with the EcmaScript "ToString" algorithm
 * for very small / very large doubles). Keep payload numerics as integers
 * or finite reasonable floats and the output is stable.
 */

export function canonicalize(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError("canonicalize: non-finite numbers are not allowed");
    }
    return numberToCanonical(value);
  }
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return "[" + value.map(canonicalize).join(",") + "]";
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    const parts: string[] = [];
    for (const k of keys) {
      if (obj[k] === undefined) continue; // skip undefined per JSON.stringify behavior
      parts.push(JSON.stringify(k) + ":" + canonicalize(obj[k]));
    }
    return "{" + parts.join(",") + "}";
  }
  throw new TypeError(
    `canonicalize: unsupported value type "${typeof value}"`,
  );
}

function numberToCanonical(n: number): string {
  if (Object.is(n, -0)) return "0";
  if (Number.isInteger(n)) return n.toString(10);
  return n.toString();
}
