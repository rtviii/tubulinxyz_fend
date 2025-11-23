// src/app/msa-viewer/hooks/useSequenceAligner.ts
import { useState } from 'react';
import { MolstarService } from '@/components/molstar/molstar_service';
import { useSequenceStructureRegistry } from './useSequenceStructureSync';
import { MsaToStructureMapping } from '../types';
import { AlignmentService } from '../alignment_service';

export function useSequenceAligner(registry: ReturnType<typeof useSequenceStructureRegistry>) {
    const [isAligning, setIsAligning] = useState(false);
    const [currentChain, setCurrentChain] = useState<string | null>(null);

    /**
     * Orchestrates the alignment process:
     * 1. Extract observed sequence & IDs from Molstar (Source of Truth)
     * 2. Send to Backend for alignment
     * 3. Process mapping (0-based MSA index -> AuthSeqId)
     * 4. Update Registry
     */
    const alignAndRegisterChain = async (
        pdbId: string,
        chainId: string,
        molstarService: MolstarService
    ) => {
        setIsAligning(true);
        setCurrentChain(chainId);

        try {
            // 1. EXTRACT FROM MOLSTAR
            // This ensures we are aligning exactly what the user sees
            const observedData = molstarService.controller.getObservedSequenceAndMapping(pdbId, chainId);

            if (!observedData) {
                throw new Error(`Could not extract sequence data for ${pdbId} chain ${chainId}`);
            }

            // Safety Check: The sequence string and the ID array must match in length
            if (observedData.sequence.length !== observedData.authSeqIds.length) {
                throw new Error(`Data mismatch in Molstar extraction: Sequence length (${observedData.sequence.length}) != ID count (${observedData.authSeqIds.length})`);
            }

            // 2. SEND TO BACKEND
            const sequenceId = `${pdbId}_${chainId}`;

            const result = await AlignmentService.alignSequence({
                sequence: observedData.sequence,
                sequence_id: sequenceId,
                auth_seq_ids: observedData.authSeqIds
            });

            // 3. TRANSFORM MAPPING
            // Backend returns: Array where index = MSA Col (0-based), Value = AuthSeqId or -1
            // Frontend App State: Map where Key = MSA Col (0-based), Value = AuthSeqId
            const positionMapping: MsaToStructureMapping = {};

            result.mapping.forEach((authId, msaIndexZeroBased) => {
                // Filter out gaps. Note: Backend might send -1 (number) or "-1" (string) depending on serialization
                if (authId !== -1 && authId !== "-1") {
                    // STRICT 0-BASED: We do NOT add 1 here.
                    positionMapping[msaIndexZeroBased] = authId;
                }
            });

            // 4. REGISTER RESULT
            registry.addSequence(
                sequenceId,
                sequenceId,
                result.aligned_sequence,
                {
                    type: 'pdb',
                    pdbId: pdbId,
                    chainId: chainId,
                    positionMapping: positionMapping
                }
            );

            // 5. UX: Focus the chain in the viewer
            await molstarService.controller.isolateChain(pdbId, chainId);

        } catch (error: any) {
            console.error("Alignment logic failed:", error);
            // Re-throw so the UI component can show an alert or toast
            throw error;
        } finally {
            setIsAligning(false);
            setCurrentChain(null);
        }
    };

    return {
        alignAndRegisterChain,
        isAligning,
        currentChain
    };
}