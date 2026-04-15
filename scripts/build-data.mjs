import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EUROPEAN_COUNTRY_CODES, WINDOW_END, WINDOW_START, sourceDefaults } from "./source-fixtures.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

function toIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

function fromIsoDate(value) {
  return new Date(`${value}T00:00:00Z`);
}

function addDays(value, days) {
  const date = fromIsoDate(value);
  date.setUTCDate(date.getUTCDate() + days);
  return toIsoDate(date);
}

function slugify(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildHolidayId(countryCode, regionId, holidayType, name, startDate) {
  return `${countryCode.toLowerCase()}-${holidayType}-${slugify(regionId)}-${slugify(name)}-${startDate}`;
}

function buildOffSeasonDays(windowStart, windowEnd, holidays) {
  const holidayIdsByDay = new Map();
  let cursor = windowStart;

  for (const holiday of holidays) {
    let current = holiday.startDate;
    while (current <= holiday.endDate) {
      if (current >= windowStart && current <= windowEnd) {
        const ids = holidayIdsByDay.get(current) ?? [];
        ids.push(holiday.id);
        holidayIdsByDay.set(current, ids);
      }
      current = addDays(current, 1);
    }
  }

  const days = [];
  while (cursor <= windowEnd) {
    days.push({
      date: cursor,
      offSeason: !holidayIdsByDay.has(cursor),
      holidayIds: holidayIdsByDay.get(cursor) ?? []
    });
    cursor = addDays(cursor, 1);
  }

  return days;
}

function pickLocalizedText(values, preferredLanguage = "EN") {
  if (!Array.isArray(values) || values.length === 0) {
    return "";
  }
  return (
    values.find((entry) => entry.language === preferredLanguage)?.text ??
    values.find((entry) => entry.language === "EN")?.text ??
    values[0].text
  );
}

function filterWindow(holidays) {
  return holidays.filter((holiday) => holiday.endDate >= WINDOW_START && holiday.startDate <= WINDOW_END);
}

function sortRecords(records, keys) {
  return [...records].sort((left, right) => {
    for (const key of keys) {
      const leftValue = left[key] ?? "";
      const rightValue = right[key] ?? "";
      if (leftValue < rightValue) {
        return -1;
      }
      if (leftValue > rightValue) {
        return 1;
      }
    }
    return 0;
  });
}

function readSnapshot(snapshotPath) {
  return fs.readFile(path.join(repoRoot, snapshotPath), "utf8");
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent": "off-season-data-sync/0.1 (+https://github.com/nblondiau/off-season)"
    }
  });

  if (!response.ok) {
    throw new Error(`Fetch failed for ${url}: ${response.status}`);
  }

  return response.json();
}

function flattenSubdivisions(entries, parentCode = null, topLevelCode = null) {
  const result = [];
  for (const entry of entries) {
    const currentTopLevelCode = topLevelCode ?? entry.code;
    const category = pickLocalizedText(entry.category);
    result.push({
      code: entry.code,
      label: pickLocalizedText(entry.name),
      category,
      scope: category.toLowerCase() || "subdivision",
      parentCode,
      topLevelCode: currentTopLevelCode
    });
    if (Array.isArray(entry.children) && entry.children.length > 0) {
      result.push(...flattenSubdivisions(entry.children, entry.code, currentTopLevelCode));
    }
  }
  return result;
}

function buildRegionLabel(countryLabel, subdivisionLabel, groupLabel) {
  if (subdivisionLabel && groupLabel) {
    return `${countryLabel} · ${subdivisionLabel} · ${groupLabel}`;
  }
  if (subdivisionLabel) {
    return `${countryLabel} · ${subdivisionLabel}`;
  }
  if (groupLabel) {
    return `${countryLabel} · ${groupLabel}`;
  }
  return countryLabel;
}

function getHolidayScope(regionId, countryRegionId) {
  return regionId === countryRegionId ? "national" : "regional";
}

function normalizeScope(scope) {
  const value = scope.toLowerCase();
  if (value.includes("state")) {
    return "subdivision";
  }
  if (value.includes("community")) {
    return "group";
  }
  if (value.includes("zone")) {
    return "group";
  }
  if (value.includes("national")) {
    return "national";
  }
  return "regional";
}

