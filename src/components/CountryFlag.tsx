import { useState } from "react";
import { getCountryFlagAssetPath, normalizeCountryCode } from "../lib/country";

interface CountryFlagProps {
  countryCode: string;
  className?: string;
  decorative?: boolean;
}

export function CountryFlag({ countryCode, className = "", decorative = true }: CountryFlagProps) {
  const normalizedCode = normalizeCountryCode(countryCode);
  const [hasLoadError, setHasLoadError] = useState(false);
  const rootClassName = ["country-flag", className].filter(Boolean).join(" ");

  if (!/^[A-Z]{2}$/.test(normalizedCode) || hasLoadError) {
    return (
      <span aria-hidden={decorative} className={`${rootClassName} country-flag-fallback`}>
        {normalizedCode}
      </span>
    );
  }

  return (
    <img
      alt=""
      aria-hidden={decorative}
      className={rootClassName}
      height="14"
      loading="lazy"
      onError={() => setHasLoadError(true)}
      src={getCountryFlagAssetPath(normalizedCode)}
      width="20"
    />
  );
}
