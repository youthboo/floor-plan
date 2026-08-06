import axios, { AxiosError } from 'axios';
import {
  AppConfig,
  FileUploadResponse,
  CalculationResponse,
  WaiveUploadResponse,
  ApiError,
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
