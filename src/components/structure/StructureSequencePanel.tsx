// src/components/structure/StructureSequencePanel.tsx
'use client';

import { useRef, useEffect, useMemo } from 'react';
import { X } from 'lucide-react';
import { ResizableMSAContainer, ResizableMSAContainerHandle } from '@/components/msa/ResizableMSAContainer';
import type { MsaSequence } from '@/store/slices/sequence_registry';
import type { MolstarInstance } from '@/components/molstar/services/MolstarInstance';
import { getFamilyForChain, StructureProfile } from '@/lib/profile_utils';

interface StructureSequencePanelProps {
  chainId: string;
  instance: MolstarInstance | null;
  profile: StructureProfile | null;
  onClose: () => void;
}

export function StructureSequencePanel({
  chainId,
  instance,
  profile,
  onClose,
}: StructureSequencePanelProps) {
  const msaRef = useRef<ResizableMSAContainerHandle>(null);

  const sequence = useMemo(() => {
    if (!instance) return null;
    const seqData = instance.getSequenceData(chainId);
    if (!seqData) return null;

    const family = getFamilyForChain(profile, chainId);
    const seq: MsaSequence = {
      id: `${seqData.pdbId}_${chainId}`,
      name: `${seqData.pdbId} Chain ${chainId}`,
      sequence: seqData.sequence,
      rowIndex: 0,
      originType: 'pdb',
      family: family ?? undefined,
    };
    return seq;
  }, [instance, chainId, profile]);

  const sequences = useMemo(() => sequence ? [sequence] : [], [sequence]);
  const maxLength = sequence?.sequence.length ?? 0;

  // Sync hover from sequence to 3D viewer
  const handleResidueHover = (seqId: string, position: number) => {
    if (!instance) return;
    // position is 0-based in the MSA, auth_seq_id needs the observed sequence mapping
    const observed = instance.getObservedSequence(chainId);
    if (!observed || position >= observed.authSeqIds.length) return;
    const authSeqId = observed.authSeqIds[position];
    instance.highlightResidue(chainId, authSeqId, true);
  };

  const handleResidueLeave = () => {
    instance?.highlightResidue(chainId, 0, false);
  };

  if (!sequence) return null;

  const family = getFamilyForChain(profile, chainId);
  const familyLabel = family
    ? family.replace(/^tubulin_/, '').replace(/^map_/, '').charAt(0).toUpperCase() +
      family.replace(/^tubulin_|^map_/, '').slice(1)
    : null;

  return (
    <div className="h-full flex flex-col bg-white">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-100 bg-gray-50/40">
        <div className="flex items-baseline gap-2 text-xs text-gray-600">
          <span className="font-mono font-medium">{chainId}</span>
          {familyLabel && <span className="text-gray-400">{familyLabel}</span>}
          <span className="text-gray-300">{maxLength} residues</span>
        </div>
        <button
          onClick={onClose}
          className="p-0.5 text-gray-400 hover:text-gray-600 transition-colors"
          title="Close sequence panel"
        >
          <X size={14} />
        </button>
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">
        <ResizableMSAContainer
          ref={msaRef}
          sequences={sequences}
          maxLength={maxLength}
          colorScheme="clustal"
          showLabels={false}
          onResidueHover={handleResidueHover}
          onResidueLeave={handleResidueLeave}
        />
      </div>
    </div>
  );
}
