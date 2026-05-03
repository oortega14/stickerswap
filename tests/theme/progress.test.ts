import { progressColor } from "@/theme/progress";

const STOPS = {
  progressRed: "#dc2626",
  progressAmber: "#f59e0b",
  progressGreen: "#16a34a"
} as const;

describe("progressColor", () => {
  it("returns red at 0%", () => {
    expect(progressColor(0, STOPS)).toBe("#dc2626");
  });

  it("returns amber at 50%", () => {
    expect(progressColor(0.5, STOPS)).toBe("#f59e0b");
  });

  it("returns green at 100%", () => {
    expect(progressColor(1, STOPS)).toBe("#16a34a");
  });

  it("interpolates between red and amber at 25%", () => {
    // midpoint between #dc2626 (220,38,38) and #f59e0b (245,158,11)
    // = (232.5, 98, 24.5) → (233, 98, 25) → "#e96219"
    expect(progressColor(0.25, STOPS)).toBe("#e96219");
  });

  it("interpolates between amber and green at 75%", () => {
    // midpoint between #f59e0b (245,158,11) and #16a34a (22,163,74)
    // = (133.5, 160.5, 42.5) → (134, 161, 43) → "#86a12b"
    expect(progressColor(0.75, STOPS)).toBe("#86a12b");
  });

  it("clamps below 0 to red", () => {
    expect(progressColor(-0.5, STOPS)).toBe("#dc2626");
  });

  it("clamps above 1 to green", () => {
    expect(progressColor(1.5, STOPS)).toBe("#16a34a");
  });
});
