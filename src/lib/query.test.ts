import { buildQueryString, parseCountryCodesParam, parseMonthParam, toMonthParam } from "./query";

describe("toMonthParam", () => {
  it("formats a year and zero-based month as YYYY-MM", () => {
    expect(toMonthParam(2026, 0)).toBe("2026-01");
    expect(toMonthParam(2028, 11)).toBe("2028-12");
  });
});

describe("parseMonthParam", () => {
  it("parses a valid month", () => {
    expect(parseMonthParam("2026-08")).toEqual({ year: 2026, month: 7 });
  });

  it("returns null when the value is absent", () => {
    expect(parseMonthParam(null)).toBeNull();
  });

  it("returns null for malformed values", () => {
    expect(parseMonthParam("")).toBeNull();
    expect(parseMonthParam("2026-8")).toBeNull();
    expect(parseMonthParam("2026-00")).toBeNull();
    expect(parseMonthParam("2026-13")).toBeNull();
    expect(parseMonthParam("202608")).toBeNull();
    expect(parseMonthParam("August 2026")).toBeNull();
  });
});

describe("parseCountryCodesParam", () => {
  it("returns null when the value is absent", () => {
    expect(parseCountryCodesParam(null)).toBeNull();
  });

  it("returns an empty list when the value is present but empty", () => {
    expect(parseCountryCodesParam("")).toEqual([]);
  });

  it("parses comma-separated codes, trimming and uppercasing", () => {
    expect(parseCountryCodesParam("be, FR ,nl")).toEqual(["BE", "FR", "NL"]);
  });

  it("deduplicates repeated codes", () => {
    expect(parseCountryCodesParam("BE,BE,FR")).toEqual(["BE", "FR"]);
  });

  it("ignores empty segments", () => {
    expect(parseCountryCodesParam("BE,,FR,")).toEqual(["BE", "FR"]);
  });
});

describe("buildQueryString", () => {
  it("serializes the month and countries params", () => {
    const params = new URLSearchParams(buildQueryString(2026, 7, ["BE", "FR"]));
    expect(params.get("month")).toBe("2026-08");
    expect(params.get("countries")).toBe("BE,FR");
  });

  it("keeps the countries param present when no country is selected", () => {
    const query = buildQueryString(2026, 7, []);
    expect(query).toContain("countries=");
    const params = new URLSearchParams(query);
    expect(params.get("countries")).toBe("");
  });
});
