'use client';

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { lociFromResidues, ResiduePair } from '@/components/molstar/landing/highlight';

type LigandRow = {
    family: 'tubulin_alpha' | 'tubulin_beta';
    chemical_id: string;
    chemical_name: string | null;
    top_residues: Array<[string, number, number]>; // [chain, auth_seq_id, hits]
    max_hits: number;
};

function famLabel(f: LigandRow['family']) {
    return f === 'tubulin_alpha' ? 'α-tubulin' : 'β-tubulin';
}

export default function LandingLigandSidebar(props: { viewer: any | null }) {
    const { viewer } = props;

    const [rows, setRows] = useState<LigandRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                setLoading(true);
                const res = await fetch('/landing/ligands.json', { cache: 'no-store' });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const json = await res.json();

                const loaded: LigandRow[] = Array.isArray(json) ? json : (json.rows ?? []);
                setRows(loaded);

            } catch (e: any) {
                if (!cancelled) setErr(e?.message ?? 'failed');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, []);


  const filteredRows = useMemo(() => {
    // For now: only keep ligands with >= 3 hits.
    // Later you can OR-in a paper allowlist here if you want.
    return rows.filter(r => (r.max_hits ?? 0) >= 3);
  }, [rows]);

  const grouped = useMemo(() => {
    const g: Record<string, LigandRow[]> = { tubulin_alpha: [], tubulin_beta: [] };
    for (const r of filteredRows) g[r.family]?.push(r);
    g.tubulin_alpha.sort((a, b) => b.max_hits - a.max_hits);
    g.tubulin_beta.sort((a, b) => b.max_hits - a.max_hits);
    return g as { tubulin_alpha: LigandRow[]; tubulin_beta: LigandRow[] };
  }, [filteredRows]);

    const highlightRow = useCallback((row: LigandRow | null) => {
        if (!viewer?.ctx?.managers?.interactivity?.lociHighlights) return;

        const hi = viewer.ctx.managers.interactivity.lociHighlights;

        if (!row) {
            hi.clearHighlights();
            return;
        }

        // Use a slice for responsiveness; you can increase later
        const residues: ResiduePair[] = row.top_residues
            .slice(0, 150)
            .map(([ch, pos]) => [ch, pos]);

        const loci = lociFromResidues(viewer, residues);
        if (!loci) return;

        hi.highlightOnly({ loci });
    }, [viewer]);

    if (loading) return <div className="text-xs text-slate-500">Loading ligands…</div>;
    if (err) return <div className="text-xs text-red-600">{err}</div>;

    return (
        <div className="h-full flex flex-col">
            <div className="text-sm font-medium mb-2">Ligands</div>

            <div className="flex-1 overflow-y-auto rounded-md border bg-white">
                {(['tubulin_alpha', 'tubulin_beta'] as const).map((fam) => (
                    <div key={fam} className="border-b last:border-b-0">
                        <div className="px-3 py-2 text-xs font-semibold text-slate-600 bg-slate-50 border-b">
                            {famLabel(fam)} <span className="font-normal">({grouped[fam].length})</span>
                        </div>

                        {grouped[fam].map((r) => (
                            <div
                                key={`${r.family}:${r.chemical_id}`}
                                className="px-3 py-2 cursor-pointer hover:bg-slate-50"
                                onMouseEnter={() => highlightRow(r)}
                                onMouseLeave={() => highlightRow(null)}
                            >
                                <div className="flex items-baseline justify-between gap-2">
                                    <div className="font-mono text-xs">{r.chemical_id}</div>
                                    <div className="text-[11px] text-slate-500">max {r.max_hits}</div>
                                </div>
                                <div className="text-xs text-slate-600 truncate">{r.chemical_name ?? ''}</div>
                            </div>
                        ))}
                    </div>
                ))}
            </div>

            <div className="mt-2 text-[11px] text-slate-500">
                Hover a ligand to highlight its composite binding site on 1JFF.
            </div>
        </div>
    );
}
