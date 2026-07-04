import { describe, expect, it } from "vitest";
import { normalizeStep, StepValidationError, STEP_ACTIONS } from "./test-steps";
import { hashYaml, parseTestYaml } from "./test-yaml";

const MINIMAL = `
id: AUTH-01
name: Login
suite: auth
steps:
  - goto: "{{project.base_url}}/login"
  - fill: { label: "Email", value: "{{data.email}}" }
  - click: "Sign in"
  - expect_url_contains: "/dashboard"
`;

describe("parseTestYaml", () => {
  it("parses a minimal single-app doc with defaults", () => {
    const doc = parseTestYaml(MINIMAL);
    expect(doc.platform).toBe("web");
    expect(doc.tags).toEqual([]);
    expect(doc.crossApp).toBe(false);
    expect(doc.steps.map((s) => s.action)).toEqual([
      "goto",
      "fill",
      "click",
      "expect_url_contains",
    ]);
  });

  it("shorthand and longform click are equivalent", () => {
    const short = normalizeStep({ click: "Save" });
    const long = normalizeStep({ click: { text: "Save" } });
    expect(short.action).toBe("click");
    expect(long.action).toBe("click");
    expect(short.params).toBe("Save");
    expect(long.params).toEqual({ text: "Save" });
  });

  it("accepts every declared primitive", () => {
    // Spot-check the full grammar surface stays registered.
    expect(STEP_ACTIONS).toContain("drag_and_drop");
    expect(STEP_ACTIONS).toContain("for_each");
    expect(STEP_ACTIONS.length).toBeGreaterThanOrEqual(30);
    expect(() =>
      normalizeStep({ within: { target: ".card", steps: [{ click: "Open" }] } })
    ).not.toThrow();
  });

  it("rejects an unknown primitive naming the step index", () => {
    const yaml = `
id: X-01
name: x
suite: x
steps:
  - goto: "/"
  - hover_and_pray: "button"
`;
    expect(() => parseTestYaml(yaml)).toThrowError(/step 2: unknown step primitive/);
  });

  it("rejects bare strings that are not nullary actions", () => {
    expect(() => normalizeStep("click")).toThrow(StepValidationError);
    expect(normalizeStep("logout")).toEqual({ action: "logout", params: null });
  });

  it("verify_backend defaults window_ms=8000 and normalizes map-form expects", () => {
    const yaml = `${MINIMAL}
verify_backend:
  expect:
    - no_5xx: true
    - api_succeeded: { path_contains: "/login", method: POST }
`;
    const doc = parseTestYaml(yaml);
    expect(doc.verify_backend?.window_ms).toBe(8000);
    expect(doc.verify_backend?.expect[0]).toBe("no_5xx");
    expect(doc.verify_backend?.expect[1]).toEqual({
      api_succeeded: { path_contains: "/login", method: "POST", status_lt: 500 },
    });
  });

  it("flags cross-app docs and leaves them executable-later", () => {
    const yaml = `
id: CROSS-01
name: cross
suite: cross-app
apps:
  admin: { project: p1, platform: web }
steps:
  - app: admin
    phase: "one"
    do:
      - click: "Go"
`;
    const doc = parseTestYaml(yaml);
    expect(doc.crossApp).toBe(true);
  });

  it("hashYaml is stable and content-sensitive", () => {
    expect(hashYaml(MINIMAL)).toBe(hashYaml(MINIMAL));
    expect(hashYaml(MINIMAL)).not.toBe(hashYaml(MINIMAL + "\n# comment"));
  });
});
