import type { DatasetBundle, HolidayRecord } from "../types";
import { daysBetweenInclusive } from "./date";

export interface HolidayOnDay extends HolidayRecord {
  sourceLabel: string;
  sourceKind: string;
}

export interface FilterState {
  countryCodes: string[];
}

export function buildHolidayCoverageKey(holiday: Pick<
  HolidayRecord,
  "country" | "name" | "holidayType" | "sourceId" | "startDate" | "endDate" | "notes"
>) {
  return [
    holiday.country,
    holiday.name.toLowerCase(),
    holiday.holidayType,
    holiday.sourceId,
    holiday.startDate,
    holiday.endDate,
    holiday.notes ?? ""
  ].join("::");
}

export function buildHolidayDayMap(dataset: DatasetBundle): Map<string, HolidayRecord[]> {
  const dayMap = new Map<string, HolidayRecord[]>();

  for (const holiday of dataset.holidays) {
    for (const date of daysBetweenInclusive(holiday.startDate, holiday.endDate)) {
      const current = dayMap.get(date) ?? [];
      current.push(holiday);
      dayMap.set(date, current);
    }
  }

  return dayMap;
}

export function getHolidaysForDay(
  dataset: DatasetBundle,
  dayMap: Map<string, HolidayRecord[]>,
  date: string,
  filters: FilterState
): HolidayOnDay[] {
  const sourceMap = new Map(dataset.sources.map((source) => [source.sourceId, source]));

  return (dayMap.get(date) ?? [])
    .filter((holiday) => filters.countryCodes.includes(holiday.country))
    .map((holiday) => {
      const source = sourceMap.get(holiday.sourceId);
      return {
        ...holiday,
        sourceLabel: source?.sourceName ?? holiday.sourceId,
        sourceKind: source?.sourceKind ?? "unknown"
      };
    });
}
