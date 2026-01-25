// src/hooks/annotations/usePolymerAnnotationsQuery.ts

import {
  useGetPolymerAnnotationsQuery,
  useGetPolymerLigandNeighborhoodsQuery,
} from '@/store/tubxz_api';

export interface UsePolymerAnnotationsQueryOptions {
  rcsbId: string | null;
  authAsymId: string | null;
  skip?: boolean;
}

/**
 * Pure data-fetching hook for polymer annotations.
 * Returns raw API responses - no transformations, no side effects.
 */
export function usePolymerAnnotationsQuery({ rcsbId, authAsymId, skip = false }: UsePolymerAnnotationsQueryOptions) {
  const shouldSkip = skip || !rcsbId || !authAsymId;
  const normalizedId = rcsbId?.toUpperCase() ?? '';

  const variantsQuery = useGetPolymerAnnotationsQuery(
    { rcsbId: normalizedId, authAsymId: authAsymId ?? '' },
    { skip: shouldSkip }
  );

  const ligandsQuery = useGetPolymerLigandNeighborhoodsQuery(
    { rcsbId: normalizedId, authAsymId: authAsymId ?? '' },
    { skip: shouldSkip }
  );

  return {
    variants: variantsQuery.data,
    ligands: ligandsQuery.data,
    isLoading: variantsQuery.isLoading || ligandsQuery.isLoading,
    isFetching: variantsQuery.isFetching || ligandsQuery.isFetching,
    isError: variantsQuery.isError || ligandsQuery.isError,
    error: variantsQuery.error || ligandsQuery.error,
    refetch: () => {
      variantsQuery.refetch();
      ligandsQuery.refetch();
    },
  };
}