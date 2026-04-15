import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CalendarGrid } from "./CalendarGrid";
import type { HolidayOnDay } from "../lib/dataset";

function makeHoliday(overrides: Partial<HolidayOnDay> = {}): HolidayOnDay {
  return {
    id: "h1",
    country: "BE",
    regionId: "BE",
    regionLabel: "Belgium",
    scope: "national",
    holidayType: "public",
    name: "Test Holiday",
    startDate: "2026-04-01",
    endDate: "2026-04-01",
    sourceId: "s1",
    sourceLabel: "Test Source",
    sourceKind: "aggregated_open_data",
    ...overrides
  };
}

// April 2026 grid: 42 days starting from Monday 2026-03-30
const APRIL_2026_DAYS = Array.from({ length: 42 }, (_, i) => {
  const d = new Date(Date.UTC(2026, 2, 30 + i));
  return d.toISOString().slice(0, 10);
});

describe("CalendarGrid", () => {
  it("renders 42 day cells", () => {
    const holidaysByDate = new Map<string, HolidayOnDay[]>();
    render(
      <CalendarGrid
        activeDate="2026-04-01"
        currentMonth={3}
        currentYear={2026}
        days={APRIL_2026_DAYS}
        holidaysByDate={holidaysByDate}
        onStepMonth={vi.fn()}
        onSelectDate={vi.fn()}
      />
    );

    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(42);
  });

  it("applies public holiday class when day has a public holiday", () => {
    const holidaysByDate = new Map<string, HolidayOnDay[]>([
      ["2026-04-01", [makeHoliday({ holidayType: "public" })]]
    ]);

    render(
      <CalendarGrid
        activeDate="2026-04-14"
        currentMonth={3}
        currentYear={2026}
        days={APRIL_2026_DAYS}
        holidaysByDate={holidaysByDate}
        onStepMonth={vi.fn()}
        onSelectDate={vi.fn()}
      />
    );

    const cell = screen.getByRole("button", { name: "2026-04-01" });
    expect(cell.className).toContain("day-cell-public");
    expect(cell.className).not.toContain("day-cell-school");
  });

  it("applies school holiday class when day has a school holiday", () => {
    const holidaysByDate = new Map<string, HolidayOnDay[]>([
      ["2026-04-06", [makeHoliday({ holidayType: "school" })]]
    ]);

    render(
      <CalendarGrid
        activeDate="2026-04-14"
        currentMonth={3}
        currentYear={2026}
        days={APRIL_2026_DAYS}
        holidaysByDate={holidaysByDate}
        onStepMonth={vi.fn()}
        onSelectDate={vi.fn()}
      />
    );

    const cell = screen.getByRole("button", { name: "2026-04-06" });
    expect(cell.className).toContain("day-cell-school");
  });

  it("applies mixed class when day has both public and school holidays", () => {
    const holidaysByDate = new Map<string, HolidayOnDay[]>([
      ["2026-04-10", [
        makeHoliday({ id: "h1", holidayType: "public" }),
        makeHoliday({ id: "h2", holidayType: "school" })
      ]]
    ]);

    render(
      <CalendarGrid
        activeDate="2026-04-14"
        currentMonth={3}
        currentYear={2026}
        days={APRIL_2026_DAYS}
        holidaysByDate={holidaysByDate}
        onStepMonth={vi.fn()}
        onSelectDate={vi.fn()}
      />
    );

    const cell = screen.getByRole("button", { name: "2026-04-10" });
    expect(cell.className).toContain("day-cell-mixed");
  });

  it("mutes days outside the current month", () => {
    const holidaysByDate = new Map<string, HolidayOnDay[]>();
    render(
      <CalendarGrid
        activeDate="2026-04-14"
        currentMonth={3}
        currentYear={2026}
        days={APRIL_2026_DAYS}
        holidaysByDate={holidaysByDate}
        onStepMonth={vi.fn()}
        onSelectDate={vi.fn()}
      />
    );

    // March 30 is outside April
    const cell = screen.getByRole("button", { name: "2026-03-30" });
    expect(cell.className).toContain("day-cell-muted");
  });

  it("marks the active date", () => {
    const holidaysByDate = new Map<string, HolidayOnDay[]>();
    render(
      <CalendarGrid
        activeDate="2026-04-14"
        currentMonth={3}
        currentYear={2026}
        days={APRIL_2026_DAYS}
        holidaysByDate={holidaysByDate}
        onStepMonth={vi.fn()}
        onSelectDate={vi.fn()}
      />
    );

    const cell = screen.getByRole("button", { name: "2026-04-14" });
    expect(cell.className).toContain("day-cell-active");
  });

  it("calls onSelectDate when a day is clicked", async () => {
    const user = userEvent.setup();
    const onSelectDate = vi.fn();
    const holidaysByDate = new Map<string, HolidayOnDay[]>();

    render(
      <CalendarGrid
        activeDate="2026-04-14"
        currentMonth={3}
        currentYear={2026}
        days={APRIL_2026_DAYS}
        holidaysByDate={holidaysByDate}
        onStepMonth={vi.fn()}
        onSelectDate={onSelectDate}
      />
    );

    await user.click(screen.getByRole("button", { name: "2026-04-20" }));
    expect(onSelectDate).toHaveBeenCalledWith("2026-04-20");
  });

  it("steps month on horizontal swipe and suppresses accidental date selection", () => {
    const onStepMonth = vi.fn();
    const onSelectDate = vi.fn();
    const holidaysByDate = new Map<string, HolidayOnDay[]>();

    const { container } = render(
      <CalendarGrid
        activeDate="2026-04-14"
        currentMonth={3}
        currentYear={2026}
        days={APRIL_2026_DAYS}
        holidaysByDate={holidaysByDate}
        onStepMonth={onStepMonth}
        onSelectDate={onSelectDate}
      />
    );

    const shell = container.querySelector(".calendar-shell");
    const day = screen.getByRole("button", { name: "2026-04-20" });
    expect(shell).not.toBeNull();

    fireEvent.touchStart(shell!, {
      changedTouches: [{ clientX: 240, clientY: 160 }]
    });
    fireEvent.touchMove(shell!, {
      changedTouches: [{ clientX: 140, clientY: 164 }]
    });
    fireEvent.touchEnd(shell!, {
      changedTouches: [{ clientX: 140, clientY: 164 }]
    });

    day.click();

    expect(onStepMonth).toHaveBeenCalledWith(1);
    expect(onSelectDate).not.toHaveBeenCalled();
  });
});
