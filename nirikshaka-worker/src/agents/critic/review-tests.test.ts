import { describe, expect, it } from "vitest";
import { emptyAppModel, type AppModelDoc } from "../../schema/app-model";
import { parseTestYaml } from "../../schema/test-yaml";
import { decideNextAction } from "./loop";
import { lintTestYaml } from "./review-tests-lint";

function modelWithFeature(id: string, states: string[]): AppModelDoc {
  return {
    ...emptyAppModel(),
    features: [
      {
        id,
        name: id,
        confidence: 0.9,
        roles: [],
        screens: [],
        apis: [],
        states,
        depends_on: [],
        affects: [],
        business_rules: [],
      },
    ],
  };
}

const base = (extra: string) => `
id: c1
name: case
suite: crud
tags: [crud, "feature:orders"]
source_flow: "flow:x"
${extra}
`;

describe("lintTestYaml", () => {
  it("flags sleep abuse", () => {
    const doc = parseTestYaml(
      base(`steps:
  - goto: "/x"
  - sleep: 5000`)
    );
    const findings = lintTestYaml(doc, modelWithFeature("orders", []));
    expect(findings.some((f) => f.detail.includes("sleep"))).toBe(true);
  });

  it("critically flags a state-changing feature with no verify_backend", () => {
    const doc = parseTestYaml(
      base(`steps:
  - goto: "/orders"
  - click: "Create"`)
    );
    const findings = lintTestYaml(doc, modelWithFeature("orders", ["open", "closed"]));
    const critical = findings.find((f) => f.severity === "critical");
    expect(critical?.detail).toContain("verify_backend");
  });

  it("does not flag verify_backend when the feature is not state-changing", () => {
    const doc = parseTestYaml(
      base(`steps:
  - goto: "/orders"
  - expect_visible: "Orders"`)
    );
    const findings = lintTestYaml(doc, modelWithFeature("orders", []));
    expect(findings.some((f) => f.severity === "critical")).toBe(false);
  });

  it("flags hardcoded credentials outside templates", () => {
    const doc = parseTestYaml(
      base(`steps:
  - goto: "/login"
  - fill: { label: Phone, value: "+919876543210" }`)
    );
    const findings = lintTestYaml(doc, modelWithFeature("orders", []));
    expect(findings.some((f) => f.detail.includes("hardcoded"))).toBe(true);
  });

  it("passes clean templated values", () => {
    const doc = parseTestYaml(
      base(`steps:
  - goto: "{{project.base_url}}/login"
  - fill: { label: Phone, value: "{{data.phone}}" }`)
    );
    const findings = lintTestYaml(doc, modelWithFeature("orders", []));
    expect(findings).toHaveLength(0);
  });

  it("flags raw-css-only targeting", () => {
    const doc = parseTestYaml(
      base(`steps:
  - click: { css: "div.x > button:nth-child(3)" }`)
    );
    const findings = lintTestYaml(doc, modelWithFeature("orders", []));
    expect(findings.some((f) => f.detail.includes("raw CSS"))).toBe(true);
  });
});

describe("decideNextAction (test loop)", () => {
  it("approved → accept", () => {
    expect(decideNextAction("approved", 1, 3)).toBe("accept");
  });
  it("rejected below cap → regenerate", () => {
    expect(decideNextAction("rejected", 1, 3)).toBe("regenerate");
    expect(decideNextAction("rejected", 2, 3)).toBe("regenerate");
  });
  it("rejected at cap → needs_human", () => {
    expect(decideNextAction("rejected", 3, 3)).toBe("needs_human");
  });
  it("explicit needs_human at any iteration → needs_human", () => {
    expect(decideNextAction("needs_human", 1, 3)).toBe("needs_human");
  });
});
