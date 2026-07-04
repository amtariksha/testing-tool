import type { Locator } from "playwright";
import type { NormalizedStep, Target, TargetInput } from "../../schema/test-steps";
import type { ExecContext } from "./types";
import { executeAssertion } from "./assertions";

/**
 * Step dispatch (PRD v3 §5.3). Each step's params are already
 * template-substituted. Throws on failure; the case runner owns the
 * resolve→execute→verify→recover loop and passes an override locator when
 * retrying after LLM recovery.
 */

/** The recoverable (primary) target of a step, if it has one. */
export function getStepTarget(step: NormalizedStep): TargetInput | null {
  const p = step.params as Record<string, unknown> | string | null;
  switch (step.action) {
    case "click":
    case "double_click":
    case "check":
    case "uncheck":
    case "scroll_to":
    case "expect_visible":
    case "expect_hidden":
      return step.params as TargetInput;
    case "fill":
    case "clear_and_fill":
    case "select": {
      const params = p as { target?: TargetInput; label?: string };
      return params.target ?? (params.label ? { label: params.label } : null);
    }
    case "upload_file":
    case "expect_attribute":
    case "expect_count":
    case "extract":
    case "within":
    case "if_visible":
      return ((p as { target?: TargetInput }).target ?? null) as TargetInput | null;
    case "wait_for_selector":
      return typeof p === "string" ? p : ((p as { target: TargetInput }).target ?? null);
    case "expect_text": {
      const params = p as { target?: TargetInput; selector?: string };
      return params.target ?? (params.selector ? { css: params.selector } : null);
    }
    default:
      return null;
  }
}

async function resolveOrOverride(
  ctx: ExecContext,
  step: NormalizedStep,
  stepIndex: number,
  override: Locator | undefined
): Promise<Locator> {
  if (override) return override;
  const target = getStepTarget(step);
  if (!target) throw new Error(`step "${step.action}" has no target`);
  return ctx.resolveTarget(target, stepIndex);
}

export async function executeStep(
  ctx: ExecContext,
  step: NormalizedStep,
  stepIndex: number,
  override?: Locator
): Promise<void> {
  const { page } = ctx;
  const p = step.params as never;

  switch (step.action) {
    // ── navigation ──
    case "goto":
      await page.goto(p as string);
      return;
    case "reload":
      await page.reload();
      return;
    case "go_back":
      await page.goBack();
      return;
    case "close_popup":
      await page.keyboard.press("Escape");
      return;

    // ── interaction ──
    case "click":
      await (await resolveOrOverride(ctx, step, stepIndex, override)).click();
      return;
    case "double_click":
      await (await resolveOrOverride(ctx, step, stepIndex, override)).dblclick();
      return;
    case "fill":
      await (await resolveOrOverride(ctx, step, stepIndex, override)).fill(
        (p as { value: string }).value
      );
      return;
    case "clear_and_fill": {
      const locator = await resolveOrOverride(ctx, step, stepIndex, override);
      await locator.clear();
      await locator.fill((p as { value: string }).value);
      return;
    }
    case "select":
      await (await resolveOrOverride(ctx, step, stepIndex, override)).selectOption({
        label: (p as { value: string }).value,
      });
      return;
    case "check":
      await (await resolveOrOverride(ctx, step, stepIndex, override)).check();
      return;
    case "uncheck":
      await (await resolveOrOverride(ctx, step, stepIndex, override)).uncheck();
      return;
    case "upload_file":
      await (await resolveOrOverride(ctx, step, stepIndex, override)).setInputFiles(
        (p as { path: string }).path
      );
      return;
    case "press_key":
      await page.keyboard.press(typeof p === "string" ? p : (p as { key: string }).key);
      return;
    case "scroll_to":
      await (await resolveOrOverride(ctx, step, stepIndex, override)).scrollIntoViewIfNeeded();
      return;
    case "drag_and_drop": {
      const params = p as { source: TargetInput; target: TargetInput };
      const source = await ctx.resolveTarget(params.source, stepIndex);
      const dest = await ctx.resolveTarget(params.target, stepIndex);
      await source.dragTo(dest);
      return;
    }

    // ── waiting / assertions / structural / data-flow / meta ──
    default:
      return executeAssertion(ctx, step, stepIndex, override);
  }
}

/** Human-readable target description for step logs. */
export function describeTarget(target: TargetInput | null): string | undefined {
  if (target === null) return undefined;
  if (typeof target === "string") return target;
  const t = target as Target;
  const parts = Object.entries(t)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}=${v}`);
  return parts.join(",");
}
