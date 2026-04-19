import { useEffect, useMemo, useState } from "react";
import type { DatasetBundle } from "./types";
import { buildHolidayDayMap, getHolidaysForDay, type FilterState } from "./lib/dataset";
import { formatMonthLabel, listMonthGrid, localToday } from "./lib/date";
import { DEFAULT_COUNTRY_CODES, STORAGE_KEY } from "./config";
import { Filters } from "./components/Filters";
import { CalendarGrid } from "./components/CalendarGrid";
import { DayPanel } from "./components/DayPanel";

function getSavedCountryCodes(dataset: DatasetBundle): string[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as string[];
    const available = new Set(dataset.countries.map((c) => c.countryCode));
    const valid = parsed.filter((code) => available.has(code));
    return valid.length > 0 ? valid : null;
  } catch {
    return null;
  }
}

function saveCountryCodes(countryCodes: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(countryCodes));
  } catch {
    // Ignore storage failures so the app still renders when persistence is unavailable.
  }
}

function getDefaultCountryCodes(dataset: DatasetBundle): string[] {
  const availableCountryCodes = new Set(dataset.countries.map((country) => country.countryCode));
  const preferredCountryCodes = DEFAULT_COUNTRY_CODES.filter((countryCode) => availableCountryCodes.has(countryCode));
  return preferredCountryCodes.length > 0 ? preferredCountryCodes : dataset.countries.map((country) => country.countryCode);
}

function getInitialMonth(dataset: DatasetBundle): { year: number; month: number; date: string } {
  const today = localToday();
  const date = today >= dataset.windowStart && today <= dataset.windowEnd ? today : dataset.windowStart;
  const initial = new Date(`${date}T00:00:00Z`);
  return {
    year: initial.getUTCFullYear(),
    month: initial.getUTCMonth(),
    date
  };
}

function getMonthStart(value: string): Date {
  const date = new Date(`${value}T00:00:00Z`);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function useIsMobile(maxWidth = 720) {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return false;
    }
    return window.matchMedia(`(max-width: ${maxWidth}px)`).matches;
  });

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }

    const mediaQuery = window.matchMedia(`(max-width: ${maxWidth}px)`);
    const update = () => setIsMobile(mediaQuery.matches);
    update();

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", update);
      return () => mediaQuery.removeEventListener("change", update);
    }

    mediaQuery.addListener(update);
    return () => mediaQuery.removeListener(update);
  }, [maxWidth]);

  return isMobile;
}

function getDatasetUrl() {
  return `${import.meta.env.BASE_URL}generated/dataset.json`;
}

export default function App() {
  const [dataset, setDataset] = useState<DatasetBundle | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [year, setYear] = useState(1970);
  const [month, setMonth] = useState(0);
  const [selectedDate, setSelectedDate] = useState("");
  const [filters, setFilters] = useState<FilterState>({ countryCodes: [] });
  const isMobile = useIsMobile();

  useEffect(() => {
    let cancelled = false;

    async function loadDataset() {
      try {
        const response = await fetch(getDatasetUrl());
        if (!response.ok) {
          throw new Error(`Failed to load dataset: ${response.status}`);
        }

        const nextDataset = (await response.json()) as DatasetBundle;
        if (cancelled) {
          return;
        }

        setDataset(nextDataset);
        setFilters({ countryCodes: getSavedCountryCodes(nextDataset) ?? getDefaultCountryCodes(nextDataset) });
        const initial = getInitialMonth(nextDataset);
        setYear(initial.year);
        setMonth(initial.month);
        setSelectedDate(initial.date);
      } catch (error) {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : "Unknown dataset load failure");
        }
      }
    }

    void loadDataset();

    return () => {
      cancelled = true;
    };
  }, []);

  const holidayDayMap = useMemo(() => (dataset ? buildHolidayDayMap(dataset) : new Map()), [dataset]);
  const countryOptions = useMemo(() => (dataset?.countries ?? []).map((country) => ({
    value: country.countryCode,
    label: country.label
  })), [dataset]);
  const days = useMemo(() => listMonthGrid(year, month), [year, month]);

  const holidaysByDate = useMemo(() => {
    if (!dataset) {
      return new Map();
    }
    const entries = days.map((date) => [date, getHolidaysForDay(dataset, holidayDayMap, date, filters)] as const);
    return new Map(entries);
  }, [dataset, days, filters, holidayDayMap]);

  useEffect(() => {
    if (selectedDate && !days.includes(selectedDate)) {
      setSelectedDate(days[0]);
    }
  }, [days, selectedDate]);

  useEffect(() => {
    if (dataset) {
      saveCountryCodes(filters.countryCodes);
    }
  }, [dataset, filters.countryCodes]);

  if (loadError) {
    return <div className="app-shell">Failed to load dataset: {loadError}</div>;
  }

  if (!dataset || !selectedDate) {
    return <div className="app-shell">Loading holiday dataset…</div>;
  }

  const selectedHolidays = holidaysByDate.get(selectedDate) ?? [];
  const sourceSummary = dataset.sources[0];
  const earliestMonth = getMonthStart(dataset.windowStart);
  const latestMonth = getMonthStart(dataset.windowEnd);
  const visibleMonth = new Date(Date.UTC(year, month, 1));
  const canStepBackward = visibleMonth > earliestMonth;
  const canStepForward = visibleMonth < latestMonth;

  function stepMonth(direction: -1 | 1) {
    const next = new Date(Date.UTC(year, month + direction, 1));
    if (next < earliestMonth || next > latestMonth) {
      return;
    }
    setYear(next.getUTCFullYear());
    setMonth(next.getUTCMonth());
  }

  return (
    <div className="app-shell">
      <header className="hero">
        <div>
          <h1>Off-Season</h1>
          <p className="hero-copy">
            Track public holidays and school holidays in European countries.
          </p>
        </div>
      </header>

      <main className="layout">
        <section className="calendar-panel">
          <div className="calendar-toolbar">
            {isMobile ? (
              <Filters countryOptions={countryOptions} filters={filters} mode="mobile" onChange={setFilters} />
            ) : null}

            <div className="calendar-heading">
              <h2>{formatMonthLabel(year, month)}</h2>
              <div className="calendar-nav">
                <button type="button" onClick={() => stepMonth(-1)} disabled={!canStepBackward}>
                  Previous
                </button>
                <button type="button" onClick={() => stepMonth(1)} disabled={!canStepForward}>
                  Next
                </button>
              </div>
            </div>

            {!isMobile ? (
              <Filters countryOptions={countryOptions} filters={filters} mode="desktop" onChange={setFilters} />
            ) : null}
          </div>

          <CalendarGrid
            activeDate={selectedDate}
            currentMonth={month}
            currentYear={year}
            days={days}
            holidaysByDate={holidaysByDate}
            onStepMonth={stepMonth}
            onSelectDate={setSelectedDate}
          />
        </section>

        <DayPanel dataset={dataset} date={selectedDate} holidays={selectedHolidays} />
      </main>

      <footer className="app-footer">
        Holidays window {dataset.windowStart} to {dataset.windowEnd}
        {sourceSummary ? (
          <>
            {" · source "}
            <a href="https://www.openholidaysapi.org" target="_blank" rel="noreferrer">
              {sourceSummary.sourceName}
            </a>
            {` · last checked ${sourceSummary.lastCheckedAt}`}
          </>
        ) : null}
      </footer>
    </div>
  );
}
