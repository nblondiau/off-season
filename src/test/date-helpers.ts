export const TEST_YEAR = new Date().getUTCFullYear() + 1;

export function isoDate(year: number, month: number, day: number): string {
  return new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10);
}

export function buildMonthGrid(year: number, month: number): string[] {
  const firstOfMonth = new Date(Date.UTC(year, month - 1, 1));
  const start = new Date(firstOfMonth);
  const weekday = (start.getUTCDay() + 6) % 7;
  start.setUTCDate(start.getUTCDate() - weekday);

  return Array.from({ length: 42 }, (_, index) => {
    const current = new Date(start);
    current.setUTCDate(start.getUTCDate() + index);
    return current.toISOString().slice(0, 10);
  });
}
