import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CalendarGrid } from "./CalendarGrid";
import type { HolidayOnDay } from "../lib/dataset";
import { TEST_YEAR, buildMonthGrid, isoDate } from "../test/date-helpers";

const TEST_MONTH = 4;
const TEST_MONTH_INDEX = TEST_MONTH - 1;
const TEST_GRID_DAYS = buildMonthGrid(TEST_YEAR, TEST_MONTH);
const PREVIOUS_MONTH_DAY = TEST_GRID_DAYS.find((date) => !date.startsWith(`${TEST_YEAR}-${String(TEST_MONTH).padStart(2, "0")}`));

if (!PREVIOUS_MONTH_DAY) {
  throw new Error("Expected overflow day in synthetic calendar grid.");
}

function makeHoliday(overrides: Partial<HolidayOnDay> = {}): HolidayOnDay {
  return {
    id: "h1",
    country: "BE",
    regionId: "BE",
    regionLabel: "Belgium",
    scope: "national",
    holidayType: "public",
    name: "Test Holiday",
    startDate: isoDate(TEST_YEAR, TEST_MONTH, 1),
    endDate: isoDate(TEST_YEAR, TEST_MONTH, 1),
    sourceId: "s1",
    sourceLabel: "Test Source",
    sourceKind: "aggregated_open_data",
    ...overrides
  };
}

