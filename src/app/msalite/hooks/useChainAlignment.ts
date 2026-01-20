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
      instance: MolstarInstance  // Changed from MolstarService
    ): Promise<AlignmentResult> => {
      setIsAligning(true);
      setCurrentChain(chainId);
      setError(null);

      try {
        // Extract sequence from Molstar - use instance method directly
        const observed = instance.getObservedSequence(chainId);
        if (!observed) {
          throw new Error(`Failed to get observed sequence for ${pdbId}:${chainId}`);
        }

        // Call backend alignment
        const result = await alignSequence({
          alignmentRequest: {
            sequence: observed.sequence,
            sequence_id: `${pdbId}_${chainId}`,
            auth_seq_ids: observed.authSeqIds,
            annotations: [],
          },
        }).unwrap();

        // Build position mapping: msaPosition -> authSeqId
        const positionMapping: PositionMapping = {};
        result.mapping.forEach((msaPos: number, idx: number) => {
          if (msaPos !== -1) {
            positionMapping[msaPos] = observed.authSeqIds[idx];
          }
        });

        const sequenceId = `${pdbId}_${chainId}`;

        // Register in Redux
        dispatch(addSequence({
          id: sequenceId,
          name: sequenceId,
          sequence: result.aligned_sequence,
          originType: 'pdb',
          chainRef: { pdbId, chainId },
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