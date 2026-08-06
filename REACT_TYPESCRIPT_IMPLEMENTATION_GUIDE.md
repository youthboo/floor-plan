# FloorPlan Interest Calculator - React + TypeScript Implementation Guide

## Quick Start

### Project Structure
```
frontend/
├── src/
│   ├── components/
│   │   ├── Layout/
│   │   │   ├── Header.tsx
│   │   │   ├── Navigation.tsx
│   │   │   └── Footer.tsx
│   │   ├── Pages/
│   │   │   ├── HomePage.tsx
│   │   │   ├── UploadARPage.tsx
│   │   │   ├── PreviewARPage.tsx
│   │   │   ├── UploadWaivePage.tsx
│   │   │   ├── PreviewWaivePage.tsx
│   │   │   └── ResultPage.tsx
│   │   └── Shared/
│   │       ├── FileUpload.tsx
│   │       ├── DataTable.tsx
│   │       ├── SummaryTable.tsx
│   │       ├── LoadingSpinner.tsx
│   │       ├── ErrorAlert.tsx
│   │       └── SuccessAlert.tsx
│   ├── services/
│   │   ├── api.ts
│   │   ├── configService.ts
│   │   └── fileService.ts
│   ├── hooks/
│   │   ├── useConfig.ts
│   │   ├── useFileUpload.ts
│   │   ├── useCalculation.ts
│   │   └── useLocalStorage.ts
│   ├── context/
│   │   ├── AppContext.tsx
│   │   └── ThemeContext.tsx
│   ├── types/
│   │   ├── index.ts
│   │   ├── api.ts
│   │   └── models.ts
│   ├── utils/
│   │   ├── formatters.ts
│   │   ├── validators.ts
│   │   ├── constants.ts
│   │   └── helpers.ts
│   ├── styles/
│   │   └── globals.css
│   ├── App.tsx
│   ├── main.tsx
│   └── vite-env.d.ts
├── package.json
├── tsconfig.json
├── vite.config.ts
└── index.html

backend/
├── app.py
├── config/
│   └── Rental_Charge_Conditions_v2.xlsx
├── uploads/
├── AR_Outputs/
├── AR_Outputs - Waive/
├── AR_Input/
└── requirements.txt
```

---

## Implementation Details

### 1. TypeScript Types (src/types/index.ts)

```typescript
// src/types/index.ts

// ============= CONFIG TYPES =============
export interface ConfigData {
  monthEndDate: string;      // YYYY-MM-DD
  penaltyRate: number;       // e.g., 15
}

export interface RateRange {
  startDay: number;
  endDay: number;
  rate: number;              // e.g., 12.5
  effectiveStart: string;    // YYYY-MM-DD
  effectiveEnd: string;      // YYYY-MM-DD
  isActive: boolean;
}

export interface SubventionCampaign {
  campaignName: string;      // e.g., "Normal", "Campaign A"
  freeDays: number;          // e.g., 30
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
  allocationDate: string;    // DD/MM/YYYY
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
  arMasterCode: string;       // "Charge to Dealer" | "RAM Rever Automotive"
  amountPerCalculation: number;
  waive: number;
  wht: number;                // Withholding Tax
  vat: number;
  totalReceivable: number;
  total: number;
}

// ============= API REQUEST/RESPONSE TYPES =============
export interface FileUploadResponse {
  fileName: string;
  filePath: string;
  sheetNames: string[];
  previewTables: Record<string, string>;  // HTML table strings
  recordCounts: Record<string, number>;
}

export interface WaiveUploadResponse extends FileUploadResponse {
  approvedCount: number;
}

export interface CalculationResponse {
  success: boolean;
  message: string;
  outputPath: string;
  summary: SummaryData;
  detailRecords: ARRecord[];
  dealerSummary: DealerSummaryRecord[];
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
  progress: number;  // 0-100
}

export interface AppState {
  config: AppConfig | null;
  configLoading: boolean;
  configError: string | null;
  uploadState: UploadState;
  calculationState: CalculationState;
}
```

