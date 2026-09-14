/** Converts a "dd-mm-yy" display date (the format Campaign Master API responses use) to
 * the "yyyy-MM-dd" ISO format the DatePicker component expects as its value. */
export function toISODate(display: string): string {
  const parts = display.split('-');
  if (parts.length !== 3) return '';
  const [dd, mm, yy] = parts;
  const yyyy = yy.length === 2 ? `20${yy}` : yy;
  return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
}

/** Converts a "yyyy-MM-dd" ISO date (the DatePicker's value format) back to "dd-mm-yy" —
 * the backend's campaign endpoints only accept dd-mm-yy; sending ISO directly is parsed
 * with dayfirst=True and silently swaps day/month (e.g. 2025-04-01 -> 4 Jan, not 1 Apr). */
export function fromISODate(iso: string): string {
  const parts = iso.split('-');
  if (parts.length !== 3) return '';
  const [yyyy, mm, dd] = parts;
  return `${dd.padStart(2, '0')}-${mm.padStart(2, '0')}-${yyyy.slice(-2)}`;
}
