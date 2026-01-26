'use client';

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { lociFromResidues, ResiduePair } from '@/components/molstar/landing/highlight';

type LigandRow = {
    family: 'tubulin_alpha' | 'tubulin_beta';
    chemical_id: string;
    chemical_name: string | null;
    top_residues: Array<[string, number, number]>;
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

    const filteredRows = useMemo(() => rows.filter(r => (r.max_hits ?? 0) >= 3), [rows]);

    const grouped = useMemo(() => {
        const g: Record<string, LigandRow[]> = { tubulin_alpha: [], tubulin_beta: [] };
        for (const r of filteredRows) g[r.family]?.push(r);
        // sort by max hits desc so top ligands appear first
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

        const residues: ResiduePair[] = row.top_residues
            .slice(0, 120)
            .map(([ch, pos]) => [ch, pos]);

        const loci = lociFromResidues(viewer, residues);
        if (!loci) return;
        hi.highlightOnly({ loci });
    }, [viewer]);

    if (loading) return <div className="text-xs text-slate-500">Loading ligands…</div>;
    if (err) return <div className="text-xs text-red-600">{err}</div>;

    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between">
                <div className="text-sm font-medium">Ligands</div>
                <div className="text-[11px] text-slate-500">
                    showing max_hits ≥ 3
                </div>
            </div>

            <div className="space-y-3">
                {(['tubulin_alpha', 'tubulin_beta'] as const).map((fam) => {
                    const famRows = grouped[fam];
                    return (
                        <div key={fam} className="rounded-lg border bg-white">
                            <div className="px-3 py-2 text-xs font-semibold text-slate-600 bg-slate-50 border-b flex items-center justify-between">
                                <span>{famLabel(fam)}</span>
                                <span className="font-normal text-slate-500">{famRows.length}</span>
                            </div>

                            <div className="p-2 flex flex-wrap gap-1.5">
                                {famRows.map((r) => (
                                    <button
                                        key={`${r.family}:${r.chemical_id}`}
                                        type="button"
                                        onMouseEnter={() => highlightRow(r)}
                                        onMouseLeave={() => highlightRow(null)}
                                        className="
        inline-flex items-center gap-1
        rounded-full border border-slate-200 bg-white
        px-2 py-0.5
        text-[11px] font-mono text-slate-700
        hover:bg-slate-50 active:bg-slate-100
        transition
      "
                                        title={r.chemical_name ?? r.chemical_id}
                                    >
                                        <span>{r.chemical_id}</span>
                                        <span className="text-[10px] font-sans text-slate-400">{r.max_hits}</span>
                                    </button>
                                ))}
                            </div>

                        </div>
                    );
                })}
            </div>

            <div className="text-[11px] text-slate-500">
                Hover a pill to highlight its composite binding site on 1JFF.
            </div>
        </div>
    );
}

