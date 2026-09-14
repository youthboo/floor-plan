import axios, { AxiosError } from 'axios';
import {
  AppConfig,
  FileUploadResponse,
  CalculationResponse,
  WaiveUploadResponse,
  ApiError,
  CampaignDetail,
  CampaignSummary,
  CampaignImportResult,
} from '../types';

const API_BASE_URL = (import.meta.env.VITE_API_URL as string) || 'http://localhost:5001/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 120000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
apiClient.interceptors.request.use(
  (config) => {
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error: AxiosError<ApiError>) => {
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

  uploadSOT: async (file: File): Promise<FileUploadResponse> => {
    const formData = new FormData();
    formData.append('sot_file', file);

    const response = await apiClient.post<FileUploadResponse>('/upload-sot', formData, {
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

export interface CalculationRunConfig {
  month: string;
  year: string;
  penaltyRate: number;
}

// ============= CALCULATION ENDPOINTS =============
export const calculationService = {
  calculate: async (
    filePath: string,
    runConfig?: CalculationRunConfig,
    sotFilePath?: string
  ): Promise<CalculationResponse> => {
    const response = await apiClient.post<CalculationResponse>('/calculate', {
      filePath,
      ...(sotFilePath ? { sotFilePath } : {}),
      ...(runConfig ?? {}),
    });
    return response.data;
  },

  calculateWithWaive: async (
    arFilePath: string,
    waiveFilePath: string,
    runConfig?: CalculationRunConfig,
    sotFilePath?: string
  ): Promise<CalculationResponse> => {
    const response = await apiClient.post<CalculationResponse>('/calculate-with-waive', {
      arFilePath,
      waiveFilePath,
      ...(sotFilePath ? { sotFilePath } : {}),
      ...(runConfig ?? {}),
    });
    return response.data;
  },
};

// ============= CAMPAIGN ENDPOINTS =============
export const campaignService = {
  list: async (): Promise<CampaignSummary[]> => {
    const response = await apiClient.get<CampaignSummary[]>('/campaigns');
    return response.data;
  },

  get: async (code: string): Promise<CampaignDetail> => {
    const response = await apiClient.get<CampaignDetail>(`/campaigns/${encodeURIComponent(code)}`);
    return response.data;
  },

  importFile: async (file: File): Promise<CampaignImportResult> => {
    const formData = new FormData();
    formData.append('campaign_file', file);

    const response = await apiClient.post<CampaignImportResult>('/campaigns/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  commit: async (campaigns: CampaignDetail[]): Promise<CampaignSummary[]> => {
    const response = await apiClient.post<CampaignSummary[]>('/campaigns/commit', { campaigns });
    return response.data;
  },

  remove: async (code: string): Promise<CampaignSummary[]> => {
    const response = await apiClient.delete<CampaignSummary[]>(`/campaigns/${encodeURIComponent(code)}`);
    return response.data;
  },
};

export default apiClient;
