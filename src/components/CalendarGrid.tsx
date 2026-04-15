import { useRef, type TouchEvent } from "react";
import { formatDayNumber } from "../lib/date";
import type { HolidayOnDay } from "../lib/dataset";

interface CalendarGridProps {
  activeDate: string;
  currentMonth: number;
  currentYear: number;
  days: string[];
  holidaysByDate: Map<string, HolidayOnDay[]>;
  onStepMonth: (direction: -1 | 1) => void;
  onSelectDate: (date: string) => void;
}

export function CalendarGrid({
  activeDate,
  currentMonth,
  currentYear,
  days,
  holidaysByDate,
  onStepMonth,
  onSelectDate
}: CalendarGridProps) {
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const touchCurrentRef = useRef<{ x: number; y: number } | null>(null);
  const ignoreNextClickRef = useRef(false);

  function handleTouchStart(event: TouchEvent<HTMLDivElement>) {
    const touch = event.changedTouches[0];
    if (!touch) {
      return;
    }

    const point = { x: touch.clientX, y: touch.clientY };
    touchStartRef.current = point;
    touchCurrentRef.current = point;
  }

  function handleTouchMove(event: TouchEvent<HTMLDivElement>) {
    const touch = event.changedTouches[0];
    if (!touch) {
      return;
    }

    touchCurrentRef.current = { x: touch.clientX, y: touch.clientY };
  }

  function handleTouchEnd() {
    const start = touchStartRef.current;
    const end = touchCurrentRef.current;
    touchStartRef.current = null;
    touchCurrentRef.current = null;

    if (!start || !end) {
      return;
    }

    const deltaX = end.x - start.x;
    const deltaY = end.y - start.y;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    if (absX < 48 || absX <= absY * 1.25) {
      return;
    }

    ignoreNextClickRef.current = true;
    onStepMonth(deltaX < 0 ? 1 : -1);
  }

  function handleDayClick(date: string) {
    if (ignoreNextClickRef.current) {
      ignoreNextClickRef.current = false;
      return;
    }

    onSelectDate(date);
  }

  return (
    <div
      className="calendar-shell"
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchMove}
      onTouchStart={handleTouchStart}
    >
      <div className="weekday-row">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((label) => (
          <div key={label} className="weekday-cell">
            {label}
          </div>
        ))}
      </div>
      <div className="calendar-grid">
        {days.map((date) => {
          const cellDate = new Date(`${date}T00:00:00Z`);
          const inCurrentMonth = cellDate.getUTCMonth() === currentMonth && cellDate.getUTCFullYear() === currentYear;
          const holidays = holidaysByDate.get(date) ?? [];
          const hasPublic = holidays.some((holiday) => holiday.holidayType === "public");
          const hasSchool = holidays.some((holiday) => holiday.holidayType === "school");
          const classNames = [
            "day-cell",
            inCurrentMonth ? "" : "day-cell-muted",
            activeDate === date ? "day-cell-active" : "",
            hasPublic && hasSchool ? "day-cell-mixed" : "",
            hasPublic && !hasSchool ? "day-cell-public" : "",
            hasSchool && !hasPublic ? "day-cell-school" : ""
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <button
              key={date}
              aria-label={date}
              className={classNames}
              type="button"
              onClick={() => handleDayClick(date)}
            >
              <span className="day-number">{formatDayNumber(date)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
