import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { DEFAULT_COUNTRY_CODES } from "./config";
import datasetJson from "./generated/dataset.json";
import type { DatasetBundle } from "./types";
import { formatMonthLabel, localToday } from "./lib/date";
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
    const initialMonthKey = getExpectedToday(dataset).slice(0, 7);
    const { date, holidays } = findDateWithHolidays(dataset, ["BE", "FR"], (visibleHolidays, date) => {
      const countries = new Set(visibleHolidays.map((holiday) => holiday.country));
      return date.startsWith(initialMonthKey) && countries.has("BE") && countries.has("FR");
    });
    const belgiumHoliday = holidays.find((holiday) => holiday.country === "BE");
    if (!belgiumHoliday) {
      throw new Error("Expected overlapping Belgium and France holidays.");
    }

    render(<App />);

    await screen.findByText(getMonthLabelForDate(getExpectedToday(dataset)));
    await user.click(screen.getByRole("button", { name: /countries selected|All countries/i }));
    await user.click(screen.getByLabelText(/France/i));
    await user.click(screen.getByRole("button", { name: date }));
    expect(screen.getByText(belgiumHoliday.name)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /🇧🇪 Belgium/i })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /🇫🇷 France/i })).not.toBeInTheDocument();
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
});
