import type { DatasetBundle, HolidayCoverageRecord, HolidayCoverageSegment } from "../types";
import { buildHolidayCoverageKey, type HolidayOnDay } from "../lib/dataset";
import { CountryFlag } from "./CountryFlag";

interface DayPanelProps {
  dataset: DatasetBundle;
  date: string;
  holidays: HolidayOnDay[];
}

const MAX_VISIBLE_REGION_LABELS = 5;

function stripCountryPrefix(regionLabel: string, countryLabel: string) {
  const prefix = `${countryLabel} · `;
  return regionLabel.startsWith(prefix) ? regionLabel.slice(prefix.length) : regionLabel;
}

function formatRegionalMeta(regionLabels: string[], totalRegionCount: number, countryLabel: string, countLabel = "regions") {
  const regionCount = regionLabels.length;
  if (regionCount === totalRegionCount) {
    return "National";
  }

  const summary = `${regionCount}/${totalRegionCount} ${countLabel}`;
  if (regionCount > MAX_VISIBLE_REGION_LABELS) {
    return summary;
  }

  return `${summary} · ${regionLabels.map((label) => stripCountryPrefix(label, countryLabel)).join(", ")}`;
}

function formatLabelMeta(regionLabels: string[], countryLabel: string) {
  const visibleLabels = regionLabels
    .slice(0, MAX_VISIBLE_REGION_LABELS)
    .map((label) => stripCountryPrefix(label, countryLabel))
    .join(", ");

  if (regionLabels.length <= MAX_VISIBLE_REGION_LABELS) {
    return visibleLabels;
  }

  return `${visibleLabels} +${regionLabels.length - MAX_VISIBLE_REGION_LABELS} more`;
}

function formatCoverageSegment(segment: {
  displayMode: "national" | "count" | "labels";
  regionLabels: string[];
  totalRegionCount?: number;
  countLabel?: string;
}, countryLabel: string) {
  if (segment.displayMode === "national") {
    return "National";
  }
  if (segment.displayMode === "count" && segment.totalRegionCount) {
    return formatRegionalMeta(segment.regionLabels, segment.totalRegionCount, countryLabel, segment.countLabel);
  }
  return formatLabelMeta(segment.regionLabels, countryLabel);
}

function buildDisplayGroupKey(holiday: Pick<HolidayOnDay, "country" | "holidayType">) {
  return [holiday.country, holiday.holidayType].join("::");
}

function mergeCoverageSegments(coverageRecords: HolidayCoverageRecord[]): HolidayCoverageSegment[] {
  const segmentsByModel = new Map<string, {
    model: string;
    normalizedScope: "national" | "regional";
    displayMode: "national" | "count" | "labels";
    regionLabels: Set<string>;
    countLabel?: string;
    totalRegionCounts: Set<number>;
  }>();

  for (const record of coverageRecords) {
    for (const segment of record.segments) {
      const existing = segmentsByModel.get(segment.model);
      if (existing) {
        for (const label of segment.regionLabels) {
          existing.regionLabels.add(label);
        }
        if (segment.totalRegionCount) {
          existing.totalRegionCounts.add(segment.totalRegionCount);
        }
      } else {
        segmentsByModel.set(segment.model, {
          model: segment.model,
          normalizedScope: segment.normalizedScope,
          displayMode: segment.displayMode,
          regionLabels: new Set(segment.regionLabels),
          countLabel: segment.countLabel,
          totalRegionCounts: new Set(segment.totalRegionCount ? [segment.totalRegionCount] : []),
        });
      }
    }
  }

  const segments = Array.from(segmentsByModel.values()).map((merged) => {
    const regionLabels = Array.from(merged.regionLabels).sort((left, right) => left.localeCompare(right));
    const regionCount = regionLabels.length;
    const totalRegionCount = merged.totalRegionCounts.size > 0
      ? Array.from(merged.totalRegionCounts).reduce((sum, count) => sum + count, 0)
      : undefined;
    const displayMode = (totalRegionCount && regionCount >= totalRegionCount)
      ? "national" as const
      : merged.displayMode;
    const normalizedScope = displayMode === "national" ? "national" as const : merged.normalizedScope;
    return {
      model: merged.model,
      normalizedScope,
      displayMode,
      regionLabels,
      regionCount,
      ...(merged.countLabel ? { countLabel: merged.countLabel } : {}),
      ...(totalRegionCount ? { totalRegionCount } : {}),
    };
  });

  const hasGroupSegment = segments.some((s) => s.model === "zone" || s.model === "geographic_group");
  if (hasGroupSegment) {
    return segments.filter((s) => s.model !== "administrative");
  }
  return segments;
}

