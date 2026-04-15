export type CountryCode = string;

export type HolidayType = "public" | "school";
export type HolidayScope = "national" | "regional";

export type SourceKind =
  | "aggregated_open_data"
  | "official_open_data"
  | "official_structured"
  | "official_page_fallback";

export interface CountryRecord {
  countryCode: CountryCode;
  label: string;
}

export interface RegionRecord {
  id: string;
  country: CountryCode;
  label: string;
  scope: "national" | "subdivision" | "group";
  sourceIds: string[];
}

export interface SourceRecord {
  sourceId: string;
  sourceName: string;
  sourceUrl: string;
  sourceKind: SourceKind;
  coverage: string;
  lastCheckedAt: string;
  lastChangedAt: string;
}

export interface HolidayRecord {
  id: string;
  country: CountryCode;
  regionId: string;
  regionLabel: string;
  scope: HolidayScope;
  holidayType: HolidayType;
  name: string;
  startDate: string;
  endDate: string;
  sourceId: string;
  notes?: string;
}

export interface HolidayCoverageSegment {
  model: string;
  normalizedScope: HolidayScope;
  displayMode: "national" | "count" | "labels";
  regionLabels: string[];
  regionCount: number;
  countLabel?: string;
  totalRegionCount?: number;
}

export interface HolidayCoverageRecord {
  key: string;
  country: CountryCode;
  holidayType: HolidayType;
  name: string;
  startDate: string;
  endDate: string;
  sourceId: string;
  notes?: string;
  segments: HolidayCoverageSegment[];
}

export interface OffSeasonDay {
  date: string;
  offSeason: boolean;
  holidayIds: string[];
}

export interface DatasetBundle {
  generatedAt: string;
  windowStart: string;
  windowEnd: string;
  countries: CountryRecord[];
  regions: RegionRecord[];
  sources: SourceRecord[];
  holidays: HolidayRecord[];
  holidayCoverage: HolidayCoverageRecord[];
  offSeasonDays: OffSeasonDay[];
}
