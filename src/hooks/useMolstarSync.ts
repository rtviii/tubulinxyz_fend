// src/hooks/useMolstarSync.ts
import { useEffect } from 'react';
import { useAppSelector } from '@/store/store';
import { MolstarContext } from '@/components/molstar/molstar_service';
import React from 'react';

/**
 * Hook to automatically sync sequence selections with Molstar
 * Use this in your main page component to enable bidirectional communication
 */
export function useMolstarSync() {
  const molstarService = React.useContext(MolstarContext)?.getService('main');
  const syncSelection = useAppSelector(state => state.sequenceStructureSync.currentSelection);
  const syncHover = useAppSelector(state => state.sequenceStructureSync.currentHover);
  const isSelectionSyncEnabled = useAppSelector(state => state.sequenceStructureSync.isSelectionSyncEnabled);
  const isHoverSyncEnabled = useAppSelector(state => state.sequenceStructureSync.isHoverSyncEnabled);

  // Sync sequence selections to Molstar
  useEffect(() => {
    if (!molstarService?.controller || !isSelectionSyncEnabled) return;
    
    if (syncSelection && syncSelection.source === 'sequence') {
      console.log(`🔄 Syncing sequence selection to Molstar: ${syncSelection.chainId}:${syncSelection.startResidue}-${syncSelection.endResidue}`);
      
      // Create persistent selection component in Molstar
      molstarService.controller.selectResiduesRange(
        syncSelection.pdbId,
        syncSelection.chainId,
        syncSelection.startResidue,
        syncSelection.endResidue
      );
      
      // Also focus camera on the selection
      molstarService.controller.focusOnResidues(
        syncSelection.pdbId,
        syncSelection.chainId,
        syncSelection.startResidue,
        syncSelection.endResidue
      );
    } else if (!syncSelection) {
      // Clear all selections when no selection is active
      console.log(`🗑️ Clearing all Molstar selections`);
      molstarService.controller.clearResidueSelection();
    }
  }, [syncSelection, molstarService, isSelectionSyncEnabled]);

  // Sync hover events to Molstar (simplified for now)
  useEffect(() => {
    if (!molstarService?.controller || !isHoverSyncEnabled) return;
    
    if (syncHover && syncHover.source === 'sequence') {
      console.log(`👆 Syncing sequence hover to Molstar: ${syncHover.chainId}:${syncHover.residueNumber}`);
      
      // For now, just log hover events
      // TODO: Implement hover residue method if needed
      // molstarService.controller.hoverResidue(...);
    } else {
      // Clear hover when no hover state
      // TODO: Implement proper hover clearing if needed
      console.log(`👆 Clearing hover`);
    }
  }, [syncHover, molstarService, isHoverSyncEnabled]);

  return {
    isSelectionSyncEnabled,
    isHoverSyncEnabled,
    currentSelection: syncSelection,
    currentHover: syncHover
  };
}