import { useCallback } from 'react';
import { useAppDispatch } from '@/store/store';
import { setLoading, setError, selectStructure } from '@/store/slices/tubulin_structures';
import { fetchRcsbGraphQlData } from '@/services/rcsb_graphql_service';
import { createTubulinClassificationMap } from '@/services/gql_parser';
import { TubulinClassification } from '@/components/molstar/molstar_preset';

type LoadSource = 'url' | 'manual' | 'backend' | 'initial';

interface LoadOptions {
  skipClassification?: boolean;
  skipLighting?: boolean;
  skipDispatch?: boolean; // For MSA viewer which doesn't use Redux for structure selection
}

export function useStructureLoading(service: any) {
  const dispatch = useAppDispatch();

  const loadStructureWithClassification = useCallback(async (
    pdbId: string,
    source: LoadSource = 'manual',
    options: LoadOptions = {}
  ): Promise<boolean> => {
    if (!service?.controller) {
      console.log('Service or controller not ready');
      return false;
    }

    const { 
      skipClassification = false, 
      skipLighting = false,
      skipDispatch = false 
    } = options;

    console.log(`🚀 Loading structure ${pdbId} from ${source}...`);

    // Clear current structure
    try {
      await service.controller.clearCurrentStructure();
    } catch (clearError) {
      console.warn('⚠️ Error during structure cleanup:', clearError);
    }

    // Update Redux state (skip for MSA viewer)
    if (!skipDispatch) {
      dispatch(selectStructure(pdbId));
      dispatch(setLoading(true));
      dispatch(setError(null));
    }

    try {
      let classificationMap: TubulinClassification = {};

      // Fetch classification unless skipped
      if (!skipClassification) {
        try {
          console.log(` Fetching classification for ${pdbId}...`);
          const gqlData = await fetchRcsbGraphQlData(pdbId);
          classificationMap = createTubulinClassificationMap(gqlData);
          console.log(` Classification map:`, classificationMap);
        } catch (classError) {
          console.warn(`️ Could not fetch classification for ${pdbId}:`, classError);
          // Continue with empty classification
        }
      }

      // Load structure with classification
      await service.controller._loadStructure(pdbId, classificationMap);

      // Apply lighting unless skipped
      if (!skipLighting) {
        await service.viewer.representations.stylized_lighting();
      }

      console.log(` Successfully loaded ${pdbId} from ${source}`);
      return true;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
      
      if (!skipDispatch) {
        dispatch(setError(errorMessage));
      }
      
      console.error(`❌ Failed to load ${pdbId} from ${source}:`, error);
      return false;

    } finally {
      if (!skipDispatch) {
        dispatch(setLoading(false));
      }
    }
  }, [service, dispatch]);

  return { loadStructureWithClassification };
}