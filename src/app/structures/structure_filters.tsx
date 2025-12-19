// src/app/structures/structure_filters.tsx
"use client";

import { Input } from "@/components/ui/input";
import {
    CollapsibleTrigger,
    CollapsibleContent,
    Collapsible,
} from "@/components/ui/collapsible";
import Select from "react-select";
import { TreeSelect } from "antd";
import { Button } from "@/components/ui/button";
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

const FilterSection = ({
    label,
    children,
}: {
    label: string;
    children: React.ReactNode;
}) => (
    <div className="space-y-2">
        <label className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
            {label}
        </label>
        {children}
    </div>
);

const RangeInputs = ({
    value,
    onChange,
    placeholders = ["Min", "Max"],
    step,
}: {
    value: [number | null, number | null] | undefined;
    onChange: (val: [number | null, number | null]) => void;
    placeholders?: [string, string];
    step?: number;
}) => (
    <div className="flex gap-2">
        <Input
            className="bg-white text-sm h-9 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            placeholder={placeholders[0]}
            type="number"
            step={step}
            value={value?.[0] ?? ""}
            onChange={(e) => {
                const val = e.target.value ? Number(e.target.value) : null;
                onChange([val, value?.[1] ?? null]);
            }}
        />
        <Input
            className="bg-white text-sm h-9 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            placeholder={placeholders[1]}
            type="number"
            step={step}
            value={value?.[1] ?? ""}
            onChange={(e) => {
                const val = e.target.value ? Number(e.target.value) : null;
                onChange([value?.[0] ?? null, val]);
            }}
        />
    </div>
);

