# FloorPlan Interest Calculator - Complete Logic Documentation

## 📋 Table of Contents
1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [Data Input Files](#data-input-files)
4. [Configuration Setup](#configuration-setup)
5. [Main Workflows](#main-workflows)
6. [Business Logic & Calculations](#business-logic--calculations)
7. [Route Endpoints](#route-endpoints)
8. [Data Processing Steps](#data-processing-steps)
9. [Excel Output Generation](#excel-output-generation)

---

## Project Overview

**Application Name:** FloorPlan Interest Calculator  
**Purpose:** Calculate automotive dealer rental charges based on:
- Allocation dates (vehicle delivery)
- Payment dates (payment received)
- Free days from subvention campaigns
- Day-based interest rates
- Penalty charges for overdue payments
- Optional waive (discount) amounts

**Technology Stack (New Architecture - React + TypeScript):**
- **Backend:** Flask (Python) - REST API endpoints (no more templates)
- **Frontend:** React 18+ with TypeScript
- **State Management:** React Hooks or Redux/Zustand
- **HTTP Client:** Axios or Fetch API
- **Data Processing:** Pandas, OpenPyXL (Python backend)
- **UI Framework:** Material-UI, Shadcn/ui, or custom components
- **Styling:** Tailwind CSS, Styled Components, or CSS Modules
- **Desktop Wrapper:** Electron or Tauri (instead of Webview)

---

## Architecture (React + TypeScript Frontend)

### New Application Flow (Frontend-Backend Separation)

```
┌───────────────────────────────────────────────────────────┐
│  Desktop App (Electron/Tauri)                            │
│  ├─ React App on localhost:3000                         │
│  └─ Flask API on localhost:5000                         │
└────────────────┬────────────────────────────────────────┘
                 ↓
        ┌────────────────────┐
        │  React Components  │
        │  (TypeScript)      │
        └────────────┬───────┘
                     ↓
    ┌───────────────────────────────────┐
    │  State Management (Hooks/Redux)   │
    │  • configState                    │
    │  • uploadState                    │
    │  • calculationState               │
    └────────────┬──────────────────────┘
                 ↓
    ┌───────────────────────────────────┐
    │  API Service Layer (Axios)        │
    │  → POST /api/upload               │
    │  → POST /api/calculate            │
    │  → POST /api/calculate_with_waive │
    │  → GET /api/config                │
    │  → GET /api/download              │
    └────────────┬──────────────────────┘
                 ↓
    ┌────────────────────────────────────┐
    │  Flask REST API (Python Backend)   │
    │  • File handling                  │
    │  • Data processing (Pandas)       │
    │  • Charge calculations            │
    │  • Excel generation               │
    └────────────────────────────────────┘
```

### React Component Architecture

```
src/
├── components/
│   ├── Layout/
│   │   ├── Header.tsx
│   │   ├── Sidebar.tsx
│   │   └── Footer.tsx
│   ├── Pages/
│   │   ├── HomePage.tsx          (Main page with instructions)
│   │   ├── UploadARPage.tsx       (AR file upload)
│   │   ├── PreviewPage.tsx        (Preview AR data)
│   │   ├── UploadWaivePage.tsx    (Waive file upload)
│   │   ├── PreviewWaivePage.tsx   (Preview waive data)
│   │   └── ResultPage.tsx         (Calculation results)
│   └── UI/
│       ├── FileUpload.tsx         (Reusable upload component)
│       ├── DataTable.tsx          (Display sheet preview)
│       ├── SummaryTable.tsx       (Display summary)
│       └── Modal.tsx              (Error/Success modals)
├── services/
│   ├── api.ts                     (Axios instance & API calls)
│   ├── configService.ts           (Load config data)
│   └── fileService.ts             (File upload/download)
├── hooks/
│   ├── useFileUpload.ts           (Upload logic)
│   ├── useCalculation.ts          (Calculation state)
│   └── useConfig.ts               (Config loading)
├── types/
│   ├── index.ts                   (TypeScript interfaces)
│   ├── api.ts                     (API response types)
│   └── models.ts                  (Data models)
├── utils/
│   ├── formatters.ts              (Number/Date formatting)
│   ├── validators.ts              (Input validation)
│   └── constants.ts               (App constants)
├── App.tsx
└── main.tsx
```

---

## Data Input Files

### 1. **Configuration File** (config/Rental_Charge_Conditions_v2.xlsx)
Contains 4 sheets:

#### Sheet 1: **Config**
| Column | Purpose | Example |
|--------|---------|---------|
| Key | Configuration parameter name | "Month End Date" |
| Value | Configuration value | "2025-06-30" |
| | "Penalty Rate" | "15" (%) |

**Required Keys:**
- `Month End Date`: The accounting period end date (YYYY-MM-DD)
- `Penalty Rate`: Penalty percentage for overdue charges (default: 15%)

#### Sheet 2: **Rate_By_Day_Range**
Defines interest rates based on days from allocation date

| Column | Purpose | Example |
|--------|---------|---------|
| StartDay | Range start (days after allocation) | 1 |
| EndDay | Range end (days after allocation) | 30 |
| Rate (%) | Daily interest rate | 12 |
| EffectiveStart | Rate effective from date | 2025-01-01 |
| EffectiveEnd | Rate effective until date | 2025-12-31 |
| IsActive | Is this rate active (True/False) | TRUE |

**Calculation:** `Daily Interest = (Vehicle Price × Rate) / 36500`

#### Sheet 3: **Subvention_Campaign**
Campaign names with free rental days

| Column | Purpose | Example |
|--------|---------|---------|
| Campaign Name | Campaign identifier | "Normal" |
| Free Days | Free rental days | 30 |

#### Sheet 4: **AR Detail (optional)**
For waive calculations - tracks approved waives

---

### 2. **AR Monthly File** (Uploaded by User)
Excel file with 3-4 required sheets:

#### Sheet 1: **AR Last Month** (or [Previous Month] like "may" or "apr")
Contains previous month's rental records

| Column | Purpose | Must Have |
|--------|---------|-----------|
| Dealer Group | Dealer grouping | ✓ |
| Dealer Code | Dealer identifier | ✓ |
| Dealer Name | Dealer name | ✓ |
| Model | Vehicle model | ✓ |
| VIN No. | Vehicle Identification Number | ✓ |
| Pre-Vat | Vehicle price (ex. VAT) | ✓ |
| Allocation Date | Vehicle delivery date | ✓ |
| Payment Date | Payment received date | ○ (optional) |
| Contract No | Contract number | ○ |
| Subvention | Campaign code (e.g., "Normal", "Campaign A") | ○ |

#### Sheet 2: **new** (New Volume)
Same columns as "AR Last Month" but for new vehicles in current month
- Does NOT have "Payment Date" (charged to current month)
- Subvention Campaign mapping

#### Sheet 3: **all** (Payment Data)
Tracks which vehicles were paid

| Column | Purpose |
|--------|---------|
| VIN No. | Vehicle ID |
| Payment Date OR Date | When payment was received |

#### Sheet 4: **penalty** (Optional)
Overdue records with due dates

| Column | Purpose |
|--------|---------|
| VIN No. | Vehicle ID |
| Due Date | Payment due date (when penalty kicks in) |

### 3. **Waive File** (Optional, for calculate_with_waive)
Excel file with approved discounts

| Column | Purpose | Notes |
|--------|---------|-------|
| Dealer Code | Dealer identifier | Required |
| VIN Number | Vehicle ID | Required |
| waive amount | Discount amount (THB) | Must be numeric |
| reason | Why waived | Optional text |
| approved | Approval status | Must be "Y" to process |

---

## Configuration Setup

### File Paths
```python
CONFIG_PATH = os.path.join(os.getcwd(), "config", "Rental_Charge_Conditions_v2.xlsx")
```

### Required Folders
- `config/` - Contains Rental_Charge_Conditions_v2.xlsx
- `uploads/` - Stores uploaded AR files
- `AR_Outputs/` - Stores calculated results (created automatically)
- `AR_Outputs - Waive/` - Stores waive calculation results (created automatically)
- `AR_Input/` - Stores uploaded waive files (created automatically)

---

## Main Workflows

### Workflow A: Basic AR Calculation (Without Waive)

```
1. User loads index page (/)
   ↓
2. Selects AR file & clicks "Upload & Calculate"
   ↓
3. POST to /upload
   → Save file to uploads/
   → Preview first 5 rows of each sheet
   → Show preview page (result.html)
   ↓
4. User reviews & clicks "Calculate"
   ↓
5. POST to /calculate
   → Load configuration
   → Read AR sheets (last month, new volume, all payment)
   → Process & merge data
   → Calculate charges (RAM & Dealer)
   → Generate Excel output
   → Display summary
```

### Workflow B: AR Calculation with Waive

```
1. User clicks "Upload Waive File"
   ↓
2. Opens upload_waive.html form
   ↓
3. POST to /upload_waive
   → Save waive file to AR_Input/
   → Preview waive data
   → Show preview_waive.html
   ↓
4. User reviews & clicks "Calculate with Waive"
   ↓
5. POST to /calculate_with_waive
   → Load AR file (latest from uploads/)
   → Load waive file
   → Filter waive data (approved == 'Y' only)
   → Process & merge data
   → Apply waive amounts (reduce charges)
   → Generate Excel output with waive adjustments
   → Display summary
```

---

## Business Logic & Calculations

### Phase 1: Data Preparation

#### Step 1A: Clean & Prepare AR Last Month Data
```
Input: df_ar_lastmonth (from "AR Last Month" sheet)

Actions:
1. Strip whitespace from column names
2. Select required columns only:
   - Dealer Group, Dealer Code, Dealer Name, Model, VIN No.
   - Pre-Vat, Allocation Date, Payment Date, Contract No, Subvention
3. Rename columns to standardized format:
   - "VIN No." → "VIN Number"
   - "Pre-Vat" → "Price (Ex. Vat)"
   - "Contract No" → "Contract Number"
   - "Subvention" → "Subvention Campaign"
4. Convert Dealer Code to string (remove .0 suffix)
5. Add "Source" column = "AR Last Month"

Output: df_ar_lastmonth_input
```

#### Step 1B: Clean & Prepare New Volume Data
```
Input: df_new_volumn (from "new" sheet)

Actions:
1. Strip whitespace and non-breaking spaces
2. Select same required columns
3. Rename columns (same as Step 1A)
4. Add "Source" column = "New Volume"

Output: df_ar_new_volumn_input
```

#### Step 1C: Prepare Payment Data
```
Input: df_all_payment (from "all" sheet)

Actions:
1. Find Payment Date column ("Payment Date" or "Date")
2. Keep only VIN No. and Payment Date columns
3. Rename to VIN Number and Payment Date

Output: df_ar_all_payment_input
```

#### Step 1D: Prepare Penalty Data
```
Input: df_penalty (from "penalty" sheet) - OPTIONAL

Actions:
1. Strip whitespace from column names
2. Keep VIN Number and Due Date
3. Convert Due Date to datetime
4. Remove null dates

If penalty sheet not found:
   Create empty DataFrame with columns: VIN Number, Due Date

Output: df_penalty
```

#### Step 1E: Combine Data Sources
```
Actions:
1. Concatenate New Volume + AR Last Month
   df_ar_current_month = pd.concat([df_ar_new_volumn_input, df_ar_lastmonth_input])

2. Fill empty Subvention Campaign values with "Normal"

3. Remove rows where Dealer Group is empty

4. Merge with Payment Data (left join on VIN Number)
   → Adds Payment Date column
   
5. Create "Paid" flag:
   - "Y" if Payment Date exists
   - "N" if Payment Date is null

6. Merge with Penalty Data (left join on VIN Number)
   → Adds Due Date column

7. Merge with Waive Data (if available)
   - Filter: approved == 'Y' only
   - Left join on Dealer Code + VIN Number
   - Fill missing waive amounts with 0

Output: df_ar_current_month (merged dataset)
```

### Phase 2: Rate & Campaign Setup

```python
# Load rate ranges from Config file
df_rate = read from "Rate_By_Day_Range" sheet
rate_ranges = df_rate.to_dict("records")
# Creates list of dicts with: StartDay, EndDay, Rate, EffectiveStart, EffectiveEnd, IsActive

# Load campaign free days from Config file
df_subvention = read from "Subvention_Campaign" sheet
subvention_map = {"Normal": 30, "Campaign A": 45, ...}

# Map free days to each vehicle record
df_ar_current_month["Free Days"] = 
    df_ar_current_month["Subvention Campaign"].map(subvention_map).fillna(0)
```

### Phase 3: Charge Calculation (Critical Logic)

#### Function: `calculate_detailed_charge(row)`

This function calculates all charges for a single vehicle record.

**Inputs:**
- `price`: Vehicle price (ex. VAT)
- `alloc_date`: Allocation (delivery) date
- `paid_date`: Payment date (null if unpaid)
- `due_date`: Payment due date (for penalty calculation)
- `free_days`: Campaign free rental days

**Processing:**

##### 3A: RAM Charge (Company Charge - Free Days)

**Free Day Period Calculation:**
```
free_day_actual_end = alloc_date + (free_days - 1)
last_free_day = min(free_day_actual_end, month_end)
ram_charge_days = all days from alloc_date to last_free_day
ram_charge_freeday_days_this_month = count of days within current month
```

**Daily Interest Calculation:**
```
For each day in ram_charge_days:
  1. Calculate day_count = (current_day - alloc_date).days + 1
  2. Find applicable rate from rate_ranges where:
     - StartDay ≤ day_count ≤ EndDay
     - EffectiveStart ≤ current_day ≤ EffectiveEnd
     - IsActive == True
     (if multiple match, take one with latest EffectiveStart)
  3. Daily Interest = (price × rate) / 36500
  4. Add to ram_charge total
  5. Track rate summary (for reporting)
```

**Actual RAM Charge (Full Period):**
```
If paid_date exists:
  ram_charge_actual_end = min(paid_date - 1 day, month_end)
Else:
  ram_charge_actual_end = month_end

ram_charge_actual_days = all days from max(alloc_date, month_start) to ram_charge_actual_end

For each day, calculate daily interest (same as above)
Sum to get ram_charge_actual
```

##### 3B: Dealer Charge (Dealer's Rental Charge - Paid Period)

**Dealer Period Calculation:**
```
dealer_start = alloc_date + free_days (first charged day)

Determine dealer_end:
  If due_date exists:
    dealer_end = min(due_date, paid_date - 1, month_end)
        (whichever is earliest)
  Else:
    dealer_end = min(paid_date - 1, month_end)
        (if paid) or month_end (if unpaid)
```

**Dealer Charge Calculation:**
```
If dealer_start ≤ dealer_end:
  For each day in this period:
    1. Calculate day_count (same as RAM)
    2. Find applicable rate (same logic)
    3. Calculate daily interest
    4. Add to dealer_charge total
```

##### 3C: Penalty Charge (If Overdue)

**Penalty Period Calculation:**
```
Only calculated if due_date exists!

penalty_start = due_date + 1 day

If paid_date exists:
  penalty_end = min(paid_date - 1, month_end)
Else:
  penalty_end = month_end
```

**Penalty Calculation:**
```
If penalty_start ≤ penalty_end:
  penalty_day_count = count of days within current month
  
  If penalty_day_count > 0:
    daily_penalty = (price × penalty_rate) / 36500
    penalty_charge = daily_penalty × penalty_day_count
    (penalty_rate comes from Config, default 15%)
```

**Total Dealer Charge:**
```
total_dealer_charge = dealer_charge + penalty_charge
```

##### 3D: Calculate Aging

```
If paid_date exists:
  aging = (paid_date - alloc_date).days
Else:
  aging = (month_end - alloc_date).days + 1
  
aging = max(aging, 0)
```

**Function Output (8 columns):**
```
Return Series([
  ram_charge,                           # [float] RAM charge on free days
  ram_charge_actual,                    # [float] RAM charge on actual days
  total_dealer_charge,                  # [float] Dealer charge + penalty
  ram_charge_freeday_days_this_month,   # [int] Free days count
  ram_desc_txt,                         # [str] Rate summary (e.g., "7d: 1-30@12%, 23d: 31-90@10%")
  dealer_desc_txt,                      # [str] Dealer rate summary + penalty note
  len(ram_charge_actual_days),          # [int] Actual days used
  aging                                 # [int] Days from allocation to payment
])
```

### Phase 4: Post-Calculation Processing

#### Step 4A: Apply Waive (Discount)

```python
# If waive amount was loaded:
RAM Charge (After Waive) = RAM Charge + waive amount
Dealer Charge (After Waive) = Dealer Charge - waive amount

# Create AR Master Code (for GL posting)
if Dealer Charge (After Waive) == 0:
  AR Master Code = "RAM Rever Automotive"
else:
  AR Master Code = "Charge to Dealer"
```

#### Step 4B: Format Data

```python
# All numeric columns formatted as currency:
"{:,.2f}".format()  # e.g., "1,234.56"

# All date columns formatted:
"%d/%m/%Y"  # e.g., "30/06/2025"

# Dealer Code zero-padded:
str.zfill(5)  # e.g., "123" → "00123"

# Contract Number: remove .0 suffix
```

### Phase 5: Summary Calculation

#### Step 5A: Price Summary
```
Categories to sum:
1. AR Last Month: sum of prices where Source == "AR Last Month"
2. New Volume: sum of prices where Source == "New Volume"
3. All Payment (Paid=Y): sum of prices where Paid == "Y"
4. AR Outstanding (Paid=N): sum of prices where Paid == "N"
5. Total: sum of all prices
```

#### Step 5B: Dealer/RAM Summary

**Separate data into two groups:**
```
df_ram = records where RAM Charge (After Waive) > 0
df_dealer = records where Dealer Charge (After Waive) > 0
```

**For each group, calculate:**
```
AR Master Code = "RAM Rever Automotive" OR "Charge to Dealer"
Amount per Calculation = (RAM or Dealer) Charge (After Waive)
Waive = waive amount
WHT = Amount per Calculation × tax rate
  (RAM: 3%, Dealer: 5%)
VAT = Amount per Calculation × 0.07
Total Receivable = Amount - WHT + VAT
Total = Amount + VAT
```

**Grouping:**
```
Group by: Dealer Group, Dealer Code, Dealer Name, AR Master Code
Sum columns: Amount per Calculation, Waive, WHT, VAT, Total Receivable, Total

Add Total Row:
- "Total Charge to Dealer" (sum of all dealer charges)
- "Total RAM Rever Automotive" (sum of all RAM charges)
```

---

## New REST API Endpoints (React Architecture)

### API Service Setup (TypeScript)

```typescript
// src/services/api.ts
import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000,
  headers: {
    'Content-Type': 'application/json',
  }
});

// Request interceptor for handling errors
apiClient.interceptors.response.use(
  response => response,
  error => {
    console.error('API Error:', error.response?.data);
    throw error;
  }
);

export default apiClient;
```

### TypeScript Interfaces

```typescript
// src/types/index.ts

// Config Types
export interface ConfigData {
  monthEndDate: string;
  penaltyRate: number;
}

export interface RateRange {
  startDay: number;
  endDay: number;
  rate: number;
  effectiveStart: string;
  effectiveEnd: string;
  isActive: boolean;
}

export interface SubventionCampaign {
  campaignName: string;
  freeDays: number;
}

export interface AppConfig {
  config: ConfigData;
  rates: RateRange[];
  subventions: SubventionCampaign[];
}

// AR Data Types
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
  waiveAmount?: number;
  ramChargeAfterWaive: number;
  dealerChargeAfterWaive: number;
  ramRateSummary: string;
  dealerRateSummary: string;
}

// Waive Types
export interface WaiveRecord {
  dealerCode: string;
  vinNumber: string;
  waiveAmount: number;
  reason?: string;
  approved: 'Y' | 'N';
}

// API Request/Response Types
export interface FileUploadResponse {
  fileName: string;
  filePath: string;
  sheetNames: string[];
  previewTables: Record<string, string>; // HTML tables
  recordCounts: Record<string, number>;
}

export interface CalculationResponse {
  success: boolean;
  message: string;
  outputPath: string;
  summary: SummaryData;
  detailRecords: ARRecord[];
  dealerSummary: DealerSummaryRecord[];
}

export interface SummaryData {
  arLastMonth: number;
  newVolume: number;
  allPayment: number;
  arOutstanding: number;
  total: number;
}

export interface DealerSummaryRecord {
  dealerGroup: string;
  dealerCode: string;
  dealerName: string;
  arMasterCode: string;
  amountPerCalculation: number;
  waive: number;
  wht: number;
  vat: number;
  totalReceivable: number;
  total: number;
}
```

### API Endpoints (React/TypeScript)

### 1. **GET /api/config**
**Purpose:** Load configuration, rates, and subvention campaigns

**Response (200 OK):**
```json
{
  "config": {
    "monthEndDate": "2025-06-30",
    "penaltyRate": 15
  },
  "rates": [
    {
      "startDay": 1,
      "endDay": 30,
      "rate": 12,
      "effectiveStart": "2025-01-01",
      "effectiveEnd": "2025-12-31",
      "isActive": true
    }
  ],
  "subventions": [
    {
      "campaignName": "Normal",
      "freeDays": 30
    }
  ]
}
```

**React Hook Example:**
```typescript
const { config, loading, error } = useConfig();

if (loading) return <div>Loading configuration...</div>;
if (error) return <div className="error">{error}</div>;

return (
  <div>
    <h2>Configuration Loaded</h2>
    <p>Month End: {config?.config.monthEndDate}</p>
    <p>Penalty Rate: {config?.config.penaltyRate}%</p>
  </div>
);
```

---

### 2. **POST /upload**
**Purpose:** Preview uploaded AR file

**Steps:**
```
1. Receive uploaded file (ar_file)
2. Validate file exists and has content
3. Save to uploads/ folder with secure filename
4. Open as Excel file
5. Read first 5 rows of each sheet:
   - If sheet name contains "penalty" → use header row 0
   - Else → use header row 1 (0-indexed)
6. Strip column whitespace
7. Generate HTML preview of each sheet
```

**Returns:** result.html template with:
- `preview_tables`: Dict of {sheet_name: html_table}
- `file_name`: Original filename
- `file_path`: Full path to saved file

**Error Handling:**
- No file → "No file uploaded" (400)
- Empty filename → "No selected file" (400)
- Excel read error → show error for specific sheet

---

### 3. **POST /calculate**
**Purpose:** Main calculation workflow (without waive)

**Parameters:**
- `file_path`: Path to AR file (from form)

**Process:**
1. Validate file exists
2. Load all configuration sheets
3. Read AR file sheets:
   - Find sheets by pattern matching:
     - Sheet containing previous month label (case-insensitive)
     - Sheet containing "new" (case-insensitive)
     - Sheet containing "all" (case-insensitive)
     - Sheet containing "penalty" (optional)
4. Execute complete data pipeline (see Phase 1-5 above)
5. Create empty waive DataFrame (no discounts)
6. Generate Excel workbook:
   - **Sheet 1 "Summary"**: Price categories summary
   - **Sheet 2 "AR Detail"**: Full vehicle detail with all calculations
   - **Sheet 3 "Dealer Summary"**: Grouped by dealer with tax calculations
7. Save to: `AR_Outputs/AR_Summary_{Month}{Year}_{YYYYMMDD_HHMMSS}.xlsx`
8. Return HTML with:
   - Summary table
   - File location
   - Link to open output folder

**Error Handling:**
- File not found → error message
- Missing required columns → ValueError with column name
- Calculation error → Full traceback displayed

---

### 4. **GET /upload_waive**
**Purpose:** Display waive upload form

**Returns:** upload_waive.html template

---

### 5. **POST /upload_waive**
**Purpose:** Preview uploaded waive file

**Steps:**
```
1. Receive waive file
2. Validate file exists
3. Create AR_Input folder if not exists
4. Save with timestamp: waive_input_{YYYYMMDD_HHMMSS}.xlsx
5. Read first 5 rows for preview
```

**Returns:** preview_waive.html template with:
- `waive_file_path`: Full path to saved file
- `waive_preview_table`: HTML table of first 5 rows

**Error Handling:**
- No file → "No waive file uploaded" (400)

---

### 6. **POST /calculate_with_waive**
**Purpose:** Calculate with approved waives applied

**Parameters:**
- `ar_file_path`: Auto-detect latest file from uploads/
- `waive_file_path`: Path from form

**Process:**
1. Find latest AR file in uploads/ (by modification time)
2. Load and validate waive file exists
3. Filter waive data: approved == 'Y' only
4. Execute data pipeline (same as /calculate)
5. Merge waive data into calculations:
   - Left join on (Dealer Code, VIN Number)
   - Match only approved (Y) records
   - Fill missing with 0
6. Apply waive amounts:
   - Reduce Dealer Charge by waive amount
   - Reduce RAM Charge by waive amount (actually adds back)
7. Generate Excel workbook (same sheets as /calculate)
8. Save to: `AR_Outputs - Waive/AR_Summary_{Month}{Year}_After_Waive_{YYYYMMDD_HHMM}.xlsx`
9. Return HTML summary

---

### 7. **GET /open-output-folder**
**Purpose:** Open AR_Outputs folder in Windows Explorer

**Actions:**
```
subprocess.Popen('explorer "AR_Outputs path"')  # Windows
# or for macOS:
subprocess.Popen(['open', folder_path])
```

---

### 8. **GET /open-output-folder1**
**Purpose:** Open AR_Outputs - Waive folder

Same as above but for waive outputs folder.

---

### 9. **GET /open-config-folder**
**Purpose:** Open config folder

Opens folder containing Rental_Charge_Conditions_v2.xlsx

---

## Data Processing Steps

### Complete Data Flow Diagram

```
┌─── RAW INPUT FILES ────────────────────┐
│  • AR Last Month Sheet                │
│  • New Volume Sheet                   │
│  • All Payment Sheet                  │
│  • Penalty Sheet (optional)           │
│  • Waive File (optional)              │
│  • Config (Rate & Subvention)         │
└───────────────┬────────────────────────┘
                │
        ┌───────▼────────┐
        │  STEP 1        │
        │  Clean Data    │
        │  Standardize   │
        │  Rename Cols   │
        └───────┬────────┘
                │
        ┌───────▼────────┐
        │  STEP 2        │
        │  Merge Data    │
        │  Join Tables   │
        │  Add Flags     │
        └───────┬────────┘
                │
        ┌───────▼────────┐
        │  STEP 3        │
        │  Calculate     │
        │  Charges       │
        │  (row by row)  │
        └───────┬────────┘
                │
        ┌───────▼────────┐
        │  STEP 4        │
        │  Apply Waive   │
        │  Format Dates  │
        │  Format Money  │
        └───────┬────────┘
                │
        ┌───────▼────────┐
        │  STEP 5        │
        │  Summarize     │
        │  Group by      │
        │  Dealer        │
        └───────┬────────┘
                │
        ┌───────▼──────────────────┐
        │  STEP 6                 │
        │  Export to Excel         │
        │  • Summary Sheet         │
        │  • AR Detail Sheet       │
        │  • Dealer Summary Sheet  │
        └────────────────────────┘
```

### Column Transformations

**Input Columns (from AR File):**
```
Dealer Group, Dealer Code, Dealer Name, Model, VIN No.,
Pre-Vat, Allocation Date, Payment Date, Contract No, Subvention
```

**Intermediate Processing:**
```
Added Columns:
- Source (AR Last Month / New Volume)
- VIN Number (from VIN No.)
- Price (Ex. Vat) (from Pre-Vat)
- Contract Number (from Contract No.)
- Subvention Campaign (from Subvention)
- Paid (Y/N flag)
- Due Date (from Penalty sheet)
- Free Days (from Campaign mapping)
- waive amount (from Waive file)
- reason (from Waive file)
```

**Calculated Columns:**
```
- RAM Charge (interest on free days)
- RAM Charge (bf) (actual RAM charge)
- Dealer Charge (interest after free days)
- RAM Charge FreeDay (This Month) (count)
- RAM Rate Summary (description)
- Dealer Rate Summary (description)
- Actual Used Days (This Month) (count)
- Aging (days from allocation to payment)
- RAM Charge (After Waive)
- Dealer Charge (After Waive)
- AR Master Code (for GL posting)
```

**Final Output Columns (in Excel):**
```
For AR Detail Sheet:
Dealer Group, Dealer Code, Dealer Name, Model, VIN Number,
Price (Ex. Vat), Allocation Date, Contract Number, Subvention Campaign,
Source, Payment Date, Paid, Free Days, Due Date, Aging,
RAM Charge FreeDay (This Month), RAM Charge (bf), RAM Charge,
Dealer Charge, waive amount, RAM Charge (After Waive),
Dealer Charge (After Waive), RAM Rate Summary, Dealer Rate Summary, reason

For Dealer Summary Sheet:
Dealer Group, Dealer Code, Dealer Name, AR Master Code,
Amount per Calculation, Waive, WHT, VAT, Total Receivable, Total
(+ 2 Total rows: Total Charge to Dealer, Total RAM Rever Automotive)
```

---

## Excel Output Generation

### Workbook Structure

#### Sheet 1: **Summary**
Shows price totals by category

| Description | Amount (THB) |
|-------------|--------------|
| AR Last Month | X,XXX,XXX.00 |
| New Volume | X,XXX,XXX.00 |
| All Payment (Paid=Y) | X,XXX,XXX.00 |
| AR Outstanding (Paid=N) | X,XXX,XXX.00 |
| Total | X,XXX,XXX.00 |

**Formatting:**
- Currency format with 2 decimal places
- Right-aligned numbers
- Table style: TableStyleMedium9

---

#### Sheet 2: **AR Detail**
Complete vehicle detail with calculated charges

**Row 1:** Headers (see column list above)
**Rows 2+:** One row per vehicle

**Special Formatting:**
```
Columns formatted as currency:
- Price (Ex. Vat)
- RAM Charge (bf)
- RAM Charge
- Dealer Charge
- waive amount
- RAM Charge (After Waive)
- Dealer Charge (After Waive)

All formatted: #,##0.00 (thousands separator, 2 decimals)
All right-aligned
```

---

#### Sheet 3: **Dealer Summary**
Grouped summary by dealer and AR Master Code

| Dealer Group | Dealer Code | Dealer Name | AR Master Code | Amount per Calculation | Waive | WHT | VAT | Total Receivable | Total |
|---|---|---|---|---|---|---|---|---|---|
| Group A | 00001 | Dealer A | Charge to Dealer | 50,000.00 | 5,000.00 | 2,500.00 | 3,150.00 | 45,650.00 | 53,150.00 |
| Group A | 00001 | Dealer A | RAM Rever Automotive | 25,000.00 | 0.00 | 750.00 | 1,750.00 | 26,000.00 | 26,750.00 |
| | | **Total Charge to Dealer** | | X,XXX,XXX.00 | ... |
| | | **Total RAM Rever Automotive** | | X,XXX,XXX.00 | ... |

**Tax Calculations by AR Master Code:**
```
If AR Master Code == "Charge to Dealer":
  WHT = Amount × 5% (Withholding Tax)
  VAT = Amount × 7%
  Total Receivable = Amount - WHT + VAT
  Total = Amount + VAT

If AR Master Code == "RAM Rever Automotive":
  WHT = Amount × 3%
  VAT = Amount × 7%
  Total Receivable = Amount - WHT + VAT
  Total = Amount + VAT
```

**Grouping Logic:**
```
Group by: (Dealer Group, Dealer Code, Dealer Name, AR Master Code)
Sum the following columns:
- Amount per Calculation
- Waive
- WHT
- VAT
- Total Receivable
- Total

Then add 2 total rows showing sums by AR Master Code
```

---

### File Naming & Location

**Regular Calculation:**
```
Folder: AR_Outputs/
Filename: AR_Summary_{Month}{Year}_{YYYYMMDD_HHMMSS}.xlsx
Example: AR_Summary_Jun2025_20250630_143520.xlsx
```

**Waive Calculation:**
```
Folder: AR_Outputs - Waive/
Filename: AR_Summary_{Month}{Year}_After_Waive_{YYYYMMDD_HHMM}.xlsx
Example: AR_Summary_Jun2025_After_Waive_20250630_1435.xlsx
```

---

## Key Business Rules & Edge Cases

### 1. **Free Days Handling**
```
If Subvention Campaign has no mapping:
  Free Days = 0

First free day ends at: alloc_date + (free_days - 1)
Last free day cannot extend past month_end
```

### 2. **Missing Payment Date**
```
If vehicle not paid:
  Payment Date = month_end (for calculation purposes)
  Paid = "N"
  Status appears as unpaid in summary
```

### 3. **Penalty Calculation**
```
Only applies if Due Date exists in Penalty sheet
Penalty starts the day AFTER due date
Calculated using flat penalty rate from Config (not rate ranges)
```

### 4. **Rate Selection**
```
When multiple rates match the same date:
  Use rate with LATEST EffectiveStart date

Condition: IsActive must be TRUE
```

### 5. **Dealer Code Formatting**
```
Input: 123 or 123.0
Output: "00123" (5-digit zero-padded string)
```

### 6. **Contract Number Cleaning**
```
Input: "ABC123" or "ABC123.0"
Output: "ABC123" (remove .0 suffix)
```

### 7. **Waive Filtering**
```
Only approved waives are used:
  Filter: approved column == 'Y' (case-insensitive)
  All other rows are ignored
```

### 8. **Column Header Variations**
```
Payment Date column can be named:
  - "Payment Date"
  - "Date"

VIN Number column must be:
  - "VIN No." (in AR files)
  - "VIN Number" (standardized internally)
```

### 9. **Empty/Null Handling**
```
Empty Dealer Group → row is excluded
Empty Subvention Campaign → mapped to "Normal"
Null Payment Date → filled as month_end
Null Due Date → no penalty applied
Null allocation date → charge = 0
```

### 10. **Number of Days Calculation**
```
Formula: (end_date - start_date).days + 1

Example:
  From 2025-06-01 to 2025-06-30
  = (30 - 1) + 1 = 30 days
```

---

## Implementation Checklist for New Project

### Backend (Python/Flask Equivalent)
- [ ] Create data models/classes for AR, Waive, Config
- [ ] Implement configuration loader
- [ ] Implement file upload handler
- [ ] Create data cleaning/standardization module
- [ ] Implement charge calculation engine
- [ ] Create summary aggregation logic
- [ ] Implement Excel export module
- [ ] Set up folder structure (config, uploads, outputs)

### Frontend (HTML/JavaScript/React Equivalent)
- [ ] Index page with upload form
- [ ] File preview page
- [ ] Waive upload page
- [ ] Waive preview page
- [ ] Result/success page
- [ ] Error handling pages

### Database (if needed)
- [ ] Store calculation history
- [ ] Audit trail for waive approvals
- [ ] Configuration version control

### Testing
- [ ] Unit tests for charge calculation
- [ ] Integration tests for data pipeline
- [ ] Edge case testing (null dates, missing sheets, etc.)
- [ ] Excel export validation

---

## Common Questions

**Q: Why is there a "RAM Charge (bf)"?**
A: It's the charge calculated before the free days expire. "RAM Charge" is calculated only during free days.

**Q: How are taxes calculated?**
A: WHT (Withholding Tax) and VAT are applied only in the Dealer Summary sheet, after charges are determined.

**Q: Can a vehicle appear in both "New Volume" and "AR Last Month"?**
A: Technically yes, both sheets are concatenated. Check source column to identify.

**Q: What happens if penalty rate is not in config?**
A: Default of 15% is used.

**Q: Are formulas included in Excel output?**
A: No, all values are pre-calculated and static numbers.

