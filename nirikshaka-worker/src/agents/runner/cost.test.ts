import { describe, expect, it } from "vitest";
import { charge, createBudget, isExceeded, toDecimal4 } from "./cost";

describe("cost budget", () => {
  it("accumulates charges immutably", () => {
    const b0 = createBudget(1.0);
    const b1 = charge(b0, 0.25);
    expect(b0.spentUsd).toBe(0);
    expect(b1.spentUsd).toBe(0.25);
  });

  it("trips exactly at the boundary", () => {
    const budget = charge(createBudget(1.0), 0.999);
    expect(isExceeded(budget)).toBe(false);
    expect(isExceeded(charge(budget, 0.001))).toBe(true);
  });

  it("seeds from prior spend on resume", () => {
    const resumed = createBudget(1.0, 0.8);
    expect(isExceeded(resumed)).toBe(false);
    expect(isExceeded(charge(resumed, 0.3))).toBe(true);
  });

  it("toDecimal4 rounds for Decimal(10,4) writes", () => {
    expect(toDecimal4(0.123456)).toBe(0.1235);
    expect(toDecimal4(0.00004)).toBe(0);
    expect(toDecimal4(1)).toBe(1);
  });
});
