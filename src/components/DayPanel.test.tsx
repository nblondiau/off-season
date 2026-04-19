import { render, screen } from "@testing-library/react";
import { DayPanel } from "./DayPanel";
import type { DatasetBundle, HolidayCoverageRecord } from "../types";
import { buildHolidayCoverageKey, type HolidayOnDay } from "../lib/dataset";
import { TEST_YEAR, isoDate } from "../test/date-helpers";

const SUMMER_DATE = isoDate(TEST_YEAR, 7, 21);
const SPRING_DATE = isoDate(TEST_YEAR, 4, 14);
const WINTER_START = isoDate(TEST_YEAR, 12, 20);
const WINTER_ALT_START = isoDate(TEST_YEAR, 12, 19);
const WINTER_END = isoDate(TEST_YEAR + 1, 1, 3);
const WINTER_DATE = isoDate(TEST_YEAR, 12, 25);

const DATASET: DatasetBundle = {
  generatedAt: SPRING_DATE,
  windowStart: isoDate(TEST_YEAR - 1, 9, 1),
  windowEnd: isoDate(TEST_YEAR + 1, 6, 30),
  countries: [
    { countryCode: "BE", label: "Belgium" },
    { countryCode: "FR", label: "France" }
  ],
  regions: [
    { id: "BE", country: "BE", label: "Belgium", scope: "national", sourceIds: ["s1"] },
    { id: "BE-VLG", country: "BE", label: "Belgium · Flanders", scope: "group", sourceIds: ["s1"] },
    { id: "BE-WAL", country: "BE", label: "Belgium · Wallonia", scope: "group", sourceIds: ["s1"] },
    { id: "BE-BRU", country: "BE", label: "Belgium · Brussels", scope: "group", sourceIds: ["s1"] },
    { id: "FR", country: "FR", label: "France", scope: "national", sourceIds: ["s1"] }
  ],
  sources: [{
    sourceId: "s1",
    sourceName: "OpenHolidays API",
    sourceUrl: "https://openholidaysapi.org",
    sourceKind: "aggregated_open_data",
    coverage: "BE",
    lastCheckedAt: SPRING_DATE,
    lastChangedAt: SPRING_DATE
  }],
  holidays: [],
  holidayCoverage: [],
  offSeasonDays: []
};

function makeHoliday(overrides: Partial<HolidayOnDay> = {}): HolidayOnDay {
  return {
    id: "h1",
    country: "BE",
    regionId: "BE",
    regionLabel: "Belgium",
    scope: "national",
    holidayType: "public",
    name: "National Day",
    startDate: SUMMER_DATE,
    endDate: SUMMER_DATE,
    sourceId: "s1",
    sourceLabel: "OpenHolidays API",
    sourceKind: "aggregated_open_data",
    ...overrides
  };
}

function makeCoverage(overrides: Partial<HolidayCoverageRecord> = {}): HolidayCoverageRecord {
  const baseHoliday = makeHoliday();
  return {
    key: buildHolidayCoverageKey(baseHoliday),
    country: baseHoliday.country,
    holidayType: baseHoliday.holidayType,
    name: baseHoliday.name,
    startDate: baseHoliday.startDate,
    endDate: baseHoliday.endDate,
    sourceId: baseHoliday.sourceId,
    notes: baseHoliday.notes,
    segments: [{
      model: "national",
      normalizedScope: "national",
      displayMode: "national",
      regionLabels: [baseHoliday.regionLabel],
      regionCount: 1,
      countLabel: "regions"
    }],
    ...overrides
  };
}

