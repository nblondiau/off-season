import datasetJson from "../generated/dataset.json";
import type { DatasetBundle } from "../types";
import { buildHolidayDayMap, getHolidaysForDay } from "./dataset";
import { findCoverage, findDateWithHolidays, findHoliday } from "../test/dataset-helpers";

const dataset = datasetJson as DatasetBundle;

describe("dataset helpers", () => {
  it("returns visible holidays under the active filters", () => {
    const dayMap = buildHolidayDayMap(dataset);
    const belgiumHoliday = findHoliday(dataset, (holiday) => holiday.country === "BE");
    const holidays = getHolidaysForDay(dataset, dayMap, belgiumHoliday.startDate, {
      countryCodes: [belgiumHoliday.country]
    });

    expect(holidays).not.toHaveLength(0);
    expect(holidays.every((holiday) => holiday.country === belgiumHoliday.country)).toBe(true);
  });

  it("includes Belgian Flemish school holidays on a real in-window day", () => {
    const dayMap = buildHolidayDayMap(dataset);
    const flemishHoliday = findHoliday(
      dataset,
      (holiday) => holiday.country === "BE" && holiday.holidayType === "school" && holiday.regionId === "BE-NL"
    );
    const holidays = getHolidaysForDay(dataset, dayMap, flemishHoliday.startDate, {
      countryCodes: ["BE"]
    });

    expect(
      holidays.some(
        (holiday) =>
          holiday.name === flemishHoliday.name &&
          holiday.regionId === flemishHoliday.regionId &&
          holiday.startDate === flemishHoliday.startDate &&
          holiday.endDate === flemishHoliday.endDate
      )
    ).toBe(true);
  });

  it("keeps shared national public holidays national across countries", () => {
    const { holidays } = findDateWithHolidays(dataset, ["BE", "FR", "NL"], (visibleHolidays) => {
      return ["BE", "FR", "NL"].every((countryCode) =>
        visibleHolidays.some((holiday) => holiday.country === countryCode && holiday.holidayType === "public")
      );
    });
    const sharedPublicHolidays = holidays.filter(
      (holiday) => ["BE", "FR", "NL"].includes(holiday.country) && holiday.holidayType === "public"
    );

    expect(
      sharedPublicHolidays.map((holiday) => holiday.scope)
    ).toEqual(["national", "national", "national"]);
  });

  it("keeps France zone coverage and Netherlands national school coverage normalized in the dataset", () => {
    const franceCoverage = findCoverage(
      dataset,
      (coverage) => coverage.country === "FR" && coverage.holidayType === "school" && coverage.segments.some((segment) => segment.model === "zone")
    );
    const netherlandsCoverage = findCoverage(
      dataset,
      (coverage) => coverage.country === "NL" && coverage.holidayType === "school" && coverage.segments.some((segment) => segment.displayMode === "national")
    );

    expect(franceCoverage.segments.some((segment) => segment.model === "zone")).toBe(true);
    expect(franceCoverage.segments.some((segment) => segment.displayMode === "count")).toBe(true);
    expect(netherlandsCoverage.segments.map((segment) => segment.displayMode)).toEqual(["national"]);
  });
});
