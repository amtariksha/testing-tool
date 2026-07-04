import { z } from "zod";

/**
 * Step grammar for YAML test cases (PRD v3 §5.3–5.4). A step is written as a
 * bare string (`- logout`) or a single-key map (`- click: "Save"` shorthand /
 * `- click: { target: {...} }` longform); normalizeStep() converts either
 * into { action, params } with per-action Zod validation.
 */

/** Targeting grammar — locator priority testid → role → label → text → placeholder → css. */
export const targetSchema = z.object({
  testid: z.string().optional(),
  role: z.string().optional(),
  name: z.string().optional(), // accessible name, used with role
  label: z.string().optional(),
  text: z.string().optional(),
  placeholder: z.string().optional(),
  css: z.string().optional(),
  nth: z.number().int().nonnegative().optional(),
});
export type Target = z.infer<typeof targetSchema>;

/** A bare string is shorthand: resolved as text → label → role-name heuristic. */
export const targetInputSchema = z.union([z.string(), targetSchema]);
export type TargetInput = z.infer<typeof targetInputSchema>;

const fillSchema = z.object({
  target: targetInputSchema.optional(),
  label: z.string().optional(), // `fill: { label, value }` shorthand
  value: z.string(),
});

const selectSchema = z.object({
  target: targetInputSchema.optional(),
  label: z.string().optional(),
  value: z.string(),
});

export interface NormalizedStep {
  action: StepAction;
  params: unknown;
}

const stepListSchema: z.ZodType<NormalizedStep[], z.ZodTypeDef, unknown> = z.lazy(() =>
  z.array(rawStepSchema).transform((steps) => steps.map(normalizeStep))
);

/** Param schema per action. `z.any()` is never used — unknown actions reject. */
const ACTION_PARAMS = {
  // navigation
  goto: z.string(),
  reload: z.union([z.literal(true), z.object({}).strict()]).nullish(),
  go_back: z.union([z.literal(true), z.object({}).strict()]).nullish(),
  close_popup: z.union([z.literal(true), z.object({}).strict()]).nullish(),
  // interaction
  click: targetInputSchema,
  double_click: targetInputSchema,
  fill: fillSchema,
  clear_and_fill: fillSchema,
  select: selectSchema,
  check: targetInputSchema,
  uncheck: targetInputSchema,
  upload_file: z.object({ target: targetInputSchema.optional(), path: z.string() }),
  press_key: z.union([z.string(), z.object({ key: z.string() })]),
  scroll_to: targetInputSchema,
  drag_and_drop: z.object({ source: targetInputSchema, target: targetInputSchema }),
  // waiting / assertions
  expect_visible: targetInputSchema,
  expect_hidden: targetInputSchema,
  expect_text: z.object({
    selector: z.string().optional(),
    target: targetInputSchema.optional(),
    text: z.string(),
  }),
  expect_url_contains: z.string(),
  expect_attribute: z.object({
    target: targetInputSchema,
    name: z.string(),
    value: z.string(),
  }),
  expect_count: z.object({ target: targetInputSchema, count: z.number().int().nonnegative() }),
  wait_for_network_idle: z
    .union([z.literal(true), z.object({ timeout_ms: z.number().int().positive().optional() })])
    .nullish(),
  wait_for_selector: z.union([
    z.string(),
    z.object({
      target: targetInputSchema,
      timeout_ms: z.number().int().positive().optional(),
    }),
  ]),
  // data flow
  extract: z.object({
    selector: z.string().optional(),
    target: targetInputSchema.optional(),
    as: z.string(),
    attribute: z.string().optional(),
  }),
  assert_extracted: z.object({
    name: z.string(),
    equals: z.string().optional(),
    matches: z.string().optional(),
  }),
  // structural (recursive)
  within: z.object({ target: targetInputSchema, steps: stepListSchema }),
  if_visible: z.object({
    target: targetInputSchema,
    steps: stepListSchema,
    else: stepListSchema.optional(),
  }),
  for_each: z.object({
    items: z.union([z.string(), z.array(z.string())]),
    as: z.string().default("item"),
    steps: stepListSchema,
  }),
  // auth shortcuts (expanded by the runner using case data / project config)
  login: z.union([z.literal(true), z.record(z.string())]).nullish(),
  logout: z.union([z.literal(true), z.object({}).strict()]).nullish(),
  // meta
  screenshot: z.union([z.string(), z.literal(true)]).nullish(),
  note: z.string(),
  sleep: z.union([z.number().positive(), z.object({ ms: z.number().positive() })]),
} as const;

export type StepAction = keyof typeof ACTION_PARAMS;
export const STEP_ACTIONS = Object.keys(ACTION_PARAMS) as StepAction[];

/** Actions valid as a bare string step (`- logout`). */
const NULLARY_ACTIONS: StepAction[] = [
  "reload",
  "go_back",
  "close_popup",
  "login",
  "logout",
  "screenshot",
  "wait_for_network_idle",
];

const rawStepSchema = z.union([z.string(), z.record(z.unknown())]);
export type RawStep = z.infer<typeof rawStepSchema>;

export class StepValidationError extends Error {
  constructor(message: string, public readonly stepIndex?: number) {
    super(stepIndex === undefined ? message : `step ${stepIndex + 1}: ${message}`);
    this.name = "StepValidationError";
  }
}

export function normalizeStep(raw: RawStep, index?: number): NormalizedStep {
  if (typeof raw === "string") {
    const action = raw as StepAction;
    if (!NULLARY_ACTIONS.includes(action)) {
      throw new StepValidationError(
        `"${raw}" is not a bare-string step (use a map form)`,
        index
      );
    }
    return { action, params: null };
  }

  const keys = Object.keys(raw);
  if (keys.length !== 1) {
    throw new StepValidationError(
      `a step must be a single-key map, got keys [${keys.join(", ")}]`,
      index
    );
  }
  const action = keys[0] as StepAction;
  const paramSchema = ACTION_PARAMS[action];
  if (!paramSchema) {
    throw new StepValidationError(`unknown step primitive "${action}"`, index);
  }
  const parsed = paramSchema.safeParse(raw[action]);
  if (!parsed.success) {
    throw new StepValidationError(
      `invalid params for "${action}": ${parsed.error.issues
        .map((i) => `${i.path.join(".") || "(root)"} ${i.message}`)
        .join("; ")}`,
      index
    );
  }
  return { action, params: parsed.data };
}

export function normalizeSteps(steps: RawStep[]): NormalizedStep[] {
  return steps.map((raw, index) => normalizeStep(raw, index));
}
