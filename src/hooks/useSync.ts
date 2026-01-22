// src/hooks/useSync.ts

import { useEffect, useRef, useMemo, useCallback } from 'react';
import { SyncDispatcher } from '@/lib/controllers/SyncDispatcher';
import { MSAController } from '@/lib/controllers/MSAController';
import { StructureController } from '@/lib/controllers/StructureController';
import { MolstarInstance } from '@/components/molstar/services/MolstarInstance';
import { ResizableMSAContainerHandle } from '@/app/msalite/components/ResizableMSAContainer';
import { PositionMapping } from '@/lib/types/sync';

/**
 * Main sync hook - creates and manages the SyncDispatcher.
 * Returns the dispatcher for use by other hooks/components.
 */
export function useSync(
  msaRef: React.RefObject<ResizableMSAContainerHandle>,
  molstarInstance: MolstarInstance | null,
  chainId: string,
  positionMapping: PositionMapping | null
): SyncDispatcher | null {
  const dispatcherRef = useRef<SyncDispatcher | null>(null);

  // Create dispatcher once
  if (!dispatcherRef.current) {
    dispatcherRef.current = new SyncDispatcher();
  }
  const dispatcher = dispatcherRef.current;

  // Update MSA controller when ref is available
  // In useSync hook - fix timing of MSA controller connection
  useEffect(() => {
    // Check periodically until msaRef is available
    const checkRef = () => {
      if (msaRef.current) {
        console.log('[useSync] MSA ref available, setting controller');
        dispatcher.setMSAController(new MSAController(msaRef));
        return true;
      }
      return false;
    };

    // Try immediately
    if (checkRef()) return;

    // If not available, poll briefly
    const interval = setInterval(() => {
      if (checkRef()) {
        clearInterval(interval);
      }
    }, 100);

    // Cleanup
    return () => clearInterval(interval);
  }, [dispatcher, msaRef]);

  // Update Structure controller when instance changes
  useEffect(() => {
    dispatcher.setStructureController(new StructureController(molstarInstance));
  }, [dispatcher, molstarInstance]);

  // Update context when chain/mapping changes
  useEffect(() => {
    if (chainId && positionMapping) {
      dispatcher.setContext(chainId, positionMapping);
    } else {
      dispatcher.clearContext();
    }
  }, [dispatcher, chainId, positionMapping]);

  // Subscribe to Molstar hover events
  useEffect(() => {
    if (!molstarInstance?.viewer) return;

    const unsubscribe = molstarInstance.viewer.subscribeToHover((info) => {
      if (info) {
        dispatcher.onMolstarHover(info.chainId, info.authSeqId);
      } else {
        dispatcher.onMolstarHoverEnd();
      }
    });

    return unsubscribe;
  }, [molstarInstance, dispatcher]);

  return dispatcher;
}

/**
 * Hook for MSA event handlers - connect MSA events to the dispatcher.
 */
export function useSyncHandlers(
  dispatcher: SyncDispatcher | null,
  chainId: string,
  positionMapping: PositionMapping | null
) {
  const handleResidueHover = useCallback(
    (seqId: string, position: number) => {
      dispatcher?.onMSAHover(position);
    },
    [dispatcher]
  );

  const handleResidueLeave = useCallback(() => {
    dispatcher?.onMSAHoverEnd();
  }, [dispatcher]);

  const handleResidueClick = useCallback(
    (seqId: string, position: number) => {
      if (!dispatcher || !chainId) return;

      // Focus on click
      dispatcher.dispatch({
        type: 'FOCUS_RESIDUE',
        chainId,
        msaPosition: position,
        authSeqId: positionMapping?.[position] ?? 0,
      });
    },
    [dispatcher, chainId, positionMapping]
  );

  return {
    handleResidueHover,
    handleResidueLeave,
    handleResidueClick,
  };
}