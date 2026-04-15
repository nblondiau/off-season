import { daysBetweenInclusive, listMonthGrid } from "./date";

describe("date helpers", () => {
  it("lists inclusive date ranges", () => {
    expect(daysBetweenInclusive("2026-02-27", "2026-03-02")).toEqual([
      "2026-02-27",
      "2026-02-28",
      "2026-03-01",
      "2026-03-02"
    ]);
  });

  it("renders a 6-week month grid starting on Monday", () => {
    const grid = listMonthGrid(2026, 1);
    expect(grid).toHaveLength(42);
    expect(grid[0]).toBe("2026-01-26");
    expect(grid[41]).toBe("2026-03-08");
  });
});

