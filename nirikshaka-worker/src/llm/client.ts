import { readFile } from "node:fs/promises";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { type ModelTier, modelId, estimateCostUsd } from "./router";

/**
 * Thin Anthropic wrapper (implementation doc §8: direct @anthropic-ai/sdk, no
 * frameworks). Prompt caching is ON — the system prompt is sent as a cached
 * block so repeated agent calls with the same instructions are cheap.
 */

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY is not configured");
    }
    client = new Anthropic({ apiKey });
  }
  return client;
}

export interface CompleteOptions {
  tier?: ModelTier;
  system: string;
  user: string;
  maxTokens?: number;
  temperature?: number;
  /** Cache the system prompt (default true). */
  cacheSystem?: boolean;
}

export interface CompleteResult {
  text: string;
  tier: ModelTier;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

export async function complete(options: CompleteOptions): Promise<CompleteResult> {
  const tier = options.tier ?? "sonnet";
  const cacheSystem = options.cacheSystem ?? true;

  const response = await getClient().messages.create({
    model: modelId(tier),
    max_tokens: options.maxTokens ?? 4096,
    // temperature is deprecated on newer models (e.g. Sonnet 5); only send it
    // when a caller explicitly needs it (e.g. Runner recovery at temp 0).
    ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
    system: [
      {
        type: "text",
        text: options.system,
        ...(cacheSystem ? { cache_control: { type: "ephemeral" as const } } : {}),
      },
    ],
    messages: [{ role: "user", content: options.user }],
  });

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");

  const inputTokens =
    response.usage.input_tokens +
    (response.usage.cache_read_input_tokens ?? 0) +
    (response.usage.cache_creation_input_tokens ?? 0);
  const outputTokens = response.usage.output_tokens;

  return {
    text,
    tier,
    inputTokens,
    outputTokens,
    costUsd: estimateCostUsd(tier, inputTokens, outputTokens),
  };
}

/**
 * Parse a JSON object out of an LLM response, tolerating ```json fences and
 * leading prose. Throws with the raw text on failure so callers can retry.
 */
export function extractJson<T = unknown>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1]! : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error(`No JSON object found in LLM response: ${text.slice(0, 200)}`);
  }
  return JSON.parse(candidate.slice(start, end + 1)) as T;
}

/**
 * Run an LLM call whose output must parse as JSON; on a parse/validation
 * failure, retry ONCE with the error fed back (models occasionally emit
 * unescaped quotes when copying source text, or truncate). `call` receives
 * the feedback string on the retry. Costs accumulate across attempts.
 */
export async function completeJsonWithRetry<T>(
  call: (feedback?: string) => Promise<CompleteResult>,
  parse: (text: string) => T
): Promise<{ value: T; costUsd: number }> {
  const first = await call();
  let costUsd = first.costUsd;
  try {
    return { value: parse(first.text), costUsd };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const second = await call(
      `Your previous response was not valid JSON (${message}). ` +
        `Output the ENTIRE corrected JSON object again — strictly valid JSON, ` +
        `all double quotes inside string values escaped, compact single line, nothing else.`
    );
    costUsd += second.costUsd;
    return { value: parse(second.text), costUsd };
  }
}

const PROMPTS_DIR = path.join(__dirname, "prompts");
const promptCache = new Map<string, string>();

/** Load a prompt from src/llm/prompts/<name>.md (never inline prompts, doc §8). */
export async function loadPrompt(name: string): Promise<string> {
  const cached = promptCache.get(name);
  if (cached) return cached;
  const content = await readFile(path.join(PROMPTS_DIR, `${name}.md`), "utf8");
  promptCache.set(name, content);
  return content;
}

export function isLlmConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}
