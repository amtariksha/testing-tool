import type { Locator, Page } from "playwright";
import type { Target, TargetInput } from "../../schema/test-steps";

/**
 * Targeting grammar (PRD v3 §5.4): locator strategies tried in priority
 * order testid → role → label → text → placeholder → css. pickStrategy() is
 * pure (unit-tested); buildLocator() is the thin Playwright edge.
 */

export type LocatorStrategy =
  | "testid"
  | "role"
  | "label"
  | "text"
  | "placeholder"
  | "css"
  | "string";

export interface ResolvedSelector {
  strategy: LocatorStrategy;
  value: string;
  /** accessible name (role strategy only) */
  name?: string;
  nth?: number;
}

const PRIORITY: Array<Exclude<LocatorStrategy, "string">> = [
  "testid",
  "role",
  "label",
  "text",
  "placeholder",
  "css",
];

/** Highest-priority strategy present on the target. Pure. */
export function pickStrategy(target: TargetInput): ResolvedSelector {
  if (typeof target === "string") {
    return { strategy: "string", value: target };
  }
  for (const strategy of PRIORITY) {
    const value = target[strategy];
    if (value) {
      return {
        strategy,
        value,
        ...(strategy === "role" && target.name ? { name: target.name } : {}),
        ...(target.nth !== undefined ? { nth: target.nth } : {}),
      };
    }
  }
  throw new Error(`target has no usable locator field: ${JSON.stringify(target)}`);
}

/**
 * Stable cache key for a step's target (LocatorCache.semanticKey). Uses the
 * declared target, not the resolved selector, so recovery results reattach
 * to the same key across runs.
 */
export function semanticKey(
  caseExternalId: string,
  stepIndex: number,
  target: TargetInput
): string {
  const desc =
    typeof target === "string"
      ? `str=${target}`
      : PRIORITY.filter((k) => (target as Target)[k])
          .map((k) => `${k}=${(target as Target)[k]}`)
          .join(";") || "none";
  return `${caseExternalId}:step${stepIndex}:${desc}`;
}

/** Build a Playwright locator for a resolved selector. */
export function locatorFor(page: Page, selector: ResolvedSelector): Locator {
  let locator: Locator;
  switch (selector.strategy) {
    case "testid":
      locator = page.getByTestId(selector.value);
      break;
    case "role":
      locator = page.getByRole(selector.value as Parameters<Page["getByRole"]>[0], {
        ...(selector.name ? { name: selector.name } : {}),
      });
      break;
    case "label":
      locator = page.getByLabel(selector.value);
      break;
    case "text":
      locator = page.getByText(selector.value);
      break;
    case "placeholder":
      locator = page.getByPlaceholder(selector.value);
      break;
    case "css":
      locator = page.locator(selector.value);
      break;
    case "string":
      // Bare-string shorthand: visible text, else button/link by name, else label.
      locator = page
        .getByText(selector.value, { exact: true })
        .or(page.getByRole("button", { name: selector.value }))
        .or(page.getByRole("link", { name: selector.value }))
        .or(page.getByLabel(selector.value))
        .or(page.getByText(selector.value));
      break;
  }
  return selector.nth !== undefined ? locator.nth(selector.nth) : locator.first();
}

export function buildLocator(page: Page, target: TargetInput): Locator {
  return locatorFor(page, pickStrategy(target));
}

/** Like buildLocator but without .first() collapse — for expect_count. */
export function buildLocatorAll(page: Page, target: TargetInput): Locator {
  const selector = pickStrategy(target);
  if (selector.strategy === "css") return page.locator(selector.value);
  if (selector.strategy === "text") return page.getByText(selector.value);
  if (selector.strategy === "testid") return page.getByTestId(selector.value);
  return locatorFor(page, selector);
}
