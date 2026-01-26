'use client';

import { useEffect, useState } from 'react';
import type { LigandRow } from './LigandHoverList';

export function useLandingLigands() {
  const [rows, setRows] = useState<LigandRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/landing/ligands');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!cancelled) setRows(json.rows ?? []);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? 'failed');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return { rows, loading, error };
}
