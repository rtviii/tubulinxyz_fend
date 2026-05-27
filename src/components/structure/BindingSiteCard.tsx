'use client';

import { useCallback, useMemo } from 'react';
import { X } from 'lucide-react';
import { MolScriptBuilder as MS } from 'molstar/lib/mol-script/language/builder';
import { executeQuery } from '@/components/molstar/core/queries';
import { useAppSelector } from '@/store/store';
import { selectLigandOverrides } from '@/store/slices/colorOverridesSlice';
import { resolveLigandColor } from '@/lib/colors/annotationPaletteResolve';
import type { MolstarInstance } from '@/components/molstar/services/MolstarInstance';
import type { LigandBondInfo } from '@/components/molstar/core/bindingSite';

export interface ActiveBindingSite {
  uniqueKey: string;
  chemId: string;
  color: string;
  ligandName: string;
  drugbankId: string | null;
  chainKey: string;
  siteId: string;
  contacts: LigandBondInfo[];
}

interface Props {
  site: ActiveBindingSite;
  instance: MolstarInstance | null;
  onClose: () => void;
}

const SHORT_TYPE: Record<string, string> = {
  'Hydrogen Bond': 'H-bond',
  'Weak Hydrogen Bond': 'Wk H-bond',
  'Ionic Interaction': 'Ionic',
  'Hydrophobic Contact': 'Hydrophobic',
  'Cation-Pi Interaction': 'Cat-Pi',
  'Pi Stacking': 'Pi stack',
  'Halogen Bond': 'Halogen',
  'Metal Coordination': 'Metal',
  'Unknown Interaction': 'Contact',
};

function residueLabel(r: { compId: string; authSeqId: number }): string {
  return `${r.compId}${r.authSeqId}`;
}

function deduplicateContacts(contacts: LigandBondInfo[]): LigandBondInfo[] {
  const seen = new Set<string>();
  const result: LigandBondInfo[] = [];
  for (const c of contacts) {
    const key = `${c.residue.chainId}:${c.residue.authSeqId}:${c.type}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(c);
  }
  return result;
}

function buildResidueExpr(chainId: string, authSeqId: number) {
  return MS.struct.generator.atomGroups({
    'chain-test': MS.core.rel.eq([MS.ammp('auth_asym_id'), chainId]),
    'residue-test': MS.core.rel.eq([MS.ammp('auth_seq_id'), authSeqId]),
  });
}

/**
 * Floating card listing the non-covalent bonds between the active ligand
 * and its surrounding protein residues. Mirrors the visual treatment used
 * by the landing-page demo card (semi-transparent backdrop, pill-shaped
 * bond entries). Hovering a pill highlights the contact residue in 3D;
 * clicking focuses the camera on it.
 */
export function BindingSiteCard({ site, instance, onClose }: Props) {
  const contacts = useMemo(() => deduplicateContacts(site.contacts), [site.contacts]);

  // Always render the chip dot with the current effective color, so changing
  // the color via any color picker (ligand chip, MSA aux row) is reflected
  // in this card immediately — not frozen at activation time.
  const ligandOverrides = useAppSelector(selectLigandOverrides);
  const effectiveColor = resolveLigandColor(ligandOverrides, site.chemId);

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
            style={{ backgroundColor: effectiveColor }}
          />
          <h3 className="text-[11px] font-semibold text-slate-800 leading-tight font-mono">
            {site.chemId}
          </h3>
          <span className="text-[9px] text-slate-500 truncate">
            {site.contacts.length} bond{site.contacts.length === 1 ? '' : 's'}
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-700 transition-colors flex-shrink-0 mt-px"
          title="Hide binding site"
        >
          <X size={11} />
        </button>
      </div>

      {site.ligandName && (
        <p className="mt-0.5 text-[9px] text-slate-500 leading-snug line-clamp-2">
          {site.ligandName}
        </p>
      )}

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
                onPointerEnter={() => highlightResidue(c.residue.chainId, c.residue.authSeqId)}
                onPointerLeave={clearHighlight}
                onClick={() => focusResidue(c.residue.chainId, c.residue.authSeqId)}
              >
                <span className="text-slate-400 mr-px">{c.residue.chainId}</span>
                <span className="font-semibold">{residueLabel(c.residue)}</span>
                <span className="text-[8px] text-slate-400 ml-0.5 font-sans">{shortType}</span>
              </button>
            );
          })}
        </div>
      ) : (
        <p className="mt-1 text-[9px] text-slate-400 italic">
          No non-covalent contacts resolved for this ligand.
        </p>
      )}
    </div>
  );
}