function buildHolidayCoverageKey(holiday) {
  return [
    holiday.country,
    holiday.name.toLowerCase(),
    holiday.holidayType,
    holiday.sourceId,
    holiday.startDate,
    holiday.endDate,
    holiday.notes ?? ""
  ].join("::");
}

function incrementFamilyTotal(map, family) {
  map.set(family, (map.get(family) ?? 0) + 1);
}

function normalizeSubdivisionFamily(category) {
  const value = category.toLowerCase();
  if (value.includes("zone")) {
    return "zone";
  }
  return "administrative";
}

function normalizeGroupFamily(category) {
  const value = category.toLowerCase();
  if (
    value.includes("school") ||
    value.includes("schul") ||
    value.includes("enseignement") ||
    value.includes("grade")
  ) {
    return "school_type";
  }
  if (
    value.includes("community") ||
    value.includes("gemeenschap") ||
    value.includes("communaut") ||
    value.includes("region") ||
    value.includes("regio")
  ) {
    return "geographic_group";
  }
  return "group";
}

function canDisplayFamilyCount(family) {
  return family === "administrative" || family === "geographic_group" || family === "zone";
}

function canNationalizeFamily(family) {
  return family === "administrative" || family === "geographic_group";
}

function toPluralCountLabel(category, fallback = "regions") {
  const value = category.toLowerCase();
  if (value.includes("community") || value.includes("gemeenschap") || value.includes("communaut")) {
    return "communities";
  }
  if (value.includes("zone")) {
    return "zones";
  }
  if (value.includes("province") || value.includes("provincie")) {
    return "provinces";
  }
  if (value.includes("state") || value.includes("land")) {
    return "states";
  }
  return fallback;
}

function getSegmentPriority(model) {
  if (model === "administrative") {
    return 0;
  }
  if (model === "geographic_group") {
    return 1;
  }
  if (model === "zone") {
    return 2;
  }
  if (model === "school_type") {
    return 3;
  }
  return 4;
}

function sortSegments(segments) {
  return [...segments].sort((left, right) => {
    const priorityDifference = getSegmentPriority(left.model) - getSegmentPriority(right.model);
    if (priorityDifference !== 0) {
      return priorityDifference;
    }
    return left.model.localeCompare(right.model);
  });
}

function normalizeDisplaySegments(segments) {
  const sortedSegments = sortSegments(segments);
  const hasGroupSegment = sortedSegments.some((segment) => segment.model === "zone" || segment.model === "geographic_group");
  const hasAdministrativeSegment = sortedSegments.some((segment) => segment.model === "administrative");
  if (hasGroupSegment && hasAdministrativeSegment) {
    return sortedSegments.filter((segment) => segment.model !== "administrative");
  }
  return sortedSegments;
}

