import { useState } from 'react';
import axios from 'axios';
import { CalculationResponse } from '../types';
import { calculationService, CalculationRunConfig } from '../services/api';

interface UseCalculationReturn {
  result: CalculationResponse | null;
  loading: boolean;
  error: string | null;
  calculate: (
    filePath: string,
    options?: { waiveFilePath?: string; runConfig?: CalculationRunConfig }
  ) => Promise<CalculationResponse | null>;
  reset: () => void;
}

function getErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { error?: string; details?: string } | undefined;
    return data?.error || err.message || 'Calculation failed';
  }
  if (err instanceof Error) return err.message;
  return 'Calculation failed';
}

export const useCalculation = (): UseCalculationReturn => {
  const [result, setResult] = useState<CalculationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const calculate = async (
    filePath: string,
    options?: { waiveFilePath?: string; runConfig?: CalculationRunConfig }
  ) => {
    try {
      setLoading(true);
      setError(null);

      const data = options?.waiveFilePath
        ? await calculationService.calculateWithWaive(
            filePath,
            options.waiveFilePath,
            options.runConfig
          )
        : await calculationService.calculate(filePath, options?.runConfig);

      setResult(data);
      return data;
    } catch (err) {
      setError(getErrorMessage(err));
      setResult(null);
      return null;
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
