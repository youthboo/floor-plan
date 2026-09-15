/** Normalizes the Exception field into a dealer-code array — handles the array shape the
 * dealer-picker writes, and (legacy/freshly-imported-from-Excel) a free-text string. */
export function parseExceptionField(value: string[] | string | null | undefined): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return value
    .split(/[,\n]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}
