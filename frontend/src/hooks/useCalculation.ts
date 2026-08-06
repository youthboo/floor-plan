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
