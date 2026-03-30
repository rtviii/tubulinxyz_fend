'use client';

import { useCallback, useState } from 'react';
import { X } from 'lucide-react';
import type { BondPairInfo, LigandBondInfo } from './demos';
import type { MolstarInstance } from '@/components/molstar/services/MolstarInstance';
import { MolScriptBuilder as MS } from 'molstar/lib/mol-script/language/builder';
import { executeQuery, buildMultiResidueQuery } from '@/components/molstar/core/queries';

export interface DemoTab {
  label: string;
  description: string;
  color: string;
  ligandContacts?: LigandBondInfo[];
  ligandChainId?: string;
  ligandSeqId?: number;
  ligandCompId?: string;
}

export interface DemoExplanation {
  title: string;
  body: string;
  target: 'heterodimer' | 'lattice' | 'both';
  bondPairs?: BondPairInfo[];
  tabs?: DemoTab[];
  /** chainId -> hex color for chain indicator dots */
  chainColors?: Record<string, string>;
}

interface Props {
  explanation: DemoExplanation;
  onDismiss: () => void;
  instance?: MolstarInstance | null;
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

function deduplicatePairs(pairs: BondPairInfo[]): BondPairInfo[] {
  const seen = new Set<string>();
  const result: BondPairInfo[] = [];
  for (const p of pairs) {
    const key = `${p.residueA.chainId}:${p.residueA.authSeqId}-${p.residueB.chainId}:${p.residueB.authSeqId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(p);
  }
  return result;
}

function deduplicateLigandContacts(contacts: LigandBondInfo[]): LigandBondInfo[] {
  const seen = new Set<string>();
  const result: LigandBondInfo[] = [];
  for (const c of contacts) {
    const key = `${c.residue.chainId}:${c.residue.authSeqId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(c);
  }
  return result;
}

const BOND_LABEL_OVERRIDES = {
  textSize: 1.2,
  sizeFactor: 1.6,
  backgroundMargin: 0.3,
  tetherLength: 6.0,
  attachment: 'middle-right',
};

/** Small colored dot for chain identity */
function ChainDot({ chainId, color }: { chainId: string; color?: string }) {
  return (
    <span
      className="inline-block w-[5px] h-[5px] rounded-full flex-shrink-0"
      style={{ backgroundColor: color ?? '#94a3b8' }}
      title={`Chain ${chainId}`}
    />
  );
}

// ─── Helpers to build loci for highlight/focus ───

function buildResidueExpr(chainId: string, authSeqId: number) {
  return MS.struct.generator.atomGroups({
    'chain-test': MS.core.rel.eq([MS.ammp('auth_asym_id'), chainId]),
    'residue-test': MS.core.rel.eq([MS.ammp('auth_seq_id'), authSeqId]),
  });
}

function buildPairExpr(pair: BondPairInfo) {
  return MS.struct.combinator.merge([
    buildResidueExpr(pair.residueA.chainId, pair.residueA.authSeqId),
    buildResidueExpr(pair.residueB.chainId, pair.residueB.authSeqId),
  ]);
}

export function DemoExplanationCard({ explanation, onDismiss, instance }: Props) {
  const { bondPairs, tabs, chainColors } = explanation;
  const uniquePairs = bondPairs ? deduplicatePairs(bondPairs) : [];
  const [activeTab, setActiveTab] = useState(0);

  const cc = chainColors ?? {};

  const clearHighlight = useCallback(() => {
    if (!instance) return;
    instance.viewer.highlightLoci(null);
    instance.removeAllExplorerLabels();
  }, [instance]);

  // ── Hover: highlight + label ──

  const highlightPair = useCallback((pair: BondPairInfo) => {
    if (!instance) return;
    const structure = instance.viewer.getCurrentStructure();
    if (!structure) return;
    const loci = executeQuery(buildPairExpr(pair), structure);
    if (loci) {
      instance.viewer.highlightLoci(loci);
      const shortType = SHORT_TYPE[pair.type] ?? pair.type;
      const labelText = `${pair.residueA.chainId}:${residueLabel(pair.residueA)} \u2013 ${shortType} \u2013 ${pair.residueB.chainId}:${residueLabel(pair.residueB)}`;
      instance.addExplorerLabel('demo-bond-hover', loci, labelText, undefined, BOND_LABEL_OVERRIDES);
    }
  }, [instance]);

  const highlightSingleResidue = useCallback((chainId: string, authSeqId: number, compId: string) => {
    if (!instance) return;
    const structure = instance.viewer.getCurrentStructure();
    if (!structure) return;
    const loci = executeQuery(buildResidueExpr(chainId, authSeqId), structure);
    if (loci) {
      instance.viewer.highlightLoci(loci);
      instance.addExplorerLabel('demo-bond-hover', loci, `${chainId}:${compId}${authSeqId}`, undefined, BOND_LABEL_OVERRIDES);
    }
  }, [instance]);

  // ── Click: focus camera ──

  const focusPair = useCallback((pair: BondPairInfo) => {
    if (!instance) return;
    const structure = instance.viewer.getCurrentStructure();
    if (!structure) return;
    const loci = executeQuery(buildPairExpr(pair), structure);
    if (loci) instance.viewer.focusLoci(loci, 250);
  }, [instance]);

  const focusSingleResidue = useCallback((chainId: string, authSeqId: number) => {
    if (!instance) return;
    const structure = instance.viewer.getCurrentStructure();
    if (!structure) return;
    const loci = executeQuery(buildResidueExpr(chainId, authSeqId), structure);
    if (loci) instance.viewer.focusLoci(loci, 250);
  }, [instance]);

  const focusLigandContact = useCallback((contact: LigandBondInfo, tab: DemoTab) => {
    if (!instance) return;
    const structure = instance.viewer.getCurrentStructure();
    if (!structure) return;
    const parts = [buildResidueExpr(contact.residue.chainId, contact.residue.authSeqId)];
    if (tab.ligandChainId && tab.ligandSeqId) {
      parts.push(buildResidueExpr(tab.ligandChainId, tab.ligandSeqId));
    }
    const loci = executeQuery(MS.struct.combinator.merge(parts), structure);
    if (loci) instance.viewer.focusLoci(loci, 250);
  }, [instance]);

  const handleLigandContactHover = useCallback((
    contact: LigandBondInfo, tab: DemoTab, enter: boolean,
  ) => {
    if (!instance) return;
    if (!enter) { clearHighlight(); return; }
    const structure = instance.viewer.getCurrentStructure();
    if (!structure) return;
    const parts = [buildResidueExpr(contact.residue.chainId, contact.residue.authSeqId)];
    if (tab.ligandChainId && tab.ligandSeqId) {
      parts.push(buildResidueExpr(tab.ligandChainId, tab.ligandSeqId));
    }
    const loci = executeQuery(MS.struct.combinator.merge(parts), structure);
    if (loci) {
      instance.viewer.highlightLoci(loci);
      const shortType = SHORT_TYPE[contact.type] ?? contact.type;
      const labelText = `${tab.ligandCompId ?? tab.label} \u2013 ${shortType} \u2013 ${contact.residue.chainId}:${residueLabel(contact.residue)}`;
      instance.addExplorerLabel('demo-bond-hover', loci, labelText, undefined, BOND_LABEL_OVERRIDES);
    }
  }, [instance, clearHighlight]);

  const currentTab = tabs?.[activeTab];
  const tabContacts = currentTab?.ligandContacts ? deduplicateLigandContacts(currentTab.ligandContacts) : [];

  // ── Render: bond pair row (used for dimer contacts) ──

  function BondPairRow({ pair }: { pair: BondPairInfo }) {
    const shortType = SHORT_TYPE[pair.type] ?? pair.type;
    const rA = pair.residueA;
    const rB = pair.residueB;

    return (
      <div
        className="inline-flex items-center gap-0 text-[8px] font-mono leading-none
                   rounded border border-slate-200/30 overflow-hidden
                   hover:border-violet-200/60 transition-colors"
        onPointerLeave={() => clearHighlight()}
      >
        {/* Side A */}
        <button
          className="inline-flex items-center gap-[2px] px-1 py-[2px]
                     bg-slate-50/50 hover:bg-violet-50/70 hover:text-violet-700
                     transition-colors cursor-default"
          onPointerEnter={() => highlightSingleResidue(rA.chainId, rA.authSeqId, rA.compId)}
          onClick={() => focusSingleResidue(rA.chainId, rA.authSeqId)}
        >
          <ChainDot chainId={rA.chainId} color={cc[rA.chainId]} />
          <span className="font-semibold text-slate-600/80">{residueLabel(rA)}</span>
        </button>

        {/* Bond type center */}
        <span
          className="px-[3px] py-[2px] text-[7px] text-slate-400/60 font-sans bg-slate-100/30
                     border-x border-slate-200/20 cursor-default"
          onPointerEnter={() => highlightPair(pair)}
          onClick={() => focusPair(pair)}
        >
          {shortType}
        </span>

        {/* Side B */}
        <button
          className="inline-flex items-center gap-[2px] px-1 py-[2px]
                     bg-slate-50/50 hover:bg-violet-50/70 hover:text-violet-700
                     transition-colors cursor-default"
          onPointerEnter={() => highlightSingleResidue(rB.chainId, rB.authSeqId, rB.compId)}
          onClick={() => focusSingleResidue(rB.chainId, rB.authSeqId)}
        >
          <span className="font-semibold text-slate-600/80">{residueLabel(rB)}</span>
          <ChainDot chainId={rB.chainId} color={cc[rB.chainId]} />
        </button>
      </div>
    );
  }

  return (
    <div className="absolute bottom-3 right-3 z-20 max-w-[300px]
                    px-2.5 py-1.5 rounded-lg bg-white/40 backdrop-blur-sm
                    border border-slate-200/40">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-[11px] font-semibold text-slate-700/80 leading-tight">
          {explanation.title}
        </h3>
        <button
          onClick={onDismiss}
          className="text-slate-400/60 hover:text-slate-600 transition-colors flex-shrink-0 mt-px"
        >
          <X size={10} />
        </button>
      </div>

      {/* Chain legend (when chain colors are provided) */}
      {chainColors && Object.keys(chainColors).length > 0 && (
        <div className="flex items-center gap-2 mt-0.5">
          {Object.entries(chainColors).map(([cId, hex]) => (
            <span key={cId} className="inline-flex items-center gap-[3px] text-[8px] text-slate-400/70">
              <ChainDot chainId={cId} color={hex} />
              Chain {cId}
            </span>
          ))}
        </div>
      )}

      <p className="mt-0.5 text-[9px] text-slate-400/80 leading-relaxed">
        {explanation.body}
      </p>

      {/* Tabbed mode (nucleotide demos) */}
      {tabs && tabs.length > 0 && (
        <div className="mt-1.5">
          <div className="flex gap-1 mb-1">
            {tabs.map((tab, i) => (
              <button
                key={i}
                onClick={() => setActiveTab(i)}
                className={`px-2 py-[2px] rounded text-[9px] font-semibold transition-colors border
                  ${activeTab === i
                    ? 'text-white border-transparent'
                    : 'text-slate-500/80 bg-slate-100/40 border-slate-200/30 hover:bg-slate-100/60'
                  }`}
                style={activeTab === i ? { backgroundColor: tab.color } : undefined}
              >
                {tab.label}
              </button>
            ))}
          </div>
          {currentTab && (
            <>
              <p className="text-[8px] text-slate-400/70 leading-relaxed mb-1">
                {currentTab.description}
              </p>
              {tabContacts.length > 0 && (
                <div className="flex flex-wrap gap-[3px] max-h-[100px] overflow-y-auto">
                  {tabContacts.map((contact, i) => {
                    const shortType = SHORT_TYPE[contact.type] ?? contact.type;
                    return (
                      <button
                        key={i}
                        className="inline-flex items-center gap-[2px] px-1 py-[1px] rounded
                                   text-[8px] font-mono leading-tight
                                   bg-slate-100/50 text-slate-500/80 border border-slate-200/30
                                   hover:bg-violet-50/70 hover:text-violet-700 hover:border-violet-200/60
                                   transition-colors cursor-default"
                        onPointerEnter={() => handleLigandContactHover(contact, currentTab, true)}
                        onPointerLeave={() => handleLigandContactHover(contact, currentTab, false)}
                        onClick={() => focusLigandContact(contact, currentTab)}
                      >
                        <ChainDot chainId={contact.residue.chainId} color={cc[contact.residue.chainId]} />
                        <span className="font-semibold text-slate-600/80">{residueLabel(contact.residue)}</span>
                        <span className="text-[7px] text-slate-400/60 ml-0.5 font-sans">{shortType}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Bond pairs mode (dimer contact demos) */}
      {uniquePairs.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-[3px] max-h-[120px] overflow-y-auto">
          {uniquePairs.map((pair, i) => (
            <BondPairRow key={i} pair={pair} />
          ))}
        </div>
      )}
    </div>
  );
}
