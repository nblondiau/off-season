import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { DEFAULT_COUNTRY_CODES, STORAGE_KEY } from "./config";
import datasetJson from "./generated/dataset.json";
import type { DatasetBundle } from "./types";
import { formatMonthLabel, listMonthGrid, localToday } from "./lib/date";
import { findDateWithHolidays } from "./test/dataset-helpers";

const dataset = datasetJson as DatasetBundle;

function getExpectedToday(dataset: DatasetBundle): string {
  const today = localToday();
  return today >= dataset.windowStart && today <= dataset.windowEnd ? today : dataset.windowStart;
}

function getDefaultSelectionCount(dataset: DatasetBundle): number {
  const available = new Set(dataset.countries.map((country) => country.countryCode));
  return DEFAULT_COUNTRY_CODES.filter((countryCode) => available.has(countryCode)).length;
}

function getMonthLabelForDate(date: string): string {
  const value = new Date(`${date}T00:00:00Z`);
  return formatMonthLabel(value.getUTCFullYear(), value.getUTCMonth());
}

describe("App", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/");
    globalThis.localStorage?.clear?.();
    vi.stubGlobal("matchMedia", vi.fn().mockImplementation(() => ({
      matches: false,
      media: "(max-width: 720px)",
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn()
    })));
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => dataset
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("opens on today's month and selected date by default", async () => {
    const expectedDate = getExpectedToday(dataset);
    const expectedMonthLabel = getMonthLabelForDate(expectedDate);

    render(<App />);
    expect(await screen.findByText(expectedMonthLabel)).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: expectedDate })).toBeInTheDocument();
  });

  it("filters holidays by selected countries", async () => {
    const user = userEvent.setup();
    const expectedDate = getExpectedToday(dataset);
    const initialDate = new Date(`${expectedDate}T00:00:00Z`);
    const visibleDays = listMonthGrid(initialDate.getUTCFullYear(), initialDate.getUTCMonth());
    const visibleSet = new Set(visibleDays);
    const { date } = findDateWithHolidays(dataset, ["BE", "FR"], (visibleHolidays, _date) => {
      const countries = new Set(visibleHolidays.map((holiday) => holiday.country));
      return visibleSet.has(_date) && countries.has("BE") && countries.has("FR");
    });

    render(<App />);

    await screen.findByText(getMonthLabelForDate(getExpectedToday(dataset)));
    await user.click(screen.getByRole("button", { name: /countries selected|All countries/i }));
    await user.click(screen.getByLabelText(/France/i));
    await user.click(screen.getByRole("button", { name: date }));
    expect(screen.getByRole("heading", { name: /Belgium/i })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /France/i })).not.toBeInTheDocument();
  });

  it("keeps the full country list hidden until the selector is opened", async () => {
    const user = userEvent.setup();
    render(<App />);

    await screen.findByText(getMonthLabelForDate(getExpectedToday(dataset)));
    expect(screen.queryByLabelText(/France/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /countries selected|All countries/i }));
    expect(screen.getByRole("dialog", { name: /Country selector/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/France/i)).toBeInTheDocument();
  });

  it("defaults to the travel shortlist of countries", async () => {
    render(<App />);

    expect(
      await screen.findByRole("button", { name: new RegExp(`${getDefaultSelectionCount(dataset)} countries selected`, "i") })
    ).toBeInTheDocument();
  });

  it("keeps rendering when localStorage writes are unavailable", async () => {
    vi.stubGlobal("localStorage", {
      getItem: vi.fn().mockReturnValue(null)
    });

    render(<App />);

    expect(await screen.findByText(getMonthLabelForDate(getExpectedToday(dataset)))).toBeInTheDocument();
    expect(
      await screen.findByRole("button", { name: new RegExp(`${getDefaultSelectionCount(dataset)} countries selected`, "i") })
    ).toBeInTheDocument();
  });

  it("shows dataset source metadata in the footer", async () => {
    render(<App />);

    expect(await screen.findByRole("link", { name: /OpenHolidays API/i })).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`last checked ${dataset.sources[0].lastCheckedAt}`, "i"))).toBeInTheDocument();
  });

  it("loads the dataset from the Vite base URL", async () => {
    render(<App />);

    await screen.findByText(getMonthLabelForDate(getExpectedToday(dataset)));
    expect(globalThis.fetch).toHaveBeenCalledWith("/generated/dataset.json");
  });

  it("loads dataset from localStorage cache on repeat visit", async () => {
    const cachedData = JSON.stringify(dataset);
    vi.stubGlobal("localStorage", {
      getItem: vi.fn((key: string) => {
        if (key === "dataset-generated-at") return dataset.generatedAt;
        if (key === "dataset") return cachedData;
        return null;
      }),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn()
    });

    render(<App />);

    await screen.findByText(getMonthLabelForDate(getExpectedToday(dataset)));
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(globalThis.fetch).toHaveBeenCalledWith("/generated/source-review.json");
  });

  it("fetches fresh dataset when cached data is stale", async () => {
    const cachedData = JSON.stringify(dataset);
    vi.stubGlobal("localStorage", {
      getItem: vi.fn((key: string) => {
        if (key === "dataset-generated-at") return "2020-01-01";
        if (key === "dataset") return cachedData;
        return null;
      }),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn()
    });

    render(<App />);

    await screen.findByText(getMonthLabelForDate(getExpectedToday(dataset)));
    expect(globalThis.fetch).toHaveBeenCalledWith("/generated/dataset.json");
  });

  it("falls back to network when localStorage cache is corrupted", async () => {
    vi.stubGlobal("localStorage", {
      getItem: vi.fn((key: string) => {
        if (key === "dataset-generated-at") return dataset.generatedAt;
        if (key === "dataset") return "{{{not valid json}}";
        return null;
      }),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn()
    });

    render(<App />);

    await screen.findByText(getMonthLabelForDate(getExpectedToday(dataset)));
    expect(globalThis.fetch).toHaveBeenCalledWith("/generated/dataset.json");
  });

  it("prevents navigation outside the dataset month window", async () => {
    const user = userEvent.setup();
    render(<App />);

    await screen.findByText(getMonthLabelForDate(getExpectedToday(dataset)));

    const previousButton = screen.getByRole("button", { name: "Previous" });
    const nextButton = screen.getByRole("button", { name: "Next" });

    while (!previousButton.hasAttribute("disabled")) {
      await user.click(previousButton);
    }

    const startMonth = new Date(`${dataset.windowStart}T00:00:00Z`);
    expect(
      screen.getByText(formatMonthLabel(startMonth.getUTCFullYear(), startMonth.getUTCMonth()))
    ).toBeInTheDocument();
    expect(previousButton).toBeDisabled();

    while (!nextButton.hasAttribute("disabled")) {
      await user.click(nextButton);
    }

    const endMonth = new Date(`${dataset.windowEnd}T00:00:00Z`);
    expect(
      screen.getByText(formatMonthLabel(endMonth.getUTCFullYear(), endMonth.getUTCMonth()))
    ).toBeInTheDocument();
    expect(nextButton).toBeDisabled();
  });

  it("changes month on horizontal swipe in the calendar", async () => {
    const initialDate = getExpectedToday(dataset);
    const initialMonth = new Date(`${initialDate}T00:00:00Z`);
    const nextMonth = new Date(Date.UTC(initialMonth.getUTCFullYear(), initialMonth.getUTCMonth() + 1, 1));

    render(<App />);

    await screen.findByText(getMonthLabelForDate(initialDate));
    const calendarShell = document.querySelector(".calendar-shell");
    expect(calendarShell).not.toBeNull();

    fireEvent.touchStart(calendarShell!, {
      changedTouches: [{ clientX: 240, clientY: 160 }]
    });
    fireEvent.touchMove(calendarShell!, {
      changedTouches: [{ clientX: 120, clientY: 166 }]
    });
    fireEvent.touchEnd(calendarShell!, {
      changedTouches: [{ clientX: 120, clientY: 166 }]
    });

    expect(screen.getByText(formatMonthLabel(nextMonth.getUTCFullYear(), nextMonth.getUTCMonth()))).toBeInTheDocument();
  });

  it("resets to the current month and day via the Today button", async () => {
    const user = userEvent.setup();
    render(<App />);

    await screen.findByText(getMonthLabelForDate(getExpectedToday(dataset)));
    const initialMonth = new Date(`${getExpectedToday(dataset)}T00:00:00Z`);

    await user.click(screen.getByRole("button", { name: "Next" }));
    const nextMonth = new Date(Date.UTC(initialMonth.getUTCFullYear(), initialMonth.getUTCMonth() + 1, 1));
    expect(
      screen.getByText(formatMonthLabel(nextMonth.getUTCFullYear(), nextMonth.getUTCMonth()))
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Today" }));

    expect(
      screen.getByText(formatMonthLabel(initialMonth.getUTCFullYear(), initialMonth.getUTCMonth()))
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: getExpectedToday(dataset) })).toBeInTheDocument();
  });

  it("reflects the displayed month and selected countries in the URL", async () => {
    render(<App />);

    const expectedDate = getExpectedToday(dataset);
    const initialMonth = new Date(`${expectedDate}T00:00:00Z`);
    const expectedMonthParam = `${initialMonth.getUTCFullYear()}-${String(initialMonth.getUTCMonth() + 1).padStart(2, "0")}`;
    const expectedCountries = DEFAULT_COUNTRY_CODES.filter((code) =>
      dataset.countries.some((country) => country.countryCode === code)
    );

    await screen.findByText(getMonthLabelForDate(expectedDate));

    await waitFor(() => {
      const params = new URLSearchParams(window.location.search);
      expect(params.get("month")).toBe(expectedMonthParam);
      expect(params.get("countries")).toBe(expectedCountries.join(","));
    });
  });

  it("updates the URL when the month changes", async () => {
    const user = userEvent.setup();
    render(<App />);

    await screen.findByText(getMonthLabelForDate(getExpectedToday(dataset)));
    await user.click(screen.getByRole("button", { name: "Next" }));

    const initialDate = getExpectedToday(dataset);
    const initialMonth = new Date(`${initialDate}T00:00:00Z`);
    const nextMonth = new Date(Date.UTC(initialMonth.getUTCFullYear(), initialMonth.getUTCMonth() + 1, 1));
    const expectedMonthParam = `${nextMonth.getUTCFullYear()}-${String(nextMonth.getUTCMonth() + 1).padStart(2, "0")}`;

    const params = new URLSearchParams(window.location.search);
    expect(params.get("month")).toBe(expectedMonthParam);
  });

  it("updates the URL when the country selection changes", async () => {
    const user = userEvent.setup();
    render(<App />);

    await screen.findByText(getMonthLabelForDate(getExpectedToday(dataset)));
    await user.click(screen.getByRole("button", { name: /countries selected|All countries/i }));
    await user.click(screen.getByLabelText(/France/i));

    const defaultCountries = DEFAULT_COUNTRY_CODES.filter((code) =>
      dataset.countries.some((country) => country.countryCode === code)
    );
    const params = new URLSearchParams(window.location.search);
    expect(params.get("countries")).toBe(defaultCountries.filter((code) => code !== "FR").join(","));
  });

  it("opens on the month from the URL param", async () => {
    window.history.replaceState(null, "", "/?month=2027-01");
    render(<App />);

    await screen.findByText(formatMonthLabel(2027, 0));
    expect(screen.getByRole("heading", { name: "January 2027" })).toBeInTheDocument();
  });

  it("uses URL countries over the saved localStorage selection", async () => {
    vi.stubGlobal("localStorage", {
      getItem: vi.fn((key: string) => {
        if (key === STORAGE_KEY) return JSON.stringify(["DE"]);
        return null;
      }),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn()
    });
    window.history.replaceState(null, "", "/?countries=ES,PT");
    render(<App />);

    await screen.findByText(getMonthLabelForDate(getExpectedToday(dataset)));

    await waitFor(() => {
      const params = new URLSearchParams(window.location.search);
      expect(params.get("countries")).toBe("ES,PT");
    });
    expect(screen.getByRole("button", { name: /2 countries selected/i })).toBeInTheDocument();
  });

  it("ignores an out-of-window month URL param and falls back to the default month", async () => {
    window.history.replaceState(null, "", "/?month=2030-05");
    render(<App />);

    await screen.findByText(getMonthLabelForDate(getExpectedToday(dataset)));
    expect(screen.getByRole("heading", { name: getMonthLabelForDate(getExpectedToday(dataset)) })).toBeInTheDocument();
  });
});
