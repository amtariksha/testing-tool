/**
 * Pure {{ }} template substitution for test cases (PRD v3 §5):
 * {{data.X}}, {{project.base_url}}, {{extracted.X}}. Applied recursively over
 * strings, arrays and plain objects. A missing key throws — a test that
 * references undefined data must fail loudly, not act on the literal text.
 */

export interface TemplateScope {
  data: Record<string, string>;
  project: { base_url: string };
  extracted: Record<string, string>;
}

export class TemplateError extends Error {
  constructor(public readonly key: string) {
    super(`template key not found: {{${key}}}`);
    this.name = "TemplateError";
  }
}

const TEMPLATE_RE = /\{\{\s*([\w.]+)\s*\}\}/g;

function lookup(key: string, scope: TemplateScope): string {
  const [root, ...rest] = key.split(".");
  const path = rest.join(".");
  if (root === "data" && path in scope.data) return scope.data[path]!;
  if (root === "project" && path === "base_url") return scope.project.base_url;
  if (root === "extracted" && path in scope.extracted) return scope.extracted[path]!;
  throw new TemplateError(key);
}

export function substituteString(value: string, scope: TemplateScope): string {
  return value.replace(TEMPLATE_RE, (_match, key: string) => lookup(key, scope));
}

export function substitute<T>(value: T, scope: TemplateScope): T {
  if (typeof value === "string") {
    return substituteString(value, scope) as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => substitute(item, scope)) as unknown as T;
  }
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = substitute(v, scope);
    }
    return out as unknown as T;
  }
  return value;
}
