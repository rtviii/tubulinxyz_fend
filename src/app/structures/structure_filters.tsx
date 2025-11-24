'use client';

import { Input } from '@/components/ui/input';
import { CollapsibleTrigger, CollapsibleContent, Collapsible } from '@/components/ui/collapsible';
import Select, { components } from 'react-select';
import { TreeSelect } from 'antd';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { BringToFrontIcon, Layers } from 'lucide-react';

// API Hooks
import {
    useGetTaxaDictStructuresTaxaDictAllGetQuery, // Hook for dictionary data
    useGetTubulinFamiliesPolymersFamiliesGetQuery
} from '@/store/tubxz_api';

// Redux
import { useAppDispatch, useAppSelector } from '@/store/store';
import { 
    set_structures_filter, 
    update_grouped_by_deposition 
} from '@/store/slices/slice_structures';
import { set_polymers_filter as set_poly_filter_real } from '@/store/slices/slice_polymers';

// --- Options Constants ---
const POLY_STATE_OPTIONS = [
    { value: 'monomer', label: 'Monomer' },
    { value: 'dimer', label: 'Dimer' },
    { value: 'oligomer', label: 'Oligomer' },
    { value: 'filament', label: 'Filament' },
    { value: 'unknown', label: 'Unknown' },
];

const groupStyles = {
    borderRadius: '5px',
    background: '#f2fcff'
};

// Fix React-Select generic type issue by using 'any' safely
export const Group = (props: any) => (
    <div style={groupStyles}>
        <components.Group {...props} />
    </div>
);

