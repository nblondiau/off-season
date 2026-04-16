import type { DatasetBundle, HolidayCoverageRecord, HolidayRecord } from "../types";
import { buildHolidayDayMap, getHolidaysForDay, type HolidayOnDay } from "../lib/dataset";

export function findHoliday(dataset: DatasetBundle, predicate: (holiday: HolidayRecord) => boolean): HolidayRecord {
  const holiday = dataset.holidays.find(predicate);
  if (!holiday) {
    throw new Error("Expected matching holiday in test dataset.");
  }
  return holiday;
}

export function findCoverage(
  dataset: DatasetBundle,
  predicate: (coverage: HolidayCoverageRecord) => boolean
): HolidayCoverageRecord {
  const coverage = dataset.holidayCoverage.find(predicate);
  if (!coverage) {
    throw new Error("Expected matching coverage record in test dataset.");
  }
  return coverage;
}

export function findDateWithHolidays(
  dataset: DatasetBundle,
  countryCodes: string[],
  predicate: (holidays: HolidayOnDay[], date: string) => boolean
): { date: string; holidays: HolidayOnDay[] } {
  const dayMap = buildHolidayDayMap(dataset);
  const dates = Array.from(dayMap.keys()).sort((left, right) => left.localeCompare(right));

  for (const date of dates) {
    const holidays = getHolidaysForDay(dataset, dayMap, date, { countryCodes });
    if (predicate(holidays, date)) {
      return { date, holidays };
    }
  }

  throw new Error("Expected matching date in test dataset.");
}
