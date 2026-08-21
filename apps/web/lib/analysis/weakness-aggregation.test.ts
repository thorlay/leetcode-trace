import { describe, expect, it } from "vitest";
import { aggregateWeakness, type WeaknessState } from "./weakness-aggregation";

describe("weakness aggregation", () => {
  it("aggregates three state-restoration observations into one weakness", () => {
    let weakness: WeaknessState | null = null;
    for (let index = 0; index < 3; index += 1) weakness = aggregateWeakness(weakness, { severity: 0.8, confidence: 0.9 });
    expect(weakness.observationCount).toBe(3);
    expect(weakness.masteryScore).toBeCloseTo(0.176);
  });
});
