import axios from 'axios';

interface ApiErrorShape {
  error?: string;
}

/** Extracts a user-facing message from an API/axios error, preferring the server's `error` field. */
export function getApiErrorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as ApiErrorShape | undefined;
    return data?.error || err.message || fallback;
  }
  if (err instanceof Error) return err.message;
  return fallback;
}
