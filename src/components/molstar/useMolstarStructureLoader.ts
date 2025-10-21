import { useAppDispatch } from "@/store/store";
import { MolstarController } from "./molstar_controller";
import { TubulinClass, TubulinClassification } from "./molstar_preset";
import { useCallback, useState } from "react";
import { selectStructure, setError, setLoading } from "@/store/slices/tubulin_structures";
import { fetchRcsbGraphQlData } from "@/services/rcsb_graphql_service";
import { createTubulinClassificationMap } from "@/services/gql_parser";

export type StructureSource = 'rcsb' | 'backend' | 'file';

interface LoadOptions {
  applyStylizedLighting?: boolean;
  customClassification?: TubulinClassification;
}

interface LoadResult {
  success: boolean;
  pdbId: string;
  classification?: TubulinClassification;
}

/**
 * Custom hook for loading structures into Molstar with automatic cleanup and state management
 */
export function useMolstarStructureLoader(controller: MolstarController | null) {
  const dispatch = useAppDispatch();
  const [currentLoadedPdbId, setCurrentLoadedPdbId] = useState<string | null>(null);

  /**
   * Core loading function with automatic cleanup
   */
  const loadWithCleanup = useCallback(async (
    pdbId: string,
    loadFunction: () => Promise<TubulinClassification>,
    options: LoadOptions = {}
  ): Promise<LoadResult> => {
    if (!controller) {
      console.error('Controller not available');
      return { success: false, pdbId };
    }

    const { applyStylizedLighting = true } = options;

    try {
      // Clean up previous structure
      await controller.clearCurrentStructure();
      
      // Update Redux state
      dispatch(selectStructure(pdbId));
      dispatch(setLoading(true));
      dispatch(setError(null));

      // Execute the load function
      const classification = await loadFunction();

      // Apply visual enhancements
      if (applyStylizedLighting && controller.viewer.ctx) {
        await controller.viewer.representations.stylized_lighting();
      }

      setCurrentLoadedPdbId(pdbId);
      
      return { success: true, pdbId, classification };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      dispatch(setError(errorMessage));
      console.error(`Failed to load structure ${pdbId}:`, error);
      return { success: false, pdbId };

    } finally {
      dispatch(setLoading(false));
    }
  }, [controller, dispatch]);

  /**
   * Load structure from RCSB with automatic classification fetching
   */
  const loadFromRCSB = useCallback(async (
    pdbId: string, 
    options?: LoadOptions
  ): Promise<LoadResult> => {
    const normalizedPdbId = pdbId.toUpperCase();
    
    return loadWithCleanup(normalizedPdbId, async () => {
      // Fetch classification from RCSB GraphQL
      const gqlData = await fetchRcsbGraphQlData(normalizedPdbId);
      const classification = createTubulinClassificationMap(gqlData);
      console.log(`Fetched classification for ${normalizedPdbId}:`, classification);
      
      
      // Load into Molstar
      await controller!.loadStructure(normalizedPdbId, classification);
      
      return classification;
    }, options);
  }, [loadWithCleanup, controller]);

  /**
   * Load structure from backend with optional custom classification
   */
  const loadFromBackend = useCallback(async (
    filename: string,
    options?: LoadOptions & { classification?: TubulinClassification }
  ): Promise<LoadResult> => {
    const pdbId = filename.split('_')[0].toUpperCase();
    
    return loadWithCleanup(pdbId, async () => {
      // Use provided classification or create default
      const classification = options?.customClassification || {
        A: TubulinClass.Alpha,
        B: TubulinClass.Beta
      };
      
      await controller!.loadStructureFromBackend(filename, classification);
      
      return classification;
    }, options);
  }, [loadWithCleanup, controller]);

  /**
   * Load structure from raw mmCIF data
   */
  const loadFromData = useCallback(async (
    pdbId: string,
    mmcifData: string,
    classification: TubulinClassification,
    options?: LoadOptions
  ): Promise<LoadResult> => {
    const normalizedPdbId = pdbId.toUpperCase();
    
    return loadWithCleanup(normalizedPdbId, async () => {
      // You'd need to add a method to controller for this
      await controller!.loadStructureFromData?.(normalizedPdbId, mmcifData, classification);
      return classification;
    }, options);
  }, [loadWithCleanup, controller]);

  /**
   * Load basic structure without classification (for non-tubulin structures)
   */
  const loadBasic = useCallback(async (
    pdbId: string,
    options?: LoadOptions
  ): Promise<LoadResult> => {
    const normalizedPdbId = pdbId.toUpperCase();
    
    return loadWithCleanup(normalizedPdbId, async () => {
      // Load with empty classification
      await controller!.loadStructure(normalizedPdbId, {});
      return {};
    }, options);
  }, [loadWithCleanup, controller]);

  /**
   * Check if a specific structure is currently loaded
   */
  const isLoaded = useCallback((pdbId: string): boolean => {
    return currentLoadedPdbId === pdbId.toUpperCase();
  }, [currentLoadedPdbId]);

  /**
   * Clear current structure
   */
  const clear = useCallback(async (): Promise<void> => {
    if (controller) {
      await controller.clearCurrentStructure();
      setCurrentLoadedPdbId(null);
    }
  }, [controller]);

  return {
    loadFromRCSB,
    loadFromBackend,
    loadFromData,
    loadBasic,
    isLoaded,
    clear,
    currentLoadedPdbId
  };
}