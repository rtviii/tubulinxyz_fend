// src/hooks/useChainFocusSync.ts
import { useEffect, useMemo } from 'react';
import { useAppSelector, useAppDispatch } from '@/store/store';
import {
  selectHoveredChainKey,
  selectSelectedChainKey,
} from '@/store/slices/chainFocusSlice';
import {
  setSelectedSequence,
  selectSequenceIdForChainKey,
} from '@/store/slices/sequence_registry';
import { makeChainKey } from '@/lib/chain_key';
import type { MolstarInstance } from '@/components/molstar/services/MolstarInstance';
import type { AlignedStructure } from '@/components/molstar/core/types';

interface UseChainFocusSyncOptions {
  instance: MolstarInstance | null;
  primaryPdbId: string | null;
  primaryChainId: string | null;
  alignedStructures: AlignedStructure[];
}

export function useChainFocusSync({
  instance,
  primaryPdbId,
  primaryChainId,
  alignedStructures,
}: UseChainFocusSyncOptions) {
  const dispatch = useAppDispatch();
  const hoveredChainKey = useAppSelector(selectHoveredChainKey);
  const selectedChainKey = useAppSelector(selectSelectedChainKey);

  const primaryKey = useMemo(
    () =>
      primaryPdbId && primaryChainId
        ? makeChainKey(primaryPdbId, primaryChainId)
        : null,
    [primaryPdbId, primaryChainId]
  );

  // Stable lookup: chainKey -> aligned structure info
  const alignedByKey = useMemo(() => {
    const map: Record<string, { id: string; targetChainId: string }> = {};
    for (const a of alignedStructures) {
      map[makeChainKey(a.sourcePdbId, a.sourceChainId)] = {
        id: a.id,
        targetChainId: a.targetChainId,
      };
    }
    return map;
  }, [alignedStructures]);

  // ── Hover -> Molstar highlight (ephemeral glow only, no visibility changes) ──

  useEffect(() => {
    if (!instance) return;

    if (!hoveredChainKey) {
      instance.clearHighlight();
      return;
    }

    if (hoveredChainKey === primaryKey && primaryChainId) {
      instance.highlightChain(primaryChainId, true);
    } else {
      const aligned = alignedByKey[hoveredChainKey];
      if (aligned) {
        instance.highlightAlignedChain(aligned.targetChainId, aligned.id, true);
      }
    }

    return () => {
      instance.clearHighlight();
    };
  }, [hoveredChainKey, instance, primaryKey, primaryChainId, alignedByKey]);

  // ── Selection -> sync sequenceRegistry.selectedSequenceId ──

  const selectedSeqId = useAppSelector(state =>
    selectedChainKey
      ? selectSequenceIdForChainKey(state, selectedChainKey)
      : null
  );

  useEffect(() => {
    dispatch(setSelectedSequence(selectedSeqId));
  }, [selectedSeqId, dispatch]);
}