function buildCoverageRecord({
  country,
  countryLabel,
  holidayType,
  name,
  startDate,
  endDate,
  sourceId,
  notes,
  targetLabels,
  subdivisions,
  groups,
  nationwide,
  subdivisionFamilyTotals,
  groupFamilyTotals
}) {
  const baseRecord = {
    key: buildHolidayCoverageKey({ country, holidayType, name, startDate, endDate, sourceId, notes }),
    country,
    holidayType,
    name,
    startDate,
    endDate,
    sourceId,
    notes
  };

  if (nationwide || (subdivisions.length === 0 && groups.length === 0)) {
    return {
      ...baseRecord,
      segments: [{
        model: "national",
        normalizedScope: "national",
        displayMode: "national",
        regionLabels: Array.from(new Set(targetLabels)).sort((left, right) => left.localeCompare(right)),
        regionCount: 1
      }]
    };
  }

  if (subdivisions.length === 0 && groups.length > 0) {
    const segments = Array.from(
      groups.reduce((familyMap, group) => {
        const current = familyMap.get(group.family) ?? {
          model: group.family,
          category: group.category,
          labels: new Set()
        };
        current.labels.add(buildRegionLabel(countryLabel, null, group.label ?? group.shortName));
        familyMap.set(group.family, current);
        return familyMap;
      }, new Map())
    ).map(([, familyGroup]) => {
      const regionLabels = Array.from(familyGroup.labels).sort((left, right) => left.localeCompare(right));
      const regionCount = regionLabels.length;
      const totalRegionCount = groupFamilyTotals.get(familyGroup.model);
      if (totalRegionCount && canNationalizeFamily(familyGroup.model) && regionCount === totalRegionCount) {
        return {
          model: familyGroup.model,
          normalizedScope: "national",
          displayMode: "national",
          regionLabels,
          regionCount,
          totalRegionCount
        };
      }
      if (totalRegionCount && canDisplayFamilyCount(familyGroup.model)) {
        return {
          model: familyGroup.model,
          normalizedScope: "regional",
          displayMode: "count",
          regionLabels,
          regionCount,
          countLabel: toPluralCountLabel(familyGroup.category ?? familyGroup.model),
          totalRegionCount
        };
      }
      return {
        model: familyGroup.model,
        normalizedScope: "regional",
        displayMode: "labels",
        regionLabels,
        regionCount
      };
    });

    if (segments.length > 0) {
      return {
        ...baseRecord,
        segments: normalizeDisplaySegments(segments)
      };
    }
  }

  if (subdivisions.length > 0 && groups.length === 0) {
    const segmentLabelsByFamily = new Map();
    for (const subdivision of subdivisions) {
      const current = segmentLabelsByFamily.get(subdivision.family) ?? {
        model: subdivision.family,
        category: subdivision.category,
        labels: new Set()
      };
      current.labels.add(buildRegionLabel(countryLabel, subdivision.label ?? subdivision.shortName));
      segmentLabelsByFamily.set(subdivision.family, current);
    }
    const segments = Array.from(segmentLabelsByFamily.values()).map((familyGroup) => {
      const regionLabels = Array.from(familyGroup.labels).sort((left, right) => left.localeCompare(right));
      const regionCount = regionLabels.length;
      const totalRegionCount = subdivisionFamilyTotals.get(familyGroup.model);
      if (totalRegionCount && canNationalizeFamily(familyGroup.model) && regionCount === totalRegionCount) {
        return {
          model: familyGroup.model,
          normalizedScope: "national",
          displayMode: "national",
          regionLabels,
          regionCount,
          totalRegionCount
        };
      }
      if (totalRegionCount && canDisplayFamilyCount(familyGroup.model)) {
        return {
          model: familyGroup.model,
          normalizedScope: "regional",
          displayMode: "count",
          regionLabels,
          regionCount,
          countLabel: toPluralCountLabel(familyGroup.category ?? familyGroup.model),
          totalRegionCount
        };
      }
      return {
        model: familyGroup.model,
        normalizedScope: "regional",
        displayMode: "labels",
        regionLabels,
        regionCount
      };
    });

    if (segments.length > 0) {
      return {
        ...baseRecord,
        segments: normalizeDisplaySegments(segments)
      };
    }
  }

  if (subdivisions.length > 0 && groups.length > 0) {
    const segments = [];
    const subdivisionLabelsByFamily = new Map();
    for (const subdivision of subdivisions) {
      const current = subdivisionLabelsByFamily.get(subdivision.family) ?? {
        model: subdivision.family,
        category: subdivision.category,
        labels: new Set()
      };
      current.labels.add(buildRegionLabel(countryLabel, subdivision.label ?? subdivision.shortName));
      subdivisionLabelsByFamily.set(subdivision.family, current);
    }
    for (const familyGroup of subdivisionLabelsByFamily.values()) {
      const regionLabels = Array.from(familyGroup.labels).sort((left, right) => left.localeCompare(right));
      const regionCount = regionLabels.length;
      const totalRegionCount = subdivisionFamilyTotals.get(familyGroup.model);
      if (totalRegionCount && canNationalizeFamily(familyGroup.model) && regionCount === totalRegionCount) {
        segments.push({
          model: familyGroup.model,
          normalizedScope: "national",
          displayMode: "national",
          regionLabels,
          regionCount,
          totalRegionCount
        });
      } else if (totalRegionCount && canDisplayFamilyCount(familyGroup.model)) {
        segments.push({
          model: familyGroup.model,
          normalizedScope: "regional",
          displayMode: "count",
          regionLabels,
          regionCount,
          countLabel: toPluralCountLabel(familyGroup.category ?? familyGroup.model),
          totalRegionCount
        });
      } else {
        segments.push({
          model: familyGroup.model,
          normalizedScope: "regional",
          displayMode: "labels",
          regionLabels,
          regionCount
        });
      }
    }
    const groupLabelsByFamily = new Map();
    for (const group of groups) {
      const current = groupLabelsByFamily.get(group.family) ?? {
        model: group.family,
        category: group.category,
        labels: new Set()
      };
      current.labels.add(buildRegionLabel(countryLabel, null, group.label ?? group.shortName));
      groupLabelsByFamily.set(group.family, current);
    }
    for (const familyGroup of groupLabelsByFamily.values()) {
      const regionLabels = Array.from(familyGroup.labels).sort((left, right) => left.localeCompare(right));
      const regionCount = regionLabels.length;
      const totalRegionCount = groupFamilyTotals.get(familyGroup.model);
      if (totalRegionCount && canNationalizeFamily(familyGroup.model) && regionCount === totalRegionCount) {
        segments.push({
          model: familyGroup.model,
          normalizedScope: "national",
          displayMode: "national",
          regionLabels,
          regionCount,
          totalRegionCount
        });
      } else if (totalRegionCount && canDisplayFamilyCount(familyGroup.model)) {
        segments.push({
          model: familyGroup.model,
          normalizedScope: "regional",
          displayMode: "count",
          regionLabels,
          regionCount,
          countLabel: toPluralCountLabel(familyGroup.category ?? familyGroup.model),
          totalRegionCount
        });
      } else {
        segments.push({
          model: familyGroup.model,
          normalizedScope: "regional",
          displayMode: "labels",
          regionLabels,
          regionCount
        });
      }
    }

    if (segments.length > 0) {
      return {
        ...baseRecord,
        segments: normalizeDisplaySegments(segments)
      };
    }
  }

  return {
    ...baseRecord,
    segments: [{
      model: "labels",
      normalizedScope: "regional",
      displayMode: "labels",
      regionLabels: Array.from(new Set(targetLabels)).sort((left, right) => left.localeCompare(right)),
      regionCount: Array.from(new Set(targetLabels)).length
    }]
  };
}

