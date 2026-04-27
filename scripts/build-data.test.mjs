import { afterEach, vi } from "vitest";
import {
  buildDatasetFromPayload,
  fetchLiveSnapshot,
  getRollingHolidayWindow,
  resolveDatasetWindow,
  resolveLastCheckedAt
} from "./build-data.mjs";

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

function localized(text) {
  return [{ language: "EN", text }];
}

function createHoliday(overrides = {}) {
  return {
    id: "holiday-1",
    name: localized("Test holiday"),
    startDate: `${TEST_YEAR}-04-10`,
    endDate: `${TEST_YEAR}-04-12`,
    nationwide: true,
    subdivisions: [],
    groups: [],
    ...overrides
  };
}

function createCountryPayload(overrides = {}) {
  return createPayload({
    countries: [{ countryCode: "BE", label: "Belgium", officialLanguages: [] }],
    publicHolidaysByCountry: {
      BE: [createHoliday()]
    },
    schoolHolidaysByCountry: {
      BE: []
    },
    ...overrides
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

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

describe("build-data holiday window", () => {
  it("builds a rolling full-month window for the current month plus 24 months", () => {
    expect(getRollingHolidayWindow("2026-04-27")).toEqual({
      windowStart: "2026-04-01",
      windowEnd: "2028-04-30"
    });
  });

  it("uses the payload window for generated metadata, filtering, and off-season days", () => {
    const payload = createCountryPayload({
      windowStart: `${TEST_YEAR}-04-01`,
      windowEnd: `${TEST_YEAR}-04-30`,
      publicHolidaysByCountry: {
        BE: [
          createHoliday({ id: "inside", startDate: `${TEST_YEAR}-04-10`, endDate: `${TEST_YEAR}-04-12` }),
          createHoliday({ id: "outside", startDate: `${TEST_YEAR}-05-01`, endDate: `${TEST_YEAR}-05-01` })
        ]
      }
    });

    const dataset = buildDatasetFromPayload(payload, BUILD_DATE, source);

    expect(dataset.windowStart).toBe(`${TEST_YEAR}-04-01`);
    expect(dataset.windowEnd).toBe(`${TEST_YEAR}-04-30`);
    expect(dataset.holidays).toHaveLength(1);
    expect(dataset.holidays[0].startDate).toBe(`${TEST_YEAR}-04-10`);
    expect(dataset.offSeasonDays[0].date).toBe(`${TEST_YEAR}-04-01`);
    expect(dataset.offSeasonDays.at(-1)?.date).toBe(`${TEST_YEAR}-04-30`);
  });

  it("uses stored snapshot window bounds when available", () => {
    const payload = createPayload({
      windowStart: `${TEST_YEAR}-01-01`,
      windowEnd: `${TEST_YEAR}-12-31`
    });

    expect(resolveDatasetWindow(payload, BUILD_DATE)).toEqual({
      windowStart: `${TEST_YEAR}-01-01`,
      windowEnd: `${TEST_YEAR}-12-31`
    });
  });

  it("derives legacy snapshot bounds from returned holiday dates", () => {
    const payload = createCountryPayload({
      publicHolidaysByCountry: {
        BE: [
          createHoliday({ startDate: `${TEST_YEAR}-02-10`, endDate: `${TEST_YEAR}-02-10` }),
          createHoliday({ startDate: `${TEST_YEAR}-11-01`, endDate: `${TEST_YEAR}-11-03` })
        ]
      }
    });

    expect(resolveDatasetWindow(payload, BUILD_DATE)).toEqual({
      windowStart: `${TEST_YEAR}-02-10`,
      windowEnd: `${TEST_YEAR}-11-03`
    });
  });

  it("falls back to the rolling window for legacy snapshots without holidays", () => {
    expect(resolveDatasetWindow(createPayload(), "2026-04-27")).toEqual({
      windowStart: "2026-04-01",
      windowEnd: "2028-04-30"
    });
  });

  it("queries OpenHolidays with the rolling window and stores it in the live snapshot", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      const textUrl = String(url);
      const body = textUrl.endsWith("/Countries")
        ? [{ isoCode: "BE", name: localized("Belgium"), officialLanguages: [] }]
        : [];

      return {
        ok: true,
        json: async () => body
      };
    });

    const snapshot = await fetchLiveSnapshot("2026-04-27");

    expect(snapshot.windowStart).toBe("2026-04-01");
    expect(snapshot.windowEnd).toBe("2028-04-30");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://openholidaysapi.org/PublicHolidays?countryIsoCode=BE&languageIsoCode=EN&validFrom=2026-04-01&validTo=2028-04-30",
      expect.any(Object)
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "https://openholidaysapi.org/SchoolHolidays?countryIsoCode=BE&languageIsoCode=EN&validFrom=2026-04-01&validTo=2028-04-30",
      expect.any(Object)
    );
  });
});
