// src/app/msa-viewer/hooks/useChainAnnotations.ts
import { useState, useCallback } from 'react';

interface ChainAnnotationData {
  rcsb_id: string;
  auth_asym_id: string;
  mutations: any[];
  modifications: any[];
  total_count: number;
}

export function useChainAnnotations() {
  const [annotationCache, setAnnotationCache] = useState<Map<string, ChainAnnotationData>>(new Map());

  const getCacheKey = (rcsb_id: string, auth_asym_id: string) => `${rcsb_id}_${auth_asym_id}`;

  const fetchAnnotations = useCallback(async (rcsb_id: string, auth_asym_id: string) => {
    const key = getCacheKey(rcsb_id, auth_asym_id);
    
    if (annotationCache.has(key)) {
      return annotationCache.get(key)!;
    }

    // This will be handled by the component using the hook
    return null;
  }, [annotationCache]);

  const cacheAnnotations = useCallback((rcsb_id: string, auth_asym_id: string, data: ChainAnnotationData) => {
    const key = getCacheKey(rcsb_id, auth_asym_id);
    setAnnotationCache(prev => new Map(prev).set(key, data));
  }, []);

  const getAnnotations = useCallback((rcsb_id: string, auth_asym_id: string) => {
    const key = getCacheKey(rcsb_id, auth_asym_id);
    return annotationCache.get(key) || null;
  }, [annotationCache]);

  return {
    getAnnotations,
    cacheAnnotations,
    annotationCache
  };
}