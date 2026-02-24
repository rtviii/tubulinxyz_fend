"use client";

import { useMemo } from "react";
import { Input, Select, TreeSelect, Tag, Tooltip } from "antd";
import type { TreeSelectProps } from "antd";
import {
    Collapsible,
    CollapsibleTrigger,
    CollapsibleContent,
} from "@/components/ui/collapsible";
import { ChevronDown, Info } from "lucide-react";
import { getHexColor } from "@/components/molstar/colors/tubulin-color-theme";

export type UiFilters = {
    search?: string;
    ids: string[];
    expMethod: string[];
    polyState: string[];
    family: string[];
    ligands: string[];
    uniprot: string[];

    resMin?: number;
    resMax?: number;
    yearMin?: number;
    yearMax?: number;

    sourceTaxa: number[];
    hostTaxa: number[];

    hasVariants?: boolean;
    variantFamily?: string;
    variantType?: string;
    variantPosMin?: number;
    variantPosMax?: number;
    variantWildType?: string;
    variantObserved?: string;
    variantSource?: string;
};

export type StructureFiltersPanelProps = {
    filters: UiFilters;
    facets?: any;
    sourceTaxTree?: TreeSelectProps["treeData"];
    hostTaxTree?: TreeSelectProps["treeData"];
    totalCount: number;
    searchText: string;
    onSearchTextChange: (v: string) => void;
    updateFilter: <K extends keyof UiFilters>(key: K, value: UiFilters[K]) => void;
    onClear: () => void;
};

function formatFamilyLabel(f: string) {
    const special: Record<string, string> = {
        tubulin_alpha             : "α-tubulin",
        tubulin_beta              : "β-tubulin",
        tubulin_gamma             : "γ-tubulin",
        tubulin_delta             : "δ-tubulin",
        tubulin_epsilon           : "ε-tubulin",
        map_eb_family             : "EB family",
        map_ckap5_chtog           : "CKAP5 / ch-TOG",
        map_ttll_glutamylase_short: "TTLL glutamylase (short)",
        map_ttll_glutamylase_long : "TTLL glutamylase (long)",
        map_ccp_deglutamylase     : "CCP deglutamylase",
    };
    if (special[f]) return special[f];
    return f
        .replace(/^tubulin_/, "")
        .replace(/^map_/, "")
        .split("_")
        .map((w) => (w.length <= 3 ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1)))
        .join(" ");
}

function formatLigandLabel(id: string, name?: string | null, count?: number) {
    const n = name ? name.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) : "";
    return count != null ? `${id} — ${n} (${count})` : `${id} — ${n}`;
}

const tagRender = (props: any) => {
    const { label, value, closable, onClose } = props;
    const color = getHexColor(value);
    return (
        <Tag
            closable={closable}
            onClose={onClose}
            style={{
                marginRight: 3,
                marginTop: 2,
                marginBottom: 2,
                borderRadius: "2px",
                backgroundColor: color,
                border: `1px solid rgba(0,0,0,0.15)`,
                fontWeight: 600,
                color: "#fff",
                fontSize: "9px",
                textTransform: "uppercase",
                padding: "0px 5px",
                display: "inline-flex",
                alignItems: "center",
            }}
        >
            {label}
        </Tag>
    );
};

const FilterSection = ({
    label,
    children,
}: {
    label: string;
    children: React.ReactNode;
}) => (
    <div className="space-y-1 mb-3">
        <label className="text-[10px] font-bold uppercase tracking-tight text-gray-700">
            {label}
        </label>
        {children}
    </div>
);

