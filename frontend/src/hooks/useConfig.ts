import { useEffect, useState } from 'react';
import axios from 'axios';
import { AppConfig } from '../types';
import { configService } from '../services/api';

interface UseConfigReturn {
  config: AppConfig | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

function getConfigErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { error?: string } | undefined;
    return data?.error || err.message || 'Failed to load config';
  }
  if (err instanceof Error) return err.message;
  return 'Failed to load config';
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
      setError(getConfigErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  return { config, loading, error, refetch: fetchConfig };
};
