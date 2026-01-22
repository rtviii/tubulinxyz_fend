// src/hooks/useSync.ts

import { useEffect, useRef, useCallback } from 'react';
import { SyncDispatcher, MSAController, StructureController, PositionMapping, ResizableMSAContainerHandle } from '@/lib/sync';
import { MolstarInstance } from '@/components/molstar/services/MolstarInstance';

/**
 * Main sync hook - creates and manages the SyncDispatcher.
 */
export function useSync(
  msaRef: React.RefObject<ResizableMSAContainerHandle>,
  molstarInstance: MolstarInstance | null,
  chainId: string,
  positionMapping: PositionMapping | null
): SyncDispatcher | null {
  const dispatcherRef = useRef<SyncDispatcher | null>(null);

  if (!dispatcherRef.current) {
    dispatcherRef.current = new SyncDispatcher();
  }
  const dispatcher = dispatcherRef.current;

  // Connect MSA controller when ref is available
  useEffect(() => {
    const checkRef = () => {
      if (msaRef.current) {
        dispatcher.setMSAController(new MSAController(msaRef));
        return true;
      }
      return false;
    };

    if (checkRef()) return;

    const interval = setInterval(() => {
      if (checkRef()) clearInterval(interval);
    }, 100);

    return () => clearInterval(interval);
  }, [dispatcher, msaRef]);

  // Connect Structure controller when instance changes
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
 * Hook for MSA event handlers.
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
      dispatcher.dispatch({
        type: 'FOCUS_RESIDUE',
        chainId,
        msaPosition: position,
        authSeqId: positionMapping?.[position] ?? 0,
      });
    },
    [dispatcher, chainId, positionMapping]
  );

  return { handleResidueHover, handleResidueLeave, handleResidueClick };
}