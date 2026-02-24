import { useState } from 'react';
import { ArrowLeft, Eye, EyeOff, X, Plus } from 'lucide-react';
import { VariantsPanel } from '@/components/annotations/VariantsPanel';
import { LigandsPanel } from '@/components/annotations/LigandsPanel';
import { AlignStructureForm } from './AlignStructureForm';
import { getFamilyForChain, StructureProfile } from '@/lib/profile_utils';
import { formatFamilyShort } from '@/lib/formatters';
import { useChainAlignment } from '@/hooks/useChainAlignment';
import type { MolstarInstance } from '@/components/molstar/services/MolstarInstance';
import type { PolymerComponent, AlignedStructure } from '@/components/molstar/core/types';
import type { LigandSite, Variant } from '@/store/slices/annotationsSlice';

export interface MonomerSidebarProps {
  activeChainId: string | null;
  polymerComponents: PolymerComponent[];
  alignedStructures: AlignedStructure[];
  instance: MolstarInstance | null;
  pdbId: string | null;
  profile: StructureProfile | null;
  // Annotation state
  ligandSites: LigandSite[];
  variants: Variant[];
  visibleLigandIds: Set<string>;
  showVariants: boolean;
  onToggleLigand: (siteId: string) => void;
  onFocusLigand: (siteId: string) => void;
  onToggleVariants: (enabled: boolean) => void;
  onFocusVariant: (masterIndex: number) => void;
  onShowAllLigands: () => void;
  onHideAllLigands: () => void;
  onClearAll: () => void;
}

export function MonomerSidebar({
  activeChainId,
  polymerComponents,
  alignedStructures,
  instance,
  pdbId,
  profile,
  ligandSites,
  variants,
  visibleLigandIds,
  showVariants,
  onToggleLigand,
  onFocusLigand,
  onToggleVariants,
  onFocusVariant,
  onShowAllLigands,
  onHideAllLigands,
  onClearAll,
}: MonomerSidebarProps) {
  const [showAlignForm, setShowAlignForm] = useState(false);
  const { alignChain } = useChainAlignment();

  const activeFamily = activeChainId
    ? getFamilyForChain(profile, activeChainId)
    : undefined;

  const formattedFamily = activeFamily ? formatFamilyShort(activeFamily) : null;

  const handleChainSwitch = (chainId: string) => {
    if (chainId !== activeChainId) instance?.switchMonomerChain(chainId);
  };

  return (
    <div className="h-full bg-white border-r border-gray-200 p-4 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0">
        <button
          onClick={() => instance?.exitMonomerView()}
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft size={16} />
          Back to structure
        </button>

        <h1 className="text-lg font-semibold mb-1">
          Chain {activeChainId}
          {formattedFamily && (
            <span className="ml-2 text-sm font-normal text-gray-500">({formattedFamily})</span>
          )}
        </h1>
        <p className="text-sm text-gray-500 mb-6">{pdbId}</p>

        <section className="mb-6">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Switch Chain
          </h2>
          <div className="flex flex-wrap gap-1">
            {polymerComponents.map(chain => (
              <button
                key={chain.chainId}
                onClick={() => handleChainSwitch(chain.chainId)}
                className={`px-2 py-1 text-xs font-mono rounded ${chain.chainId === activeChainId
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
              >
                {chain.chainId}
              </button>
            ))}
          </div>
        </section>

        <section className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Aligned Structures
            </h2>
            <button
              onClick={() => setShowAlignForm(true)}
              className="p-1 text-gray-400 hover:text-blue-600"
            >
              <Plus size={14} />
            </button>
          </div>

          {showAlignForm && activeChainId && (
            <AlignStructureForm
              targetChainId={activeChainId}
              instance={instance}
              targetFamily={activeFamily}
              alignChain={alignChain}
              onClose={() => setShowAlignForm(false)}
            />
          )}

          <div className="space-y-1 mt-2">
            {alignedStructures.map(aligned => (
              <AlignedStructureRow
                key={aligned.id}
                aligned={aligned}
                instance={instance}
              />
            ))}
          </div>
        </section>
      </div>

      {/* Annotations */}
      <section className="flex-1 min-h-0 border-t pt-4 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Annotations
          </h2>
          <button onClick={onClearAll} className="text-xs text-gray-500 hover:text-gray-700">
            Clear all
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4">
          <VariantsPanel
            variants={variants}
            showVariants={showVariants}
            onToggleVariants={onToggleVariants}
            onFocusVariant={onFocusVariant}
          />
          <LigandsPanel
            ligandSites={ligandSites}
            visibleLigandIds={visibleLigandIds}
            onToggleLigand={onToggleLigand}
            onFocusLigand={onFocusLigand}
            onShowAll={onShowAllLigands}
            onHideAll={onHideAllLigands}
          />
          {ligandSites.length === 0 && variants.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">No annotations available</p>
          )}
        </div>
      </section>
    </div>
  );
}

function AlignedStructureRow({
  aligned,
  instance,
}: {
  aligned: AlignedStructure;
  instance: MolstarInstance | null;
}) {
  return (
    <div className="flex items-center justify-between py-1 px-2 rounded text-sm bg-red-50">
      <div className="flex-1 min-w-0">
        <span className="font-mono text-xs">
          {aligned.sourcePdbId}:{aligned.sourceChainId}
        </span>
        {aligned.rmsd !== null && (
          <span className="text-xs text-gray-500 ml-2">RMSD: {aligned.rmsd.toFixed(2)}</span>
        )}
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={() =>
            instance?.setAlignedStructureVisible(
              aligned.targetChainId,
              aligned.id,
              !aligned.visible
            )
          }
          className="p-1 text-gray-400 hover:text-gray-700"
        >
          {aligned.visible ? <Eye size={14} /> : <EyeOff size={14} />}
        </button>
        <button
          onClick={() =>
            instance?.removeAlignedStructureById(aligned.targetChainId, aligned.id)
          }
          className="p-1 text-gray-400 hover:text-red-600"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}