describe("CalendarGrid", () => {
  it("renders 42 day cells", () => {
    const holidaysByDate = new Map<string, HolidayOnDay[]>();
    render(
      <CalendarGrid
        activeDate={isoDate(TEST_YEAR, TEST_MONTH, 1)}
        currentMonth={TEST_MONTH_INDEX}
        currentYear={TEST_YEAR}
        days={TEST_GRID_DAYS}
        holidaysByDate={holidaysByDate}
        onStepMonth={vi.fn()}
        onSelectDate={vi.fn()}
      />
    );

    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(42);
  });

  it("applies public holiday class when day has a public holiday", () => {
    const publicDate = isoDate(TEST_YEAR, TEST_MONTH, 1);
    const holidaysByDate = new Map<string, HolidayOnDay[]>([
      [publicDate, [makeHoliday({ holidayType: "public", startDate: publicDate, endDate: publicDate })]]
    ]);

    render(
      <CalendarGrid
        activeDate={isoDate(TEST_YEAR, TEST_MONTH, 14)}
        currentMonth={TEST_MONTH_INDEX}
        currentYear={TEST_YEAR}
        days={TEST_GRID_DAYS}
        holidaysByDate={holidaysByDate}
        onStepMonth={vi.fn()}
        onSelectDate={vi.fn()}
      />
    );

    const cell = screen.getByRole("button", { name: publicDate });
    expect(cell.className).toContain("day-cell-public");
    expect(cell.className).not.toContain("day-cell-school");
  });

  it("applies school holiday class when day has a school holiday", () => {
    const schoolDate = isoDate(TEST_YEAR, TEST_MONTH, 6);
    const holidaysByDate = new Map<string, HolidayOnDay[]>([
      [schoolDate, [makeHoliday({ holidayType: "school", startDate: schoolDate, endDate: schoolDate })]]
    ]);

    render(
      <CalendarGrid
        activeDate={isoDate(TEST_YEAR, TEST_MONTH, 14)}
        currentMonth={TEST_MONTH_INDEX}
        currentYear={TEST_YEAR}
        days={TEST_GRID_DAYS}
        holidaysByDate={holidaysByDate}
        onStepMonth={vi.fn()}
        onSelectDate={vi.fn()}
      />
    );

    const cell = screen.getByRole("button", { name: schoolDate });
    expect(cell.className).toContain("day-cell-school");
  });

  it("applies mixed class when day has both public and school holidays", () => {
    const mixedDate = isoDate(TEST_YEAR, TEST_MONTH, 10);
    const holidaysByDate = new Map<string, HolidayOnDay[]>([
      [mixedDate, [
        makeHoliday({ id: "h1", holidayType: "public", startDate: mixedDate, endDate: mixedDate }),
        makeHoliday({ id: "h2", holidayType: "school", startDate: mixedDate, endDate: mixedDate })
      ]]
    ]);

    render(
      <CalendarGrid
        activeDate={isoDate(TEST_YEAR, TEST_MONTH, 14)}
        currentMonth={TEST_MONTH_INDEX}
        currentYear={TEST_YEAR}
        days={TEST_GRID_DAYS}
        holidaysByDate={holidaysByDate}
        onStepMonth={vi.fn()}
        onSelectDate={vi.fn()}
      />
    );

    const cell = screen.getByRole("button", { name: mixedDate });
    expect(cell.className).toContain("day-cell-mixed");
  });

  it("mutes days outside the current month", () => {
    const holidaysByDate = new Map<string, HolidayOnDay[]>();
    render(
      <CalendarGrid
        activeDate={isoDate(TEST_YEAR, TEST_MONTH, 14)}
        currentMonth={TEST_MONTH_INDEX}
        currentYear={TEST_YEAR}
        days={TEST_GRID_DAYS}
        holidaysByDate={holidaysByDate}
        onStepMonth={vi.fn()}
        onSelectDate={vi.fn()}
      />
    );

    const cell = screen.getByRole("button", { name: PREVIOUS_MONTH_DAY });
    expect(cell.className).toContain("day-cell-muted");
  });

  it("marks the active date", () => {
    const activeDate = isoDate(TEST_YEAR, TEST_MONTH, 14);
    const holidaysByDate = new Map<string, HolidayOnDay[]>();
    render(
      <CalendarGrid
        activeDate={activeDate}
        currentMonth={TEST_MONTH_INDEX}
        currentYear={TEST_YEAR}
        days={TEST_GRID_DAYS}
        holidaysByDate={holidaysByDate}
        onStepMonth={vi.fn()}
        onSelectDate={vi.fn()}
      />
    );

    const cell = screen.getByRole("button", { name: activeDate });
    expect(cell.className).toContain("day-cell-active");
  });

  it("calls onSelectDate when a day is clicked", async () => {
    const user = userEvent.setup();
    const selectedDate = isoDate(TEST_YEAR, TEST_MONTH, 20);
    const onSelectDate = vi.fn();
    const holidaysByDate = new Map<string, HolidayOnDay[]>();

    render(
      <CalendarGrid
        activeDate={isoDate(TEST_YEAR, TEST_MONTH, 14)}
        currentMonth={TEST_MONTH_INDEX}
        currentYear={TEST_YEAR}
        days={TEST_GRID_DAYS}
        holidaysByDate={holidaysByDate}
        onStepMonth={vi.fn()}
        onSelectDate={onSelectDate}
      />
    );

    await user.click(screen.getByRole("button", { name: selectedDate }));
    expect(onSelectDate).toHaveBeenCalledWith(selectedDate);
  });

  it("steps month on horizontal swipe and suppresses accidental date selection", () => {
    const selectedDate = isoDate(TEST_YEAR, TEST_MONTH, 20);
    const onStepMonth = vi.fn();
    const onSelectDate = vi.fn();
    const holidaysByDate = new Map<string, HolidayOnDay[]>();

    const { container } = render(
      <CalendarGrid
        activeDate={isoDate(TEST_YEAR, TEST_MONTH, 14)}
        currentMonth={TEST_MONTH_INDEX}
        currentYear={TEST_YEAR}
        days={TEST_GRID_DAYS}
        holidaysByDate={holidaysByDate}
        onStepMonth={onStepMonth}
        onSelectDate={onSelectDate}
      />
    );

    const shell = container.querySelector(".calendar-shell");
    const day = screen.getByRole("button", { name: selectedDate });
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
