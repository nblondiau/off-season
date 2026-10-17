import datasetJson from "../generated/dataset.json";
import type { DatasetBundle, HolidayRecord } from "../types";
import { buildHolidayDayMap, getCountriesMissingSchoolHolidays, getHolidaysForDay } from "./dataset";
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

  it("reports exactly the countries without school holidays in the dataset window", () => {
    const missing = new Set(getCountriesMissingSchoolHolidays(dataset));
    const countriesWithSchoolHolidays = new Set(
      dataset.holidays
        .filter((holiday) => holiday.holidayType === "school")
        .map((holiday) => holiday.country)
    );

    // Assert the relationship rather than specific countries so the test survives
    // the data changing (e.g. a country's school holidays being published later).
    for (const country of dataset.countries) {
      expect(missing.has(country.countryCode)).toBe(!countriesWithSchoolHolidays.has(country.countryCode));
    }
  });

  it("stops reporting a country once school holidays appear in the window", () => {
    const spanishSchoolHoliday: HolidayRecord = {
      id: "es-school-test",
      country: "ES",
      regionId: "ES-NAT",
      regionLabel: "Spain",
      scope: "national",
      holidayType: "school",
      name: "Test school holiday",
      startDate: dataset.windowStart,
      endDate: dataset.windowStart,
      sourceId: dataset.sources[0].sourceId
    };
    const datasetWithSpanishSchool: DatasetBundle = {
      ...dataset,
      holidays: [...dataset.holidays, spanishSchoolHoliday]
    };

    expect(getCountriesMissingSchoolHolidays(dataset)).toContain("ES");
    expect(getCountriesMissingSchoolHolidays(datasetWithSpanishSchool)).not.toContain("ES");
  });

  it("includes regional Belgian school holidays on a real in-window day", () => {
    const dayMap = buildHolidayDayMap(dataset);
    const regionalSchoolHoliday = findHoliday(
      dataset,
      (holiday) =>
        holiday.country === "BE" && holiday.holidayType === "school" && holiday.scope === "regional"
    );
    const holidays = getHolidaysForDay(dataset, dayMap, regionalSchoolHoliday.startDate, {
      countryCodes: ["BE"]
    });

    expect(
      holidays.some(
        (holiday) =>
          holiday.name === regionalSchoolHoliday.name &&
          holiday.regionId === regionalSchoolHoliday.regionId &&
          holiday.startDate === regionalSchoolHoliday.startDate &&
          holiday.endDate === regionalSchoolHoliday.endDate
      )
    ).toBe(true);
  });

  it("keeps shared national public holidays national across countries", () => {
    const countryCodes = ["BE", "FR", "NL"];
    // Target a holiday that all three countries share by name, so an unrelated
    // regional holiday that happens to land on the same day cannot skew the check.
    const { holidays } = findDateWithHolidays(dataset, countryCodes, (visibleHolidays) => {
      const publicHolidays = visibleHolidays.filter((holiday) => holiday.holidayType === "public");
      return publicHolidays.some((candidate) =>
        countryCodes.every((countryCode) =>
          publicHolidays.some((holiday) => holiday.country === countryCode && holiday.name === candidate.name)
        )
      );
    });

    const publicHolidays = holidays.filter((holiday) => holiday.holidayType === "public");
    const sharedName = publicHolidays.find((candidate) =>
      countryCodes.every((countryCode) =>
        publicHolidays.some((holiday) => holiday.country === countryCode && holiday.name === candidate.name)
      )
    )?.name;
    const sharedPublicHolidays = publicHolidays
      .filter((holiday) => holiday.name === sharedName)
      .sort((left, right) => left.country.localeCompare(right.country));

    expect(sharedName).toBeDefined();
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
