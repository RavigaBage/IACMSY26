import { useState, useCallback } from 'react';
import { api } from '../lib/api';
import { useToast } from '../contexts/ToastContext';

interface UseCrudOptions {
  endpoint: string;
  onSuccess?: (data: any) => void;
  onError?: (err: any) => void;
}

export function getErrorMessage(err: any, fallback: string): string {
  const status = err?.status ?? err?.statusCode ?? err?.data?.status ?? err?.data?.statusCode;

  // If status is 500 or higher (server error), show a safe generic message with code
  if (typeof status === 'number' && status >= 500) {
    return `${fallback}: Server error (${status}). Please try again later.`;
  }

  // If status is anything but 500 and above (i.e. < 500 or client validation error), show the specific error
  const specificMessage =
    err?.message ||
    err?.data?.message ||
    err?.data?.error ||
    err?.error ||
    (typeof err === 'string' ? err : null);

  if (specificMessage && specificMessage !== 'Failed to fetch' && !specificMessage.includes('[object Object]')) {
    return specificMessage;
  }
  return fallback;
}

export function useCrud<T = any>({ endpoint, onSuccess, onError }: UseCrudOptions) {
  const [data, setData] = useState<T[] | any>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const { success, error } = useToast();
  const [pages, setpages] = useState(0);

  const fetchAll = useCallback(async (params?: Record<string, any>) => {
    try {
      setLoading(true);
      const queryString = params
        ? '?' + new URLSearchParams(params as any).toString()
        : '';
      const res = await api.get(`${endpoint}${queryString}`);
      if (res.data) setData(res.data);
      if (res.totalPages !== undefined) setpages(res.totalPages);
      return res;
    } catch (err: any) {
      console.error(`Failed to fetch from ${endpoint}:`, err);
      const errorMsg = getErrorMessage(err, 'Failed to load data');
      error(errorMsg);
      onError?.(err);
    } finally {
      setLoading(false);
    }
  }, [endpoint, error, onError]);

  const createRecord = async (payload: any, customEndpoint?: string) => {
    try {
      setSubmitting(true);
      const targetEndpoint = customEndpoint || endpoint;
      const res = await api.post(targetEndpoint, payload);
      if (res?.status === 'error') {
        const errorMsg = res?.message || res?.error || 'Failed to create record';
        const customErr: any = new Error(errorMsg);
        customErr.status = 400;
        customErr.data = res;
        throw customErr;
      }
      success('Record created successfully');
      onSuccess?.(res);
      await fetchAll();
      return res;
    } catch (err: any) {
      console.error(`Failed to create record at ${endpoint}:`, err);
      const errorMsg = getErrorMessage(err, 'Failed to create record');
      error(errorMsg);
      onError?.(err);
      throw err;
    } finally {
      setSubmitting(false);
    }
  };

  const updateRecord = async (id: string, payload: any, customEndpoint?: string) => {
    try {
      setSubmitting(true);
      const targetEndpoint = customEndpoint
        ? (customEndpoint.includes(id) ? customEndpoint : `${customEndpoint}/${id}`)
        : `${endpoint}/${id}`;
      const res = await api.patch(targetEndpoint, payload);
      if (res?.status === 'error') {
        const errorMsg = res?.message || res?.error || 'Failed to update record';
        const customErr: any = new Error(errorMsg);
        customErr.status = 400;
        customErr.data = res;
        throw customErr;
      }
      success('Record updated successfully');
      onSuccess?.(res);
      await fetchAll();
      return res;
    } catch (err: any) {
      console.error(`Failed to update record ${id} at ${endpoint}:`, err);
      const errorMsg = getErrorMessage(err, 'Failed to update record');
      error(errorMsg);
      onError?.(err);
      throw err;
    } finally {
      setSubmitting(false);
    }
  };

  const deleteRecord = async (id: string, customEndpoint?: string) => {
    try {
      setSubmitting(true);
      const targetEndpoint = customEndpoint
        ? (customEndpoint.includes(id) ? customEndpoint : `${customEndpoint}/${id}`)
        : `${endpoint}/${id}`;
      const res = await api.delete(targetEndpoint);
      if (res?.status === 'error') {
        const errorMsg = res?.message || res?.error || 'Failed to delete record';
        const customErr: any = new Error(errorMsg);
        customErr.status = 400;
        customErr.data = res;
        throw customErr;
      }
      success('Record deleted successfully');
      onSuccess?.(res);
      await fetchAll();
      return res;
    } catch (err: any) {
      console.error(`Failed to delete record ${id} at ${endpoint}:`, err);
      const errorMsg = getErrorMessage(err, 'Failed to delete record');
      error(errorMsg);
      onError?.(err);
      throw err;
    } finally {
      setSubmitting(false);
    }
  };

  return {
    pages,
    data,
    setData,
    loading,
    submitting,
    fetchAll,
    createRecord,
    updateRecord,
    deleteRecord,
  };
}
