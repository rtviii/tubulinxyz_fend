// src/components/structure/StructureSequencePanel.tsx
'use client';

import { useRef, useEffect, useMemo, useState, useCallback } from 'react';
import { X } from 'lucide-react';
import { ResizableMSAContainer, ResizableMSAContainerHandle } from '@/components/msa/ResizableMSAContainer';
import { MSAToolbar } from '@/components/msa/MSAToolbar';
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
  const [colorScheme, setColorScheme] = useState('clustal');

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

  // Helper: map authSeqId -> 0-based position in observed sequence
  const authSeqIdToPosition = useCallback((authSeqId: number): number | null => {
    if (!instance) return null;
    const observed = instance.getObservedSequence(chainId);
    if (!observed) return null;
    const idx = observed.authSeqIds.indexOf(authSeqId);
    return idx >= 0 ? idx : null;
  }, [instance, chainId]);

  // Helper: map 0-based position -> authSeqId
  const positionToAuthSeqId = useCallback((position: number): number | null => {
    if (!instance) return null;
    const observed = instance.getObservedSequence(chainId);
    if (!observed || position >= observed.authSeqIds.length) return null;
    return observed.authSeqIds[position];
  }, [instance, chainId]);

  // Sequence -> 3D hover
  const handleResidueHover = useCallback((seqId: string, position: number) => {
    const authSeqId = positionToAuthSeqId(position);
    if (authSeqId != null) instance?.highlightResidue(chainId, authSeqId, true);
  }, [instance, chainId, positionToAuthSeqId]);

  const handleResidueLeave = useCallback(() => {
    instance?.highlightResidue(chainId, 0, false);
  }, [instance, chainId]);

  // Sequence -> 3D click (focus camera on residue)
  const handleResidueClick = useCallback((seqId: string, position: number) => {
    const authSeqId = positionToAuthSeqId(position);
    if (authSeqId != null) instance?.focusResidue(chainId, authSeqId);
  }, [instance, chainId, positionToAuthSeqId]);

  // 3D -> Sequence hover sync
  useEffect(() => {
    if (!instance) return;
    const unsub = instance.viewer.subscribeToHover(info => {
      if (!info || info.chainId !== chainId) {
        msaRef.current?.clearHighlight();
        return;
      }
      const pos = authSeqIdToPosition(info.authSeqId);
      if (pos != null) {
        msaRef.current?.setHighlight(pos, pos);
      }
    });
    return unsub;
  }, [instance, chainId, authSeqIdToPosition]);

  // 3D -> Sequence click sync (center view on clicked residue)
  useEffect(() => {
    if (!instance) return;
    const unsub = instance.viewer.subscribeToClick(info => {
      if (!info || info.chainId !== chainId) return;
      const pos = authSeqIdToPosition(info.authSeqId);
      if (pos != null) {
        msaRef.current?.jumpToRange(Math.max(0, pos - 25), pos + 25);
      }
    });
    return unsub;
  }, [instance, chainId, authSeqIdToPosition]);

  // Toolbar callbacks
  const handleSchemeChange = useCallback((scheme: string) => {
    setColorScheme(scheme);
    msaRef.current?.setColorScheme(scheme);
  }, []);

  const handleJumpToRange = useCallback((start: number, end: number) => {
    msaRef.current?.jumpToRange(start, end);
  }, []);

  const handleReset = useCallback(() => {
    msaRef.current?.clearPositionColors();
  }, []);

  if (!sequence) return null;

  const family = getFamilyForChain(profile, chainId);
  const familyLabel = family
    ? family.replace(/^tubulin_/, '').replace(/^map_/, '').charAt(0).toUpperCase() +
      family.replace(/^tubulin_|^map_/, '').slice(1)
    : null;

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-100 bg-gray-50/40 gap-3">
        <div className="flex items-baseline gap-2 text-xs text-gray-600 flex-shrink-0">
          <span className="font-mono font-medium">{chainId}</span>
          {familyLabel && <span className="text-gray-400">{familyLabel}</span>}
          <span className="text-gray-300">{maxLength} residues</span>
        </div>
        <div className="flex-1 min-w-0 overflow-x-auto">
          <MSAToolbar
            currentScheme={colorScheme}
            maxLength={maxLength}
            onSchemeChange={handleSchemeChange}
            onJumpToRange={handleJumpToRange}
            onReset={handleReset}
            compact
          />
        </div>
        <button
          onClick={onClose}
          className="p-0.5 text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
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
          colorScheme={colorScheme}
          showLabels={false}
          onResidueHover={handleResidueHover}
          onResidueLeave={handleResidueLeave}
          onResidueClick={handleResidueClick}
        />
      </div>
    </div>
  );
}
