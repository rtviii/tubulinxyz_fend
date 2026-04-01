// src/services/organism_map.ts
// Cached mapping of rcsb_id -> source organism names, fetched once.

import { useState, useEffect } from 'react';
import { API_BASE_URL } from '@/config';

let cache: Record<string, string[]> | null = null;
let fetchPromise: Promise<Record<string, string[]>> | null = null;

export async function getOrganismMap(): Promise<Record<string, string[]>> {
  if (cache) return cache;
  if (fetchPromise) return fetchPromise;

  fetchPromise = fetch(`${API_BASE_URL}/structures/organisms`)
    .then(res => {
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    })
    .then((data: Record<string, string[]>) => {
      // Only cache if we got real data
      if (Object.keys(data).length > 0) {
        cache = data;
      } else {
        fetchPromise = null; // allow retry
      }
      return data;
    })
    .catch(() => {
      fetchPromise = null; // allow retry on next call
      return {};
    });

  return fetchPromise;
}

export function useOrganismMap(): Record<string, string[]> | null {
  const [map, setMap] = useState<Record<string, string[]> | null>(cache);

  useEffect(() => {
    if (cache && Object.keys(cache).length > 0) {
      setMap(cache);
      return;
    }
    getOrganismMap().then(result => {
      if (Object.keys(result).length > 0) {
        setMap(result);
      }
    });
  }, []);

  return map;
}
