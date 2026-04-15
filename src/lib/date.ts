export function localToday(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function parseIsoDate(value: string): Date {
  return new Date(`${value}T00:00:00Z`);
}

export function addDays(value: string, days: number): string {
  const date = parseIsoDate(value);
  date.setUTCDate(date.getUTCDate() + days);
  return toIsoDate(date);
}

export function daysBetweenInclusive(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  let cursor = startDate;

  while (cursor <= endDate) {
    dates.push(cursor);
    cursor = addDays(cursor, 1);
  }

  return dates;
}

export function listMonthGrid(year: number, monthIndex: number): string[] {
  const firstOfMonth = new Date(Date.UTC(year, monthIndex, 1));
  const start = new Date(firstOfMonth);
  const weekday = (start.getUTCDay() + 6) % 7;
  start.setUTCDate(start.getUTCDate() - weekday);

  const days: string[] = [];
  for (let index = 0; index < 42; index += 1) {
    const current = new Date(start);
    current.setUTCDate(start.getUTCDate() + index);
    days.push(toIsoDate(current));
  }

  return days;
}

export function formatMonthLabel(year: number, monthIndex: number): string {
  return new Intl.DateTimeFormat("en", {
    month: "long",
    year: "numeric",
    timeZone: "UTC"
  }).format(new Date(Date.UTC(year, monthIndex, 1)));
}

export function formatDayNumber(date: string): string {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    timeZone: "UTC"
  }).format(parseIsoDate(date));
}