export function DayPanel({ dataset, date, holidays }: DayPanelProps) {
  const countryMap = new Map(dataset.countries.map((country) => [country.countryCode, country.label]));
  const holidayCoverageMap = new Map((dataset.holidayCoverage ?? []).map((coverage) => [coverage.key, coverage]));
  const groupedByCountry = Array.from(
    holidays.reduce((countryGroups, holiday) => {
      const key = holiday.country;
      const current = countryGroups.get(key) ?? [];
      current.push(holiday);
      countryGroups.set(key, current);
      return countryGroups;
    }, new Map<string, HolidayOnDay[]>())
  ).sort(([leftCode], [rightCode]) => leftCode.localeCompare(rightCode));

  return (
    <aside className="details-panel">
      <div className="details-header">
        <h2>{date}</h2>
      </div>

      {holidays.length === 0 ? (
        <p className="details-empty">
          No holidays match the active filters for this date.
        </p>
      ) : (
        <div className="country-groups">
          {groupedByCountry.map(([countryCode, countryHolidays]) => {
            const groupedHolidays = Array.from(
              countryHolidays.reduce((holidayGroups, holiday) => {
                const key = buildDisplayGroupKey(holiday);
                const current = holidayGroups.get(key);
                if (current) {
                  current.names.add(holiday.name);
                  current.regionLabels.add(holiday.regionLabel);
                  current.coverageKeys.add(buildHolidayCoverageKey(holiday));
                  if (holiday.notes) current.notes.add(holiday.notes);
                  if (holiday.scope === "national") current.hasNational = true;
                  return holidayGroups;
                }

                holidayGroups.set(key, {
                  holidayType: holiday.holidayType,
                  names: new Set([holiday.name]),
                  regionLabels: new Set([holiday.regionLabel]),
                  coverageKeys: new Set([buildHolidayCoverageKey(holiday)]),
                  notes: new Set(holiday.notes ? [holiday.notes] : []),
                  hasNational: holiday.scope === "national"
                });
                return holidayGroups;
              }, new Map<string, {
                holidayType: string;
                names: Set<string>;
                regionLabels: Set<string>;
                coverageKeys: Set<string>;
                notes: Set<string>;
                hasNational: boolean;
              }>())
            );

            return (
              <section key={countryCode} className="country-group">
                <h3 className="country-group-title">
                  <CountryFlag countryCode={countryCode} />
                  <span>{countryMap.get(countryCode) ?? countryCode}</span>
                </h3>
                <ul className="holiday-list">
                  {groupedHolidays.map(([displayKey, { holidayType, names, regionLabels, coverageKeys, notes, hasNational }]) => {
                    const countryLabel = countryMap.get(countryCode) ?? countryCode;
                    const nameList = Array.from(names).sort((left, right) => left.localeCompare(right));
                    const regionLabelList = Array.from(regionLabels).sort((left, right) => left.localeCompare(right));
                    const coverageRecords = Array.from(coverageKeys)
                      .map((key) => holidayCoverageMap.get(key))
                      .filter((record): record is HolidayCoverageRecord => record != null);
                    const mergedSegments = coverageRecords.length > 0
                      ? mergeCoverageSegments(coverageRecords)
                      : [];
                    const metaLabels = mergedSegments.length > 0
                      ? mergedSegments.map((segment) => formatCoverageSegment(segment, countryLabel))
                      : (hasNational ? ["National"] : [formatLabelMeta(regionLabelList, countryLabel)]);
                    const noteList = Array.from(notes).sort((left, right) => left.localeCompare(right));
                    return (
                      <li key={displayKey} className="holiday-item">
                        <div className="holiday-title-row">
                          <strong>{nameList.join(", ")}</strong>
                          <span className={`pill pill-${holidayType}`}>{holidayType}</span>
                        </div>
                        {metaLabels.map((metaLabel) => (
                          <div key={`${displayKey}-${metaLabel}`} className="holiday-meta">{metaLabel}</div>
                        ))}
                        {noteList.map((note) => (
                          <p key={note} className="holiday-notes">{note}</p>
                        ))}
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </aside>
  );
}
