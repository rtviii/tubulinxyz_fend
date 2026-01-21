// src/hooks/useSync.ts

import { useEffect, useRef, useMemo } from 'react';
import { SyncDispatcher } from '@/lib/controllers/SyncDispatcher';
import { MSAController } from '@/lib/controllers/MSAController';
import { StructureController } from '@/lib/controllers/StructureController';
import { MolstarInstance } from '@/components/molstar/services/MolstarInstance';
import { ResizableMSAContainerHandle } from '@/app/msalite/components/ResizableMSAContainer';
import { PositionMapping } from '@/lib/types/sync';

/**
 * Hook to create and manage a SyncDispatcher for coordinating MSA and Structure views.
 */
export function useSync(
  msaRef: React.RefObject<ResizableMSAContainerHandle>,
  molstarInstance: MolstarInstance | null,
  chainId: string | null,
  positionMapping: PositionMapping | null
) {
  // Create dispatcher once
  const dispatcherRef = useRef<SyncDispatcher>();

  if (!dispatcherRef.current) {
    dispatcherRef.current = new SyncDispatcher();
  }

  const dispatcher = dispatcherRef.current;

  // Setup MSA controller
  useEffect(() => {
    const msaController = new MSAController(msaRef);
    dispatcher.setMSAController(msaController);

    console.log('[useSync] MSA controller registered');
  }, [dispatcher, msaRef]);

  // Setup Structure controller
  useEffect(() => {
    const structureController = new StructureController(molstarInstance);
    dispatcher.setStructureController(structureController);

    console.log('[useSync] Structure controller registered');

    return () => {
      // Cleanup if instance changes
      structureController.setInstance(null);
    };
  }, [dispatcher, molstarInstance]);

  // Update context when chainId or positionMapping changes
  useEffect(() => {
    if (chainId && positionMapping) {
      dispatcher.setContext(chainId, positionMapping);
      console.log('[useSync] Context updated:', chainId, Object.keys(positionMapping).length, 'mappings');
    } else {
      dispatcher.clearContext();
      console.log('[useSync] Context cleared');
    }
  }, [dispatcher, chainId, positionMapping]);

  return dispatcher;
}

/**
 * Hook for simple hover/click handlers that dispatch to the sync system.
 */
export function useSyncHandlers(
  dispatcher: SyncDispatcher | null,
  chainId: string | null,
  positionMapping: PositionMapping | null
) {
  const handleResidueHover = useMemo(() => {
    return (seqId: string, msaPosition: number) => {
      if (!dispatcher || !chainId || !positionMapping) return;

      const authSeqId = positionMapping[msaPosition];
      if (authSeqId !== undefined) {
        dispatcher.dispatch({
          type: 'HIGHLIGHT_RESIDUE',
          chainId,
          authSeqId,
          msaPosition,
        });
      }
    };
  }, [dispatcher, chainId, positionMapping]);

  const handleResidueLeave = useMemo(() => {
    return () => {
      dispatcher?.dispatch({ type: 'CLEAR_HIGHLIGHT' });
    };
  }, [dispatcher]);

  const handleResidueClick = useMemo(() => {
    return (seqId: string, msaPosition: number) => {
      if (!dispatcher || !chainId || !positionMapping) return;

      const authSeqId = positionMapping[msaPosition];
      if (authSeqId !== undefined) {
        dispatcher.dispatch({
          type: 'FOCUS_RESIDUE',
          chainId,
          authSeqId,
          msaPosition,
        });
      }
    };
  }, [dispatcher, chainId, positionMapping]);

  return {
    handleResidueHover,
    handleResidueLeave,
    handleResidueClick,
  };
}