export function StructureFiltersPanel({
    filters,
    facets,
    sourceTaxTree,
    hostTaxTree,
    totalCount,
    searchText,
    onSearchTextChange,
    updateFilter,
    onClear,
}: StructureFiltersPanelProps) {
    const familyOptions = useMemo(
        () =>
            facets?.tubulin_families?.map((f: any) => ({
                value: f.value,
                label: `${formatFamilyLabel(f.value)} (${f.count})`,
            })) ?? [],
        [facets]
    );

    const ligandOptions = useMemo(
        () =>
            facets?.top_ligands?.map((l: any) => ({
                value: l.chemical_id,
                label: formatLigandLabel(l.chemical_id, l.chemical_name, l.count),
            })) ?? [],
        [facets]
    );

    const expMethodOptions = useMemo(
        () =>
            facets?.exp_methods?.map((m: any) => ({
                value: m.value,
                label: `${m.value} (${m.count})`,
            })) ?? [],
        [facets]
    );

    const variantFamilyOptions = useMemo(
        () =>
            facets?.variants_by_family?.map((v: any) => ({
                value: v.family,
                label: `${formatFamilyLabel(v.family)} (${v.structure_count})`,
            })) ?? [],
        [facets]
    );

    const positionRange = useMemo(() => {
        const fam = filters.variantFamily;
        if (!fam) return null;
        return facets?.variant_position_ranges?.find((r: any) => r.family === fam) ?? null;
    }, [facets, filters.variantFamily]);

    return (
        <div className="bg-white rounded border border-gray-200 overflow-visible">
            <Collapsible defaultOpen={true}>
                <CollapsibleTrigger className="w-full px-3 py-2 flex items-center justify-between border-b border-gray-100 bg-gray-50/80 hover:bg-gray-50">
                    <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-800 text-[11px] uppercase tracking-tight">
                            Filters
                        </span>
                        <Tooltip
                            title="Total count of unique PDB structures"
                            placement="right"
                        >
                            <span className="text-[10px] bg-blue-600 text-white px-1.5 py-0.5 rounded font-bold cursor-help flex items-center gap-1">
                                {totalCount.toLocaleString()}
                                <Info className="h-2.5 w-2.5 opacity-80" />
                            </span>
                        </Tooltip>
                    </div>
                    <ChevronDown className="h-3 w-3 text-gray-400" />
                </CollapsibleTrigger>

                <CollapsibleContent className="overflow-visible">
                    <div className="p-3 space-y-1 overflow-visible">
                        {/* Search */}
                        <FilterSection label="Search">
                            <Input
                                placeholder="ID, title, keywords..."
                                className="rounded border-gray-300 text-sm"
                                value={searchText}
                                onChange={(e) => onSearchTextChange(e.target.value)}
                                allowClear
                            />
                        </FilterSection>

                        {/* Year & Resolution */}
                        <div className="grid grid-cols-2 gap-2">
                            <FilterSection label="Year">
                                <div className="flex gap-1">
                                    <Input
                                        placeholder="From"
                                        className="rounded border-gray-300 h-7 text-xs"
                                        value={filters.yearMin ?? ""}
                                        onChange={(e) =>
                                            updateFilter(
                                                "yearMin",
                                                e.target.value ? Number(e.target.value) : undefined
                                            )
                                        }
                                    />
                                    <Input
                                        placeholder="To"
                                        className="rounded border-gray-300 h-7 text-xs"
                                        value={filters.yearMax ?? ""}
                                        onChange={(e) =>
                                            updateFilter(
                                                "yearMax",
                                                e.target.value ? Number(e.target.value) : undefined
                                            )
                                        }
                                    />
                                </div>
                            </FilterSection>

                            <FilterSection label="Res (A)">
                                <div className="flex gap-1">
                                    <Input
                                        placeholder="Min"
                                        className="rounded border-gray-300 h-7 text-xs"
                                        value={filters.resMin ?? ""}
                                        onChange={(e) =>
                                            updateFilter(
                                                "resMin",
                                                e.target.value ? Number(e.target.value) : undefined
                                            )
                                        }
                                    />
                                    <Input
                                        placeholder="Max"
                                        className="rounded border-gray-300 h-7 text-xs"
                                        value={filters.resMax ?? ""}
                                        onChange={(e) =>
                                            updateFilter(
                                                "resMax",
                                                e.target.value ? Number(e.target.value) : undefined
                                            )
                                        }
                                    />
                                </div>
                            </FilterSection>
                        </div>

                        {/* Exp Method */}
                        <FilterSection label="Method">
                            <Select
                                mode="multiple"
                                style={{ width: "100%" }}
                                placeholder="All methods"
                                value={filters.expMethod}
                                options={expMethodOptions}
                                onChange={(v) => updateFilter("expMethod", v)}
                                allowClear
                                size="small"
                            />
                        </FilterSection>

                        {/* Protein Family */}
                        <FilterSection label="Protein Family">
                            <Select
                                mode="multiple"
                                style={{ width: "100%" }}
                                placeholder="Select families"
                                value={filters.family}
                                tagRender={tagRender}
                                options={familyOptions}
                                onChange={(v) => updateFilter("family", v)}
                                allowClear
                                size="small"
                            />
                        </FilterSection>

                        {/* Source Organism */}
                        <FilterSection label="Source Organism">
                            <TreeSelect
                                style={{ width: "100%" }}
                                value={filters.sourceTaxa}
                                dropdownStyle={{ maxHeight: 400, overflow: "auto" }}
                                placeholder="Select species"
                                multiple
                                allowClear
                                treeCheckable
                                showCheckedStrategy={TreeSelect.SHOW_PARENT}
                                treeData={sourceTaxTree ?? []}
                                onChange={(v) => updateFilter("sourceTaxa", v)}
                                size="small"
                            />
                        </FilterSection>

                        {/* Host Organism */}
                        <FilterSection label="Host Organism">
                            <TreeSelect
                                style={{ width: "100%" }}
                                value={filters.hostTaxa}
                                dropdownStyle={{ maxHeight: 400, overflow: "auto" }}
                                placeholder="Select hosts"
                                multiple
                                allowClear
                                treeCheckable
                                showCheckedStrategy={TreeSelect.SHOW_PARENT}
                                treeData={hostTaxTree ?? []}
                                onChange={(v) => updateFilter("hostTaxa", v)}
                                size="small"
                            />
                        </FilterSection>

                        {/* Ligands */}
                        <FilterSection label="Ligands">
                            <Select
                                mode="multiple"
                                style={{ width: "100%" }}
                                placeholder="Filter ligands"
                                value={filters.ligands}
                                tagRender={tagRender}
                                options={ligandOptions}
                                onChange={(v) => updateFilter("ligands", v)}
                                allowClear
                                size="small"
                            />
                        </FilterSection>

                        {/* Variants Section */}
                        <div className="mt-3 pt-3 border-t border-gray-100">
                            <FilterSection label="Variants">
                                <div className="space-y-2">
                                    {/* Has variants toggle */}
                                    <div className="flex gap-1">
                                        <button
                                            onClick={() =>
                                                updateFilter(
                                                    "hasVariants",
                                                    filters.hasVariants === true ? undefined : true
                                                )
                                            }
                                            className={`flex-1 py-1 text-[10px] font-bold uppercase border rounded-sm transition-colors ${filters.hasVariants === true
                                                    ? "bg-blue-600 border-blue-700 text-white"
                                                    : "bg-white border-gray-300 text-gray-500 hover:bg-gray-50"
                                                }`}
                                        >
                                            Has Variants
                                        </button>
                                        <button
                                            onClick={() =>
                                                updateFilter(
                                                    "hasVariants",
                                                    filters.hasVariants === false ? undefined : false
                                                )
                                            }
                                            className={`flex-1 py-1 text-[10px] font-bold uppercase border rounded-sm transition-colors ${filters.hasVariants === false
                                                    ? "bg-gray-800 border-gray-900 text-white"
                                                    : "bg-white border-gray-300 text-gray-500 hover:bg-gray-50"
                                                }`}
                                        >
                                            No Variants
                                        </button>
                                    </div>

                                    {/* Variant family */}
                                    <Select
                                        style={{ width: "100%" }}
                                        placeholder="Variant family"
                                        value={filters.variantFamily}
                                        options={variantFamilyOptions}
                                        onChange={(v) => updateFilter("variantFamily", v || undefined)}
                                        allowClear
                                        size="small"
                                    />

                                    {/* Variant type */}
                                    <Select
                                        style={{ width: "100%" }}
                                        placeholder="Variant type"
                                        value={filters.variantType}
                                        options={[
                                            { value: "substitution", label: "Substitution" },
                                            { value: "insertion", label: "Insertion" },
                                            { value: "deletion", label: "Deletion" },
                                        ]}
                                        onChange={(v) => updateFilter("variantType", v || undefined)}
                                        allowClear
                                        size="small"
                                    />

                                    {/* Position range */}
                                    <div className="flex gap-1 items-center">
                                        <Input
                                            placeholder={positionRange ? `Min (${positionRange.min_position})` : "Pos Min"}
                                            className="h-7 text-xs rounded border-gray-300"
                                            value={filters.variantPosMin ?? ""}
                                            onChange={(e) =>
                                                updateFilter(
                                                    "variantPosMin",
                                                    e.target.value ? Number(e.target.value) : undefined
                                                )
                                            }
                                        />
                                        <span className="text-gray-400 text-xs px-1">to</span>
                                        <Input
                                            placeholder={positionRange ? `Max (${positionRange.max_position})` : "Pos Max"}
                                            className="h-7 text-xs rounded border-gray-300"
                                            value={filters.variantPosMax ?? ""}
                                            onChange={(e) =>
                                                updateFilter(
                                                    "variantPosMax",
                                                    e.target.value ? Number(e.target.value) : undefined
                                                )
                                            }
                                        />
                                    </div>

                                    {/* WT / Observed */}
                                    <div className="flex gap-1">
                                        <Input
                                            placeholder="WT"
                                            maxLength={1}
                                            className="text-center font-mono h-7 text-xs uppercase rounded border-gray-300"
                                            value={filters.variantWildType ?? ""}
                                            onChange={(e) =>
                                                updateFilter(
                                                    "variantWildType",
                                                    e.target.value ? e.target.value.toUpperCase() : undefined
                                                )
                                            }
                                        />
                                        <Input
                                            placeholder="OBS"
                                            maxLength={1}
                                            className="text-center font-mono h-7 text-xs uppercase rounded border-gray-300"
                                            value={filters.variantObserved ?? ""}
                                            onChange={(e) =>
                                                updateFilter(
                                                    "variantObserved",
                                                    e.target.value ? e.target.value.toUpperCase() : undefined
                                                )
                                            }
                                        />
                                    </div>

                                    {/* Variant source */}
                                    <Select
                                        style={{ width: "100%" }}
                                        placeholder="Variant source"
                                        value={filters.variantSource}
                                        options={[
                                            { value: "PDB", label: "PDB" },
                                            { value: "UNIPROT", label: "UniProt" },
                                            { value: "CLINVAR", label: "ClinVar" },
                                            { value: "GNOMAD", label: "gnomAD" },
                                        ]}
                                        onChange={(v) => updateFilter("variantSource", v || undefined)}
                                        allowClear
                                        size="small"
                                    />
                                </div>
                            </FilterSection>
                        </div>

                        {/* Clear button */}
                        <div className="pt-3 border-t border-gray-100">
                            <button
                                onClick={onClear}
                                className="w-full py-1.5 text-[10px] font-bold uppercase text-gray-500 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                            >
                                Clear All Filters
                            </button>
                        </div>
                    </div>
                </CollapsibleContent>
            </Collapsible>
        </div>
    );
}
