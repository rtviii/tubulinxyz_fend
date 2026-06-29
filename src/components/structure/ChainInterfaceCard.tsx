'use client';

import { useCallback, useMemo } from 'react';
import { X } from 'lucide-react';
import { executeQuery } from '@/components/molstar/core/queries';
import type { MolstarInstance } from '@/components/molstar/services/MolstarInstance';
import { SHORT_TYPE, residueLabel, buildResidueExpr } from './BindingSiteCard';

// One contacted residue on a partner chain (the thing the focused chain touches).
export interface InterfaceContact {
  chainId: string;
  authSeqId: number;
  compId: string;
  type: string;
}

export interface ActiveChainInterface {
  // The focused chain whose contacts we're listing (e.g. the EB/MAP chain).
  chainId: string;
  // Optional friendly label for the header (e.g. "EB family", a family name).
  label?: string | null;
  color: string;
  contacts: InterfaceContact[];
}

interface Props {
  site: ActiveChainInterface;
  instance: MolstarInstance | null;
  onClose: () => void;
}

function dedupe(contacts: InterfaceContact[]): InterfaceContact[] {
  const seen = new Set<string>();
  const out: InterfaceContact[] = [];
  for (const c of contacts) {
    const key = `${c.chainId}:${c.authSeqId}:${c.type}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}

/**
 * Floating card listing the non-covalent contacts a chain makes with the chains
 * around it — the chain-chain analogue of BindingSiteCard. Fed by the bond pairs
 * returned by MolstarInstance.focusChainInterface (we surface the PARTNER-side
 * residue of each pair, i.e. what the focused chain touches). Hover a pill to
 * highlight that residue in 3D; click to focus it. Same visual treatment as the
 * ligand binding-site card so the two read identically.
 */
export function ChainInterfaceCard({ site, instance, onClose }: Props) {
  const contacts = useMemo(() => dedupe(site.contacts), [site.contacts]);

  const highlightResidue = useCallback((chainId: string, authSeqId: number) => {
    if (!instance) return;
    const structure = instance.viewer.getCurrentStructure();
    if (!structure) return;
    const loci = executeQuery(buildResidueExpr(chainId, authSeqId), structure);
    if (loci) instance.viewer.highlightLoci(loci);
  }, [instance]);

  const clearHighlight = useCallback(() => {
    if (!instance) return;
    instance.viewer.highlightLoci(null);
  }, [instance]);

  const focusResidue = useCallback((chainId: string, authSeqId: number) => {
    if (!instance) return;
    instance.focusResidue(chainId, authSeqId);
  }, [instance]);

  return (
    <div
      className="max-w-[22rem] min-w-[14rem]
                 px-2.5 py-1.5 rounded-2xl bg-white/80 backdrop-blur
                 border border-slate-200/60 shadow-sm"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-baseline gap-1.5 min-w-0">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0 translate-y-px"
            style={{ backgroundColor: site.color }}
          />
          <h3 className="text-[11px] font-semibold text-slate-800 leading-tight font-mono">
            {site.label ? `${site.label} · ${site.chainId}` : `Chain ${site.chainId}`}
          </h3>
          <span className="text-[9px] text-slate-500 truncate">
            {contacts.length} contact{contacts.length === 1 ? '' : 's'}
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-700 transition-colors flex-shrink-0 mt-px"
          title="Hide interface"
        >
          <X size={11} />
        </button>
      </div>

      {contacts.length > 0 ? (
        <div className="mt-1.5 flex flex-wrap gap-[3px] max-h-[160px] overflow-y-auto">
          {contacts.map((c, i) => {
            const shortType = SHORT_TYPE[c.type] ?? c.type;
            return (
              <button
                key={i}
                className="inline-flex items-center gap-[2px] px-1 py-[1px] rounded
                           text-[9px] font-mono leading-tight
                           bg-slate-50 text-slate-600 border border-slate-200/60
                           hover:bg-slate-100 hover:text-slate-900 hover:border-slate-300
                           transition-colors cursor-default"
                onPointerEnter={() => highlightResidue(c.chainId, c.authSeqId)}
                onPointerLeave={clearHighlight}
                onClick={() => focusResidue(c.chainId, c.authSeqId)}
              >
                <span className="text-slate-400 mr-px">{c.chainId}</span>
                <span className="font-semibold">{residueLabel(c)}</span>
                <span className="text-[8px] text-slate-400 ml-0.5 font-sans">{shortType}</span>
              </button>
            );
          })}
        </div>
      ) : (
        <p className="mt-1 text-[9px] text-slate-400 italic">
          No non-covalent contacts resolved for this chain.
        </p>
      )}
    </div>
  );
}