function mergeCoverageSegments(existingSegments, newSegments) {
  const segmentsByModel = new Map(
    existingSegments.map((segment) => [segment.model, {
      ...segment,
      regionLabels: new Set(segment.regionLabels)
    }])
  );
  for (const segment of newSegments) {
    const existing = segmentsByModel.get(segment.model);
    if (existing) {
      for (const label of segment.regionLabels) {
        existing.regionLabels.add(label);
      }
    } else {
      segmentsByModel.set(segment.model, {
        ...segment,
        regionLabels: new Set(segment.regionLabels)
      });
    }
  }
  return Array.from(segmentsByModel.values()).map((merged) => {
    const regionLabels = Array.from(merged.regionLabels).sort((a, b) => a.localeCompare(b));
    const regionCount = regionLabels.length;
    const displayMode = (merged.totalRegionCount && regionCount >= merged.totalRegionCount)
      ? "national"
      : merged.displayMode;
    const normalizedScope = displayMode === "national" ? "national" : merged.normalizedScope;
    return {
      model: merged.model,
      normalizedScope,
      displayMode,
      regionLabels,
      regionCount,
      ...(merged.countLabel ? { countLabel: merged.countLabel } : {}),
      ...(merged.totalRegionCount ? { totalRegionCount: merged.totalRegionCount } : {})
    };
  });
}

async function fetchLiveSnapshot(buildDate) {
  const countriesResponse = await fetchJson("https://openholidaysapi.org/Countries");
  const supportedCountries = countriesResponse.filter((country) => EUROPEAN_COUNTRY_CODES.includes(country.isoCode));
  const countries = supportedCountries.map((country) => ({
    countryCode: country.isoCode,
    label: pickLocalizedText(country.name),
    officialLanguages: country.officialLanguages ?? []
  }));

  const payload = {
    generatedAt: buildDate,
    countries: [],
    subdivisionsByCountry: {},
    groupsByCountry: {},
    publicHolidaysByCountry: {},
    schoolHolidaysByCountry: {}
  };

  for (const country of countries) {
    const languageIsoCode = "EN";
    const [subdivisions, groups, publicHolidays, schoolHolidays] = await Promise.all([
      fetchJson(`https://openholidaysapi.org/Subdivisions?countryIsoCode=${country.countryCode}`).catch(() => []),
      fetchJson(`https://openholidaysapi.org/Groups?countryIsoCode=${country.countryCode}`).catch(() => []),
      fetchJson(
        `https://openholidaysapi.org/PublicHolidays?countryIsoCode=${country.countryCode}&languageIsoCode=${languageIsoCode}&validFrom=${WINDOW_START}&validTo=${WINDOW_END}`
      ).catch(() => []),
      fetchJson(
        `https://openholidaysapi.org/SchoolHolidays?countryIsoCode=${country.countryCode}&languageIsoCode=${languageIsoCode}&validFrom=${WINDOW_START}&validTo=${WINDOW_END}`
      ).catch(() => [])
    ]);

    payload.countries.push(country);
    payload.subdivisionsByCountry[country.countryCode] = subdivisions;
    payload.groupsByCountry[country.countryCode] = groups;
    payload.publicHolidaysByCountry[country.countryCode] = publicHolidays;
    payload.schoolHolidaysByCountry[country.countryCode] = schoolHolidays;
  }

  return payload;
}

