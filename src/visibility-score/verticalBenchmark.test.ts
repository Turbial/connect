import { describe, expect, it } from "vitest";
import { computeVerticalBenchmark, MIN_BENCHMARK_SAMPLE } from "./index.js";

describe("computeVerticalBenchmark", () => {
  it("returns null below the minimum sample size, never a misleadingly precise number", () => {
    const scores = Array.from({ length: MIN_BENCHMARK_SAMPLE - 1 }, (_, i) => 50 + i);
    expect(computeVerticalBenchmark(scores)).toBeNull();
  });

  it("returns the median and sample size at or above the minimum sample size", () => {
    const result = computeVerticalBenchmark([10, 90, 50, 70, 30]);
    expect(result).toEqual({ medianScore: 50, sampleSize: 5 });
  });

  it("averages the two middle values for an even-sized sample", () => {
    const result = computeVerticalBenchmark([10, 20, 30, 40, 50, 60]);
    expect(result).toEqual({ medianScore: 35, sampleSize: 6 });
  });

  it("is not dragged by a single outlier, unlike an average would be", () => {
    const result = computeVerticalBenchmark([10, 12, 14, 16, 100]);
    expect(result?.medianScore).toBe(14);
  });
});
