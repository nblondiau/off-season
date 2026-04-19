import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { FilterState } from "../lib/dataset";
import { CountryFlag } from "./CountryFlag";

interface FiltersProps {
  countryOptions: Array<{ value: string; label: string }>;
  filters: FilterState;
  mode: "desktop" | "mobile";
  onChange: (next: FilterState) => void;
}

function buildSummary(selectedCount: number, totalCount: number): string {
  if (selectedCount === totalCount) {
    return "All countries";
  }

  if (selectedCount === 1) {
    return "1 country selected";
  }

  return `${selectedCount} countries selected`;
}

export function Filters({ countryOptions, filters, mode, onChange }: FiltersProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const listboxId = useId();

  const selectedCount = filters.countryCodes.length;
  const summary = buildSummary(selectedCount, countryOptions.length);
  const selectedCountryFlags = useMemo(() => {
    const selectedCodes = new Set(filters.countryCodes);
    return countryOptions
      .filter((option) => selectedCodes.has(option.value))
      .map((option) => option.value);
  }, [countryOptions, filters.countryCodes]);

  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return countryOptions;
    }

    return countryOptions.filter((option) => {
      const haystack = `${option.label} ${option.value}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [countryOptions, query]);

  useEffect(() => {
    if (!open) {
      return;
    }

    if (mode === "desktop") {
      searchRef.current?.focus();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    function handlePointerDown(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [mode, open]);

  useEffect(() => {
    if (!open) {
      setQuery("");
    }
  }, [open]);

  function setCountryCodes(countryCodes: string[]) {
    onChange({ countryCodes });
  }

  function toggleCountry(countryCode: string) {
    const checked = filters.countryCodes.includes(countryCode);
    const nextCountryCodes = checked
      ? filters.countryCodes.filter((value) => value !== countryCode)
      : [...filters.countryCodes, countryCode];

    setCountryCodes(nextCountryCodes);
  }

  function selectAll() {
    onChange({ countryCodes: countryOptions.map((option) => option.value) });
  }

  function clearAll() {
    onChange({ countryCodes: [] });
  }

  function renderPickerContent() {
    return (
      <>
        <label className="country-filter-search">
          <input
            aria-label="Search countries"
            ref={searchRef}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Type a country name"
          />
        </label>

        <div className="country-filter-actions">
          <button type="button" onClick={selectAll}>
            Select all
          </button>
          <button type="button" onClick={clearAll}>
            Clear all
          </button>
        </div>

        <div className="checkbox-list" role="listbox" aria-multiselectable="true">
          {filteredOptions.map((option) => {
            const checked = filters.countryCodes.includes(option.value);
            return (
              <label key={option.value} className="checkbox-item">
                <input
                  aria-label={option.label}
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleCountry(option.value)}
                />
                <span className="country-option-label">
                  <CountryFlag countryCode={option.value} />
                  <span>{option.label}</span>
                </span>
              </label>
            );
          })}
          {filteredOptions.length === 0 ? <p className="country-filter-empty">No countries match.</p> : null}
        </div>
      </>
    );
  }

  return (
    <div ref={rootRef} className={`filters-panel filters-panel-${mode}`}>
      <div className="country-filter">
        <button
          aria-controls={listboxId}
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-label={summary}
          className="country-filter-trigger"
          type="button"
          onClick={() => setOpen((value) => !value)}
        >
          {selectedCountryFlags.length > 0 ? (
            <span aria-hidden="true" className="country-filter-selected-flags">
              {selectedCountryFlags.map((countryCode) => (
                <CountryFlag key={countryCode} countryCode={countryCode} />
              ))}
            </span>
          ) : null}
          {selectedCountryFlags.length === 0 ? <span>{summary}</span> : null}
          <span aria-hidden="true" className={`country-filter-chevron${open ? " country-filter-chevron-open" : ""}`}>
            ▾
          </span>
        </button>
        {open && mode === "mobile" ? (
          <div aria-label="Country selector" className="country-filter-popover" id={listboxId} role="dialog">
            {renderPickerContent()}
          </div>
        ) : null}
      </div>

      {open && mode === "desktop" ? (
        <div aria-label="Country selector" className="country-filter-dialog" id={listboxId} role="dialog">
          <div className="country-filter-dialog-header">
            <h3>Choose countries</h3>
            <button aria-label="Close country selector" type="button" onClick={() => setOpen(false)}>
              Close
            </button>
          </div>
          {renderPickerContent()}
        </div>
      ) : null}
    </div>
  );
}