describe("DayPanel", () => {
  it("does not render the Selected day title", () => {
    render(<DayPanel dataset={DATASET} date={SPRING_DATE} holidays={[]} />);
    expect(screen.queryByText("Selected day")).not.toBeInTheDocument();
  });

  it("shows the selected date", () => {
    render(<DayPanel dataset={DATASET} date={SPRING_DATE} holidays={[]} />);
    expect(screen.getByRole("heading", { name: SPRING_DATE })).toBeInTheDocument();
  });

  it("shows empty message when no holidays match", () => {
    render(<DayPanel dataset={DATASET} date={SPRING_DATE} holidays={[]} />);
    expect(screen.getByText(/No holidays match/i)).toBeInTheDocument();
  });

  it("renders holiday name and type pill", () => {
    const holidays = [makeHoliday()];
    render(<DayPanel dataset={DATASET} date={SUMMER_DATE} holidays={holidays} />);
    expect(screen.getByText("National Day")).toBeInTheDocument();
    expect(screen.getByText("public")).toBeInTheDocument();
  });

  it("groups holidays under a country heading", () => {
    const holidays = [makeHoliday({ country: "BE", regionLabel: "Belgium" })];
    render(<DayPanel dataset={DATASET} date={SUMMER_DATE} holidays={holidays} />);
    expect(screen.getByRole("heading", { name: "Belgium" })).toBeInTheDocument();
  });

  it("shows the number of affected regions for grouped holidays", () => {
    const holidays = [
      makeHoliday({ id: "h1", country: "BE", regionId: "BE-VLG", regionLabel: "Belgium · Flanders", scope: "regional" }),
      makeHoliday({ id: "h2", country: "BE", regionId: "BE-VLG", regionLabel: "Belgium · Flanders", scope: "regional" })
    ];
    const dataset = {
      ...DATASET,
      holidayCoverage: [
        makeCoverage({
          segments: [{
            model: "geographic_group",
            normalizedScope: "regional",
            displayMode: "count",
            regionLabels: ["Belgium · Flanders"],
            regionCount: 1,
            countLabel: "communities",
            totalRegionCount: 3
          }]
        })
      ]
    };
    render(<DayPanel dataset={dataset} date={SUMMER_DATE} holidays={holidays} />);
    expect(screen.getByText("1/3 communities · Flanders")).toBeInTheDocument();
  });

  it("lists affected regions when up to five regions match", () => {
    const holidays = [
      makeHoliday({ id: "h1", country: "BE", regionId: "BE-BRU", regionLabel: "Belgium · Brussels", scope: "regional" }),
      makeHoliday({ id: "h2", country: "BE", regionId: "BE-DE", regionLabel: "Belgium · German-speaking community", scope: "regional" }),
      makeHoliday({ id: "h3", country: "BE", regionId: "BE-NL", regionLabel: "Belgium · Flemish community", scope: "regional" }),
      makeHoliday({ id: "h4", country: "BE", regionId: "BE-VLG", regionLabel: "Belgium · Flanders", scope: "regional" }),
      makeHoliday({ id: "h5", country: "BE", regionId: "BE-WAL", regionLabel: "Belgium · Wallonia", scope: "regional" })
    ];
    const dataset = {
      ...DATASET,
      holidayCoverage: [
        makeCoverage({
          segments: [{
            model: "geographic_group",
            normalizedScope: "regional",
            displayMode: "count",
            regionLabels: [
              "Belgium · Brussels",
              "Belgium · German-speaking community",
              "Belgium · Flemish community",
              "Belgium · Flanders",
              "Belgium · Wallonia"
            ],
            regionCount: 5,
            countLabel: "communities",
            totalRegionCount: 6
          }]
        })
      ]
    };
    render(<DayPanel dataset={dataset} date={SUMMER_DATE} holidays={holidays} />);
    expect(
      screen.getByText(
        "5/6 communities · Brussels, Flanders, Flemish community, German-speaking community, Wallonia"
      )
    ).toBeInTheDocument();
  });

  it("shows only the count summary when more than five regions match", () => {
    const holidays = [
      makeHoliday({ id: "h1", country: "BE", regionId: "BE-BRU", regionLabel: "Belgium · Brussels", scope: "regional" }),
      makeHoliday({ id: "h2", country: "BE", regionId: "BE-DE", regionLabel: "Belgium · German-speaking community", scope: "regional" }),
      makeHoliday({ id: "h3", country: "BE", regionId: "BE-NL", regionLabel: "Belgium · Flemish community", scope: "regional" }),
      makeHoliday({ id: "h4", country: "BE", regionId: "BE-VLG", regionLabel: "Belgium · Flanders", scope: "regional" }),
      makeHoliday({ id: "h5", country: "BE", regionId: "BE-WAL", regionLabel: "Belgium · Wallonia", scope: "regional" }),
      makeHoliday({ id: "h6", country: "BE", regionId: "BE-SM", regionLabel: "Belgium · Small region", scope: "regional" })
    ];
    const dataset = {
      ...DATASET,
      holidayCoverage: [
        makeCoverage({
          segments: [{
            model: "geographic_group",
            normalizedScope: "regional",
            displayMode: "count",
            regionLabels: [
              "Belgium · Brussels",
              "Belgium · German-speaking community",
              "Belgium · Flemish community",
              "Belgium · Flanders",
              "Belgium · Wallonia",
              "Belgium · Small region"
            ],
            regionCount: 6,
            countLabel: "communities",
            totalRegionCount: 7
          }]
        })
      ]
    };
    render(<DayPanel dataset={dataset} date={SUMMER_DATE} holidays={holidays} />);
    expect(screen.getByText("6/7 communities")).toBeInTheDocument();
    expect(screen.queryByText(/Brussels/)).not.toBeInTheDocument();
  });

  it("shows National when all regional subdivisions match", () => {
    const holidays = [
      makeHoliday({ id: "h1", country: "BE", regionId: "BE-BRU", regionLabel: "Belgium · Brussels", scope: "regional" }),
      makeHoliday({ id: "h2", country: "BE", regionId: "BE-VLG", regionLabel: "Belgium · Flanders", scope: "regional" }),
      makeHoliday({ id: "h3", country: "BE", regionId: "BE-WAL", regionLabel: "Belgium · Wallonia", scope: "regional" })
    ];
    const dataset = {
      ...DATASET,
      holidayCoverage: [makeCoverage({
        segments: [{
          model: "geographic_group",
          normalizedScope: "national",
          displayMode: "national",
          regionLabels: [
            "Belgium · Brussels",
            "Belgium · Flanders",
            "Belgium · Wallonia"
          ],
          regionCount: 3,
          totalRegionCount: 3
        }]
      })]
    };
    render(<DayPanel dataset={dataset} date={SUMMER_DATE} holidays={holidays} />);
    expect(screen.getByText("National")).toBeInTheDocument();
    expect(screen.queryByText(/3\/3 communities/)).not.toBeInTheDocument();
  });

  it("shows the single affected region label when only one region matches", () => {
    const holidays = [makeHoliday({ country: "BE", regionId: "BE-VLG", regionLabel: "Belgium · Flanders", scope: "regional" })];
    const dataset = {
      ...DATASET,
      holidayCoverage: [
        makeCoverage({
          segments: [{
            model: "geographic_group",
            normalizedScope: "regional",
            displayMode: "count",
            regionLabels: ["Belgium · Flanders"],
            regionCount: 1,
            countLabel: "communities",
            totalRegionCount: 3
          }]
        })
      ]
    };
    render(<DayPanel dataset={dataset} date={SUMMER_DATE} holidays={holidays} />);
    expect(screen.getByText("1/3 communities · Flanders")).toBeInTheDocument();
  });

  it("shows up to five direct region labels before collapsing", () => {
    const holidays = [
      makeHoliday({ id: "h1", country: "BE", regionId: "BE-BRU", regionLabel: "Belgium · Brussels", scope: "regional" }),
      makeHoliday({ id: "h2", country: "BE", regionId: "BE-DE", regionLabel: "Belgium · German-speaking community", scope: "regional" }),
      makeHoliday({ id: "h3", country: "BE", regionId: "BE-NL", regionLabel: "Belgium · Flemish community", scope: "regional" }),
      makeHoliday({ id: "h4", country: "BE", regionId: "BE-VLG", regionLabel: "Belgium · Flanders", scope: "regional" }),
      makeHoliday({ id: "h5", country: "BE", regionId: "BE-WAL", regionLabel: "Belgium · Wallonia", scope: "regional" })
    ];

    render(<DayPanel dataset={DATASET} date={SUMMER_DATE} holidays={holidays} />);
    expect(
      screen.getByText("Brussels, Flanders, Flemish community, German-speaking community, Wallonia")
    ).toBeInTheDocument();
  });

  it("collapses direct region labels after five entries", () => {
    const holidays = [
      makeHoliday({ id: "h1", country: "BE", regionId: "BE-BRU", regionLabel: "Belgium · Brussels", scope: "regional" }),
      makeHoliday({ id: "h2", country: "BE", regionId: "BE-DE", regionLabel: "Belgium · German-speaking community", scope: "regional" }),
      makeHoliday({ id: "h3", country: "BE", regionId: "BE-NL", regionLabel: "Belgium · Flemish community", scope: "regional" }),
      makeHoliday({ id: "h4", country: "BE", regionId: "BE-VLG", regionLabel: "Belgium · Flanders", scope: "regional" }),
      makeHoliday({ id: "h5", country: "BE", regionId: "BE-WAL", regionLabel: "Belgium · Wallonia", scope: "regional" }),
      makeHoliday({ id: "h6", country: "BE", regionId: "BE-SM", regionLabel: "Belgium · Small region", scope: "regional" })
    ];

    render(<DayPanel dataset={DATASET} date={SUMMER_DATE} holidays={holidays} />);
    expect(
      screen.getByText("Brussels, Flanders, Flemish community, German-speaking community, Small region +1 more")
    ).toBeInTheDocument();
  });

  it("shows National for country-wide holidays", () => {
    const holidays = [makeHoliday({ country: "BE", regionId: "BE", regionLabel: "Belgium", scope: "national" })];
    render(<DayPanel dataset={DATASET} date={SUMMER_DATE} holidays={holidays} />);
    expect(screen.getByText("National")).toBeInTheDocument();
    expect(screen.queryByText(/1\/3 communities/)).not.toBeInTheDocument();
  });

  it("renders separate groups for different countries", () => {
    const holidays = [
      makeHoliday({ id: "h1", country: "BE", regionId: "BE", regionLabel: "Belgium", scope: "national" }),
      makeHoliday({ id: "h2", country: "FR", regionId: "FR", regionLabel: "France", scope: "national", name: "Bastille Day" })
    ];
    render(<DayPanel dataset={DATASET} date={SUMMER_DATE} holidays={holidays} />);
    expect(screen.getByRole("heading", { name: "Belgium" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "France" })).toBeInTheDocument();
  });

  it("renders holiday notes when present", () => {
    const holidays = [makeHoliday({ notes: "Only in Flanders" })];
    render(<DayPanel dataset={DATASET} date={SUMMER_DATE} holidays={holidays} />);
    expect(screen.getByText("Only in Flanders")).toBeInTheDocument();
  });

  it("does not render notes paragraph when notes are absent", () => {
    const holidays = [makeHoliday({ notes: undefined })];
    const { container } = render(<DayPanel dataset={DATASET} date={SUMMER_DATE} holidays={holidays} />);
    expect(container.querySelector(".holiday-notes")).toBeNull();
  });

  it("shows only the zone meta line when zone and administrative coverage coexist", () => {
    const holidays = [
      makeHoliday({
        id: "fr-1",
        country: "FR",
        regionId: "FR-AR",
        regionLabel: "France · Auvergne-Rhône-Alpes",
        scope: "regional",
        holidayType: "school",
        name: "Christmas Holidays",
        startDate: WINTER_START,
        endDate: WINTER_END
      }),
      makeHoliday({
        id: "fr-2",
        country: "FR",
        regionId: "FR-ZA",
        regionLabel: "France · Zone A",
        scope: "regional",
        holidayType: "school",
        name: "Christmas Holidays",
        startDate: WINTER_START,
        endDate: WINTER_END
      })
    ];
    const dataset = {
      ...DATASET,
      holidayCoverage: [
        makeCoverage({
          key: buildHolidayCoverageKey(holidays[0]),
          country: "FR",
          holidayType: "school",
          name: "Christmas Holidays",
          startDate: WINTER_START,
          endDate: WINTER_END,
          segments: [
            {
              model: "zone",
              normalizedScope: "regional",
              displayMode: "count",
              regionLabels: ["France · Zone A"],
              regionCount: 1,
              countLabel: "zones",
              totalRegionCount: 3
            }
          ]
        })
      ]
    };
    render(<DayPanel dataset={dataset} date={WINTER_DATE} holidays={holidays} />);
    expect(screen.getByText("1/3 zones · Zone A")).toBeInTheDocument();
    expect(screen.queryByText(/Auvergne-Rhône-Alpes/)).not.toBeInTheDocument();
  });

  it("merges same-name holidays with different date ranges into one card", () => {
    const holidays = [
      makeHoliday({
        id: "be-de-spring",
        country: "BE",
        regionId: "BE-DE",
        regionLabel: "Belgium · German-speaking community",
        scope: "regional",
        holidayType: "school",
        name: "Spring Holidays",
        startDate: isoDate(TEST_YEAR, 4, 6),
        endDate: isoDate(TEST_YEAR, 4, 18)
      }),
      makeHoliday({
        id: "be-nl-spring",
        country: "BE",
        regionId: "BE-NL",
        regionLabel: "Belgium · Flemish community",
        scope: "regional",
        holidayType: "school",
        name: "Spring Holidays",
        startDate: isoDate(TEST_YEAR, 4, 6),
        endDate: isoDate(TEST_YEAR, 4, 19)
      })
    ];
    const dataset = {
      ...DATASET,
      holidayCoverage: [
        makeCoverage({
          key: buildHolidayCoverageKey(holidays[0]),
          country: "BE",
          holidayType: "school",
          name: "Spring Holidays",
          startDate: isoDate(TEST_YEAR, 4, 6),
          endDate: isoDate(TEST_YEAR, 4, 18),
          segments: [{
            model: "geographic_group",
            normalizedScope: "regional",
            displayMode: "count",
            regionLabels: ["Belgium · German-speaking community"],
            regionCount: 1,
            countLabel: "communities",
            totalRegionCount: 3
          }]
        }),
        makeCoverage({
          key: buildHolidayCoverageKey(holidays[1]),
          country: "BE",
          holidayType: "school",
          name: "Spring Holidays",
          startDate: isoDate(TEST_YEAR, 4, 6),
          endDate: isoDate(TEST_YEAR, 4, 19),
          segments: [{
            model: "geographic_group",
            normalizedScope: "regional",
            displayMode: "count",
            regionLabels: ["Belgium · Flemish community"],
            regionCount: 1,
            countLabel: "communities",
            totalRegionCount: 3
          }]
        })
      ]
    };
    render(<DayPanel dataset={dataset} date={SPRING_DATE} holidays={holidays} />);
    expect(screen.getByText("2/3 communities · Flemish community, German-speaking community")).toBeInTheDocument();
    expect(screen.getAllByText("Spring Holidays")).toHaveLength(1);
  });

  it("deduplicates holiday names that differ only by capitalization", () => {
    const holidays = [
      makeHoliday({
        id: "de-1",
        country: "DE",
        regionId: "DE",
        regionLabel: "Germany",
        scope: "national",
        holidayType: "school",
        name: "Christmas holidays",
        startDate: WINTER_START,
        endDate: WINTER_END
      }),
      makeHoliday({
        id: "de-2",
        country: "DE",
        regionId: "DE",
        regionLabel: "Germany",
        scope: "national",
        holidayType: "school",
        name: "Christmas Holidays",
        startDate: WINTER_START,
        endDate: WINTER_END
      })
    ];
    const dataset = {
      ...DATASET,
      countries: [...DATASET.countries, { countryCode: "DE", label: "Germany" }]
    };

    render(<DayPanel dataset={dataset} date={WINTER_DATE} holidays={holidays} />);

    expect(screen.getAllByText(/Christmas holidays/i)).toHaveLength(1);
    expect(screen.queryByText("Christmas holidays, Christmas Holidays")).not.toBeInTheDocument();
  });

  it("shows National when merged holidays cover all regions", () => {
    const holidays = [
      makeHoliday({
        id: "be-de-spring",
        country: "BE",
        regionId: "BE-DE",
        regionLabel: "Belgium · German-speaking community",
        scope: "regional",
        holidayType: "school",
        name: "Spring Holidays",
        startDate: isoDate(TEST_YEAR, 4, 6),
        endDate: isoDate(TEST_YEAR, 4, 18)
      }),
      makeHoliday({
        id: "be-nl-spring",
        country: "BE",
        regionId: "BE-NL",
        regionLabel: "Belgium · Flemish community",
        scope: "regional",
        holidayType: "school",
        name: "Spring Holidays",
        startDate: isoDate(TEST_YEAR, 4, 6),
        endDate: isoDate(TEST_YEAR, 4, 19)
      }),
      makeHoliday({
        id: "be-fr-spring",
        country: "BE",
        regionId: "BE-FR",
        regionLabel: "Belgium · French community",
        scope: "regional",
        holidayType: "school",
        name: "Spring Holidays",
        startDate: isoDate(TEST_YEAR, 4, 6),
        endDate: isoDate(TEST_YEAR, 4, 20)
      })
    ];
    const dataset = {
      ...DATASET,
      holidayCoverage: [
        makeCoverage({
          key: buildHolidayCoverageKey(holidays[0]),
          country: "BE",
          holidayType: "school",
          name: "Spring Holidays",
          startDate: isoDate(TEST_YEAR, 4, 6),
          endDate: isoDate(TEST_YEAR, 4, 18),
          segments: [{
            model: "geographic_group",
            normalizedScope: "regional",
            displayMode: "count",
            regionLabels: ["Belgium · German-speaking community"],
            regionCount: 1,
            countLabel: "communities",
            totalRegionCount: 3
          }]
        }),
        makeCoverage({
          key: buildHolidayCoverageKey(holidays[1]),
          country: "BE",
          holidayType: "school",
          name: "Spring Holidays",
          startDate: isoDate(TEST_YEAR, 4, 6),
          endDate: isoDate(TEST_YEAR, 4, 19),
          segments: [{
            model: "geographic_group",
            normalizedScope: "regional",
            displayMode: "count",
            regionLabels: ["Belgium · Flemish community"],
            regionCount: 1,
            countLabel: "communities",
            totalRegionCount: 3
          }]
        }),
        makeCoverage({
          key: buildHolidayCoverageKey(holidays[2]),
          country: "BE",
          holidayType: "school",
          name: "Spring Holidays",
          startDate: isoDate(TEST_YEAR, 4, 6),
          endDate: isoDate(TEST_YEAR, 4, 20),
          segments: [{
            model: "geographic_group",
            normalizedScope: "regional",
            displayMode: "count",
            regionLabels: ["Belgium · French community"],
            regionCount: 1,
            countLabel: "communities",
            totalRegionCount: 3
          }]
        })
      ]
    };
    render(<DayPanel dataset={dataset} date={SPRING_DATE} holidays={holidays} />);
    expect(screen.getByText("National")).toBeInTheDocument();
    expect(screen.queryByText(/3\/3 communities/)).not.toBeInTheDocument();
    expect(screen.getAllByText("Spring Holidays")).toHaveLength(1);
  });

  it("shows National for full-country school coverage normalized from groups", () => {
    const holidays = [
      makeHoliday({
        id: "nl-1",
        country: "NL",
        regionId: "NL-DR::NL-MI",
        regionLabel: "Netherlands (the) · Drenthe · Central Region",
        scope: "regional",
        holidayType: "school",
        name: "Christmas Holidays",
        startDate: WINTER_ALT_START,
        endDate: WINTER_END
      }),
      makeHoliday({
        id: "nl-2",
        country: "NL",
        regionId: "NL-GR::NL-NO",
        regionLabel: "Netherlands (the) · Groningen · North Region",
        scope: "regional",
        holidayType: "school",
        name: "Christmas Holidays",
        startDate: WINTER_ALT_START,
        endDate: WINTER_END
      }),
      makeHoliday({
        id: "nl-3",
        country: "NL",
        regionId: "NL-ZH::NL-ZU",
        regionLabel: "Netherlands (the) · South Holland · South Region",
        scope: "regional",
        holidayType: "school",
        name: "Christmas Holidays",
        startDate: WINTER_ALT_START,
        endDate: WINTER_END
      })
    ];
    const dataset = {
      ...DATASET,
      countries: [...DATASET.countries, { countryCode: "NL", label: "Netherlands (the)" }],
      holidayCoverage: [
        makeCoverage({
          key: buildHolidayCoverageKey(holidays[0]),
          country: "NL",
          holidayType: "school",
          name: "Christmas Holidays",
          startDate: WINTER_ALT_START,
          endDate: WINTER_END,
          segments: [{
            model: "geographic_group",
            normalizedScope: "national",
            displayMode: "national",
            regionLabels: holidays.map((holiday) => holiday.regionLabel),
            regionCount: 3,
            totalRegionCount: 3
          }]
        })
      ]
    };
    render(<DayPanel dataset={dataset} date={WINTER_DATE} holidays={holidays} />);
    expect(screen.getByRole("heading", { name: "Netherlands (the)" })).toBeInTheDocument();
    expect(screen.getByText("National")).toBeInTheDocument();
  });
});
