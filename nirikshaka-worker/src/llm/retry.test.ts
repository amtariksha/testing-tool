import { describe, expect, it } from "vitest";
import { completeJsonWithRetry, type CompleteResult } from "./client";

const result = (text: string, costUsd = 0.01): CompleteResult => ({
  text,
  tier: "sonnet",
  inputTokens: 10,
  outputTokens: 10,
  costUsd,
});

describe("completeJsonWithRetry", () => {
  it("returns on first valid attempt without feedback", async () => {
    const calls: (string | undefined)[] = [];
    const { value, costUsd } = await completeJsonWithRetry(
      async (feedback) => {
        calls.push(feedback);
        return result('{"ok":true}');
      },
      (text) => JSON.parse(text) as { ok: boolean }
    );
    expect(value.ok).toBe(true);
    expect(calls).toEqual([undefined]);
    expect(costUsd).toBeCloseTo(0.01);
  });

  it("retries once with the parse error as feedback and sums cost", async () => {
    const calls: (string | undefined)[] = [];
    const { value, costUsd } = await completeJsonWithRetry(
      async (feedback) => {
        calls.push(feedback);
        return calls.length === 1 ? result('{"broken":') : result('{"ok":true}', 0.02);
      },
      (text) => JSON.parse(text) as { ok: boolean }
    );
    expect(value.ok).toBe(true);
    expect(calls).toHaveLength(2);
    expect(calls[1]).toContain("not valid JSON");
    expect(costUsd).toBeCloseTo(0.03);
  });

  it("throws after the second failure", async () => {
    await expect(
      completeJsonWithRetry(
        async () => result("not json at all"),
        (text) => JSON.parse(text) as unknown
      )
    ).rejects.toThrow();
  });
});
