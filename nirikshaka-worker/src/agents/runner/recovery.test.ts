import { describe, expect, it } from "vitest";
import { countInteractiveElements, pruneDom, DOM_CHAR_BUDGET } from "./dom-prune";
import { nextAttempt, MAX_RECOVERY_CALLS } from "./recovery";

describe("nextAttempt (escalation policy)", () => {
  it("first call is haiku at temperature 0", () => {
    expect(nextAttempt(0)).toEqual({ tier: "haiku", temperature: 0 });
  });

  it("subsequent calls escalate to sonnet WITHOUT a temperature key", () => {
    const plan = nextAttempt(1)!;
    expect(plan.tier).toBe("sonnet");
    // claude-sonnet-5 rejects temperature — the key must be absent, not 0.
    expect("temperature" in plan).toBe(false);
    expect(nextAttempt(2)!.tier).toBe("sonnet");
  });

  it("stops at the hard cap", () => {
    expect(nextAttempt(MAX_RECOVERY_CALLS)).toBeNull();
    expect(nextAttempt(MAX_RECOVERY_CALLS + 1)).toBeNull();
  });
});

describe("pruneDom", () => {
  const page = `
<html><head><title>x</title><meta charset="utf-8"></head>
<body>
<!-- a comment -->
<script>alert("nope")</script>
<style>.a{color:red}</style>
<svg viewBox="0 0 10 10"><path d="M0 0"/></svg>
<div class="wrap" style="color:blue" onclick="hack()" data-testid="main-panel">
  <button data-testid="save-btn" class="btn primary">Save</button>
  <input type="email" placeholder="Email" aria-label="Email address">
  <a href="/home">Home</a>
</div>
</body></html>`;

  it("strips scripts, styles, svg internals, comments and head", () => {
    const pruned = pruneDom(page);
    expect(pruned).not.toContain("alert(");
    expect(pruned).not.toContain("color:red");
    expect(pruned).not.toContain("M0 0");
    expect(pruned).not.toContain("a comment");
    expect(pruned).not.toContain("<title>");
  });

  it("keeps targeting attributes, drops noise attributes", () => {
    const pruned = pruneDom(page);
    expect(pruned).toContain('data-testid="save-btn"');
    expect(pruned).toContain('placeholder="Email"');
    expect(pruned).toContain('aria-label="Email address"');
    expect(pruned).toContain('href="/home"');
    expect(pruned).not.toContain("onclick");
    expect(pruned).not.toContain("style=");
  });

  it("enforces the char budget keeping interactive elements first", () => {
    const filler = Array.from({ length: 3000 }, (_, i) => `<p>row ${i}</p>`).join("\n");
    const withButton = `${filler}\n<button data-testid="deep">Deep</button>`;
    const pruned = pruneDom(withButton, 2000);
    expect(pruned.length).toBeLessThanOrEqual(2000 + 40);
    expect(pruned).toContain('data-testid="deep"'); // interactive line survived
    expect(pruned).toContain("pruned to budget");
  });

  it("default budget approximates 3k tokens", () => {
    expect(DOM_CHAR_BUDGET).toBe(12_000);
  });

  it("countInteractiveElements drives the screenshot decision", () => {
    expect(countInteractiveElements(page)).toBeGreaterThanOrEqual(3);
    expect(countInteractiveElements("<div><p>text</p></div>")).toBe(0);
  });
});