function buildDatasetFromPayload(payload, buildDate, source) {
  const countries = sortRecords(payload.countries, ["label"]).map((country) => ({
    countryCode: country.countryCode,
    label: country.label
  }));

  const regions = [];
  const holidays = [];
  const holidayCoverage = [];

  for (const country of payload.countries) {
    const subdivisionEntries = flattenSubdivisions(payload.subdivisionsByCountry[country.countryCode] ?? []);
    const subdivisionMap = new Map(subdivisionEntries.map((entry) => [entry.code, entry]));
    const topLevelSubdivisions = subdivisionEntries.filter((entry) => entry.parentCode === null);
    const topLevelSubdivisionMap = new Map(topLevelSubdivisions.map((entry) => [entry.code, entry]));
    const topLevelCodeBySubdivision = new Map(subdivisionEntries.map((entry) => [entry.code, entry.topLevelCode]));
    const subdivisionFamilyByCode = new Map();
    for (const subdivision of topLevelSubdivisions) {
      const family = normalizeSubdivisionFamily(subdivision.category ?? subdivision.scope);
      subdivisionFamilyByCode.set(subdivision.code, family);
    }
    const groups = payload.groupsByCountry[country.countryCode] ?? [];
    const groupMap = new Map(
      groups.map((group) => [
        group.code,
        {
          code: group.code,
          label: pickLocalizedText(group.name),
          category: pickLocalizedText(group.category) || "group",
          scope: normalizeScope(pickLocalizedText(group.category) || "group"),
          family: normalizeGroupFamily(pickLocalizedText(group.category) || "group")
        }
      ])
    );

    function computeFamilyTotals(rawHolidays) {
      const usedSubdivisionCodes = new Set();
      const usedGroupCodes = new Set();
      for (const holiday of rawHolidays) {
        for (const subdivision of holiday.subdivisions ?? []) {
          const topLevelCode = topLevelCodeBySubdivision.get(subdivision.code) ?? subdivision.code;
          usedSubdivisionCodes.add(topLevelCode);
        }
        for (const group of holiday.groups ?? []) {
          usedGroupCodes.add(group.code);
        }
      }
      const subdivisionTotals = new Map();
      for (const subdivision of topLevelSubdivisions) {
        if (usedSubdivisionCodes.has(subdivision.code)) {
          incrementFamilyTotal(subdivisionTotals, subdivisionFamilyByCode.get(subdivision.code));
        }
      }
      const groupTotals = new Map();
      for (const groupEntry of groupMap.values()) {
        if (usedGroupCodes.has(groupEntry.code)) {
          incrementFamilyTotal(groupTotals, groupEntry.family);
        }
      }
      return { subdivisionFamilyTotals: subdivisionTotals, groupFamilyTotals: groupTotals };
    }

    function computeFamilyTotalsByName(rawHolidays) {
      const holidaysByName = new Map();
      for (const holiday of rawHolidays) {
        const name = pickLocalizedText(holiday.name).toLowerCase();
        const current = holidaysByName.get(name) ?? [];
        current.push(holiday);
        holidaysByName.set(name, current);
      }
      const totalsByName = new Map();
      for (const [name, holidays] of holidaysByName) {
        totalsByName.set(name, computeFamilyTotals(holidays));
      }
      return totalsByName;
    }

    const publicTotalsByName = computeFamilyTotalsByName(payload.publicHolidaysByCountry[country.countryCode] ?? []);
    const schoolTotalsByName = computeFamilyTotalsByName(payload.schoolHolidaysByCountry[country.countryCode] ?? []);

    const countryRegionId = `${country.countryCode}-NAT`;
    regions.push({
      id: countryRegionId,
      country: country.countryCode,
      label: country.label,
      scope: "national",
      sourceIds: [source.sourceId]
    });

    const regionMap = new Map([[countryRegionId, { label: country.label, scope: "national" }]]);

    for (const subdivision of topLevelSubdivisions) {
      regionMap.set(subdivision.code, { label: buildRegionLabel(country.label, subdivision.label), scope: "subdivision" });
      regions.push({
        id: subdivision.code,
        country: country.countryCode,
        label: buildRegionLabel(country.label, subdivision.label),
        scope: "subdivision",
        sourceIds: [source.sourceId]
      });
    }

    for (const group of groups) {
      if (!regionMap.has(group.code)) {
        regionMap.set(group.code, { label: buildRegionLabel(country.label, null, pickLocalizedText(group.name)), scope: "group" });
        regions.push({
          id: group.code,
          country: country.countryCode,
          label: buildRegionLabel(country.label, null, pickLocalizedText(group.name)),
          scope: "group",
          sourceIds: [source.sourceId]
        });
      }
    }

    function addHolidayRecords(rawHoliday, holidayType, { subdivisionFamilyTotals, groupFamilyTotals }) {
      const name = pickLocalizedText(rawHoliday.name);
      const targets = [];
      const subdivisions = Array.from(
        new Map(
          (rawHoliday.subdivisions ?? []).map((subdivision) => {
            const topLevelCode = topLevelCodeBySubdivision.get(subdivision.code) ?? subdivision.code;
            const topLevelEntry = topLevelSubdivisionMap.get(topLevelCode) ?? subdivisionMap.get(topLevelCode);
            return [
              topLevelCode,
              {
                code: topLevelCode,
                shortName: topLevelEntry?.code ?? subdivision.shortName,
                label: topLevelEntry?.label ?? topLevelEntry?.code ?? subdivision.shortName,
                family: subdivisionFamilyByCode.get(topLevelCode) ?? "administrative",
                category: topLevelEntry?.category ?? topLevelEntry?.scope ?? "subdivision"
              }
            ];
          })
        ).values()
      );
      const groupsForHoliday = (rawHoliday.groups ?? []).map((group) => {
        const groupEntry = groupMap.get(group.code);
        return {
          code: group.code,
          shortName: group.shortName,
          label: groupEntry?.label ?? group.shortName,
          family: groupEntry?.family ?? "group",
          category: groupEntry?.category ?? "group"
        };
      });

      if (rawHoliday.nationwide || (subdivisions.length === 0 && groupsForHoliday.length === 0)) {
        targets.push({
          regionId: countryRegionId,
          regionLabel: country.label
        });
      } else if (subdivisions.length > 0 && groupsForHoliday.length > 0) {
        for (const subdivision of subdivisions) {
          const subdivisionEntry = subdivisionMap.get(subdivision.code);
          for (const group of groupsForHoliday) {
            const groupEntry = groupMap.get(group.code);
            const regionId = `${subdivision.code}::${group.code}`;
            const regionLabel = buildRegionLabel(country.label, subdivisionEntry?.label ?? subdivision.shortName, groupEntry?.label ?? group.shortName);
            if (!regionMap.has(regionId)) {
              regionMap.set(regionId, { label: regionLabel, scope: "group" });
              regions.push({
                id: regionId,
                country: country.countryCode,
                label: regionLabel,
                scope: "group",
                sourceIds: [source.sourceId]
              });
            }
            targets.push({ regionId, regionLabel });
          }
        }
      } else if (subdivisions.length > 0) {
        for (const subdivision of subdivisions) {
          const subdivisionEntry = subdivisionMap.get(subdivision.code);
          targets.push({
            regionId: subdivision.code,
            regionLabel: buildRegionLabel(country.label, subdivisionEntry?.label ?? subdivision.shortName)
          });
        }
      } else {
        for (const group of groupsForHoliday) {
          const groupEntry = groupMap.get(group.code);
          targets.push({
            regionId: group.code,
            regionLabel: buildRegionLabel(country.label, null, groupEntry?.label ?? group.shortName)
          });
        }
      }

      holidayCoverage.push(buildCoverageRecord({
        country: country.countryCode,
        countryLabel: country.label,
        holidayType,
        name,
        startDate: rawHoliday.startDate,
        endDate: rawHoliday.endDate,
        sourceId: source.sourceId,
        notes: rawHoliday.notes,
        targetLabels: targets.map((target) => target.regionLabel),
        subdivisions,
        groups: groupsForHoliday,
        nationwide: rawHoliday.nationwide,
        subdivisionFamilyTotals,
        groupFamilyTotals
      }));

      for (const target of targets) {
        holidays.push({
          id: buildHolidayId(country.countryCode, target.regionId, holidayType, name, rawHoliday.startDate),
          country: country.countryCode,
          regionId: target.regionId,
          regionLabel: target.regionLabel,
          scope: getHolidayScope(target.regionId, countryRegionId),
          holidayType,
          name,
          startDate: rawHoliday.startDate,
          endDate: rawHoliday.endDate,
          sourceId: source.sourceId
        });
      }
    }

    for (const holiday of payload.publicHolidaysByCountry[country.countryCode] ?? []) {
      const name = pickLocalizedText(holiday.name).toLowerCase();
      addHolidayRecords(holiday, "public", publicTotalsByName.get(name) ?? computeFamilyTotals([]));
    }

    for (const holiday of payload.schoolHolidaysByCountry[country.countryCode] ?? []) {
      const name = pickLocalizedText(holiday.name).toLowerCase();
      addHolidayRecords(holiday, "school", schoolTotalsByName.get(name) ?? computeFamilyTotals([]));
    }
  }

  const uniqueRegions = Array.from(new Map(regions.map((region) => [region.id, region])).values());
  const uniqueHolidays = Array.from(new Map(filterWindow(holidays).map((holiday) => [holiday.id, holiday])).values());
  const coverageByKey = new Map();
  for (const coverage of filterWindow(holidayCoverage)) {
    const existing = coverageByKey.get(coverage.key);
    if (!existing) {
      coverageByKey.set(coverage.key, coverage);
    } else {
      existing.segments = mergeCoverageSegments(existing.segments, coverage.segments);
    }
  }
  const uniqueHolidayCoverage = Array.from(coverageByKey.values());

  return {
    generatedAt: buildDate,
    windowStart: WINDOW_START,
    windowEnd: WINDOW_END,
    countries,
    regions: sortRecords(uniqueRegions, ["country", "label", "id"]),
    sources: [
      {
        ...source,
        lastCheckedAt: buildDate,
        lastChangedAt: buildDate
      }
    ],
    holidays: sortRecords(uniqueHolidays, ["startDate", "country", "regionId", "name"]),
    holidayCoverage: sortRecords(uniqueHolidayCoverage, ["startDate", "country", "name"]),
    offSeasonDays: buildOffSeasonDays(WINDOW_START, WINDOW_END, uniqueHolidays)
  };
}

