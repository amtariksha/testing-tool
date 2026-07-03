import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  encryptString,
  decryptString,
  tryDecryptString,
  isEnvelope,
  isEncryptionConfigured,
} from "./envelope";

const TEST_KEY =
  "a3f1c2d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90";
const OTHER_KEY =
  "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff";

describe("envelope encryption", () => {
  beforeEach(() => {
    process.env.NIRIKSHAKA_MASTER_KEY = TEST_KEY;
  });

  afterEach(() => {
    delete process.env.NIRIKSHAKA_MASTER_KEY;
  });

  it("round-trips a plain string", () => {
    const envelope = encryptString('{"user":"pradeep","otp":"123456"}');
    expect(isEnvelope(envelope)).toBe(true);
    expect(decryptString(envelope)).toBe('{"user":"pradeep","otp":"123456"}');
  });

  it("round-trips unicode and long payloads", () => {
    const payload = "नमस्ते 🚀 " + "x".repeat(50_000);
    expect(decryptString(encryptString(payload))).toBe(payload);
  });

  it("produces distinct ciphertexts for identical plaintext (fresh DEK per value)", () => {
    expect(encryptString("same")).not.toBe(encryptString("same"));
  });

  it("binds ciphertext to AAD (projectId)", () => {
    const envelope = encryptString("body", "project-a");
    expect(decryptString(envelope, "project-a")).toBe("body");
    expect(() => decryptString(envelope, "project-b")).toThrow();
    expect(() => decryptString(envelope)).toThrow();
  });

  it("fails with a different master key", () => {
    const envelope = encryptString("secret");
    process.env.NIRIKSHAKA_MASTER_KEY = OTHER_KEY;
    expect(() => decryptString(envelope)).toThrow();
  });

  it("fails on tampered ciphertext", () => {
    const envelope = encryptString("secret");
    const parts = envelope.split(":");
    const ct = Buffer.from(parts[4]!, "base64");
    ct[0] = ct[0]! ^ 0xff;
    parts[4] = ct.toString("base64");
    expect(() => decryptString(parts.join(":"))).toThrow();
  });

  it("accepts a base64 master key", () => {
    process.env.NIRIKSHAKA_MASTER_KEY = Buffer.from(TEST_KEY, "hex").toString("base64");
    expect(decryptString(encryptString("via-base64"))).toBe("via-base64");
  });

  it("rejects a short master key", () => {
    process.env.NIRIKSHAKA_MASTER_KEY = "too-short";
    expect(() => encryptString("x")).toThrow(/32 bytes/);
  });

  it("throws when key is missing", () => {
    delete process.env.NIRIKSHAKA_MASTER_KEY;
    expect(isEncryptionConfigured()).toBe(false);
    expect(() => encryptString("x")).toThrow(/not configured/);
  });

  describe("tryDecryptString", () => {
    it("passes through null, empty and legacy plaintext", () => {
      expect(tryDecryptString(null)).toBeNull();
      expect(tryDecryptString("")).toBe("");
      expect(tryDecryptString('{"legacy":true}')).toBe('{"legacy":true}');
    });

    it("decrypts envelopes", () => {
      expect(tryDecryptString(encryptString("v", "p1"), "p1")).toBe("v");
    });

    it("returns a marker instead of throwing on bad envelopes", () => {
      expect(tryDecryptString("enc:v1:garbage")).toBe("[nirikshaka] decryption failed");
    });
  });
});
