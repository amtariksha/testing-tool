import { describe, expect, it } from "vitest";
import { substitute, TemplateError, type TemplateScope } from "./templating";

const scope: TemplateScope = {
  data: { email: "qa@example.com", otp: "123456" },
  project: { base_url: "https://staging.example.com" },
  extracted: { request_id: "REQ-42" },
};

describe("substitute", () => {
  it("replaces data, project and extracted keys inside strings", () => {
    expect(substitute("{{project.base_url}}/login", scope)).toBe(
      "https://staging.example.com/login"
    );
    expect(substitute("code {{data.otp}} for {{data.email}}", scope)).toBe(
      "code 123456 for qa@example.com"
    );
    expect(substitute("see {{extracted.request_id}}", scope)).toBe("see REQ-42");
  });

  it("recurses through objects and arrays", () => {
    const input = {
      target: { label: "OTP" },
      values: ["{{data.otp}}", { nested: "{{extracted.request_id}}" }],
    };
    expect(substitute(input, scope)).toEqual({
      target: { label: "OTP" },
      values: ["123456", { nested: "REQ-42" }],
    });
  });

  it("throws naming the missing key", () => {
    expect(() => substitute("{{data.missing}}", scope)).toThrowError(
      /template key not found: \{\{data.missing\}\}/
    );
    try {
      substitute("{{secrets.apiKey}}", scope);
    } catch (e) {
      expect(e).toBeInstanceOf(TemplateError);
    }
  });

  it("leaves non-template strings and non-strings untouched", () => {
    expect(substitute("plain text", scope)).toBe("plain text");
    expect(substitute(42, scope)).toBe(42);
    expect(substitute(null, scope)).toBeNull();
  });
});