async function main() {
  const buildDate = toIsoDate(new Date());
  const source = sourceDefaults[0];

  let payload;
  let mode = "live";

  try {
    payload = await fetchLiveSnapshot(buildDate);
    await fs.mkdir(path.dirname(path.join(repoRoot, source.snapshotPath)), { recursive: true });
    await fs.writeFile(path.join(repoRoot, source.snapshotPath), `${JSON.stringify(payload, null, 2)}\n`);
  } catch {
    payload = JSON.parse(await readSnapshot(source.snapshotPath));
    mode = "snapshot";
  }

  const dataset = buildDatasetFromPayload(payload, buildDate, {
    ...source,
    defaultLastChangedAt: mode === "live" ? buildDate : source.defaultLastChangedAt
  });

  await fs.mkdir(path.join(repoRoot, "src", "generated"), { recursive: true });
  await fs.mkdir(path.join(repoRoot, "public", "generated"), { recursive: true });
  await fs.writeFile(path.join(repoRoot, "src", "generated", "dataset.json"), `${JSON.stringify(dataset, null, 2)}\n`);
  await fs.writeFile(path.join(repoRoot, "public", "generated", "dataset.json"), `${JSON.stringify(dataset, null, 2)}\n`);
  await fs.writeFile(
    path.join(repoRoot, "src", "generated", "source-review.json"),
    `${JSON.stringify({ generatedAt: buildDate, reviews: [{ sourceId: source.sourceId, status: mode }] }, null, 2)}\n`
  );
}

await main();