export const StructureFiltersComponent = ({
    update_state,
}: {
    update_state: "structures" | "polymers";
}) => {
    const { data: sourceTaxaTree } =
        useGetTaxonomyTreeStructuresTaxonomyTreeTaxTypeGetQuery({
            taxType: "source",
        });
    const { data: familiesData } = useGetFamiliesStructuresFamiliesGetQuery();
    const { data: facets } = useGetFacetsStructuresFacetsGetQuery(); // <-- Add this

    const dispatch = useAppDispatch();

    const ligandOptions = (facets?.top_ligands ?? []).map((lig) => ({
        value: lig.chemical_id,
        label: `${lig.chemical_id} - ${lig.chemical_name || "Unknown"} (${lig.count})`,
    }));
    const total_count = useAppSelector((state) => {
        if (update_state === "structures")
            return state.structures_page?.total_count || 0;
        return state.polymers_page?.total_count || 0;
    });

    const filters = useAppSelector((state) => {
        if (update_state === "structures") return state.structures_page.filters;
        return state.polymers_page.filters;
    });

    const dispatchFilterUpdate = (filterType: string, value: any) => {
        if (update_state === "structures") {
            dispatch(
                set_structures_filter({ filter_type: filterType as any, value })
            );
        } else {
            dispatch(set_poly_filter_real({ filter_type: filterType as any, value }));
        }
    };

    const grouped_by_deposition = useAppSelector(
        (state) => state.structures_page?.grouped_by_deposition ?? true
    );

    const familyOptions = (familiesData ?? []).map((fam: any) => ({
        value: fam.family,
        label: `${fam.family} (${fam.count})`,
    }));

    const selectStyles = {
        control: (base: any) => ({ ...base, minHeight: 36, fontSize: 14 }),
        valueContainer: (base: any) => ({ ...base, padding: "2px 8px" }),
        multiValue: (base: any) => ({ ...base, fontSize: 12 }),
    };

    return (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-visible">
            <Collapsible defaultOpen={true}>
                <CollapsibleTrigger className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-3">
                        <span className="font-semibold text-gray-900">Filters</span>
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                            {total_count}
                        </span>
                    </div>
                    <ChevronDown className="h-4 w-4 text-gray-400" />
                </CollapsibleTrigger>

                <CollapsibleContent className="overflow-visible">
                    <div className="px-4 pb-4 space-y-5 border-t border-gray-100 pt-4 overflow-visible">
                        {/* Search */}
                        <FilterSection label="Search">
                            <Input
                                placeholder="ID, title, keywords..."
                                className="bg-gray-50 border-gray-200 h-9"
                                value={filters.search || ""}
                                onChange={(e) =>
                                    dispatchFilterUpdate("search", e.target.value || null)
                                }
                            />
                        </FilterSection>

                        {/* Year & Resolution side by side */}
                        <div className="grid grid-cols-2 gap-4">
                            <FilterSection label="Year">
                                <RangeInputs
                                    value={filters.year}
                                    onChange={(v) => dispatchFilterUpdate("year", v)}
                                    placeholders={["From", "To"]}
                                />
                            </FilterSection>

                            <FilterSection label="Resolution (Å)">
                                <RangeInputs
                                    value={filters.resolution}
                                    onChange={(v) => dispatchFilterUpdate("resolution", v)}
                                    placeholders={["Min", "Max"]}
                                    step={0.1}
                                />
                            </FilterSection>
                        </div>

                        {/* Families */}
                        <FilterSection label="Protein Family">
                            <Select
                                isMulti
                                options={familyOptions}
                                placeholder="Any family..."
                                styles={selectStyles}
                                value={familyOptions.filter((o: any) =>
                                    filters.family?.includes(o.value)
                                )}
                                onChange={(options) =>
                                    dispatchFilterUpdate(
                                        "family",
                                        options.map((o) => o.value)
                                    )
                                }
                            />
                        </FilterSection>

                        {/* Source Organism */}
                        <FilterSection label="Source Organism">
                            <TreeSelect
                                style={{ width: "100%" }}
                                value={filters.source_taxa}
                                dropdownStyle={{ maxHeight: 400, overflow: "auto" }}
                                showSearch
                                treeNodeFilterProp="title"
                                placeholder="Any organism..."
                                multiple
                                allowClear
                                treeData={sourceTaxaTree ?? []}
                                onChange={(v) => dispatchFilterUpdate("source_taxa", v)}
                                size="middle"
                            />
                        </FilterSection>
                        {/* Ligands */}
                        <Select
                            isMulti
                            options={ligandOptions}
                            placeholder="Search ligands..."
                            styles={{
                                ...selectStyles,
                                menu: (base) => ({ ...base, zIndex: 50 }),
                                menuList: (base) => ({ ...base, maxHeight: 300 }),
                            }}
                            value={ligandOptions.filter((o) => filters.ligands?.includes(o.value))}
                            onChange={(options) => dispatchFilterUpdate('ligands', options.map(o => o.value))}
                            formatOptionLabel={(option) => (
                                <div className="flex items-center justify-between w-full py-0.5">
                                    <span className="font-mono text-sm font-medium text-gray-900">{option.value}</span>
                                    <span className="text-xs text-gray-500 truncate ml-3 max-w-[180px]">
                                        {option.label.split(' - ')[1]?.split(' (')[0]}
                                    </span>
                                </div>
                            )}
                            getOptionLabel={(option) => `${option.value} ${option.label}`} // For search
                        />
                        <FilterSection label="Mutations">
                            <div className="space-y-3">
                                {/* Family scope selector */}
                                <Select
                                    isClearable
                                    options={familyOptions}
                                    placeholder="Any family..."
                                    styles={selectStyles}
                                    value={familyOptions.find(o => o.value === filters.mutation_family) || null}
                                    onChange={(option) => dispatchFilterUpdate('mutation_family', option?.value || null)}
                                />

                                {/* Toggle: has mutations */}
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => dispatchFilterUpdate('has_mutations',
                                            filters.has_mutations === true ? null : true)}
                                        className={`flex-1 px-3 py-1.5 text-xs rounded border transition-colors ${filters.has_mutations === true
                                                ? 'bg-amber-100 border-amber-300 text-amber-700'
                                                : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                                            }`}
                                    >
                                        With Mutations
                                    </button>
                                    <button
                                        onClick={() => dispatchFilterUpdate('has_mutations',
                                            filters.has_mutations === false ? null : false)}
                                        className={`flex-1 px-3 py-1.5 text-xs rounded border transition-colors ${filters.has_mutations === false
                                                ? 'bg-gray-700 border-gray-600 text-white'
                                                : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                                            }`}
                                    >
                                        Wild-type Only
                                    </button>
                                </div>

                                {/* Position range */}
                                <div className="flex gap-2 items-center">
                                    <span className="text-xs text-gray-500 w-8">Pos:</span>
                                    <Input
                                        placeholder="Min"
                                        type="number"
                                        className="flex-1 h-8 text-xs"
                                        value={filters.mutation_position_min ?? ''}
                                        onChange={e => dispatchFilterUpdate('mutation_position_min',
                                            e.target.value ? Number(e.target.value) : null)}
                                    />
                                    <span className="text-gray-400">-</span>
                                    <Input
                                        placeholder="Max"
                                        type="number"
                                        className="flex-1 h-8 text-xs"
                                        value={filters.mutation_position_max ?? ''}
                                        onChange={e => dispatchFilterUpdate('mutation_position_max',
                                            e.target.value ? Number(e.target.value) : null)}
                                    />
                                </div>

                                {/* From/To residues */}
                                <div className="flex gap-2 items-center">
                                    <Input
                                        placeholder="WT"
                                        maxLength={1}
                                        className="w-14 h-8 text-xs text-center font-mono uppercase"
                                        value={filters.mutation_from ?? ''}
                                        onChange={e => dispatchFilterUpdate('mutation_from',
                                            e.target.value?.toUpperCase() || null)}
                                    />
                                    <span className="text-gray-400 text-sm">→</span>
                                    <Input
                                        placeholder="Mut"
                                        maxLength={1}
                                        className="w-14 h-8 text-xs text-center font-mono uppercase"
                                        value={filters.mutation_to ?? ''}
                                        onChange={e => dispatchFilterUpdate('mutation_to',
                                            e.target.value?.toUpperCase() || null)}
                                    />
                                </div>

                                {/* Phenotype search */}
                                <Input
                                    placeholder="Phenotype (e.g., resistance, cancer)"
                                    className="h-8 text-xs"
                                    value={filters.mutation_phenotype ?? ''}
                                    onChange={e => dispatchFilterUpdate('mutation_phenotype',
                                        e.target.value || null)}
                                />

                                {/* Show helper text if family is selected */}
                                {filters.mutation_family && (
                                    <p className="text-[10px] text-gray-400 italic">
                                        Filtering mutations in {filters.mutation_family.replace('tubulin_', '')} tubulin
                                    </p>
                                )}
                            </div>
                        </FilterSection>

                        {/* Group Toggle */}
                        {update_state === "structures" && (
                            <Button
                                variant={grouped_by_deposition ? "default" : "outline"}
                                size="sm"
                                onClick={() =>
                                    dispatch(update_grouped_by_deposition(!grouped_by_deposition))
                                }
                                className="w-full"
                            >
                                {grouped_by_deposition ? (
                                    <>
                                        <Layers className="h-4 w-4 mr-2" /> Grouped by Deposition
                                    </>
                                ) : (
                                    <>
                                        <LayoutGrid className="h-4 w-4 mr-2" /> Individual
                                        Structures
                                    </>
                                )}
                            </Button>
                        )}
                    </div>
                </CollapsibleContent>
            </Collapsible>
        </div>
    );
};
