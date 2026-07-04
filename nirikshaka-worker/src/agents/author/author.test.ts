import { describe, expect, it } from "vitest";
import { parseMdCases } from "./md-import";
import { pickTier } from "./tier";
import { GenerationFailedError, generateValidated, stripYamlFences } from "./validate";

describe("pickTier", () => {
  it("haiku for simple single-role non-state-changing flows", () => {
    expect(pickTier({ mode: "strategy", stepCount: 4, roleCount: 1, stateChanging: false })).toBe(
      "haiku"
    );
  });

  it("sonnet for long flows, multi-role, or state-changing features", () => {
    expect(pickTier({ mode: "strategy", stepCount: 8, roleCount: 1, stateChanging: false })).toBe(
      "sonnet"
    );
    expect(pickTier({ mode: "strategy", stepCount: 3, roleCount: 2, stateChanging: false })).toBe(
      "sonnet"
    );
    expect(pickTier({ mode: "strategy", stepCount: 3, roleCount: 1, stateChanging: true })).toBe(
      "sonnet"
    );
  });

  it("convert starts haiku, escalates to sonnet on retry", () => {
    expect(pickTier({ mode: "convert", attempt: 1 })).toBe("haiku");
    expect(pickTier({ mode: "convert", attempt: 2 })).toBe("sonnet");
  });

  it("regenerate is always sonnet — the cheap attempt already failed", () => {
    expect(pickTier({ mode: "regenerate", stepCount: 2, attempt: 1 })).toBe("sonnet");
  });
});

describe("generateValidated", () => {
  it("threads the validation error back as feedback and sums cost", async () => {
    const feedbacks: (string | undefined)[] = [];
    let call = 0;
    const result = await generateValidated(
      async (feedback) => {
        feedbacks.push(feedback);
        call += 1;
        return { text: call === 1 ? "bad" : "good", costUsd: 0.1 };
      },
      (text) => {
        if (text !== "good") throw new Error("id missing");
        return { ok: true };
      },
      2
    );
    expect(result.attempts).toBe(2);
    expect(result.costUsd).toBeCloseTo(0.2);
    expect(feedbacks).toEqual([undefined, "id missing"]);
  });

  it("throws GenerationFailedError with total cost after exhausting retries", async () => {
    try {
      await generateValidated(
        async () => ({ text: "bad", costUsd: 0.05 }),
        () => {
          throw new Error("always invalid");
        },
        2
      );
      expect.unreachable("should have thrown");
    } catch (error) {
      const failure = error as GenerationFailedError;
      expect(failure.name).toBe("GenerationFailedError");
      expect(failure.attempts).toBe(3);
      expect(failure.costUsd).toBeCloseTo(0.15);
      expect(failure.message).toContain("always invalid");
    }
  });

  it("stripYamlFences tolerates fenced output", () => {
    expect(stripYamlFences("```yaml\nid: x\n```")).toBe("id: x");
    expect(stripYamlFences("id: y")).toBe("id: y");
  });
});

describe("parseMdCases", () => {
  const md = `
# CommunityOS Admin Test Cases

## Login with valid OTP
1. Open the login page
2. Enter registered phone number
3. Enter the OTP
**Expected:** admin lands on the dashboard

## Login with valid OTP
- Repeat for guard role

Expected result:
- guard dashboard shown

### Notes
no steps here, should be dropped
`;

  it("splits heading-per-case with steps and expected sections", () => {
    const cases = parseMdCases(md);
    expect(cases).toHaveLength(2);
    expect(cases[0]!.steps).toHaveLength(3);
    expect(cases[0]!.expected).toEqual(["admin lands on the dashboard"]);
    expect(cases[1]!.expected).toEqual(["guard dashboard shown"]);
  });

  it("dedupes externalIds with stable suffixes and drops step-less cases", () => {
    const cases = parseMdCases(md);
    expect(cases[0]!.externalId).toBe("login-with-valid-otp");
    expect(cases[1]!.externalId).toBe("login-with-valid-otp-2");
    expect(cases.some((c) => c.title === "Notes")).toBe(false);
  });
});
