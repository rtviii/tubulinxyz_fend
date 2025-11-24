// src/app/msa-viewer/hooks/useSequenceAligner.ts
import { MolstarService } from "@/components/molstar/molstar_service";
import { useCallback, useState } from "react";
import { useSequenceStructureRegistry } from "./useSequenceStructureSync";
import { useAlignSequenceMsaprofileSequencePostMutation } from "@/store/tubxz_api";

export function useSequenceAligner(registry: ReturnType<typeof useSequenceStructureRegistry>) {
  const [isAligning, setIsAligning] = useState(false);
  const [currentChain, setCurrentChain] = useState<string | null>(null);
  
  const [alignSequence] = useAlignSequenceMsaprofileSequencePostMutation();

  const alignAndRegisterChain = useCallback(
    async (
      pdbId: string,
      chainId: string,
      service: MolstarService,
      mutations: any[] = [],
      modifications: any[] = []
    ) => {
      setIsAligning(true);
      setCurrentChain(chainId);

      console.log('🔍 Aligning with mutations:', mutations);
      console.log('🔍 Aligning with modifications:', modifications);

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

        console.log('✅ Registering sequence with mutations:', mutations.length);

        registry.addSequence(
          `${pdbId}_${chainId}`,
          `${pdbId}_${chainId}`,
          result.aligned_sequence,
          {
            type: 'pdb',
            pdbId,
            chainId,
            positionMapping,
            mutations,
            modifications
          }
        );
      } catch (error: any) {
        throw new Error(`Alignment failed: ${error.message || 'Unknown error'}`);
      } finally {
        setIsAligning(false);
        setCurrentChain(null);
      }
    },
    [registry, alignSequence]
  );

  return { alignAndRegisterChain, isAligning, currentChain };
}