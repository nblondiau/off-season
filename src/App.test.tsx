import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { DEFAULT_COUNTRY_CODES } from "./config";
import datasetJson from "./generated/dataset.json";
import type { DatasetBundle } from "./types";
import { formatMonthLabel, localToday } from "./lib/date";

const dataset = datasetJson as DatasetBundle;

function getExpectedToday(dataset: DatasetBundle): string {
  const today = localToday();
  return today >= dataset.windowStart && today <= dataset.windowEnd ? today : dataset.windowStart;
}

function getDefaultSelectionCount(dataset: DatasetBundle): number {
  const available = new Set(dataset.countries.map((country) => country.countryCode));
  return DEFAULT_COUNTRY_CODES.filter((countryCode) => available.has(countryCode)).length;
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
    render(<App />);
    expect(await screen.findByText(/April 2026/i)).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: expectedDate })).toBeInTheDocument();
  });

  it("filters holidays by selected countries", async () => {
    const user = userEvent.setup();
    render(<App />);

    await screen.findByText(/April 2026/i);
    await user.click(screen.getByRole("button", { name: /countries selected|All countries/i }));
    await user.click(screen.getByLabelText(/France/i));
    await user.click(screen.getByRole("button", { name: "2026-04-06" }));
    expect(screen.getAllByText(/Spring Holidays/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: /🇧🇪 Belgium/i })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /🇫🇷 France/i })).not.toBeInTheDocument();
  });

  it("keeps the full country list hidden until the selector is opened", async () => {
    const user = userEvent.setup();
    render(<App />);

    await screen.findByText(/April 2026/i);
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

    expect(await screen.findByText(/April 2026/i)).toBeInTheDocument();
    expect(
      await screen.findByRole("button", { name: new RegExp(`${getDefaultSelectionCount(dataset)} countries selected`, "i") })
    ).toBeInTheDocument();
  });

  it("shows dataset source metadata in the footer", async () => {
    render(<App />);

    expect(await screen.findByRole("link", { name: /OpenHolidays API/i })).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`last checked ${dataset.generatedAt}`, "i"))).toBeInTheDocument();
  });

  it("loads the dataset from the Vite base URL", async () => {
    render(<App />);

    await screen.findByText(/April 2026/i);
    expect(globalThis.fetch).toHaveBeenCalledWith("/generated/dataset.json");
  });

  it("prevents navigation outside the dataset month window", async () => {
    const user = userEvent.setup();
    render(<App />);

    await screen.findByText(/April 2026/i);

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
    render(<App />);

    await screen.findByText(/April 2026/i);
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

    expect(screen.getByText(/May 2026/i)).toBeInTheDocument();
  });
});
