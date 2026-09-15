// ============= CONFIG TYPES =============
export interface ConfigData {
  monthEndDate: string;
  fullMonthDays: number;
  penaltyRate: number;
  month: string;
  year: string;
}

export interface RateRange {
  StartDay: number;
  EndDay: number;
  Rate: number;
  EffectiveStart: string;
  EffectiveEnd: string;
  IsActive: boolean;
}

export interface SubventionCampaign {
  'Campaign Name': string;
  'Free Days': number;
}

export interface AppConfig {
  config: ConfigData;
  rates: RateRange[];
  subventions: SubventionCampaign[];
}

// ============= AR RECORD TYPES =============
export interface ARRecord {
  dealerGroup: string;
  dealerCode: string;
  dealerName: string;
  model: string;
  vinNumber: string;
  price: number;
  allocationDate: string;
  contractNumber?: string;
  subventionCampaign: string;
  source: 'AR Last Month' | 'New Volume';
  paymentDate?: string;
  paid: 'Y' | 'N';
  freeDays: number;
  dueDate?: string;
  aging: number;
  ramCharge: number;
  dealerCharge: number;
  ramChargeAfterWaive: number;
  dealerChargeAfterWaive: number;
  ramRateSummary: string;
  dealerRateSummary: string;
  waiveAmount?: number;
  reason?: string;
}

// ============= WAIVE RECORD TYPES =============
export interface WaiveRecord {
  dealerCode: string;
  vinNumber: string;
  waiveAmount: number;
  reason?: string;
  approved: 'Y' | 'N';
}

// ============= SUMMARY TYPES =============
export interface SummaryData {
  'AR Last Month': number;
  'New Volume': number;
  'All Payment (Paid=Y)': number;
  'AR Outstanding (Paid=N)': number;
  Total: number;
}

export interface DealerSummaryRecord {
  dealerGroup: string;
  dealerCode: string;
  dealerName: string;
  'AR Master Code': string;
  'Amount per calculation': number;
  Waive: number;
  WHT: number;
  VAT: number;
  'Total Receivable': number;
  Total: number;
}

// ============= API REQUEST/RESPONSE TYPES =============
export interface FileUploadResponse {
  fileName: string;
  filePath: string;
  sheetNames: string[];
  previewTables: Record<string, string>;
  recordCounts: Record<string, number>;
}

export interface WaiveUploadResponse extends FileUploadResponse {
  approvedCount: number;
}

export interface CalculationStats {
  rowsProcessed: number;
  totalRamCharge: number;
  totalDealerCharge: number;
  mismatchCount: number;
  /** Only present on a post-waive (calculate-with-waive) result. */
  totalWaive?: number;
}

export interface CampaignDistributionItem {
  campaign: string;
  vins: number;
}

export interface CampaignMismatch {
  vinNumber: string;
  dealer: string;
  model: string;
  drawdown: string;
  assignedTo: string;
  shouldBe: string;
  reason: string;
}

export interface SummaryByDealerCodeItem {
  dealerCode: string;
  dealerName: string;
  vins: number;
  ramCharge: number;
  dealerCharge: number;
  arAmount: number;
}

export interface CalculationResponse {
  success: boolean;
  message: string;
  outputPath: string;
  stats?: CalculationStats;
  campaignDistribution?: CampaignDistributionItem[];
  mismatches?: CampaignMismatch[];
  summary: SummaryData;
  summaryByDealerCode?: SummaryByDealerCodeItem[];
  detailRecords: Record<string, unknown>[];
  dealerSummary: Record<string, unknown>[];
}

export interface ApiError {
  error: string;
  details?: string;
}

// ============= UI STATE TYPES =============
export interface UploadState {
  file: File | null;
  fileName: string;
  isUploading: boolean;
  error: string | null;
  preview: FileUploadResponse | null;
}

export interface CalculationState {
  isCalculating: boolean;
  result: CalculationResponse | null;
  error: string | null;
  progress: number;
}

export interface AppState {
  config: AppConfig | null;
  configLoading: boolean;
  configError: string | null;
  uploadState: UploadState;
  calculationState: CalculationState;
}

// ============= CAMPAIGN MASTER TYPES =============
export interface CampaignConditionRow {
  id: number;
  campaign: string;
  range: string;
  model: string;
  /** Display format: dd-mm-yy */
  ddStart: string;
  /** Display format: dd-mm-yy */
  ddEnd: string;
  units?: number;
  affectedDealers: string;
  selectedDealers?: string[];
  /** Dealers excluded from an "All dealers" scope — picked via the same dealer-picker modal. */
  exception?: string[] | null;
}

export interface RateTierRow {
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

export interface CampaignDetail {
  code: string;
  name: string;
  status: string;
  freeDays: number;
  units: number;
  campaignConditions: CampaignConditionRow[];
  rateByDayRange: RateTierRow[];
}

export interface CampaignSummary {
  code: string;
  name: string;
  status: string;
  models: string;
  drawdownPeriod: string;
}

export interface CampaignImportResult {
  fileName: string;
  campaignsExtracted: number;
  totalQuotaRows: number;
  campaigns: CampaignDetail[];
}
