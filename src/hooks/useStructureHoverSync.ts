// src/hooks/useStructureHoverSync.ts

import { useEffect, useRef } from 'react';
import { useAppDispatch } from '@/store/store';
import { setComponentHovered } from '@/components/molstar/state/molstarInstancesSlice';
import type { MolstarInstance } from '@/components/molstar/services/MolstarInstance';
import type { MolstarInstanceId, ViewMode } from '@/components/molstar/core/types';
import type { PolymerComponent, LigandComponent } from '@/components/molstar/core/types';

interface UseStructureHoverSyncOpts {
  instanceId: MolstarInstanceId;
  instance: MolstarInstance | null;
  polymerComponents: PolymerComponent[];
  ligandComponents: LigandComponent[];
  viewMode: ViewMode;
}

export function useStructureHoverSync({
  instanceId,
  instance,
  polymerComponents,
  ligandComponents,
  viewMode,
}: UseStructureHoverSyncOpts) {
  const dispatchRef = useRef(useAppDispatch());
  const prevKeyRef = useRef<string | null>(null);
  const viewModeRef = useRef(viewMode);

  const ligandLookupRef = useRef(new Map<string, string>());
  const chainIdsRef = useRef(new Set<string>());

  useEffect(() => {
    viewModeRef.current = viewMode;

    // If we just switched to monomer mode, clean up any active hover
    if (viewMode === 'monomer' && prevKeyRef.current && instance) {
      dispatchRef.current(setComponentHovered({
        instanceId, componentKey: prevKeyRef.current, hovered: false
      }));
      instance.hideComponentLabel();
      prevKeyRef.current = null;
    }
  }, [viewMode, instance, instanceId]);

  useEffect(() => {
    const map = new Map<string, string>();
    for (const lig of ligandComponents) {
      map.set(`${lig.authAsymId}_${lig.authSeqId}`, lig.uniqueKey);
    }
    ligandLookupRef.current = map;
  }, [ligandComponents]);

  useEffect(() => {
    chainIdsRef.current = new Set(polymerComponents.map(p => p.chainId));
  }, [polymerComponents]);

  useEffect(() => {
    if (!instance) return;

    const unsubscribe = instance.viewer.subscribeToHover((info) => {
      // Skip entirely in monomer mode
      if (viewModeRef.current === 'monomer') return;

      const prev = prevKeyRef.current;
      const dispatch = dispatchRef.current;

      if (!info) {
        if (prev) {
          dispatch(setComponentHovered({ instanceId, componentKey: prev, hovered: false }));
          instance.hideComponentLabel();
          prevKeyRef.current = null;
        }
        return;
      }

      let key: string | null = null;
      const ligKey = ligandLookupRef.current.get(`${info.chainId}_${info.authSeqId}`);
      if (ligKey) {
        key = ligKey;
      } else if (chainIdsRef.current.has(info.chainId)) {
        key = info.chainId;
      }

      if (key === prev) return;

      if (prev) {
        dispatch(setComponentHovered({ instanceId, componentKey: prev, hovered: false }));
      }

      if (key) {
        dispatch(setComponentHovered({ instanceId, componentKey: key, hovered: true }));
        instance.showComponentLabel(key);
      } else {
        instance.hideComponentLabel();
      }

      prevKeyRef.current = key;
    });

    return () => {
      unsubscribe();
      instance.hideComponentLabel();
      prevKeyRef.current = null;
    };
  }, [instance, instanceId]);
}