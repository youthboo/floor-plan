/** Shared naming convention for duplicated campaigns (single or bulk). */
export function duplicateCampaignName(name: string): string {
  return `${name} - copy`;
}

export function nextAvailableCampaignCode(baseCode: string, taken: Set<string>): string {
  let candidate = `${baseCode}-copy`;
  let suffix = 2;
  while (taken.has(candidate)) {
    candidate = `${baseCode}-copy-${suffix}`;
    suffix += 1;
  }
  taken.add(candidate);
  return candidate;
}
