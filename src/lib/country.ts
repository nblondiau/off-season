export function countryCodeToFlag(countryCode: string): string {
  return countryCode
    .toUpperCase()
    .replace(/./g, (character) => String.fromCodePoint(0x1f1e6 - 65 + character.charCodeAt(0)));
}
