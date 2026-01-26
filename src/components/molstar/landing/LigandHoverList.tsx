'use client';

import React, { useMemo, useState, useCallback } from 'react';
import type { MolstarViewer } from '@/components/molstar/core/MolstarViewer';
import { lociFromResidues, ResiduePair } from '@/components/molstar/landing/highlight';

export type LigandRow = {
  family: 'tubulin_alpha' | 'tubulin_beta';
  chemical_id: string;
  chemical_name: string | null;
  top_residues: Array<[string, number, number]>; // [chain, auth_seq_id, hits]
  max_hits: number;
};

function familyLabel(f: LigandRow['family']) {
  return f === 'tubulin_alpha' ? 'α-tubulin' : 'β-tubulin';
}

export default function LigandHoverList(props: { viewer: MolstarViewer | null; rows: LigandRow[] }) {
  const { viewer, rows } = props;
  const [activeKey, setActiveKey] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const m = new Map<string, LigandRow[]>();
    for (const r of rows) {
      const k = r.family;
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(r);
    }
    return m;
  }, [rows]);

  const highlight = useCallback((row: LigandRow | null) => {
    if (!viewer) return;

    const hi = viewer.ctx.managers.interactivity.lociHighlights;

    if (!row) {
      hi.clearHighlights();
      return;
    }

    // Use all residues or slice for hover (recommended)
    const residues: ResiduePair[] = row.top_residues
      .slice(0, 120) // hover highlight doesn’t need thousands
      .map(([ch, pos]) => [ch, pos]);

    const loci = lociFromResidues(viewer, residues);
    if (!loci) return;

    hi.highlightOnly({ loci });
  }, [viewer]);

  return (
    <div className="h-full flex flex-col">
      <div className="text-sm font-medium mb-2">Ligands</div>

      <div className="flex-1 overflow-y-auto rounded-md border bg-white">
        {(['tubulin_alpha','tubulin_beta'] as const).map((fam) => {
          const famRows = grouped.get(fam) ?? [];
          return (
            <div key={fam} className="border-b last:border-b-0">
              <div className="px-3 py-2 text-xs font-semibold text-slate-600 bg-slate-50 border-b">
                {familyLabel(fam)} <span className="font-normal">({famRows.length})</span>
              </div>

              {famRows.map((r) => {
                const key = `${r.family}:${r.chemical_id}`;
                const isActive = key === activeKey;
                return (
                  <div
                    key={key}
                    className={cn(
                      'px-3 py-2 cursor-pointer hover:bg-slate-50',
                      isActive && 'bg-slate-100'
                    )}
                    onMouseEnter={() => {
                      setActiveKey(key);
                      highlight(r);
                    }}
                    onMouseLeave={() => {
                      setActiveKey(null);
                      highlight(null);
                    }}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <div className="font-mono text-xs">{r.chemical_id}</div>
                      <div className="text-[11px] text-slate-500">
                        max {r.max_hits}
                      </div>
                    </div>
                    <div className="text-xs text-slate-600 truncate">
                      {r.chemical_name ?? ''}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      <div className="mt-2 text-[11px] text-slate-500">
        Hover a ligand to highlight its composite binding site on 1JFF.
      </div>
    </div>
  );
}
