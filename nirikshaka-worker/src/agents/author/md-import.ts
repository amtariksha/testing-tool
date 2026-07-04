/**
 * Deterministic parser for Pradeep's markdown test-case catalogs (the
 * 260-case CommunityOS file): one heading per case, numbered/bulleted lines
 * as steps, an "Expected"/"Expected Result" section as expectations. Pure —
 * no LLM here; the Author's convert mode turns these into YAML.
 */

export interface ConvertCase {
  externalId: string;
  title: string;
  steps: string[];
  expected: string[];
}

function slugify(title: string): string {
  return (
    title.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "case"
  );
}

const HEADING_RE = /^#{2,4}\s+(.+)$/;
const LIST_RE = /^(?:\d+[.)]\s+|[-*]\s+)(.+)$/;
// matched against a bold-stripped line so "**Expected:**" variants all hit
const EXPECTED_RE = /^expected(?:\s+result)?s?\s*:?\s*(.*)$/i;

export function parseMdCases(md: string): ConvertCase[] {
  const cases: ConvertCase[] = [];
  const seen = new Map<string, number>();
  let current: ConvertCase | null = null;
  let inExpected = false;

  const push = () => {
    if (current && current.steps.length > 0) cases.push(current);
    current = null;
  };

  for (const rawLine of md.split("\n")) {
    const line = rawLine.trim();

    const heading = line.match(HEADING_RE);
    if (heading) {
      push();
      const title = heading[1]!.trim();
      const base = slugify(title);
      const count = (seen.get(base) ?? 0) + 1;
      seen.set(base, count);
      current = {
        externalId: count === 1 ? base : `${base}-${count}`,
        title,
        steps: [],
        expected: [],
      };
      inExpected = false;
      continue;
    }
    if (!current) continue;

    const expectedHeader = line.replace(/\*+/g, "").trim().match(EXPECTED_RE);
    if (expectedHeader) {
      inExpected = true;
      if (expectedHeader[1]) current.expected.push(expectedHeader[1].trim());
      continue;
    }

    const listItem = line.match(LIST_RE);
    if (listItem) {
      (inExpected ? current.expected : current.steps).push(listItem[1]!.trim());
    }
  }
  push();

  return cases;
}
