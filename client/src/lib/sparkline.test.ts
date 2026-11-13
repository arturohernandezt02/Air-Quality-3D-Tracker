import { describe, expect, it } from "vitest";
import { buildSparkline } from "./sparkline";

describe("buildSparkline", () => {
  it("splits the line when values are missing", () => {
    const geometry = buildSparkline([1, null, 3, 4]);

    expect(geometry.segments).toHaveLength(2);
    expect(geometry.pointCount).toBe(3);
    expect(geometry.min).toBe(1);
    expect(geometry.max).toBe(4);
    for (const segment of geometry.segments) {
      expect(segment.line).toMatch(/^M/);
      expect(segment.line).not.toContain("NaN");
    }
  });

  it("returns an empty geometry for no values", () => {
    expect(buildSparkline([])).toMatchObject({
      segments: [],
      min: null,
      max: null,
      pointCount: 0,
    });
  });

  it("draws a single value without an area fill", () => {
    const geometry = buildSparkline([5]);

    expect(geometry.segments).toHaveLength(1);
    expect(geometry.segments[0].area).toBe("");
  });

  it("handles constant series without dividing by zero", () => {
    const geometry = buildSparkline([2, 2, 2]);

    expect(geometry.min).toBe(2);
    expect(geometry.max).toBe(2);
    expect(geometry.segments[0].line).not.toContain("NaN");
  });
});
