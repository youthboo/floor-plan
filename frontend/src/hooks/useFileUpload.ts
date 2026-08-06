import { useState } from 'react';
import { FileUploadResponse } from '../types';

interface UseFileUploadReturn {
  file: File | null;
  preview: FileUploadResponse | null;
  loading: boolean;
  error: string | null;
  handleFileSelect: (file: File) => void;
  handleUpload: () => Promise<void>;
  reset: () => void;
}

export const useFileUpload = (
  uploadFunction: (file: File) => Promise<FileUploadResponse>
): UseFileUploadReturn => {
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
