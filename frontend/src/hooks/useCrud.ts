import { useState, useCallback } from 'react';
import { api } from '../lib/api';
import { useToast } from '../contexts/ToastContext';

interface UseCrudOptions {
  endpoint: string;
  onSuccess?: (data: any) => void;
  onError?: (err: any) => void;
}

export function useCrud<T = any>({ endpoint, onSuccess, onError }: UseCrudOptions) {
  const [data, setData] = useState<T[] | any>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const { success, error } = useToast();
  const [pages,setpages] = useState(0);

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
    } catch (err) {
      console.error(`Failed to fetch from ${endpoint}:`, err);
      error('Failed to load data');
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
      if(res?.status == 'error'){
        error(res?.message);
        return res?.data;
      }
      success('Record created successfully');
      onSuccess?.(res);
      await fetchAll();
      return res;
    } catch (err) {
      console.error(`Failed to create record at ${endpoint}:`, err);
      error('Failed to create record');
      onError?.(err);
      throw err;
    } finally {
      setSubmitting(false);
    }
  };

  const updateRecord = async (id: string, payload: any, customEndpoint?: string) => {
    try {
      setSubmitting(true);
      const targetEndpoint = customEndpoint ? `${customEndpoint}/${id}` : `${endpoint}/${id}`;
      const res = await api.patch(targetEndpoint, payload);
      success('Record updated successfully');
      onSuccess?.(res);
      await fetchAll();
      return res;
    } catch (err) {
      console.error(`Failed to update record ${id} at ${endpoint}:`, err);
      error('Failed to update record');
      onError?.(err);
      throw err;
    } finally {
      setSubmitting(false);
    }
  };

  const deleteRecord = async (id: string, customEndpoint?: string) => {
    try {
      setSubmitting(true);
      const targetEndpoint = customEndpoint ? `${customEndpoint}/${id}` : `${endpoint}/${id}`;
      const res = await api.delete(targetEndpoint);
      success('Record deleted successfully');
      onSuccess?.(res);
      await fetchAll();
      return res;
    } catch (err) {
      console.error(`Failed to delete record ${id} at ${endpoint}:`, err);
      error('Failed to delete record');
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
