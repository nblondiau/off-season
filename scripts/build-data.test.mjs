import { buildDatasetFromPayload, resolveLastCheckedAt } from "./build-data.mjs";

const TEST_YEAR = new Date().getUTCFullYear() + 1;
const GENERATED_AT = `${TEST_YEAR}-04-15`;
const LAST_CHECKED_AT = `${TEST_YEAR}-04-14`;
const BUILD_DATE = `${TEST_YEAR}-04-16`;
const LAST_CHANGED_AT = `${TEST_YEAR}-04-12`;

const source = {
  sourceId: "openholidays-api",
  sourceName: "OpenHolidays API",
  sourceUrl: "https://openholidaysapi.org/",
  sourceKind: "aggregated_open_data",
  coverage: "Europe public holidays and school holidays",
  snapshotPath: "data/snapshots/openholidays-europe.json",
  defaultLastChangedAt: LAST_CHANGED_AT
};

function createPayload(overrides = {}) {
  return {
    generatedAt: GENERATED_AT,
    countries: [],
    subdivisionsByCountry: {},
    groupsByCountry: {},
    publicHolidaysByCountry: {},
    schoolHolidaysByCountry: {},
    ...overrides
  };
}

describe("build-data metadata", () => {
  it("prefers the persisted live query date for last checked", () => {
    const payload = createPayload({ lastCheckedAt: LAST_CHECKED_AT });

    const dataset = buildDatasetFromPayload(payload, BUILD_DATE, source);

    expect(dataset.generatedAt).toBe(BUILD_DATE);
    expect(dataset.sources[0].lastCheckedAt).toBe(LAST_CHECKED_AT);
    expect(dataset.sources[0].lastChangedAt).toBe(LAST_CHANGED_AT);
  });

  it("falls back to the snapshot generated date for legacy payloads", () => {
    const payload = createPayload();

    const dataset = buildDatasetFromPayload(payload, BUILD_DATE, source);

    expect(dataset.sources[0].lastCheckedAt).toBe(GENERATED_AT);
  });

  it("falls back to the current build date when no persisted metadata exists", () => {
    expect(resolveLastCheckedAt({ countries: [] }, BUILD_DATE)).toBe(BUILD_DATE);
  });
});