// --- Component ---
export const StructureFiltersComponent = ({ update_state }: { update_state: 'structures' | 'polymers' }) => {
    
    // 1. Data Fetching
    const { data: taxa_dict } = useGetTaxaDictStructuresTaxaDictAllGetQuery();
    const { data: tubulin_families } = useGetTubulinFamiliesPolymersFamiliesGetQuery();
    
    const dispatch = useAppDispatch();

    // 2. Selectors
    const total_count = useAppSelector(state => {
        if (update_state === 'structures') return state.structures_page?.total_count || 0;
        return state.polymers_page?.total_count || 0;
    });
    
    const filters = useAppSelector(state => {
        if (update_state === 'structures') return state.structures_page.filters;
        return state.polymers_page.filters;
    });

    // Helper to choose the right action based on context
    const dispatchFilterUpdate = (filterType: string, value: any) => {
        if (update_state === 'structures') {
            // @ts-ignore
            dispatch(set_structures_filter({ filter_type: filterType, value }));
        } else {
             // @ts-ignore
            dispatch(set_poly_filter_real({ filter_type: filterType, value }));
        }
    };

    const grouped_by_deposition = useAppSelector(state => state.structures_page?.grouped_by_deposition ?? true);

    // 3. Prepare Options
    const [familyOptions, setFamilyOptions] = useState<any[]>([]);

    useEffect(() => {
        if (tubulin_families) {
            setFamilyOptions(tubulin_families.map((fam: string) => ({
                value: fam,
                label: fam.charAt(0).toUpperCase() + fam.slice(1) + " Tubulin"
            })));
        }
    }, [tubulin_families]);

    return (
        <Collapsible className="p-4 border rounded-sm bg-slate-100 shadow-inner" defaultOpen={true}>
            <div className="flex items-center justify-between mb-2">
                <CollapsibleTrigger asChild className="hover:rounded-md cursor-pointer flex">
                    <div className="min-w-full font-semibold flex flex-row justify-between items-center">
                        <span>{update_state === 'structures' ? "Structure" : "Polymer"} Filters</span>
                        <span className="font-semibold text-xs bg-gray-200 px-2 py-1 rounded-full text-gray-700">
                             {total_count} results
                        </span>
                    </div>
                </CollapsibleTrigger>
            </div>

            <CollapsibleContent>
                <div className="space-y-4 pt-2">
                    {/* SEARCH */}
                    <Input
                        placeholder="Search (ID, Title, Keywords)"
                        className="bg-white"
                        value={filters.search || ''}
                        onChange={e => dispatchFilterUpdate('search', e.target.value)}
                    />

                    {/* YEAR & RESOLUTION ROW */}
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex-1">
                            <label className="text-xs font-semibold uppercase text-gray-500 mb-1 block">Year</label>
                            <div className="flex items-center gap-1">
                                <Input
                                    className="bg-white text-xs h-8"
                                    placeholder="Start"
                                    type="number"
                                    value={filters.year?.[0] || ''}
                                    onChange={e => dispatchFilterUpdate('year', [Number(e.target.value), filters.year?.[1] || null])}
                                />
                                <Input
                                    className="bg-white text-xs h-8"
                                    placeholder="End"
                                    type="number"
                                    value={filters.year?.[1] || ''}
                                    onChange={e => dispatchFilterUpdate('year', [filters.year?.[0] || null, Number(e.target.value)])}
                                />
                            </div>
                        </div>

                        <div className="flex-1">
                            <label className="text-xs font-semibold uppercase text-gray-500 mb-1 block">Resolution</label>
                            <div className="flex items-center gap-1">
                                <Input
                                    className="bg-white text-xs h-8"
                                    placeholder="Min"
                                    type="number"
                                    step={0.1}
                                    value={filters.resolution?.[0] || ''}
                                    onChange={e => dispatchFilterUpdate('resolution', [Number(e.target.value), filters.resolution?.[1] || null])}
                                />
                                <Input
                                    className="bg-white text-xs h-8"
                                    placeholder="Max"
                                    type="number"
                                    step={0.1}
                                    value={filters.resolution?.[1] || ''}
                                    onChange={e => dispatchFilterUpdate('resolution', [filters.resolution?.[0] || null, Number(e.target.value)])}
                                />
                            </div>
                        </div>
                    </div>

                    {/* TUBULIN SPECIFIC FILTERS */}
                    <div className="flex gap-4">
                        <div className="flex-1">
                            <label className="text-xs font-semibold uppercase text-gray-500 mb-1 block">State</label>
                            <Select
                                isMulti
                                options={POLY_STATE_OPTIONS}
                                placeholder="State..."
                                className="text-sm"
                                onChange={(options) => dispatchFilterUpdate('polymerization_state', options.map(o => o.value))}
                            />
                        </div>

                        <div className="flex-1">
                            <label className="text-xs font-semibold uppercase text-gray-500 mb-1 block">Families</label>
                            <Select
                                isMulti
                                options={familyOptions}
                                placeholder="Family..."
                                className="text-sm"
                                onChange={(options) => dispatchFilterUpdate('family', options.map(o => o.value))}
                            />
                        </div>
                    </div>

                    {/* TAXONOMY */}
                    <div className="space-y-2">
                        <label className="text-xs font-semibold uppercase text-gray-500 mb-1 block">Source Organism</label>
                        <TreeSelect
                            style={{ width: '100%' }}
                            value={filters.source_taxa}
                            dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
                            showSearch
                            treeNodeFilterProp="title"
                            placeholder="Select source organisms..."
                            multiple
                            allowClear
                            treeData={taxa_dict || []} 
                            onChange={v => dispatchFilterUpdate('source_taxa', v)}
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-semibold uppercase text-gray-500 mb-1 block">Host Organism</label>
                        <TreeSelect
                            style={{ width: '100%' }}
                            value={filters.host_taxa}
                            dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
                            showSearch
                            treeNodeFilterProp="title"
                            placeholder="Select host organisms..."
                            multiple
                            allowClear
                            treeData={taxa_dict || []}
                            onChange={v => dispatchFilterUpdate('host_taxa', v)}
                        />
                    </div>

                    {/* TOGGLE BUTTON */}
                    {update_state === 'structures' && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => dispatch(update_grouped_by_deposition(!grouped_by_deposition))}
                            className="flex items-center gap-2 mt-2 w-full"
                        >
                            {grouped_by_deposition ? (
                                <>
                                    <BringToFrontIcon className="h-4 w-4" />
                                    <span>Show Individual</span>
                                </>
                            ) : (
                                <>
                                    <Layers className="h-4 w-4" />
                                    <span>Group by Deposition</span>
                                </>
                            )}
                        </Button>
                    )}
                </div>
            </CollapsibleContent>
        </Collapsible>
    );
};