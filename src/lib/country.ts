export function normalizeCountryCode(countryCode: string): string {
  return countryCode.trim().toUpperCase();
}

export function getCountryFlagAssetPath(countryCode: string): string {
  return `${import.meta.env.BASE_URL}flags/${normalizeCountryCode(countryCode).toLowerCase()}.svg`;
}
