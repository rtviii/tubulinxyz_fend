// src/hooks/usePolymerSearch.ts
import { useState, useMemo, useEffect } from 'react';
import {
    useListPolymersQuery,
    useListFamiliesQuery,
    useListLigandOptionsQuery,
    type ListPolymersApiArg,
} from '@/store/tubxz_api';

export interface PolymerSearchFilters {
    family: string[];
    isotype: string[];
    sourceTaxa: number[];
    uniprot: string;
    hasVariants: boolean | null;
    variantType: string | null;
    variantPosMin: number | null;
    variantPosMax: number | null;
    ligands: string[];
    seqLenMin: number | null;
    seqLenMax: number | null;
}

const DEFAULT_FILTERS: PolymerSearchFilters = {
    family: [],
    isotype: [],
    sourceTaxa: [],
    uniprot: '',
    hasVariants: null,
    variantType: null,
    variantPosMin: null,
    variantPosMax: null,
    ligands: [],
    seqLenMin: null,
    seqLenMax: null,
};

function useDebouncedValue<T>(value: T, delayMs: number): T {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const t = setTimeout(() => setDebounced(value), delayMs);
        return () => clearTimeout(t);
    }, [value, delayMs]);
    return debounced;
}

export function usePolymerSearch(lockedFamily?: string) {
    const [filters, setFilters] = useState<PolymerSearchFilters>(() => ({
        ...DEFAULT_FILTERS,
        family: lockedFamily ? [lockedFamily] : [],
    }));

    const [cursor, setCursor] = useState<string | null>(null);
    // Accumulate results across pages; reset when filters change
    const [accumulated, setAccumulated] = useState<import('@/store/tubxz_api').PolypeptideEntitySummary[]>([]);

    const filterKey = useMemo(() => JSON.stringify(filters), [filters]);
    useEffect(() => { setCursor(null); setAccumulated([]); }, [filterKey]);

    const debouncedFilters = useDebouncedValue(filters, 300);

    const queryArgs = useMemo((): ListPolymersApiArg => ({
        cursor,
        limit: 40,
        family: debouncedFilters.family.length ? debouncedFilters.family : null,
        isotype: debouncedFilters.isotype.length ? debouncedFilters.isotype : null,
        sourceTaxa: debouncedFilters.sourceTaxa.length
            ? debouncedFilters.sourceTaxa.join(',')
            : null,
        uniprot: debouncedFilters.uniprot.trim() || null,
        hasVariants: debouncedFilters.hasVariants,
        variantType: debouncedFilters.variantType,
        variantPosMin: debouncedFilters.variantPosMin,
        variantPosMax: debouncedFilters.variantPosMax,
        ligands: debouncedFilters.ligands.length
            ? debouncedFilters.ligands.join(',') as any
            : null,
        seqLenMin: debouncedFilters.seqLenMin,
        seqLenMax: debouncedFilters.seqLenMax,
    }), [cursor, debouncedFilters]);

    const { data, isFetching, isError } = useListPolymersQuery(queryArgs);
    const { data: familyOptions } = useListFamiliesQuery();

    // Append new page results to accumulated list
    useEffect(() => {
        if (!data?.data) return;
        if (cursor === null) {
            // First page (filters changed) -- replace
            setAccumulated(data.data);
        } else {
            // Subsequent page -- append
            setAccumulated(prev => [...prev, ...data.data]);
        }
    }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

    // Ligand autocomplete
    const [ligandSearch, setLigandSearch] = useState('');
    const debouncedLigandSearch = useDebouncedValue(ligandSearch, 250);
    const { data: ligandOptions } = useListLigandOptionsQuery(
        { search: debouncedLigandSearch || null, limit: 20 },
        { skip: !debouncedLigandSearch }
    );

    const updateFilter = <K extends keyof PolymerSearchFilters>(
        key: K, value: PolymerSearchFilters[K]
    ) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    };

    const toggleFamily = (f: string) => {
        // If family is locked, don't allow toggling
        if (lockedFamily) return;
        setFilters(prev => {
            const has = prev.family.includes(f);
            return { ...prev, family: has ? prev.family.filter(x => x !== f) : [...prev.family, f] };
        });
    };

    const addLigand = (chemId: string) => {
        setFilters(prev => ({
            ...prev,
            ligands: prev.ligands.includes(chemId) ? prev.ligands : [...prev.ligands, chemId],
        }));
        setLigandSearch('');
    };

    const removeLigand = (chemId: string) => {
        setFilters(prev => ({
            ...prev,
            ligands: prev.ligands.filter(l => l !== chemId),
        }));
    };

    const resetFilters = () => {
        setFilters({
            ...DEFAULT_FILTERS,
            family: lockedFamily ? [lockedFamily] : [],
        });
        setLigandSearch('');
    };

    return {
        filters,
        lockedFamily: lockedFamily ?? null,
        updateFilter,
        toggleFamily,
        addLigand,
        removeLigand,
        ligandSearch,
        setLigandSearch,
        ligandOptions: ligandOptions?.data ?? [],
        resetFilters,
        results: accumulated,
        totalCount: data?.total_count ?? 0,
        hasMore: data?.has_more ?? false,
        nextCursor: data?.next_cursor ?? null,
        loadMore: () => { if (data?.next_cursor) setCursor(data.next_cursor); },
        isFetching,
        isError,
        familyOptions: familyOptions ?? [],
    };
}