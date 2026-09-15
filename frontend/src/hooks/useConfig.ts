import { useEffect, useState } from 'react';
import { AppConfig } from '../types';
import { configService } from '../services/api';
import { getApiErrorMessage } from '../utils/apiError';

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
      setError(getApiErrorMessage(err, 'Failed to load config'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  return { config, loading, error, refetch: fetchConfig };
};
