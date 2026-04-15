import datasetJson from "../generated/dataset.json";
import type { DatasetBundle } from "../types";
import { buildHolidayCoverageKey, buildHolidayDayMap, getHolidaysForDay } from "./dataset";

const dataset = datasetJson as DatasetBundle;

describe("dataset helpers", () => {
  it("returns visible holidays under the active filters", () => {
    const dayMap = buildHolidayDayMap(dataset);
    const holidays = getHolidaysForDay(dataset, dayMap, "2026-04-06", {
      countryCodes: ["BE"]
    });

    expect(holidays.map((holiday) => holiday.name)).toContain("Spring Holidays");
    expect(holidays.every((holiday) => holiday.country === "BE")).toBe(true);
  });

  it("includes the Flemish Easter break on April 6, 2026", () => {
    const dayMap = buildHolidayDayMap(dataset);
    const holidays = getHolidaysForDay(dataset, dayMap, "2026-04-06", {
      countryCodes: ["BE"]
    });

    expect(
      holidays.some(
        (holiday) =>
          holiday.name === "Spring Holidays" &&
          holiday.regionId === "BE-NL" &&
          holiday.startDate === "2026-04-06" &&
          holiday.endDate === "2026-04-19"
      )
    ).toBe(true);
  });

  it("keeps Christmas Day national on December 25, 2026", () => {
    const dayMap = buildHolidayDayMap(dataset);
    const holidays = getHolidaysForDay(dataset, dayMap, "2026-12-25", {
      countryCodes: ["BE", "FR", "NL"]
    });

    expect(
      holidays.filter((holiday) => holiday.name === "Christmas Day").map((holiday) => holiday.scope)
    ).toEqual(["national", "national", "national"]);
  });

  it("prefers zone coverage over parallel administrative coverage and keeps Netherlands national on December 25, 2026", () => {
    const dayMap = buildHolidayDayMap(dataset);
    const holidays = getHolidaysForDay(dataset, dayMap, "2026-12-25", {
      countryCodes: ["FR", "NL"]
    });
    const franceHoliday = holidays.find(
      (holiday) => holiday.country === "FR" && holiday.name === "Christmas Holidays" && holiday.holidayType === "school"
    );
    const netherlandsHoliday = holidays.find(
      (holiday) => holiday.country === "NL" && holiday.name === "Christmas Holidays" && holiday.holidayType === "school"
    );

    expect(franceHoliday).toBeDefined();
    expect(netherlandsHoliday).toBeDefined();

    const franceCoverage = dataset.holidayCoverage.find(
      (coverage) => coverage.key === buildHolidayCoverageKey(franceHoliday!)
    );
    const netherlandsCoverage = dataset.holidayCoverage.find(
      (coverage) => coverage.key === buildHolidayCoverageKey(netherlandsHoliday!)
    );

    expect(franceCoverage).toBeDefined();
    expect(netherlandsCoverage).toBeDefined();
    expect(franceCoverage!.segments.map((segment) => segment.model)).toEqual(["zone"]);
    expect(franceCoverage!.segments.map((segment) => segment.displayMode)).toEqual(["count"]);
    expect(netherlandsCoverage!.segments.map((segment) => segment.displayMode)).toEqual(["national"]);
  });
});
