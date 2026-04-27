export const EUROPEAN_COUNTRY_CODES = [
  "AD",
  "AL",
  "AT",
  "BE",
  "BG",
  "BY",
  "CH",
  "CZ",
  "DE",
  "EE",
  "ES",
  "FR",
  "HR",
  "HU",
  "IE",
  "IT",
  "LI",
  "LT",
  "LU",
  "LV",
  "MC",
  "MD",
  "MT",
  "NL",
  "PL",
  "PT",
  "RO",
  "RS",
  "SE",
  "SI",
  "SK",
  "SM",
  "VA"
];

export const sourceDefaults = [
  {
    sourceId: "openholidays-api",
    sourceName: "OpenHolidays API",
    sourceUrl: "https://openholidaysapi.org/",
    sourceKind: "aggregated_open_data",
    coverage: "Europe public holidays and school holidays",
    snapshotPath: "data/snapshots/openholidays-europe.json",
    defaultLastChangedAt: "2026-04-12"
  }
];
