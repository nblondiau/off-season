const MONTH_PARAM_PATTERN = /^(\d{4})-(\d{2})$/;

export interface MonthParam {
  year: number;
  month: number;
}

/**
 * Serializes a month as `YYYY-MM` (month index is zero-based).
 */
export function toMonthParam(year: number, monthIndex: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
}

/**
 * Parses a `YYYY-MM` month value. Returns null when the value is absent,
 * malformed, or references an invalid month number.
 */
export function parseMonthParam(value: string | null): MonthParam | null {
  if (value === null) {
    return null;
  }
  const match = MONTH_PARAM_PATTERN.exec(value);
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  if (monthIndex < 0 || monthIndex > 11) {
    return null;
  }
  return { year, month: monthIndex };
}

/**
 * Parses a comma-separated country code list. Returns null when the param is
 * absent, an empty list when it is present but empty (e.g. `countries=`), and
 * the deduplicated, trimmed, uppercased codes otherwise.
 */
export function parseCountryCodesParam(value: string | null): string[] | null {
  if (value === null) {
    return null;
  }
  if (value === "") {
    return [];
  }
  const codes = value
    .split(",")
    .map((code) => code.trim().toUpperCase())
    .filter((code) => code.length > 0);
  return [...new Set(codes)];
}

/**
 * Builds the full query string for the given calendar state.
 */
export function buildQueryString(year: number, monthIndex: number, countryCodes: string[]): string {
  const params = new URLSearchParams();
  params.set("month", toMonthParam(year, monthIndex));
  params.set("countries", countryCodes.join(","));
  return params.toString();
}
