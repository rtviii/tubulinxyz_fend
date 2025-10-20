import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from 'react-redux';
import { MolstarViewer } from './molstar_viewer';
import { MolstarController } from './molstar_controller'; // Assuming you keep this controller
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
    // Use a ref to hold the services map to prevent re-renders
    const servicesRef = useRef(new Map<MolstarInstanceId, MolstarService>());

    const value = useMemo(() => ({
        getService: (id: MolstarInstanceId) => servicesRef.current.get(id),
        registerService: (id: MolstarInstanceId, service: MolstarService) => {
            servicesRef.current.set(id, service);
        },
        unregisterService: (id: MolstarInstanceId) => {
            servicesRef.current.get(id)?.controller.dispose();
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

    const getState = useCallback((): RootState => {
        return store.getState();
    }, [store]);

    useEffect(() => {
        let didUnmount = false;
        let serviceInstance: MolstarService | null = null;

        const initMolstar = async () => {
            if (!containerRef.current || !context || didUnmount) {
                return;
            }

            console.log(`Initializing Molstar instance: ${instanceId}`);

            try {
                const viewer = new MolstarViewer();
                await viewer.init(containerRef.current);

                if (didUnmount) {
                    viewer.dispose();
                    return;
                }

                const controller = new MolstarController(viewer, dispatch, getState);
                serviceInstance = { viewer, controller, instanceId };

                context.registerService(instanceId, serviceInstance);
                setIsInitialized(true);
                console.log(`Successfully initialized Molstar instance: ${instanceId}`);

            } catch (error) {
                console.error(`Failed to initialize Molstar instance ${instanceId}:`, error);
            }
        };

        initMolstar();

        return () => {
            didUnmount = true;
            if (context && serviceInstance) {
                console.log(`Cleaning up Molstar instance: ${instanceId}`);
                context.unregisterService(instanceId);
                serviceInstance = null;
            }
            setIsInitialized(false);
        };
    }, [containerRef, instanceId, context, dispatch, getState]);

    return {
        service: context?.getService(instanceId) ?? null,
        isInitialized,
    };
};