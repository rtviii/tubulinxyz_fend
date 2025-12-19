// src/app/structures/structure_filters.tsx
"use client";

import React from "react";
import { Input, Select, TreeSelect, Tag } from "antd";
import {
    CollapsibleTrigger,
    CollapsibleContent,
    Collapsible
} from "@/components/ui/collapsible";
import { ChevronDown, Layers, LayoutGrid } from "lucide-react";

import {
    useGetTaxonomyTreeStructuresTaxonomyTreeTaxTypeGetQuery,
    useGetFamiliesStructuresFamiliesGetQuery,
    useGetFacetsStructuresFacetsGetQuery,
} from "@/store/tubxz_api";

import { useAppDispatch, useAppSelector } from "@/store/store";
import {
    set_structures_filter,
    update_grouped_by_deposition,
} from "@/store/slices/slice_structures";
import { set_polymers_filter as set_poly_filter_real } from "@/store/slices/slice_polymers";
import { getHexColor } from "@/lib/tubulin-colors";

// --- Custom Tag Renderer (Strict & High Contrast) ---
const tagRender = (props: any) => {
    const { label, value, closable, onClose } = props;
    const color = getHexColor(value);

    return (
        <Tag
            closable={closable}
            onClose={onClose}
            style={{
                marginRight: 4,
                marginTop: 2,
                marginBottom: 2,
                borderRadius: '2px', // Sharp corners
                backgroundColor: color,
                border: `1px solid rgba(0,0,0,0.2)`, // Visible edge
                fontWeight: 700,
                color: '#fff',
                fontSize: '10px',
                textTransform: 'uppercase',
                padding: '0px 6px',
                display: 'inline-flex',
                alignItems: 'center'
            }}
        >
            {label}
        </Tag>
    );
};

const FilterSection = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="space-y-1 mb-4">
        <label className="text-[10px] font-bold uppercase tracking-tight text-gray-900">
            {label}
        </label>
        {children}
    </div>
);

