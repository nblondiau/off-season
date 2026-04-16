import { buildDatasetFromPayload, resolveLastCheckedAt } from "./build-data.mjs";

const source = {
  sourceId: "openholidays-api",
  sourceName: "OpenHolidays API",
  sourceUrl: "https://openholidaysapi.org/",
  sourceKind: "aggregated_open_data",
  coverage: "Europe public holidays and school holidays",
  snapshotPath: "data/snapshots/openholidays-europe.json",
  defaultLastChangedAt: "2026-04-12"
};

function createPayload(overrides = {}) {
  return {
    generatedAt: "2026-04-15",
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
    const payload = createPayload({ lastCheckedAt: "2026-04-14" });

    const dataset = buildDatasetFromPayload(payload, "2026-04-16", source);

    expect(dataset.generatedAt).toBe("2026-04-16");
    expect(dataset.sources[0].lastCheckedAt).toBe("2026-04-14");
    expect(dataset.sources[0].lastChangedAt).toBe("2026-04-12");
  });

  it("falls back to the snapshot generated date for legacy payloads", () => {
    const payload = createPayload();

    const dataset = buildDatasetFromPayload(payload, "2026-04-16", source);

    expect(dataset.sources[0].lastCheckedAt).toBe("2026-04-15");
  });

  it("falls back to the current build date when no persisted metadata exists", () => {
    expect(resolveLastCheckedAt({ countries: [] }, "2026-04-16")).toBe("2026-04-16");
  });
});
