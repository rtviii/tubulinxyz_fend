// src/components/monomer/MonomerSidebar.tsx

import { useMemo, useState, useCallback } from 'react';
import { ArrowLeft, Plus, EyeOff } from 'lucide-react';
import { ChainRow } from './ChainRow';
import { getFamilyForChain, StructureProfile } from '@/lib/profile_utils';
import { formatFamilyShort } from '@/lib/formatters';
import { makeChainKey } from '@/lib/chain_key';
import { useAppDispatch } from '@/store/store';
import { hideAllVisibility } from '@/store/slices/annotationsSlice';
import type { MolstarInstance } from '@/components/molstar/services/MolstarInstance';
import type { PolymerComponent, AlignedStructure } from '@/components/molstar/core/types';
import type { MSAHandle } from '@/components/msa/types';
import { AlignmentDialog } from './AlignmentDialog';

export interface MonomerSidebarProps {
  activeChainId: string | null;
  polymerComponents: PolymerComponent[];
  alignedStructures: AlignedStructure[];
  instance: MolstarInstance | null;
  pdbId: string | null;
  profile: StructureProfile | null;
  masterLength: number;
  msaRef: React.RefObject<MSAHandle>;
}

export function MonomerSidebar({
  activeChainId,
  polymerComponents,
  alignedStructures,
  instance,
  pdbId,
  profile,
  masterLength,
  msaRef,
}: MonomerSidebarProps) {
  const dispatch = useAppDispatch();
  const [alignDialogOpen, setAlignDialogOpen] = useState(false);

  const activeFamily = activeChainId
    ? getFamilyForChain(profile, activeChainId)
    : undefined;
  const formattedFamily = activeFamily ? formatFamilyShort(activeFamily) : null;

  const chainSections = useMemo(() => {
    const sections: Array<{
      chainKey: string;
      pdbId: string;
      chainId: string;
      isPrimary: boolean;
      family?: string;
      aligned?: { id: string; targetChainId: string; rmsd: number | null; visible: boolean };
    }> = [];

    if (pdbId && activeChainId) {
      sections.push({
        chainKey: makeChainKey(pdbId, activeChainId),
        pdbId,
        chainId: activeChainId,
        isPrimary: true,
        family: activeFamily,
      });
    }

    for (const a of alignedStructures) {
      sections.push({
        chainKey: makeChainKey(a.sourcePdbId, a.sourceChainId),
        pdbId: a.sourcePdbId,
        chainId: a.sourceChainId,
        isPrimary: false,
        family: a.family,
        aligned: {
          id: a.id,
          targetChainId: a.targetChainId,
          rmsd: a.rmsd,
          visible: a.visible,
        },
      });
    }

    return sections;
  }, [pdbId, activeChainId, activeFamily, alignedStructures]);

  // Solo: hide all aligned chains except the given one
  const handleSolo = useCallback((soloChainKey: string) => {
    if (!instance || !activeChainId) return;
    for (const a of alignedStructures) {
      const ck = makeChainKey(a.sourcePdbId, a.sourceChainId);
      const shouldShow = ck === soloChainKey;
      instance.setAlignedStructureVisible(a.targetChainId, a.id, shouldShow);
    }
  }, [instance, activeChainId, alignedStructures]);

  return (
    <div className="h-full bg-white border-r border-gray-200 flex flex-col overflow-hidden text-xs">
      {/* ── Header ── */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100">
        <button
          onClick={() => instance?.exitMonomerView()}
          className="p-1 text-gray-400 hover:text-gray-700 flex-shrink-0"
          title="Back to structure view"
        >
          <ArrowLeft size={14} />
        </button>

        <span className="font-semibold text-sm text-gray-800 truncate">
          {pdbId}
          <span className="text-gray-400 mx-0.5">/</span>
          {activeChainId}
        </span>

        {formattedFamily && (
          <span className="text-[10px] text-gray-400 flex-shrink-0">({formattedFamily})</span>
        )}

        <div className="ml-auto flex items-center gap-0.5 flex-shrink-0">
          {polymerComponents.map(chain => (
            <button
              key={chain.chainId}
              onClick={() => {
                if (chain.chainId !== activeChainId) instance?.switchMonomerChain(chain.chainId);
              }}
              className={`w-6 h-6 text-[10px] font-mono rounded ${chain.chainId === activeChainId
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
            >
              {chain.chainId}
            </button>
          ))}
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-gray-100 bg-gray-50/50">
        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mr-auto">
          Monomers
        </span>

        <button
          onClick={() => setAlignDialogOpen(true)}
          className="p-1 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50"
          title="Add alignment"
        >
          <Plus size={13} />
        </button>

        <button
          onClick={() => dispatch(hideAllVisibility())}
          className="p-1 text-gray-400 hover:text-gray-700 rounded hover:bg-gray-100"
          title="Hide all annotations"
        >
          <EyeOff size={13} />
        </button>
      </div>

      {/* ── Chain list ── */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {chainSections.map(section => (
          <ChainRow
            key={section.chainKey}
            chainKey={section.chainKey}
            pdbId={section.pdbId}
            chainId={section.chainId}
            isPrimary={section.isPrimary}
            family={section.family}
            aligned={section.aligned}
            instance={instance}
            msaRef={msaRef}
            onSolo={section.isPrimary ? undefined : handleSolo}
          />
        ))}
        {chainSections.length === 0 && (
          <p className="text-gray-400 text-center py-6">
            Enter monomer view to see annotations
          </p>
        )}
      </div>

      {alignDialogOpen && activeChainId && (
        <AlignmentDialog
          targetChainId={activeChainId}
          targetFamily={activeFamily}
          instance={instance}
          masterLength={masterLength}
          alignedStructures={alignedStructures}
          primaryPdbId={pdbId}
          onClose={() => setAlignDialogOpen(false)}
        />
      )}
    </div>
  );
}