export const StructureFiltersComponent = ({ update_state }: { update_state: "structures" | "polymers" }) => {
    const dispatch = useAppDispatch();
    const { data: sourceTaxaTree } = useGetTaxonomyTreeStructuresTaxonomyTreeTaxTypeGetQuery({ taxType: "source" });
    const { data: familiesData } = useGetFamiliesStructuresFamiliesGetQuery();
    const { data: facets } = useGetFacetsStructuresFacetsGetQuery();

    const filters = useAppSelector((state) => (update_state === "structures" ? state.structures_page.filters : state.polymers_page.filters));
    const total_count = useAppSelector((state) => (update_state === "structures" ? state.structures_page?.total_count : state.polymers_page?.total_count) || 0);
    const grouped_by_deposition = useAppSelector((state) => state.structures_page?.grouped_by_deposition ?? true);

    const dispatchFilterUpdate = (filterType: string, value: any) => {
        const action = update_state === "structures" ? set_structures_filter : set_poly_filter_real;
        dispatch(action({ filter_type: filterType as any, value }));
    };

    const familyOptions = (familiesData ?? []).map((fam: any) => ({
        value: fam.family,
        label: fam.family.replace('tubulin_', '').replace('map_', '').toUpperCase(),
    }));

    const ligandOptions = (facets?.top_ligands ?? []).map((lig) => ({
        value: lig.chemical_id,
        label: lig.chemical_id,
    }));

    return (
        <div className="bg-white rounded-sm border border-gray-300 shadow-none overflow-visible">
            <Collapsible defaultOpen={true}>
                <CollapsibleTrigger className="w-full px-3 py-2 flex items-center justify-between border-b border-gray-200 bg-gray-50">
                    <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-900 text-xs uppercase tracking-tighter">Filters</span>
                        <span className="text-[10px] bg-blue-600 text-white px-1.5 py-0.1 rounded-sm font-bold">
                            {total_count}
                        </span>
                    </div>
                    <ChevronDown className="h-3 w-3 text-gray-500" />
                </CollapsibleTrigger>

                <CollapsibleContent className="overflow-visible">
                    <div className="p-3 space-y-1 overflow-visible">
                        <FilterSection label="Search">
                            <Input
                                placeholder="ID, title, keywords..."
                                className="rounded-sm border-gray-300 text-sm focus:border-blue-500 hover:border-gray-400"
                                value={filters.search || ""}
                                onChange={(e) => dispatchFilterUpdate("search", e.target.value || null)}
                            />
                        </FilterSection>

                        <div className="grid grid-cols-2 gap-2">
                            <FilterSection label="Year">
                                <div className="flex gap-1">
                                    <Input placeholder="From" className="rounded-sm border-gray-300 h-8 text-xs" value={filters.year?.[0] ?? ""} onChange={e => dispatchFilterUpdate("year", [e.target.value ? Number(e.target.value) : null, filters.year?.[1] ?? null])} />
                                    <Input placeholder="To" className="rounded-sm border-gray-300 h-8 text-xs" value={filters.year?.[1] ?? ""} onChange={e => dispatchFilterUpdate("year", [filters.year?.[0] ?? null, e.target.value ? Number(e.target.value) : null])} />
                                </div>
                            </FilterSection>
                            <FilterSection label="Res (Å)">
                                <div className="flex gap-1">
                                    <Input placeholder="Min" className="rounded-sm border-gray-300 h-8 text-xs" value={filters.resolution?.[0] ?? ""} onChange={e => dispatchFilterUpdate("resolution", [e.target.value ? Number(e.target.value) : null, filters.resolution?.[1] ?? null])} />
                                    <Input placeholder="Max" className="rounded-sm border-gray-300 h-8 text-xs" value={filters.resolution?.[1] ?? ""} onChange={e => dispatchFilterUpdate("resolution", [filters.resolution?.[0] ?? null, e.target.value ? Number(e.target.value) : null])} />
                                </div>
                            </FilterSection>
                        </div>

                        <FilterSection label="Protein Family">
                            <Select
                                mode="multiple"
                                style={{ width: '100%' }}
                                placeholder="Select families"
                                value={filters.family}
                                tagRender={tagRender}
                                options={familyOptions}
                                onChange={(v) => dispatchFilterUpdate("family", v)}
                                className="text-xs ant-select-custom"
                            />
                        </FilterSection>

                        <FilterSection label="Organism">
                            <TreeSelect
                                style={{ width: "100%" }}
                                value={filters.source_taxa}
                                dropdownStyle={{ maxHeight: 400, overflow: "auto" }}
                                placeholder="Select species"
                                multiple
                                allowClear
                                treeData={sourceTaxaTree ?? []}
                                onChange={(v) => dispatchFilterUpdate("source_taxa", v)}
                            />
                        </FilterSection>

                        <FilterSection label="Ligands">
                            <Select
                                mode="multiple"
                                style={{ width: '100%' }}
                                placeholder="Filter ligands"
                                value={filters.ligands}
                                tagRender={tagRender}
                                options={ligandOptions}
                                onChange={(v) => dispatchFilterUpdate('ligands', v)}
                            />
                        </FilterSection>

                        <div className="mt-4 pt-3 border-t border-gray-200">
                            <FilterSection label="Mutations">
                                <div className="space-y-2">
                                    <Select
                                        className="w-full h-8 text-xs"
                                        placeholder="Scope (e.g. BETA)"
                                        options={familyOptions}
                                        value={filters.mutation_family}
                                        onChange={(v) => dispatchFilterUpdate('mutation_family', v)}
                                    />

                                    <div className="flex gap-1">
                                        <button
                                            onClick={() => dispatchFilterUpdate('has_mutations', filters.has_mutations === true ? null : true)}
                                            className={`flex-1 py-1 text-[10px] font-bold uppercase border transition-none ${filters.has_mutations === true ? 'bg-blue-600 border-blue-700 text-white' : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'}`}
                                        >
                                            Mutant
                                        </button>
                                        <button
                                            onClick={() => dispatchFilterUpdate('has_mutations', filters.has_mutations === false ? null : false)}
                                            className={`flex-1 py-1 text-[10px] font-bold uppercase border transition-none ${filters.has_mutations === false ? 'bg-gray-900 border-black text-white' : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'}`}
                                        >
                                            Wild-type
                                        </button>
                                    </div>

                                    <div className="flex gap-1 items-center">
                                        <Input placeholder="Pos Min" className="h-7 text-xs rounded-sm" value={filters.mutation_position_min ?? ''} onChange={e => dispatchFilterUpdate('mutation_position_min', e.target.value ? Number(e.target.value) : null)} />
                                        <span className="text-gray-400 font-bold px-1">to</span>
                                        <Input placeholder="Pos Max" className="h-7 text-xs rounded-sm" value={filters.mutation_position_max ?? ''} onChange={e => dispatchFilterUpdate('mutation_position_max', e.target.value ? Number(e.target.value) : null)} />
                                    </div>

                                    <div className="flex gap-1">
                                        <Input placeholder="WT" maxLength={1} className="text-center font-mono h-7 text-xs uppercase rounded-sm border-gray-300" value={filters.mutation_from ?? ''} onChange={e => dispatchFilterUpdate('mutation_from', e.target.value.toUpperCase() || null)} />
                                        <Input placeholder="MUT" maxLength={1} className="text-center font-mono h-7 text-xs uppercase rounded-sm border-gray-300" value={filters.mutation_to ?? ''} onChange={e => dispatchFilterUpdate('mutation_to', e.target.value.toUpperCase() || null)} />
                                    </div>

                                    <Input
                                        placeholder="Phenotype (e.g. Taxol res.)"
                                        className="h-7 text-xs rounded-sm border-gray-300"
                                        value={filters.mutation_phenotype ?? ''}
                                        onChange={(e) => dispatchFilterUpdate('mutation_phenotype', e.target.value || null)}
                                    />
                                </div>
                            </FilterSection>
                        </div>
                    </div>
                </CollapsibleContent>
            </Collapsible>
        </div>
    );
};