---

### 2. API Service (src/services/api.ts)

```typescript
// src/services/api.ts
import axios, { AxiosError } from 'axios';
import {
  AppConfig,
  FileUploadResponse,
  CalculationResponse,
  WaiveUploadResponse,
  ApiError,
} from '../types';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 120000,  // 2 minutes for long-running calculations
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
apiClient.interceptors.request.use(
  (config) => {
    console.log(`[API] ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor
apiClient.interceptors.response.use(
  (response) => {
    console.log(`[API] Response Status: ${response.status}`);
    return response;
  },
  (error: AxiosError<ApiError>) => {
    console.error('[API] Error:', error.response?.data?.error || error.message);
    return Promise.reject(error);
  }
);

// ============= CONFIG ENDPOINTS =============
export const configService = {
  getConfig: async (): Promise<AppConfig> => {
    const response = await apiClient.get<AppConfig>('/config');
    return response.data;
  },
};

// ============= FILE UPLOAD ENDPOINTS =============
export const fileService = {
  uploadAR: async (file: File): Promise<FileUploadResponse> => {
    const formData = new FormData();
    formData.append('ar_file', file);

    const response = await apiClient.post<FileUploadResponse>('/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  uploadWaive: async (file: File): Promise<WaiveUploadResponse> => {
    const formData = new FormData();
    formData.append('waive_file', file);

    const response = await apiClient.post<WaiveUploadResponse>('/upload-waive', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  downloadFile: async (filePath: string, fileName: string): Promise<void> => {
    const response = await apiClient.get('/download', {
      params: { filePath },
      responseType: 'blob',
    });

    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fileName || 'AR_Summary.xlsx');
    document.body.appendChild(link);
    link.click();
    link.parentElement?.removeChild(link);
    window.URL.revokeObjectURL(url);
  },
};

// ============= CALCULATION ENDPOINTS =============
export const calculationService = {
  calculate: async (filePath: string): Promise<CalculationResponse> => {
    const response = await apiClient.post<CalculationResponse>('/calculate', {
      filePath,
    });
    return response.data;
  },

  calculateWithWaive: async (
    arFilePath: string,
    waiveFilePath: string
  ): Promise<CalculationResponse> => {
    const response = await apiClient.post<CalculationResponse>('/calculate-with-waive', {
      arFilePath,
      waiveFilePath,
    });
    return response.data;
  },
};

export default apiClient;
```

---

### 3. Custom Hooks

#### useConfig Hook (src/hooks/useConfig.ts)

```typescript
import { useEffect, useState } from 'react';
import { AppConfig } from '../types';
import { configService } from '../services/api';

interface UseConfigReturn {
  config: AppConfig | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export const useConfig = (): UseConfigReturn => {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const data = await configService.getConfig();
      setConfig(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load config');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  return { config, loading, error, refetch: fetchConfig };
};
```

#### useFileUpload Hook (src/hooks/useFileUpload.ts)

```typescript
import { useState } from 'react';
import { FileUploadResponse } from '../types';
import { fileService } from '../services/api';

interface UseFileUploadReturn {
  file: File | null;
  preview: FileUploadResponse | null;
  loading: boolean;
  error: string | null;
  handleFileSelect: (file: File) => void;
  handleUpload: () => Promise<void>;
  reset: () => void;
}

export const useFileUpload = (uploadFunction: (file: File) => Promise<FileUploadResponse>): UseFileUploadReturn => {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<FileUploadResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = (selectedFile: File) => {
    if (!selectedFile.name.match(/\.(xlsx|xls)$/i)) {
      setError('Please select a valid Excel file (.xlsx or .xls)');
      return;
    }
    setFile(selectedFile);
    setError(null);
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await uploadFunction(file);
      setPreview(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setFile(null);
    setPreview(null);
    setError(null);
    setLoading(false);
  };

  return { file, preview, loading, error, handleFileSelect, handleUpload, reset };
};
```

#### useCalculation Hook (src/hooks/useCalculation.ts)

```typescript
import { useState } from 'react';
import { CalculationResponse } from '../types';
import { calculationService } from '../services/api';

interface UseCalculationReturn {
  result: CalculationResponse | null;
  loading: boolean;
  error: string | null;
  calculate: (filePath: string, waiveFilePath?: string) => Promise<void>;
  reset: () => void;
}

export const useCalculation = (): UseCalculationReturn => {
  const [result, setResult] = useState<CalculationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const calculate = async (filePath: string, waiveFilePath?: string) => {
    try {
      setLoading(true);
      setError(null);

      const data = waiveFilePath
        ? await calculationService.calculateWithWaive(filePath, waiveFilePath)
        : await calculationService.calculate(filePath);

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Calculation failed');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setResult(null);
    setError(null);
    setLoading(false);
  };

  return { result, loading, error, calculate, reset };
};
```

---

### 4. React Components

#### HomePage Component (src/components/Pages/HomePage.tsx)

```typescript
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useConfig } from '../../hooks/useConfig';
import LoadingSpinner from '../Shared/LoadingSpinner';
import ErrorAlert from '../Shared/ErrorAlert';
import './HomePage.css';

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { config, loading, error } = useConfig();

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorAlert message={error} />;
  if (!config) return <ErrorAlert message="Failed to load configuration" />;

  return (
    <div className="home-page">
      <div className="container">
        <h1>FloorPlan Interest Calculator</h1>
        <p className="subtitle">Calculate automotive dealer rental charges</p>

        {/* Config Display */}
        <section className="config-section">
          <h2>Configuration</h2>
          <div className="config-grid">
            <div className="config-item">
              <span className="label">Month End Date:</span>
              <span className="value">{config.config.monthEndDate}</span>
            </div>
            <div className="config-item">
              <span className="label">Penalty Rate:</span>
              <span className="value">{config.config.penaltyRate}%</span>
            </div>
          </div>
        </section>

        {/* Rate Table */}
        <section className="rates-section">
          <h2>Interest Rates by Day Range</h2>
          <table className="data-table">
            <thead>
              <tr>
                <th>Start Day</th>
                <th>End Day</th>
                <th>Rate (%)</th>
                <th>Effective Period</th>
              </tr>
            </thead>
            <tbody>
              {config.rates.map((rate, idx) => (
                <tr key={idx}>
                  <td>{rate.startDay}</td>
                  <td>{rate.endDay}</td>
                  <td>{rate.rate}</td>
                  <td>{rate.effectiveStart} to {rate.effectiveEnd}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* Subvention Table */}
        <section className="subvention-section">
          <h2>Subvention Campaigns</h2>
          <table className="data-table">
            <thead>
              <tr>
                <th>Campaign Name</th>
                <th>Free Days</th>
              </tr>
            </thead>
            <tbody>
              {config.subventions.map((sub, idx) => (
                <tr key={idx}>
                  <td>{sub.campaignName}</td>
                  <td>{sub.freeDays}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* Action Buttons */}
        <section className="actions-section">
          <h2>Calculations</h2>
          <div className="button-group">
            <button
              className="btn btn-primary"
              onClick={() => navigate('/upload-ar')}
            >
              📤 Upload AR File & Calculate
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => navigate('/upload-waive')}
            >
              📋 Apply Waive & Calculate
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};
```

#### UploadARPage Component (src/components/Pages/UploadARPage.tsx)

```typescript
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useFileUpload } from '../../hooks/useFileUpload';
import { fileService } from '../../services/api';
import FileUpload from '../Shared/FileUpload';
import LoadingSpinner from '../Shared/LoadingSpinner';
import ErrorAlert from '../Shared/ErrorAlert';
import './UploadARPage.css';

export const UploadARPage: React.FC = () => {
  const navigate = useNavigate();
  const { file, preview, loading, error, handleFileSelect, handleUpload, reset } =
    useFileUpload(fileService.uploadAR);

  const handleProceed = async () => {
    if (preview?.filePath) {
      navigate('/preview-ar', { state: { filePath: preview.filePath } });
    }
  };

  return (
    <div className="upload-ar-page">
      <div className="container">
        <h1>Upload AR File</h1>
        <p className="description">Upload your monthly AR file for processing</p>

        {!preview ? (
          <div className="upload-section">
            <FileUpload
              onFileSelect={handleFileSelect}
              loading={loading}
              error={error}
              onUpload={handleUpload}
              accept=".xlsx,.xls"
              buttonText="Upload & Preview"
            />
          </div>
        ) : (
          <div className="preview-section">
            <h2>File Preview: {preview.fileName}</h2>

            {/* Sheet Overview */}
            <div className="sheets-overview">
              {preview.sheetNames.map((sheet) => (
                <div key={sheet} className="sheet-info">
                  <h3>{sheet}</h3>
                  <p className="record-count">
                    {preview.recordCounts[sheet]} records
                  </p>
                </div>
              ))}
            </div>

            {/* Detailed Preview */}
            {preview.sheetNames.map((sheet) => (
              <div key={`preview-${sheet}`} className="sheet-preview">
                <h3>{sheet} (First 5 rows)</h3>
                <div
                  className="table-container"
                  dangerouslySetInnerHTML={{
                    __html: preview.previewTables[sheet],
                  }}
                />
              </div>
            ))}

            {/* Action Buttons */}
            <div className="button-group">
              <button className="btn btn-primary" onClick={handleProceed}>
                ✓ Proceed to Calculation
              </button>
              <button className="btn btn-secondary" onClick={reset}>
                ↺ Upload Different File
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
```

---

### 5. Backend Flask API Updates

```python
# backend/app.py (Key modifications for API)

from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import pandas as pd
import os
import json
from datetime import datetime

app = Flask(__name__)
CORS(app)  # Enable CORS for React frontend

UPLOAD_FOLDER = 'uploads'
OUTPUT_FOLDER = 'AR_Outputs'
CONFIG_PATH = os.path.join(os.getcwd(), 'config', 'Rental_Charge_Conditions_v2.xlsx')

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(OUTPUT_FOLDER, exist_ok=True)

# ============= API ENDPOINTS =============

@app.route('/api/config', methods=['GET'])
def get_config():
    """Return configuration data as JSON"""
    try:
        df_config = pd.read_excel(CONFIG_PATH, sheet_name='Config')
        df_rate = pd.read_excel(CONFIG_PATH, sheet_name='Rate_By_Day_Range')
        df_subvention = pd.read_excel(CONFIG_PATH, sheet_name='Subvention_Campaign')
        
        config_dict = dict(zip(df_config['Key'], df_config['Value']))
        
        return jsonify({
            'config': {
                'monthEndDate': str(config_dict.get('Month End Date')),
                'penaltyRate': float(config_dict.get('Penalty Rate', 15))
            },
            'rates': df_rate.to_dict('records'),
            'subventions': df_subvention.to_dict('records')
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/upload', methods=['POST'])
def upload_ar():
    """Upload and preview AR file"""
    try:
        if 'ar_file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
        
        file = request.files['ar_file']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        filename = secure_filename(file.filename)
        filepath = os.path.join(UPLOAD_FOLDER, filename)
        file.save(filepath)
        
        xls = pd.ExcelFile(filepath, engine='openpyxl')
        sheet_names = xls.sheet_names
        
        preview_tables = {}
        record_counts = {}
        
        for sheet in sheet_names:
            try:
                header = 0 if 'penalty' in sheet.lower() else 1
                df = pd.read_excel(xls, sheet_name=sheet, header=header)
                preview_tables[sheet] = df.head(5).to_html(classes='table table-sm')
                record_counts[sheet] = int(len(df))
            except:
                preview_tables[sheet] = '<p>Error reading sheet</p>'
                record_counts[sheet] = 0
        
        return jsonify({
            'fileName': filename,
            'filePath': filepath,
            'sheetNames': sheet_names,
            'previewTables': preview_tables,
            'recordCounts': record_counts
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/calculate', methods=['POST'])
def calculate_api():
    """Calculate charges (without waive)"""
    try:
        data = request.json
        file_path = data.get('filePath')
        
        if not file_path or not os.path.exists(file_path):
            return jsonify({'error': 'File not found'}), 400
        
        # Execute calculation logic from original app.py
        # Return JSON response instead of HTML
        
        result = {
            'success': True,
            'message': 'Calculation completed successfully',
            'outputPath': output_path,
            'summary': {
                'arLastMonth': float(ar_last_total),
                'newVolume': float(new_vol_total),
                'allPayment': float(paid_total),
                'arOutstanding': float(outstanding_total),
                'total': float(total)
            },
            'detailRecords': df_ar_current_month.to_dict('records'),
            'dealerSummary': df_rental_summary.to_dict('records')
        }
        
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e), 'details': traceback.format_exc()}), 400

@app.route('/api/calculate-with-waive', methods=['POST'])
def calculate_with_waive_api():
    """Calculate with approved waives"""
    try:
        data = request.json
        ar_file_path = data.get('arFilePath')
        waive_file_path = data.get('waiveFilePath')
        
        # Similar to /api/calculate but with waive logic
        
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/download', methods=['GET'])
def download():
    """Download generated Excel file"""
    try:
        file_path = request.args.get('filePath')
        if not file_path or not os.path.exists(file_path):
            return jsonify({'error': 'File not found'}), 404
        
        return send_file(file_path, as_attachment=True)
    except Exception as e:
        return jsonify({'error': str(e)}), 400

# ============= FLASK APP STARTUP =============

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=5000, debug=False)
```

---

## Deployment

### Development Mode
```bash
# Terminal 1: Backend
cd backend
python app.py
# Flask runs on http://localhost:5000

# Terminal 2: Frontend
cd frontend
npm run dev
# Vite runs on http://localhost:5173
```

### Production Mode

#### Option 1: Electron (Desktop App)

```json
// package.json scripts
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "electron": "electron .",
    "electron-dev": "concurrently \"npm run dev\" \"wait-on http://localhost:5173 && electron .\"",
    "electron-build": "npm run build && electron-builder"
  }
}
```

#### Option 2: Tauri (Lightweight Desktop)

```toml
# src-tauri/tauri.conf.json
{
  "build": {
    "beforeBuildCommand": "npm run build",
    "devPath": "http://localhost:5173",
    "frontendDist": "../dist"
  }
}
```

---

## Key Differences from Original

| Aspect | Original (Flask) | New (React) |
|--------|------------------|------------|
| **Frontend** | Jinja2 templates | React components |
| **Data Flow** | Server renders HTML | Client renders UI |
| **API Calls** | Form submissions | REST API (JSON) |
| **State** | Server-side sessions | Client-side (Hooks/Redux) |
| **UI Updates** | Page refreshes | Instant (React) |
| **Styling** | Inline CSS | Tailwind/CSS Modules |
| **Type Safety** | Python type hints | Full TypeScript |

---

## Testing

### Frontend Tests (Vitest/Jest)

```typescript
// src/hooks/__tests__/useConfig.test.ts
import { renderHook, waitFor } from '@testing-library/react';
import { useConfig } from '../useConfig';

describe('useConfig', () => {
  it('should load config successfully', async () => {
    const { result } = renderHook(() => useConfig());
    
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    
    expect(result.current.config).toBeDefined();
    expect(result.current.error).toBeNull();
  });
});
```

### Backend Tests (pytest)

```python
# tests/test_api.py
import pytest
from app import app

@pytest.fixture
def client():
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client

def test_get_config(client):
    response = client.get('/api/config')
    assert response.status_code == 200
    data = response.get_json()
    assert 'config' in data
    assert 'rates' in data
    assert 'subventions' in data
```

