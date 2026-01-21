// src/app/msalite/hooks/useChainAlignment.ts
import { useCallback, useState } from 'react';
import { useAppDispatch } from '@/store/store';
import { addSequence, setPositionMapping, PositionMapping } from '@/store/slices/sequence_registry';
import { useAlignSequenceMsaSequencePostMutation } from '@/store/tubxz_api';
import { MolstarInstance } from '@/components/molstar/services/MolstarInstance';

export interface AlignmentResult {
  sequenceId: string;
  alignedSequence: string;
  mapping: PositionMapping;
}

// "tubulin_alpha" -> "Alpha", "map_tau" -> "TAU"
function formatFamily(family: string | undefined): string | undefined {
  if (!family) return undefined;
  
  const tubulinMatch = family.match(/^tubulin_(\w+)$/);
  if (tubulinMatch) {
    const type = tubulinMatch[1];
    return type.charAt(0).toUpperCase() + type.slice(1);
  }
  
  const mapMatch = family.match(/^map_(\w+)/);
  if (mapMatch) {
    return mapMatch[1].toUpperCase();
  }
  
  return family;
}

export function useChainAlignment() {
  const dispatch = useAppDispatch();
  const [alignSequence] = useAlignSequenceMsaSequencePostMutation();
  
  const [isAligning, setIsAligning] = useState(false);
  const [currentChain, setCurrentChain] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const alignChain = useCallback(
    async (
      pdbId: string,
      chainId: string,
      instance: MolstarInstance,
      family?: string
    ): Promise<AlignmentResult> => {
      setIsAligning(true);
      setCurrentChain(chainId);
      setError(null);

      try {
        const observed = instance.getObservedSequence(chainId);
        if (!observed) {
          throw new Error(`Failed to get observed sequence for ${pdbId}:${chainId}`);
        }

        const result = await alignSequence({
          alignmentRequest: {
            sequence: observed.sequence,
            sequence_id: `${pdbId}_${chainId}`,
            auth_seq_ids: observed.authSeqIds,
            annotations: [],
          },
        }).unwrap();

        const positionMapping: PositionMapping = {};
        result.mapping.forEach((msaPos: number, idx: number) => {
          if (msaPos !== -1) {
            positionMapping[msaPos] = observed.authSeqIds[idx];
          }
        });

        const sequenceId = `${pdbId}_${chainId}`;
        const formattedFamily = formatFamily(family);
        
        // Build display name: "5JCO:A" or "5JCO:A (Alpha)"
        const displayName = formattedFamily 
          ? `${pdbId}:${chainId} (${formattedFamily})`
          : `${pdbId}:${chainId}`;

        dispatch(addSequence({
          id: sequenceId,
          name: displayName,
          sequence: result.aligned_sequence,
          originType: 'pdb',
          chainRef: { pdbId, chainId },
          family,
        }));

        dispatch(setPositionMapping({
          sequenceId,
          mapping: positionMapping,
        }));

        return {
          sequenceId,
          alignedSequence: result.aligned_sequence,
          mapping: positionMapping,
        };
      } catch (err: any) {
        const message = err?.data?.detail || err?.message || 'Alignment failed';
        setError(message);
        throw new Error(message);
      } finally {
        setIsAligning(false);
        setCurrentChain(null);
      }
    },
    [dispatch, alignSequence]
  );

  return {
    alignChain,
    isAligning,
    currentChain,
    error,
  };
}