import { describe, expect, it } from "vitest";
import { pickStrategy, semanticKey } from "./targeting";

describe("pickStrategy (grammar priority)", () => {
  it("prefers testid over everything", () => {
    expect(
      pickStrategy({ testid: "submit", role: "button", text: "Save", css: "#x" }).strategy
    ).toBe("testid");
  });

  it("walks the priority chain testid→role→label→text→placeholder→css", () => {
    expect(pickStrategy({ role: "button", name: "Save", css: "#x" })).toEqual({
      strategy: "role",
      value: "button",
      name: "Save",
    });
    expect(pickStrategy({ label: "Email", text: "Email" }).strategy).toBe("label");
    expect(pickStrategy({ text: "Welcome", placeholder: "x" }).strategy).toBe("text");
    expect(pickStrategy({ placeholder: "Search…", css: ".s" }).strategy).toBe("placeholder");
    expect(pickStrategy({ css: ".last-resort" }).strategy).toBe("css");
  });

  it("bare string becomes the string heuristic", () => {
    expect(pickStrategy("Sign in")).toEqual({ strategy: "string", value: "Sign in" });
  });

  it("carries nth through", () => {
    expect(pickStrategy({ css: ".row", nth: 2 }).nth).toBe(2);
  });

  it("rejects an empty target", () => {
    expect(() => pickStrategy({})).toThrowError(/no usable locator/);
  });
});

describe("semanticKey", () => {
  it("is stable for identical inputs and distinct per step/target", () => {
    const a = semanticKey("smoke-login", 3, { role: "button", name: "Sign in" });
    expect(a).toBe(semanticKey("smoke-login", 3, { role: "button", name: "Sign in" }));
    expect(a).not.toBe(semanticKey("smoke-login", 4, { role: "button", name: "Sign in" }));
    expect(a).not.toBe(semanticKey("smoke-login", 3, { text: "Sign in" }));
  });

  it("uses the declared target, so recovery reattaches to the same key", () => {
    expect(semanticKey("c", 0, "Save")).toBe("c:step0:str=Save");
    expect(semanticKey("c", 0, { testid: "save-btn" })).toBe("c:step0:testid=save-btn");
  });
});
