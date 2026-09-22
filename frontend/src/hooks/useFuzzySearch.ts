import { useMemo } from 'react';
import Fuse from 'fuse.js';

interface UseFuzzySearchOptions {
  keys: string[];
  threshold?: number;
}

export function useFuzzySearch<T>(list: T[], query: string, options: UseFuzzySearchOptions) {
  const fuse = useMemo(() => {
    return new Fuse(list, {
      keys: options.keys,
      threshold: options.threshold ?? 0.3, // 0.0 is perfect match, 1.0 is anything
      ignoreLocation: true,
    });
  }, [list, options.keys, options.threshold]);

  const results = useMemo(() => {
    if (!query) return list;
    return fuse.search(query).map((result) => result.item);
  }, [fuse, query, list]);

  return results;
}
