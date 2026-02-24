// src/hooks/useChainAlignment.ts
import { useCallback, useState, useRef } from 'react';
import { useAppDispatch } from '@/store/store';
import { addSequence, setPositionMapping, PositionMapping } from '@/store/slices/sequence_registry';
import { useAlignSequenceMutation } from '@/store/tubxz_api';
import { MolstarInstance } from '@/components/molstar/services/MolstarInstance';
import { formatFamilyShort } from '@/lib/formatters';

export interface AlignmentResult {
  sequenceId: string;
  alignedSequence: string;
  mapping: PositionMapping;
}


export function useChainAlignment() {
  const dispatch = useAppDispatch();
  const [alignSequence] = useAlignSequenceMutation();

  const [isAligning, setIsAligning] = useState(false);
  const [currentChain, setCurrentChain] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Track in-flight requests to prevent duplicate calls
  // This survives across state updates unlike isAligning
  const inFlightRef = useRef<Set<string>>(new Set());

  const alignChain = useCallback(
    async (
      pdbId: string,
      chainId: string,
      instance: MolstarInstance,
      family?: string
    ): Promise<AlignmentResult> => {
      const key = `${pdbId}_${chainId}`;

      // Guard: Already aligning this chain
      if (inFlightRef.current.has(key)) {
        console.log(`[useChainAlignment] Skipping duplicate request for ${key}`);
        throw new Error(`Already aligning ${key}`);
      }

      inFlightRef.current.add(key);
      setIsAligning(true);
      setCurrentChain(chainId);
      setError(null);

      try {
        const observed = instance.getObservedSequence(chainId);
        if (!observed) {
          throw new Error(`Failed to get observed sequence for ${pdbId}:${chainId}`);
        }


const key = `${pdbId}_${chainId}`;        // stable chainKey == sequenceId
const fam = family ?? 'unknown';          // keep family only as metadata



        const result = await alignSequence({
          family: fam,
          alignmentRequest: {
            sequence: observed.sequence,
            sequence_id: key,
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
        console.log('Alignment result.mapping (first 10):', result.mapping.slice(0, 10));
        console.log('Observed authSeqIds (first 10):', observed.authSeqIds.slice(0, 10));

        const formattedFamily = formatFamilyShort(family);
        const displayName = formattedFamily
          ? `${pdbId}:${chainId} (${formattedFamily})`
          : `${pdbId}:${chainId}`;

        dispatch(addSequence({
          id        : key,
          name      : displayName,
          sequence  : result.aligned_sequence,
          originType: 'pdb',
          chainRef  : { pdbId, chainId },
          family,
        }));

        dispatch(setPositionMapping({
          sequenceId: key,
          mapping: positionMapping,
        }));

        return {
          sequenceId: key,
          alignedSequence: result.aligned_sequence,
          mapping: positionMapping,
        };
      } catch (err: any) {
        const message = err?.data?.detail || err?.message || 'Alignment failed';
        setError(message);
        throw new Error(message);
      } finally {
        inFlightRef.current.delete(key);
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