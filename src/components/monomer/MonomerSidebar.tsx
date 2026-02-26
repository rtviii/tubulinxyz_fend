import { useState, useMemo } from 'react';
import { ArrowLeft, Plus } from 'lucide-react';
import { AlignStructureForm } from './AlignStructureForm';
import { ChainAnnotationSection } from './ChainAnnotationSection';
import { getFamilyForChain, StructureProfile } from '@/lib/profile_utils';
import { formatFamilyShort } from '@/lib/formatters';
import { makeChainKey } from '@/lib/chain_key';
import type { MolstarInstance } from '@/components/molstar/services/MolstarInstance';
import type { PolymerComponent, AlignedStructure } from '@/components/molstar/core/types';
import type { MSAHandle } from '@/components/msa/types';

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
  const [showAlignForm, setShowAlignForm] = useState(false);

  const activeFamily = activeChainId
    ? getFamilyForChain(profile, activeChainId)
    : undefined;

  const formattedFamily = activeFamily ? formatFamilyShort(activeFamily) : null;

  const handleChainSwitch = (chainId: string) => {
    if (chainId !== activeChainId) instance?.switchMonomerChain(chainId);
  };

  // Build the list of chain sections: primary first, then aligned
  const chainSections = useMemo(() => {
    const sections: Array<{
      chainKey: string;
      pdbId: string;
      chainId: string;
      isPrimary: boolean;
      aligned?: { id: string; targetChainId: string; rmsd: number | null; visible: boolean };
    }> = [];

    if (pdbId && activeChainId) {
      sections.push({
        chainKey: makeChainKey(pdbId, activeChainId),
        pdbId,
        chainId: activeChainId,
        isPrimary: true,
      });
    }

    for (const a of alignedStructures) {
      sections.push({
        chainKey: makeChainKey(a.sourcePdbId, a.sourceChainId),
        pdbId: a.sourcePdbId,
        chainId: a.sourceChainId,
        isPrimary: false,
        aligned: {
          id: a.id,
          targetChainId: a.targetChainId,
          rmsd: a.rmsd,
          visible: a.visible,
        },
      });
    }

    return sections;
  }, [pdbId, activeChainId, alignedStructures]);

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

        {/* Align form */}
        <section className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Add Alignment
            </h2>
            <button
              onClick={() => setShowAlignForm(s => !s)}
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
              masterLength={masterLength}
              onClose={() => setShowAlignForm(false)}
            />
          )}
        </section>
      </div>

      {/* Per-chain annotation sections */}
      <section className="flex-1 min-h-0 border-t pt-4 flex flex-col overflow-hidden">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 flex-shrink-0">
          Chain Annotations
        </h2>
        <div className="flex-1 overflow-y-auto space-y-2">
          {chainSections.map(section => (
            <ChainAnnotationSection
              key={section.chainKey}
              chainKey={section.chainKey}
              pdbId={section.pdbId}
              chainId={section.chainId}
              isPrimary={section.isPrimary}
              aligned={section.aligned}
              instance={instance}
              msaRef={msaRef}
            />
          ))}
          {chainSections.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">
              Enter monomer view to see annotations
            </p>
          )}
        </div>
      </section>
    </div>
  );
}