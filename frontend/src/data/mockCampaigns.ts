// Temporary in-memory mock data source for campaigns, keyed by campaign code.
// Both the read-only detail view and the edit form pull from this single
// source so "Edit" starts from the campaign's real data instead of a blank
// form. Swap `getMockCampaign` for a real API call once the backend exists.

export interface MockConditionRow {
  id: number;
  campaign: string;
  range: string;
  model: string;
  /** Display format: dd-mm-yy */
  ddStart: string;
  /** Display format: dd-mm-yy */
  ddEnd: string;
  affectedDealers: string;
  selectedDealers?: string[];
  exception?: string;
}

export interface MockRateTierRow {
  id: number;
  range: string;
  startDay: number;
  endDay: number;
  rate: number;
  plus: string;
  /** Display format: dd-mm-yy */
  effectiveStart: string;
  /** Display format: dd-mm-yy */
  effectiveEnd: string;
  active: boolean;
  deliveryDate: boolean;
}

export interface MockCampaign {
  code: string;
  name: string;
  freeDays: number;
  units: number;
  campaignConditions: MockConditionRow[];
  rateByDayRange: MockRateTierRow[];
}

export const MOCK_CAMPAIGNS: Record<string, MockCampaign> = {
  '24001': {
    code: '24001',
    name: 'Songkran EV Drawdown',
    freeDays: 15,
    units: 2956,
    campaignConditions: [
      {
        id: 1,
        campaign: '24001',
        range: 'A',
        model: 'SEALION6',
        ddStart: '25-04-26',
        ddEnd: '31-05-26',
        affectedDealers: 'All dealers',
      },
      {
        id: 2,
        campaign: '24001',
        range: 'A',
        model: 'DOLPHIN',
        ddStart: '25-04-26',
        ddEnd: '31-05-26',
        affectedDealers: 'All dealers',
      },
      {
        id: 3,
        campaign: '24001',
        range: 'A',
        model: 'ATTO3',
        ddStart: '25-04-26',
        ddEnd: '31-05-26',
        affectedDealers: 'All dealers',
      },
    ],
    rateByDayRange: [
      {
        id: 1,
        range: 'A',
        startDay: 1,
        endDay: 90,
        rate: 6.625,
        plus: '-',
        effectiveStart: '01-01-25',
        effectiveEnd: '31-03-25',
        active: true,
        deliveryDate: true,
      },
      {
        id: 2,
        range: 'B',
        startDay: 91,
        endDay: 120,
        rate: 15.0,
        plus: '-',
        effectiveStart: '02-04-25',
        effectiveEnd: '30-04-25',
        active: true,
        deliveryDate: true,
      },
    ],
  },
};

/** Falls back to the 24001 sample so every campaign row in the demo list has something to show. */
export function getMockCampaign(code: string | undefined): MockCampaign | undefined {
  if (!code) return undefined;
  return MOCK_CAMPAIGNS[code] ?? MOCK_CAMPAIGNS['24001'];
}

/** Converts the mock data's "dd-mm-yy" display date to the "yyyy-MM-dd" ISO format the DatePicker uses. */
export function toISODate(display: string): string {
  const parts = display.split('-');
  if (parts.length !== 3) return '';
  const [dd, mm, yy] = parts;
  const yyyy = yy.length === 2 ? `20${yy}` : yy;
  return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
}
