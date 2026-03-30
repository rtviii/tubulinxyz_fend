'use client';

import { useCallback, useState } from 'react';
import { X } from 'lucide-react';
import type { BondPairInfo, LigandBondInfo } from './demos';
import type { MolstarInstance } from '@/components/molstar/services/MolstarInstance';
import { MolScriptBuilder as MS } from 'molstar/lib/mol-script/language/builder';
import { executeQuery } from '@/components/molstar/core/queries';

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

export function DemoExplanationCard({ explanation, onDismiss, instance }: Props) {
  const { bondPairs, tabs } = explanation;
  const uniquePairs = bondPairs ? deduplicatePairs(bondPairs) : [];
  const [activeTab, setActiveTab] = useState(0);

  const clearHighlight = useCallback(() => {
    if (!instance) return;
    instance.viewer.highlightLoci(null);
    instance.removeAllExplorerLabels();
  }, [instance]);

  const handlePillHover = useCallback((pair: BondPairInfo, enter: boolean) => {
    if (!instance) return;
    if (!enter) { clearHighlight(); return; }

    const structure = instance.viewer.getCurrentStructure();
    if (!structure) return;

    const mergedExpr = MS.struct.combinator.merge([
      MS.struct.generator.atomGroups({
        'chain-test': MS.core.rel.eq([MS.ammp('auth_asym_id'), pair.residueA.chainId]),
        'residue-test': MS.core.rel.eq([MS.ammp('auth_seq_id'), pair.residueA.authSeqId]),
      }),
      MS.struct.generator.atomGroups({
        'chain-test': MS.core.rel.eq([MS.ammp('auth_asym_id'), pair.residueB.chainId]),
        'residue-test': MS.core.rel.eq([MS.ammp('auth_seq_id'), pair.residueB.authSeqId]),
      }),
    ]);

    const loci = executeQuery(mergedExpr, structure);
    if (loci) {
      instance.viewer.highlightLoci(loci);
      const shortType = SHORT_TYPE[pair.type] ?? pair.type;
      const labelText = `${pair.residueA.chainId}:${residueLabel(pair.residueA)} \u2013 ${shortType} \u2013 ${pair.residueB.chainId}:${residueLabel(pair.residueB)}`;
      instance.addExplorerLabel('demo-bond-hover', loci, labelText, undefined, BOND_LABEL_OVERRIDES);
    }
  }, [instance, clearHighlight]);

  const handleLigandContactHover = useCallback((
    contact: LigandBondInfo,
    tab: DemoTab,
    enter: boolean,
  ) => {
    if (!instance) return;
    if (!enter) { clearHighlight(); return; }

    const structure = instance.viewer.getCurrentStructure();
    if (!structure) return;

    // Highlight both the ligand and the contacting polymer residue
    const parts = [
      MS.struct.generator.atomGroups({
        'chain-test': MS.core.rel.eq([MS.ammp('auth_asym_id'), contact.residue.chainId]),
        'residue-test': MS.core.rel.eq([MS.ammp('auth_seq_id'), contact.residue.authSeqId]),
      }),
    ];

    if (tab.ligandChainId && tab.ligandSeqId) {
      parts.push(MS.struct.generator.atomGroups({
        'chain-test': MS.core.rel.eq([MS.ammp('auth_asym_id'), tab.ligandChainId]),
        'residue-test': MS.core.rel.eq([MS.ammp('auth_seq_id'), tab.ligandSeqId]),
      }));
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

  return (
    <div className="absolute bottom-3 right-3 z-20 max-w-[280px]
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
                        className="inline-flex items-center gap-px px-1 py-[1px] rounded
                                   text-[8px] font-mono leading-tight
                                   bg-slate-100/50 text-slate-500/80 border border-slate-200/30
                                   hover:bg-violet-50/70 hover:text-violet-700 hover:border-violet-200/60
                                   transition-colors cursor-default"
                        onPointerEnter={() => handleLigandContactHover(contact, currentTab, true)}
                        onPointerLeave={() => handleLigandContactHover(contact, currentTab, false)}
                      >
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

      {/* Flat bond pairs mode (dimer contact demos) */}
      {uniquePairs.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-[3px] max-h-[120px] overflow-y-auto">
          {uniquePairs.map((pair, i) => {
            const shortType = SHORT_TYPE[pair.type] ?? pair.type;
            return (
              <button
                key={i}
                className="inline-flex items-center gap-px px-1 py-[1px] rounded
                           text-[8px] font-mono leading-tight
                           bg-slate-100/50 text-slate-500/80 border border-slate-200/30
                           hover:bg-violet-50/70 hover:text-violet-700 hover:border-violet-200/60
                           transition-colors cursor-default"
                onPointerEnter={() => handlePillHover(pair, true)}
                onPointerLeave={() => handlePillHover(pair, false)}
              >
                <span className="font-semibold text-slate-600/80">{residueLabel(pair.residueA)}</span>
                <span className="text-slate-300/60 mx-px">{'\u2013'}</span>
                <span className="font-semibold text-slate-600/80">{residueLabel(pair.residueB)}</span>
                <span className="text-[7px] text-slate-400/60 ml-0.5 font-sans">{shortType}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
