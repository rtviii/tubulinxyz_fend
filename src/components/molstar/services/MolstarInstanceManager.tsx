import React, { createContext, useContext, useRef, useMemo, useState, useEffect, useCallback } from 'react';
import { useStore } from 'react-redux';
import { MolstarViewer } from '../core/MolstarViewer';
import { MolstarInstance } from './MolstarInstance';
import { MolstarInstanceId } from '../core/types';
import { AppStore, useAppDispatch } from '@/store/store';

// ============================================================
// Context Type
// ============================================================

interface MolstarInstanceManagerContextValue {
  getInstance: (id: MolstarInstanceId) => MolstarInstance | null;
  registerInstance: (id: MolstarInstanceId, instance: MolstarInstance) => void;
  unregisterInstance: (id: MolstarInstanceId) => void;
}

const MolstarInstanceManagerContext = createContext<MolstarInstanceManagerContextValue | null>(null);

// ============================================================
// Provider
// ============================================================

export function MolstarInstanceManagerProvider({ children }: { children: React.ReactNode }) {
  const instancesRef = useRef(new Map<MolstarInstanceId, MolstarInstance>());

  const value = useMemo<MolstarInstanceManagerContextValue>(() => ({
    getInstance: (id) => instancesRef.current.get(id) ?? null,

    registerInstance: (id, instance) => {
      console.log(`[MolstarManager] Registering instance: ${id}`);
      instancesRef.current.set(id, instance);
    },

    unregisterInstance: (id) => {
      console.log(`[MolstarManager] Unregistering instance: ${id}`);
      const instance = instancesRef.current.get(id);
      if (instance) {
        instance.dispose();
        instancesRef.current.delete(id);
      }
    },
  }), []);

  return (
    <MolstarInstanceManagerContext.Provider value={value}>
      {children}
    </MolstarInstanceManagerContext.Provider>
  );
}

// ============================================================
// Hook: useMolstarInstance
// ============================================================

export function useMolstarInstance(
  containerRef: React.RefObject<HTMLDivElement | null>,
  instanceId: MolstarInstanceId
) {
  const context = useContext(MolstarInstanceManagerContext);
  const dispatch = useAppDispatch();
  const store = useStore<AppStore>();

  const [isInitialized, setIsInitialized] = useState(false);
  const [instance, setInstance] = useState<MolstarInstance | null>(null);

  // Track initialization to prevent double-init from StrictMode
  const initStateRef = useRef<'idle' | 'initializing' | 'ready' | 'disposed'>('idle');
  const viewerRef = useRef<MolstarViewer | null>(null);

  const getState = useCallback(() => store.getState(), [store]);

  useEffect(() => {
    if (!context) {
      console.error(`[${instanceId}] MolstarInstanceManagerContext not found`);
      return;
    }

    if (!containerRef.current) {
      return;
    }

    // Prevent double initialization
    if (initStateRef.current === 'initializing' || initStateRef.current === 'ready') {
      return;
    }

    initStateRef.current = 'initializing';

    const initInstance = async () => {
      console.log(`[${instanceId}] Initializing...`);

      try {
        // Clear container if it has leftover content from previous mount
        if (containerRef.current) {
          containerRef.current.innerHTML = '';
        }

        const viewer = new MolstarViewer();
        viewerRef.current = viewer;

        await viewer.init(containerRef.current!);

        // Check if we were disposed during async init
        if (initStateRef.current === 'disposed') {
          console.log(`[${instanceId}] Disposed during init, cleaning up`);
          viewer.dispose();
          return;
        }

        const molstarInstance = new MolstarInstance(instanceId, viewer, dispatch, getState);
        context.registerInstance(instanceId, molstarInstance);

        setInstance(molstarInstance);
        setIsInitialized(true);
        initStateRef.current = 'ready';

        console.log(`[${instanceId}] Initialized successfully`);
      } catch (error) {
        console.error(`[${instanceId}] Initialization failed:`, error);
        initStateRef.current = 'idle';
      }
    };

    initInstance();

    return () => {
      console.log(`[${instanceId}] Cleanup called, state: ${initStateRef.current}`);

      // Mark as disposed so async init knows to abort
      const wasReady = initStateRef.current === 'ready';
      initStateRef.current = 'disposed';

      if (wasReady) {
        context.unregisterInstance(instanceId);
        viewerRef.current = null;
        setInstance(null);
        setIsInitialized(false);
      }

      // Reset for potential re-mount
      setTimeout(() => {
        if (initStateRef.current === 'disposed') {
          initStateRef.current = 'idle';
        }
      }, 0);
    };
  }, [containerRef.current, instanceId, context, dispatch, getState]);

  return {
    instance,
    isInitialized,
  };
}

// ============================================================
// Hook: useExistingInstance (for components that need access without creating)
// ============================================================

export function useExistingInstance(instanceId: MolstarInstanceId): MolstarInstance | null {
  const context = useContext(MolstarInstanceManagerContext);
  return context?.getInstance(instanceId) ?? null;
}