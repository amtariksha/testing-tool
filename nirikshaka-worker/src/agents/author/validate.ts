/**
 * Generate-validate retry engine (doc §7 Phase 3): the generator is called
 * with the previous validation error as feedback until the output validates
 * or the retry budget is spent. Pure-injectable — unit-tested with fakes.
 */

export interface GenAttempt {
  text: string;
  costUsd: number;
}

export class GenerationFailedError extends Error {
  constructor(
    message: string,
    public readonly attempts: number,
    public readonly costUsd: number
  ) {
    super(message);
    this.name = "GenerationFailedError";
  }
}

export async function generateValidated<T>(
  gen: (feedback?: string) => Promise<GenAttempt>,
  validate: (text: string) => T, // throws with a descriptive message
  maxRetries: number
): Promise<{ doc: T; yamlText: string; attempts: number; costUsd: number }> {
  let costUsd = 0;
  let feedback: string | undefined;

  for (let attempt = 1; attempt <= 1 + maxRetries; attempt++) {
    const result = await gen(feedback);
    costUsd += result.costUsd;
    const yamlText = stripYamlFences(result.text);
    try {
      return { doc: validate(yamlText), yamlText, attempts: attempt, costUsd };
    } catch (error: unknown) {
      feedback = error instanceof Error ? error.message : String(error);
    }
  }

  throw new GenerationFailedError(
    `output failed validation after ${1 + maxRetries} attempt(s): ${feedback}`,
    1 + maxRetries,
    costUsd
  );
}

/** LLMs often wrap YAML in fences despite instructions — tolerate it. */
export function stripYamlFences(text: string): string {
  const fenced = text.match(/```(?:yaml|yml)?\s*\n([\s\S]*?)```/);
  return (fenced ? fenced[1]! : text).trim();
}
