import { daysBetweenInclusive, listMonthGrid } from "./date";
import { TEST_YEAR, isoDate } from "../test/date-helpers";

describe("date helpers", () => {
  it("lists inclusive date ranges", () => {
    expect(daysBetweenInclusive(isoDate(TEST_YEAR, 2, 27), isoDate(TEST_YEAR, 3, 2))).toEqual([
      isoDate(TEST_YEAR, 2, 27),
      isoDate(TEST_YEAR, 2, 28),
      isoDate(TEST_YEAR, 3, 1),
      isoDate(TEST_YEAR, 3, 2)
    ]);
  });

  it("renders a 6-week month grid starting on Monday", () => {
    const grid = listMonthGrid(TEST_YEAR, 1);
    const firstDay = new Date(`${grid[0]}T00:00:00Z`);
    const lastDay = new Date(`${grid[41]}T00:00:00Z`);

    expect(grid).toHaveLength(42);
    expect(firstDay.getUTCDay()).toBe(1);
    expect(lastDay.getTime() - firstDay.getTime()).toBe(41 * 24 * 60 * 60 * 1000);
  });
});
