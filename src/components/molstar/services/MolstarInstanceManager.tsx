import React, { createContext, useContext, useRef, useMemo, useState, useEffect, useCallback } from 'react';
import { useStore } from 'react-redux';
import { MolstarViewer } from '../core/MolstarViewer';
import { MolstarInstance } from './MolstarInstance';
import { MolstarInstanceId } from '../core/types';
import { AppStore, useAppDispatch } from '@/store/store';

// ============================================================
// Context Type
// ============================================================

interface InstanceEntry {
  instance: MolstarInstance;
  viewer: MolstarViewer;
  container: HTMLDivElement | null;
}

interface MolstarInstanceManagerContextValue {
  getInstance: (id: MolstarInstanceId) => MolstarInstance | null;
  initializeInstance: (
    id: MolstarInstanceId,
    container: HTMLDivElement,
    dispatch: any,
    getState: () => any
  ) => Promise<MolstarInstance | null>;
  disposeInstance: (id: MolstarInstanceId) => void;
}

const MolstarInstanceManagerContext = createContext<MolstarInstanceManagerContextValue | null>(null);

// ============================================================
// Provider
// ============================================================

export function MolstarInstanceManagerProvider({ children }: { children: React.ReactNode }) {
  const entriesRef = useRef(new Map<MolstarInstanceId, InstanceEntry>());
  const initializingRef = useRef(new Set<MolstarInstanceId>());

  const value = useMemo<MolstarInstanceManagerContextValue>(() => ({
    getInstance: (id) => entriesRef.current.get(id)?.instance ?? null,

    initializeInstance: async (id, container, dispatch, getState) => {
      // If already initializing, wait and return existing
      if (initializingRef.current.has(id)) {
        console.log(`[MolstarManager] ${id} already initializing, waiting...`);
        // Poll until ready (simple approach)
        for (let i = 0; i < 50; i++) {
          await new Promise(r => setTimeout(r, 100));
          const entry = entriesRef.current.get(id);
          if (entry) return entry.instance;
        }
        return null;
      }

      // If we already have an instance for this container, reuse it
      const existing = entriesRef.current.get(id);
      if (existing && existing.container === container && existing.viewer.ctx) {
        console.log(`[MolstarManager] Reusing existing instance: ${id}`);
        return existing.instance;
      }

      // If we have an instance but different container, dispose old one
      if (existing) {
        console.log(`[MolstarManager] Container changed, disposing old instance: ${id}`);
        existing.viewer.dispose();
        entriesRef.current.delete(id);
      }

      initializingRef.current.add(id);
      console.log(`[MolstarManager] Creating new instance: ${id}`);

      try {
        const viewer = new MolstarViewer();
        await viewer.init(container);

        if (!viewer.ctx) {
          throw new Error('Viewer context not created');
        }

        const instance = new MolstarInstance(id, viewer, dispatch, getState);
        
        entriesRef.current.set(id, { instance, viewer, container });
        console.log(`[MolstarManager] Instance created: ${id}`);
        
        return instance;
      } catch (error) {
        console.error(`[MolstarManager] Failed to create instance ${id}:`, error);
        return null;
      } finally {
        initializingRef.current.delete(id);
      }
    },

    disposeInstance: (id) => {
      const entry = entriesRef.current.get(id);
      if (entry) {
        console.log(`[MolstarManager] Disposing instance: ${id}`);
        entry.viewer.dispose();
        entriesRef.current.delete(id);
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
  
  const getState = useCallback(() => store.getState(), [store]);

  // Track the container element
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  
  // Update container when ref changes
  useEffect(() => {
    if (containerRef.current !== container) {
      setContainer(containerRef.current);
    }
  });

  useEffect(() => {
    if (!context || !container) {
      return;
    }

    let cancelled = false;

    const init = async () => {
      console.log(`[${instanceId}] Requesting instance...`);
      
      const inst = await context.initializeInstance(instanceId, container, dispatch, getState);
      
      if (cancelled) {
        console.log(`[${instanceId}] Init completed but cancelled`);
        return;
      }

      if (inst) {
        setInstance(inst);
        setIsInitialized(true);
        console.log(`[${instanceId}] Ready`);
      } else {
        console.error(`[${instanceId}] Failed to get instance`);
      }
    };

    init();

    return () => {
      console.log(`[${instanceId}] Cleanup (not disposing - StrictMode safe)`);
      cancelled = true;
      // DON'T dispose here - let the provider manage lifecycle
      // The instance stays alive across StrictMode remounts
    };
  }, [context, container, instanceId, dispatch, getState]);

  // Actual disposal only on page navigation (unmount from DOM tree)
  useEffect(() => {
    return () => {
      // This runs on true unmount, not StrictMode double-mount
      // We use a timeout to distinguish - if we remount quickly, don't dispose
      const timeoutId = setTimeout(() => {
        console.log(`[${instanceId}] True unmount - disposing`);
        context?.disposeInstance(instanceId);
      }, 1000);

      return () => clearTimeout(timeoutId);
    };
  }, [instanceId, context]);

  return {
    instance,
    isInitialized,
  };
}

// ============================================================
// Hook: useExistingInstance
// ============================================================

export function useExistingInstance(instanceId: MolstarInstanceId): MolstarInstance | null {
  const context = useContext(MolstarInstanceManagerContext);
  const [instance, setInstance] = useState<MolstarInstance | null>(null);

  useEffect(() => {
    // Check periodically for instance availability
    const check = () => {
      const inst = context?.getInstance(instanceId) ?? null;
      if (inst !== instance) {
        setInstance(inst);
      }
    };
    
    check();
    const interval = setInterval(check, 200);
    return () => clearInterval(interval);
  }, [context, instanceId, instance]);

  return instance;
}