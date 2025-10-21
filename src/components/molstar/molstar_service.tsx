import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from 'react-redux';
import { MolstarViewer } from './molstar_viewer';
import { MolstarController } from './_molstar_controller';
import { AppStore, RootState, useAppDispatch } from '@/store/store';

type MolstarInstanceId = 'main' | 'auxiliary';

interface MolstarService {
    viewer: MolstarViewer;
    controller: MolstarController;
    instanceId: MolstarInstanceId;
}

interface MolstarContextValue {
    getService: (id: MolstarInstanceId) => MolstarService | undefined;
    registerService: (id: MolstarInstanceId, service: MolstarService) => void;
    unregisterService: (id: MolstarInstanceId) => void;
}

export const MolstarContext = React.createContext<MolstarContextValue | null>(null);

export function MolstarProvider({ children }: { children: React.ReactNode }) {
    const servicesRef = useRef(new Map<MolstarInstanceId, MolstarService>());

    const value = useMemo(() => ({
        getService: (id: MolstarInstanceId) => servicesRef.current.get(id),
        registerService: (id: MolstarInstanceId, service: MolstarService) => {
            console.log(`📝 Registering service: ${id}`);
            servicesRef.current.set(id, service);
        },
        unregisterService: (id: MolstarInstanceId) => {
            console.log(`🗑️ Unregistering service: ${id}`);
            const service = servicesRef.current.get(id);
            if (service) {
                service.viewer.dispose();
            }
            servicesRef.current.delete(id);
        }
    }), []);

    return <MolstarContext.Provider value={value}>{children}</MolstarContext.Provider>;
}

export const useMolstarService = (
    containerRef: React.RefObject<HTMLDivElement>,
    instanceId: MolstarInstanceId = 'main'
) => {
    const context = useContext(MolstarContext);
    const [isInitialized, setIsInitialized] = useState(false);
    const dispatch = useAppDispatch();
    const store = useStore<AppStore>();
    
    // Track if we've already initialized to prevent double-init
    const initAttemptedRef = useRef(false);
    const serviceInstanceRef = useRef<MolstarService | null>(null);

    const getState = useCallback((): RootState => {
        return store.getState();
    }, [store]);

    // Use a separate effect to watch for ref becoming available
    const [isRefReady, setIsRefReady] = useState(false);

    useEffect(() => {
        // Check if ref is ready
        if (containerRef.current && !isRefReady) {
            console.log(`✓ Container ref became ready for ${instanceId}`);
            setIsRefReady(true);
        }
    });

    useEffect(() => {
        // Early returns for missing dependencies
        if (!context) {
            console.error(`❌ MolstarContext not found for ${instanceId}. Did you forget to wrap your app with MolstarProvider?`);
            return;
        }

        if (!isRefReady || !containerRef.current) {
            console.log(`⏳ Waiting for container ref for ${instanceId}...`);
            return;
        }

        // Prevent double initialization
        if (initAttemptedRef.current) {
            console.log(`✋ Already attempted init for ${instanceId}, skipping`);
            return;
        }

        initAttemptedRef.current = true;
        let didUnmount = false;

        const initMolstar = async () => {
            console.log(`🚀 Starting Molstar initialization: ${instanceId}`);
            console.log(`   Container element:`, containerRef.current);

            try {
                const viewer = new MolstarViewer();
                await viewer.init(containerRef.current!);

                if (didUnmount) {
                    console.log(`⚠️ Component unmounted during init: ${instanceId}`);
                    viewer.dispose();
                    return;
                }

                const controller = new MolstarController(viewer, dispatch, getState);
                const serviceInstance = { viewer, controller, instanceId };

                serviceInstanceRef.current = serviceInstance;
                context.registerService(instanceId, serviceInstance);
                setIsInitialized(true);
                
                console.log(`✅ Successfully initialized Molstar instance: ${instanceId}`);

            } catch (error) {
                console.error(`❌ Failed to initialize Molstar instance ${instanceId}:`, error);
                initAttemptedRef.current = false; // Allow retry on error
            }
        };

        initMolstar();

        return () => {
            console.log(`🧹 Cleanup for ${instanceId}`);
            didUnmount = true;
            
            if (serviceInstanceRef.current) {
                context.unregisterService(instanceId);
                serviceInstanceRef.current = null;
            }
            
            setIsInitialized(false);
            initAttemptedRef.current = false;
        };
    }, [isRefReady, instanceId, context, dispatch, getState]);

    return {
        service: context?.getService(instanceId) ?? null,
        isInitialized,
    };
}