import { useCallback, useState } from "react";
import { useAppDispatch } from "@/store/store";
import { addSequence, setPositionMapping } from "@/store/slices/sequence_registry";
import { useAlignSequenceMsaSequencePostMutation } from "@/store/tubxz_api";
import { MolstarService } from "@/components/molstar/molstar_service";

export function useSequenceAligner() {
  const dispatch = useAppDispatch();
  const [isAligning, setIsAligning] = useState(false);
  const [currentChain, setCurrentChain] = useState<string | null>(null);
  const [alignSequence] = useAlignSequenceMsaSequencePostMutation();

  const alignAndRegisterChain = useCallback(
    async (pdbId: string, chainId: string, service: MolstarService) => {
      setIsAligning(true);
      setCurrentChain(chainId);

      try {
        const observed = service.controller.getObservedSequenceAndMapping(pdbId, chainId);
        if (!observed) throw new Error('Failed to get observed sequence');

        const result = await alignSequence({
          alignmentRequest: {
            sequence: observed.sequence,
            sequence_id: `${pdbId}_${chainId}`,
            auth_seq_ids: observed.authSeqIds,
            annotations: []
          }
        }).unwrap();

        const mapping = result.mapping;
        const positionMapping: Record<number, number> = {};
        mapping.forEach((msaPos: number, idx: number) => {
          if (msaPos !== -1) {
            positionMapping[msaPos] = observed.authSeqIds[idx];
          }
        });

        const sequenceId = `${pdbId}_${chainId}`;

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

      } finally {
        setIsAligning(false);
        setCurrentChain(null);
      }
    },
    [dispatch, alignSequence]
  );

  return { alignAndRegisterChain, isAligning, currentChain };
}