/**
 * Pure DOM pruning for recovery prompts (doc §5.3 / PRD §6.3): strip
 * scripts/styles/svg/comments/head, drop non-essential attributes, collapse
 * whitespace, and truncate to ≤~3k tokens keeping interactive elements first.
 * Regex-based on purpose — no DOM dependency, deterministic, testable.
 */

export const DOM_CHAR_BUDGET = 12_000; // ≈3k tokens

const KEEP_ATTRS = new Set([
  "id",
  "class",
  "name",
  "type",
  "role",
  "placeholder",
  "href",
  "value",
  "for",
  "title",
  "alt",
]);

const INTERACTIVE_RE = /<(button|input|select|textarea|a|label)\b|role\s*=\s*"(button|link|tab|menuitem|checkbox|radio|combobox|textbox)"/gi;

export function countInteractiveElements(html: string): number {
  return [...html.matchAll(new RegExp(INTERACTIVE_RE.source, "gi"))].length;
}

function stripBlocks(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<script\b[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[\s\S]*?<\/style>/gi, "")
    .replace(/<svg\b[\s\S]*?<\/svg>/gi, "<svg/>")
    .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, "")
    .replace(/<head\b[\s\S]*?<\/head>/gi, "")
    .replace(/<(link|meta)\b[^>]*>/gi, "");
}

function pruneAttributes(html: string): string {
  return html.replace(/<([a-zA-Z][\w-]*)((?:\s+[^<>]*?)?)(\/?)>/g, (_m, tag: string, attrs: string, close: string) => {
    if (!attrs.trim()) return `<${tag}${close}>`;
    const kept: string[] = [];
    const attrRe = /([\w-]+)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s>]+))?/g;
    let match: RegExpExecArray | null;
    while ((match = attrRe.exec(attrs)) !== null) {
      const name = match[1]!.toLowerCase();
      if (
        KEEP_ATTRS.has(name) ||
        name.startsWith("aria-") ||
        name.startsWith("data-testid") ||
        name === "data-test"
      ) {
        kept.push(match[2] !== undefined ? `${name}=${match[2]}` : name);
      }
    }
    return `<${tag}${kept.length ? " " + kept.join(" ") : ""}${close}>`;
  });
}

/** Split into element-ish lines so truncation can prioritise interactive ones. */
function truncateInteractiveFirst(html: string, budget: number): string {
  if (html.length <= budget) return html;
  const lines = html.split(/\n+/);
  const interactive: string[] = [];
  const rest: string[] = [];
  for (const line of lines) {
    if (new RegExp(INTERACTIVE_RE.source, "i").test(line)) interactive.push(line);
    else rest.push(line);
  }
  let out = "";
  for (const line of [...interactive, ...rest]) {
    if (out.length + line.length + 1 > budget) break;
    out += line + "\n";
  }
  return out.trimEnd() + "\n<!-- pruned to budget -->";
}

export function pruneDom(html: string, budget: number = DOM_CHAR_BUDGET): string {
  const stripped = stripBlocks(html);
  const slim = pruneAttributes(stripped)
    .replace(/>\s+</g, ">\n<")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
  return truncateInteractiveFirst(slim, budget);
}
