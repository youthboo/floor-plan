/** Shared naming convention for duplicated campaigns (single or bulk). */
// NOTE: unlike nextAvailableCampaignCode, this never checks for existing name collisions.
// The calculation pipeline (backend/utils/calculation_utils.py _load_active_campaign_index)
// matches campaigns by name, not code, so duplicating the same campaign twice (or duplicating
// a "- copy") produces two campaigns with an identical name — one silently overwrites the
// other's terms for calculation matching. Known gap, not yet fixed.
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
