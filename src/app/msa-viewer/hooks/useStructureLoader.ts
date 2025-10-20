import { useEffect, useRef } from 'react';
import { useAppDispatch } from '@/store/store';
import { setLoading, setError } from '@/store/slices/tubulin_structures';

export function useStructureLoader(
  service: any,
  isInitialized: boolean,
  structureId: string,
  onLoadComplete?: () => void
) {
  const loadedRef = useRef(false);
  const dispatch = useAppDispatch();

  useEffect(() => {
    const loadStructure = async () => {
      if (loadedRef.current || !isInitialized || !service?.viewer?.ctx) {
        return;
      }

      loadedRef.current = true;
      dispatch(setLoading(true));

      try {
        await service.controller.loadStructure(structureId, {});
        onLoadComplete?.();
      } catch (e) {
        loadedRef.current = false;
        dispatch(setError(e instanceof Error ? e.message : "Failed to load structure"));
      } finally {
        dispatch(setLoading(false));
      }
    };

    loadStructure();
  }, [isInitialized, service, structureId, dispatch, onLoadComplete]);
}