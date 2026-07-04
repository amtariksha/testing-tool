import { expect } from "playwright/test";
import type { Locator } from "playwright";
import type { NormalizedStep, TargetInput } from "../../schema/test-steps";
import type { ExecContext } from "./types";
import { buildLocator, buildLocatorAll } from "./targeting";

/**
 * expect_* / wait_* / data-flow / structural / auth / meta primitives.
 * Assertion failures throw (playwright expect) and feed the recovery loop
 * like any other step failure.
 */

const EXPECT_TIMEOUT_MS = 10_000;

async function resolve(
  ctx: ExecContext,
  step: NormalizedStep,
  stepIndex: number,
  target: TargetInput,
  override?: Locator
): Promise<Locator> {
  return override ?? ctx.resolveTarget(target, stepIndex);
}

export async function executeAssertion(
  ctx: ExecContext,
  step: NormalizedStep,
  stepIndex: number,
  override?: Locator
): Promise<void> {
  const { page, scope } = ctx;
  const p = step.params as never;

  switch (step.action) {
    case "expect_visible":
      await expect(await resolve(ctx, step, stepIndex, p as TargetInput, override)).toBeVisible({
        timeout: EXPECT_TIMEOUT_MS,
      });
      return;
    case "expect_hidden":
      await expect(await resolve(ctx, step, stepIndex, p as TargetInput, override)).toBeHidden({
        timeout: EXPECT_TIMEOUT_MS,
      });
      return;
    case "expect_text": {
      const params = p as { selector?: string; target?: TargetInput; text: string };
      const target = params.target ?? { css: params.selector! };
      await expect(await resolve(ctx, step, stepIndex, target, override)).toContainText(
        params.text,
        { timeout: EXPECT_TIMEOUT_MS }
      );
      return;
    }
    case "expect_url_contains":
      await expect(page).toHaveURL(new RegExp(escapeRegex(p as string)), {
        timeout: EXPECT_TIMEOUT_MS,
      });
      return;
    case "expect_attribute": {
      const params = p as { target: TargetInput; name: string; value: string };
      await expect(
        await resolve(ctx, step, stepIndex, params.target, override)
      ).toHaveAttribute(params.name, params.value, { timeout: EXPECT_TIMEOUT_MS });
      return;
    }
    case "expect_count": {
      const params = p as { target: TargetInput; count: number };
      // count assertions must not collapse to .first()
      const locator = override ?? buildLocatorAll(ctx.root as never, params.target);
      await expect(locator).toHaveCount(params.count, { timeout: EXPECT_TIMEOUT_MS });
      return;
    }
    case "wait_for_network_idle":
      await page.waitForLoadState("networkidle", {
        timeout: (p as { timeout_ms?: number } | null)?.timeout_ms ?? 30_000,
      });
      return;
    case "wait_for_selector": {
      const target: TargetInput = typeof p === "string" ? p : (p as { target: TargetInput }).target;
      const timeout =
        typeof p === "object" && p !== null
          ? ((p as { timeout_ms?: number }).timeout_ms ?? EXPECT_TIMEOUT_MS)
          : EXPECT_TIMEOUT_MS;
      await (await resolve(ctx, step, stepIndex, target, override)).waitFor({ timeout });
      return;
    }

    // ── data flow ──
    case "extract": {
      const params = p as {
        selector?: string;
        target?: TargetInput;
        as: string;
        attribute?: string;
      };
      const target = params.target ?? { css: params.selector! };
      const locator = await resolve(ctx, step, stepIndex, target, override);
      const value = params.attribute
        ? await locator.getAttribute(params.attribute)
        : await locator.textContent();
      scope.extracted[params.as] = (value ?? "").trim();
      return;
    }
    case "assert_extracted": {
      const params = p as { name: string; equals?: string; matches?: string };
      const value = scope.extracted[params.name];
      if (value === undefined) throw new Error(`nothing extracted as "${params.name}"`);
      if (params.equals !== undefined && value !== params.equals) {
        throw new Error(`extracted ${params.name}="${value}" ≠ "${params.equals}"`);
      }
      if (params.matches !== undefined && !new RegExp(params.matches).test(value)) {
        throw new Error(`extracted ${params.name}="${value}" !~ /${params.matches}/`);
      }
      return;
    }

    // ── structural ──
    case "within": {
      const params = p as { target: TargetInput; steps: NormalizedStep[] };
      const container = await resolve(ctx, step, stepIndex, params.target, override);
      await ctx.runSteps(params.steps, container);
      return;
    }
    case "if_visible": {
      const params = p as {
        target: TargetInput;
        steps: NormalizedStep[];
        else?: NormalizedStep[];
      };
      const locator = buildLocator(ctx.root as never, params.target);
      const visible = await locator.isVisible().catch(() => false);
      if (visible) await ctx.runSteps(params.steps, ctx.root);
      else if (params.else) await ctx.runSteps(params.else, ctx.root);
      return;
    }
    case "for_each": {
      const params = p as { items: string | string[]; as: string; steps: NormalizedStep[] };
      const items = Array.isArray(params.items) ? params.items : [params.items];
      for (const item of items) {
        scope.data[params.as] = item;
        await ctx.runSteps(params.steps, ctx.root);
      }
      return;
    }

    // ── auth shortcuts ──
    case "login":
    case "logout":
      // Doc: "expanded by the runner using project config" — no per-project
      // auth config exists yet. Smoke tests write explicit steps instead.
      throw new Error(
        `"${step.action}" composite is not available in Phase 2 — write explicit steps`
      );

    // ── meta ──
    case "screenshot":
      // handled by the case runner (needs artifact deps); treated as a note here
      return;
    case "note":
      return;
    case "sleep": {
      const ms = typeof p === "number" ? p : (p as { ms: number }).ms;
      await page.waitForTimeout(Math.min(ms, 10_000));
      return;
    }

    default:
      throw new Error(`unhandled step action "${step.action}"`);
  }
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
