// src/hooks/useMonomerAnnotations.ts
import { useEffect } from 'react';
import { useAppDispatch } from '@/store/store';
import { setPrimaryChain } from '@/store/slices/annotationsSlice';
import { useChainAnnotationsData } from './useChainAnnotationsData';
import { useAnnotationVisibility } from './useAnnotationVisibility';
import { useViewerSync, MSAHandle } from './useViewerSync';
import { MolstarInstance } from '@/components/molstar/services/MolstarInstance';

interface UseMonomerAnnotationsOptions {
  rcsbId: string | null;
  authAsymId: string | null;
  molstarInstance: MolstarInstance | null;
  msaRef: React.RefObject<MSAHandle>;
}

/**
 * Convenience hook that wires together data fetching, visibility, and viewer sync.
 * Use this in page components.
 */
export function useMonomerAnnotations({
  rcsbId,
  authAsymId,
  molstarInstance,
  msaRef,
}: UseMonomerAnnotationsOptions) {
  const dispatch = useAppDispatch();
  const chainKey = rcsbId && authAsymId ? `${rcsbId.toUpperCase()}_${authAsymId}` : '';

  // Set as primary chain when entering monomer view
  useEffect(() => {
    if (chainKey) {
      dispatch(setPrimaryChain(chainKey));
    }
    return () => {
      dispatch(setPrimaryChain(null));
    };
  }, [chainKey, dispatch]);

  // Data fetching
  const { isLoading, isError, refetch } = useChainAnnotationsData({
    rcsbId,
    authAsymId,
  });

  // Visibility management
  const visibility = useAnnotationVisibility(chainKey);

  // Viewer synchronization
  const sync = useViewerSync({
    chainKey,
    molstarInstance,
    msaRef,
  });

  return {
    // Loading state
    isLoading,
    isError,
    refetch,
    
    // Data + visibility
    ...visibility,
    
    // Sync actions
    handleMSAHover: sync.handleMSAHover,
    handleMSAHoverEnd: sync.handleMSAHoverEnd,
    focusLigandSite: sync.focusLigandSite,
    focusMutation: sync.focusMutation,
  };
}