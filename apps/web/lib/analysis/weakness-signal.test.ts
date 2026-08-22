import { describe, expect, it } from "vitest";
import { isActionableWeaknessSignal } from "./weakness-signal";

describe("actionable weakness signals", () => {
  it("rejects low-confidence and generic category-level observations", () => {
    expect(isActionableWeaknessSignal({ conceptKey: "invariant.core", conceptLabel: "核心不变量与状态更新", severity: 0.9, confidence: 0.9 })).toBe(false);
    expect(isActionableWeaknessSignal({ conceptKey: "prefix_sum.query_before_update", conceptLabel: "查询频次的更新顺序", severity: 0.1, confidence: 0.9 })).toBe(false);
  });

  it("keeps a specific, evidence-backed mistake pattern", () => {
    expect(isActionableWeaknessSignal({ conceptKey: "prefix_sum.query_before_update", conceptLabel: "查询频次的更新顺序", severity: 0.7, confidence: 0.9 })).toBe(true);
  });
});
