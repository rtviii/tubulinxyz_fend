// src/hooks/useAlignedChainAnnotations.ts
import { useEffect } from 'react';
import { useAppSelector } from '@/store/store';
import { selectPdbSequences } from '@/store/slices/sequence_registry';
import { selectChainEntry } from '@/store/slices/annotationsSlice';
import { useChainAnnotationsData } from './useChainAnnotationsData';

/**
 * Watches the sequence registry for PDB sequences and auto-fetches their annotations.
 * Place this at the page level to ensure aligned chains get their data.
 */
export function useAlignedChainAnnotations() {
  const pdbSequences = useAppSelector(selectPdbSequences);

  // For each PDB sequence, we need to check if we have annotations
  // and trigger fetch if not
  return pdbSequences.map(seq => {
    if (!seq.chainRef) return null;
    
    const chainKey = `${seq.chainRef.pdbId}_${seq.chainRef.chainId}`;
    
    return (
      <AlignedChainAnnotationFetcher
        key={chainKey}
        rcsbId={seq.chainRef.pdbId}
        authAsymId={seq.chainRef.chainId}
      />
    );
  });
}

/**
 * Invisible component that triggers annotation fetch for a single chain.
 * Using a component allows us to use hooks per-chain.
 */
function AlignedChainAnnotationFetcher({ 
  rcsbId, 
  authAsymId 
}: { 
  rcsbId: string; 
  authAsymId: string; 
}) {
  // This hook will fetch and store in Redux if not already present
  useChainAnnotationsData({ rcsbId, authAsymId });
  
  return null; // Renders nothing
}