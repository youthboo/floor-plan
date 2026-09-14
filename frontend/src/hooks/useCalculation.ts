import { useState } from 'react';
import { CalculationResponse } from '../types';
import { calculationService, CalculationRunConfig } from '../services/api';
import { getApiErrorMessage } from '../utils/apiError';

interface UseCalculationReturn {
  result: CalculationResponse | null;
  loading: boolean;
  error: string | null;
  calculate: (
    filePath: string,
    options?: { waiveFilePath?: string; sotFilePath?: string; runConfig?: CalculationRunConfig }
  ) => Promise<CalculationResponse | null>;
  reset: () => void;
}

export const useCalculation = (): UseCalculationReturn => {
  const [result, setResult] = useState<CalculationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const calculate = async (
    filePath: string,
    options?: { waiveFilePath?: string; sotFilePath?: string; runConfig?: CalculationRunConfig }
  ) => {
    try {
      setLoading(true);
      setError(null);

      const data = options?.waiveFilePath
        ? await calculationService.calculateWithWaive(
            filePath,
            options.waiveFilePath,
            options.runConfig,
            options.sotFilePath
          )
        : await calculationService.calculate(filePath, options?.runConfig, options?.sotFilePath);

      setResult(data);
      return data;
    } catch (err) {
      setError(getApiErrorMessage(err, 'Calculation failed'));
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
