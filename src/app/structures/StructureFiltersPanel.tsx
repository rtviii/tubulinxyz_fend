"use client";

import { useMemo, useState } from "react";
import { Input, Select, TreeSelect } from "antd";
import type { TreeSelectProps } from "antd";
import {
    Collapsible,
    CollapsibleTrigger,
    CollapsibleContent,
} from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { getHexForFamily, getHexForIsotype } from "@/components/molstar/colors/palette";

export type UiFilters = {
    search?: string;
    ids: string[];
    expMethod: string[];
    polyState: string[];
    family: string[];
    isotype: string[];
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

// ── Constants ──

const TUBULIN_FAMILIES = [
    "tubulin_alpha", "tubulin_beta", "tubulin_gamma", "tubulin_delta", "tubulin_epsilon",
] as const;

const FAMILY_SYMBOL: Record<string, string> = {
    tubulin_alpha: "\u03B1", tubulin_beta: "\u03B2", tubulin_gamma: "\u03B3",
    tubulin_delta: "\u03B4", tubulin_epsilon: "\u03B5",
};

// Ghost hex for alpha/beta filter pills
const FAMILY_GHOST_HEX: Record<string, string> = {
    tubulin_alpha: "#D4C4A8",
    tubulin_beta: "#B8C4D0",
    tubulin_gamma: "#A07CC0",
    tubulin_delta: "#5EAB70",
    tubulin_epsilon: "#D4C060",
};

function formatFamilyLabel(f: string) {
    const special: Record<string, string> = {
        tubulin_alpha: "\u03B1-tubulin", tubulin_beta: "\u03B2-tubulin",
        tubulin_gamma: "\u03B3-tubulin", tubulin_delta: "\u03B4-tubulin",
        tubulin_epsilon: "\u03B5-tubulin",
        map_eb_family: "EB family", map_ckap5_chtog: "CKAP5 / ch-TOG",
        map_ttll_glutamylase_short: "TTLL glutamylase (short)",
        map_ttll_glutamylase_long: "TTLL glutamylase (long)",
        map_ccp_deglutamylase: "CCP deglutamylase",
    };
    if (special[f]) return special[f];
    return f.replace(/^map_/, "").split("_")
        .map((w) => (w.length <= 3 ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1)))
        .join(" ");
}

// ── Shared sub-components ──

const FilterRow = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="space-y-0.5">
        <label className="text-[8px] font-semibold uppercase tracking-wider text-gray-400">
            {label}
        </label>
        {children}
    </div>
);

/** Pill with faint color hint when inactive, stronger outline + backlight when active */
function ColorPill({
    active, color, label, count, onClick,
}: {
    active: boolean; color: string; label: string; count?: number; onClick: () => void;
}) {
    return (
        <button
            onClick={onClick}
            className="px-1.5 py-px text-[9px] font-medium rounded-full border transition-all"
            style={active ? {
                borderColor: color,
                backgroundColor: `${color}18`,
                color: color,
                boxShadow: `0 0 6px ${color}30`,
            } : {
                borderColor: `${color}30`,
                backgroundColor: 'white',
                color: '#9ca3af',
            }}
            title={count != null ? `${count} structures` : undefined}
        >
            {label}
            {count != null && (
                <span className="ml-0.5 text-[7px] opacity-60">{count}</span>
            )}
        </button>
    );
}

// ── Panel wrapper ──
const PANEL = "bg-white/95 backdrop-blur-sm shadow-lg rounded-xl border border-slate-200/60";

function PanelHeader({ label, right }: { label: string; right?: React.ReactNode }) {
    return (
        <div className="px-3 py-1.5 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wide text-gray-500">
                {label}
            </span>
            {right}
        </div>
    );
}

/** Small info popover that matches the panel style */
function AnnotationInfo() {
    const [open, setOpen] = useState(false);
    return (
        <div className="relative">
            <button
                onClick={() => setOpen(o => !o)}
                className="text-[9px] text-gray-300 hover:text-gray-400 transition-colors cursor-help"
            >
                ?
            </button>
            {open && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
                    <div className="absolute right-0 top-5 z-50 w-64 p-2.5 rounded-lg border border-slate-200/60 bg-white/95 backdrop-blur-sm shadow-lg text-[10px] text-gray-500 leading-relaxed space-y-1.5">
                        <p>
                            <span className="font-medium text-gray-700">Structural annotations</span> are
                            sequence variants detected by aligning each chain against the family consensus.
                            These are real sequence differences observed in resolved PDB structures.
                        </p>
                        <p>
                            <span className="font-medium text-gray-700">Literature annotations</span> (Morisette
                            database) are curated mutations and PTMs from published studies. These are
                            associated with tubulin families, not individual structures, and appear in the
                            chain viewer when exploring a monomer.
                        </p>
                    </div>
                </>
            )}
        </div>
    );
}

// ── Variant type inline indicator ──
const VARIANT_TYPE_STYLE: Record<string, { label: string; color: string }> = {
    substitution: { label: "substitution", color: "#f97316" },
    insertion: { label: "insertion", color: "#22c55e" },
    deletion: { label: "deletion", color: "#ef4444" },
};

// ── Main Component ──

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

    const [advancedOpen, setAdvancedOpen] = useState(false);

    // ── Derived data ──

    const familyItems = useMemo(
        () => (facets?.tubulin_families ?? [])
            .filter((f: any) => (TUBULIN_FAMILIES as readonly string[]).includes(f.value))
            .map((f: any) => ({ value: f.value, count: f.count as number })),
        [facets]
    );

    // Map isotype prefixes to families for filtering coherence
    const ISOTYPE_FAMILY: Record<string, string> = {
        TUBA: "tubulin_alpha",
        TUBB: "tubulin_beta",
        TUBG: "tubulin_gamma",
        TUBD: "tubulin_delta",
        TUBE: "tubulin_epsilon",
    };

    const isotopeItems = useMemo(() => {
        const all = (facets?.isotypes ?? []).map((i: any) => ({ value: i.value, count: i.count as number }));
        // If specific tubulin families are selected, only show matching isotypes
        const selectedTubulinFamilies = filters.family.filter(f => (TUBULIN_FAMILIES as readonly string[]).includes(f));
        if (selectedTubulinFamilies.length === 0) return all;
        return all.filter(iso => {
            const prefix = Object.keys(ISOTYPE_FAMILY).find(p => iso.value.startsWith(p));
            if (!prefix) return true; // unknown prefix, show it
            return selectedTubulinFamilies.includes(ISOTYPE_FAMILY[prefix]);
        });
    }, [facets, filters.family]);

    // Combined ligand + MAP options
    const combinedOptions = useMemo(() => {
        const mapOpts = (facets?.tubulin_families ?? [])
            .filter((f: any) => !(TUBULIN_FAMILIES as readonly string[]).includes(f.value))
            .map((f: any) => ({
                value: `map:${f.value}`,
                label: formatFamilyLabel(f.value),
                count: f.count,
                kind: "map" as const,
            }));
        const ligOpts = (facets?.top_ligands ?? []).map((l: any) => ({
            value: `lig:${l.chemical_id}`,
            label: `${l.chemical_id} -- ${(l.chemical_name ?? "").toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase())}`,
            count: l.count,
            kind: "ligand" as const,
        }));
        return [...mapOpts, ...ligOpts];
    }, [facets]);

    const combinedValue = useMemo(() => {
        const mapVals = filters.family.filter(f => f.startsWith("map_")).map(f => `map:${f}`);
        const ligVals = filters.ligands.map(l => `lig:${l}`);
        return [...mapVals, ...ligVals];
    }, [filters.family, filters.ligands]);

    const handleCombinedChange = (values: string[]) => {
        const maps = values.filter(v => v.startsWith("map:")).map(v => v.slice(4));
        const ligs = values.filter(v => v.startsWith("lig:")).map(v => v.slice(4));
        const tubulinFams = filters.family.filter(f => !f.startsWith("map_"));
        updateFilter("family", [...tubulinFams, ...maps]);
        updateFilter("ligands", ligs);
    };

    const METHOD_SHORT: Record<string, string> = {
        "ELECTRON MICROSCOPY": "cryo-EM",
        "X-RAY DIFFRACTION": "X-ray",
        "SOLUTION NMR": "NMR",
    };

    const expMethodItems = useMemo(
        () => (facets?.exp_methods ?? []).map((m: any) => ({
            value: m.value,
            count: m.count as number,
        })),
        [facets]
    );

    const variantFamilyOptions = useMemo(
        () => (facets?.variants_by_family ?? []).map((v: any) => ({
            value: v.family,
            label: `${formatFamilyLabel(v.family)} (${v.structure_count})`,
        })),
        [facets]
    );

    const positionRange = useMemo(() => {
        const fam = filters.variantFamily ?? (filters.family.length === 1 ? filters.family[0] : null);
        if (!fam) return null;
        return facets?.variant_position_ranges?.find((r: any) => r.family === fam) ?? null;
    }, [facets, filters.variantFamily, filters.family]);

    const toggleInArray = (arr: string[], value: string) =>
        arr.includes(value) ? arr.filter(x => x !== value) : [...arr, value];

    /** Toggle a tubulin family and clear any isotype selections that no longer match */
    const handleFamilyToggle = (family: string) => {
        const newFamilies = toggleInArray(filters.family, family);
        updateFilter("family", newFamilies);

        // Clear isotype selections that don't belong to any selected family
        const selectedTubulin = newFamilies.filter(f => (TUBULIN_FAMILIES as readonly string[]).includes(f));
        if (selectedTubulin.length > 0 && filters.isotype.length > 0) {
            const validIsotypes = filters.isotype.filter(iso => {
                const prefix = Object.keys(ISOTYPE_FAMILY).find(p => iso.startsWith(p));
                if (!prefix) return true;
                return selectedTubulin.includes(ISOTYPE_FAMILY[prefix]);
            });
            if (validIsotypes.length !== filters.isotype.length) {
                updateFilter("isotype", validIsotypes);
            }
        }
    };

    return (
        <div className="space-y-2">
            {/* ════════════════════════════════════════════════
                PANEL 1: Structure
               ════════════════════════════════════════════════ */}
            <div className={PANEL}>
                <PanelHeader
                    label="Structures"
                    right={
                        <div className="flex items-center gap-2">
                            <span className="text-[9px] font-bold text-gray-400 tabular-nums">
                                {totalCount.toLocaleString()}
                            </span>
                            <button
                                onClick={onClear}
                                className="text-[8px] text-gray-300 hover:text-gray-500 uppercase tracking-wider font-medium transition-colors"
                            >
                                reset
                            </button>
                        </div>
                    }
                />
                <div className="px-3 pb-2.5 space-y-1.5">
                    <Input
                        placeholder="PDB ID, title, keywords..."
                        className="rounded-lg border-gray-200 text-[10px]"
                        value={searchText}
                        onChange={(e) => onSearchTextChange(e.target.value)}
                        allowClear
                        size="small"
                    />

                    <div className="grid grid-cols-2 gap-1.5">
                        <FilterRow label="Year">
                            <div className="flex gap-0.5">
                                <Input placeholder="From" className="rounded border-gray-200 h-5 text-[9px]"
                                    value={filters.yearMin ?? ""}
                                    onChange={(e) => updateFilter("yearMin", e.target.value ? Number(e.target.value) : undefined)} />
                                <Input placeholder="To" className="rounded border-gray-200 h-5 text-[9px]"
                                    value={filters.yearMax ?? ""}
                                    onChange={(e) => updateFilter("yearMax", e.target.value ? Number(e.target.value) : undefined)} />
                            </div>
                        </FilterRow>
                        <FilterRow label="Resolution">
                            <div className="flex gap-0.5">
                                <Input placeholder="Min" className="rounded border-gray-200 h-5 text-[9px]"
                                    value={filters.resMin ?? ""}
                                    onChange={(e) => updateFilter("resMin", e.target.value ? Number(e.target.value) : undefined)} />
                                <Input placeholder="Max" className="rounded border-gray-200 h-5 text-[9px]"
                                    value={filters.resMax ?? ""}
                                    onChange={(e) => updateFilter("resMax", e.target.value ? Number(e.target.value) : undefined)} />
                            </div>
                        </FilterRow>
                    </div>

                    <FilterRow label="Method">
                        <div className="flex flex-wrap gap-0.5">
                            {expMethodItems.map(item => (
                                <ColorPill
                                    key={item.value}
                                    active={filters.expMethod.includes(item.value)}
                                    color="#64748b"
                                    label={METHOD_SHORT[item.value] ?? item.value}
                                    count={item.count}
                                    onClick={() => updateFilter("expMethod", toggleInArray(filters.expMethod, item.value))}
                                />
                            ))}
                        </div>
                    </FilterRow>

                    <FilterRow label="Source Organism">
                        <TreeSelect
                            style={{ width: "100%" }}
                            value={filters.sourceTaxa}
                            styles={{ popup: { root: { maxHeight: 400, overflow: "auto" } } }}
                            placeholder="All species"
                            multiple allowClear treeCheckable
                            showCheckedStrategy={TreeSelect.SHOW_PARENT}
                            treeData={sourceTaxTree ?? []}
                            onChange={(v) => updateFilter("sourceTaxa", v)}
                            size="small" showSearch treeNodeFilterProp="title"
                        />
                    </FilterRow>

                    <FilterRow label="Host Organism">
                        <TreeSelect
                            style={{ width: "100%" }}
                            value={filters.hostTaxa}
                            styles={{ popup: { root: { maxHeight: 400, overflow: "auto" } } }}
                            placeholder="All hosts"
                            multiple allowClear treeCheckable
                            showCheckedStrategy={TreeSelect.SHOW_PARENT}
                            treeData={hostTaxTree ?? []}
                            onChange={(v) => updateFilter("hostTaxa", v)}
                            size="small" showSearch treeNodeFilterProp="title"
                        />
                    </FilterRow>
                </div>
            </div>

            {/* ════════════════════════════════════════════════
                PANEL 2: Classification
               ════════════════════════════════════════════════ */}
            <div className={PANEL}>
                <PanelHeader label="Classification" />
                <div className="px-3 pb-2.5 space-y-2">
                    <FilterRow label="Family">
                        <div className="flex flex-wrap gap-0.5">
                            {familyItems.map(item => {
                                const vivid = getHexForFamily(item.value);
                                const ghost = FAMILY_GHOST_HEX[item.value] ?? vivid;
                                const active = filters.family.includes(item.value);
                                return (
                                    <button
                                        key={item.value}
                                        onClick={() => handleFamilyToggle(item.value)}
                                        className="px-1.5 py-px text-[9px] font-medium rounded-full border transition-all"
                                        style={active ? {
                                            borderColor: ghost,
                                            backgroundColor: `${ghost}18`,
                                            color: ghost,
                                            boxShadow: `0 0 6px ${ghost}30`,
                                        } : {
                                            borderColor: `${vivid}35`,
                                            backgroundColor: 'white',
                                            color: '#9ca3af',
                                        }}
                                        title={`${item.count} structures`}
                                    >
                                        {FAMILY_SYMBOL[item.value] ?? item.value}
                                        <span className="ml-0.5 text-[7px] opacity-60">{item.count}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </FilterRow>

                    {isotopeItems.length > 0 && (() => {
                        type IsoItem = { value: string; count: number };
                        const alphaIso = isotopeItems.filter((i: IsoItem) => i.value.startsWith("TUBA"));
                        const betaIso = isotopeItems.filter((i: IsoItem) => i.value.startsWith("TUBB"));
                        const otherIso = isotopeItems.filter((i: IsoItem) => !i.value.startsWith("TUBA") && !i.value.startsWith("TUBB"));
                        const renderPills = (items: IsoItem[]) => items.map((item: IsoItem) => (
                            <ColorPill
                                key={item.value}
                                active={filters.isotype.includes(item.value)}
                                color={getHexForIsotype(item.value)}
                                label={item.value}
                                count={item.count}
                                onClick={() => updateFilter("isotype", toggleInArray(filters.isotype, item.value))}
                            />
                        ));
                        return (
                            <FilterRow label="Isotype">
                                <div className="space-y-1">
                                    {alphaIso.length > 0 && (
                                        <div className="flex items-center gap-1">
                                            <span className="text-[7px] text-gray-300 font-medium w-3 flex-shrink-0">{"\u03B1"}</span>
                                            <div className="flex flex-wrap gap-0.5">{renderPills(alphaIso)}</div>
                                        </div>
                                    )}
                                    {betaIso.length > 0 && (
                                        <div className="flex items-center gap-1">
                                            <span className="text-[7px] text-gray-300 font-medium w-3 flex-shrink-0">{"\u03B2"}</span>
                                            <div className="flex flex-wrap gap-0.5">{renderPills(betaIso)}</div>
                                        </div>
                                    )}
                                    {otherIso.length > 0 && (
                                        <div className="flex flex-wrap gap-0.5">{renderPills(otherIso)}</div>
                                    )}
                                </div>
                            </FilterRow>
                        );
                    })()}

                    <FilterRow label="Ligands / MAPs">
                        <Select
                            mode="multiple"
                            style={{ width: "100%" }}
                            placeholder="Search ligands or MAPs..."
                            value={combinedValue}
                            onChange={handleCombinedChange}
                            allowClear
                            size="small"
                            showSearch
                            filterOption={(input, option) =>
                                String(option?.label ?? "").toLowerCase().includes(input.toLowerCase())
                            }
                            optionRender={(option) => {
                                const data = option.data as any;
                                const isMap = String(data.value).startsWith("map:");
                                return (
                                    <div className="flex items-center gap-1.5 text-[10px]">
                                        {isMap ? (
                                            <img src="/landing/ligand_icon.svg" alt="" className="w-3 h-3 opacity-40 grayscale" />
                                        ) : (
                                            <img src="/landing/ligand_icon.svg" alt="" className="w-3 h-3 opacity-60" />
                                        )}
                                        <span className={`truncate ${isMap ? "text-violet-600" : ""}`}>{data.label}</span>
                                        {data.count != null && (
                                            <span className="ml-auto text-gray-300 flex-shrink-0">{data.count}</span>
                                        )}
                                    </div>
                                );
                            }}
                            tagRender={(props) => {
                                const { label, value, closable, onClose } = props;
                                const isMap = String(value).startsWith("map:");
                                return (
                                    <span
                                        className={`inline-flex items-center gap-0.5 px-1.5 py-px text-[8px] font-medium rounded-full mr-0.5 my-px border
                                            ${isMap
                                                ? "bg-violet-50 border-violet-200 text-violet-600"
                                                : "bg-emerald-50 border-emerald-200 text-emerald-600"
                                            }`}
                                    >
                                        {label}
                                        {closable && (
                                            <button onClick={onClose} className="ml-0.5 hover:opacity-70">&times;</button>
                                        )}
                                    </span>
                                );
                            }}
                            options={combinedOptions.map(o => ({
                                value: o.value,
                                label: o.label,
                                count: o.count,
                            }))}
                        />
                    </FilterRow>
                </div>
            </div>

            {/* ════════════════════════════════════════════════
                PANEL 3: Annotations
               ════════════════════════════════════════════════ */}
            <div className={PANEL}>
                <PanelHeader
                    label="Annotations"
                    right={<AnnotationInfo />}
                />
                <div className="px-3 pb-2.5 space-y-1.5">
                    {/* Variant type -- inline small text toggles */}
                    <div className="flex items-center gap-1">
                        <span className="text-[8px] text-gray-300 uppercase tracking-wider font-medium w-8 flex-shrink-0">Type</span>
                        <div className="flex gap-px flex-1">
                            {Object.entries(VARIANT_TYPE_STYLE).map(([value, { label, color }]) => {
                                const active = filters.variantType === value;
                                return (
                                    <button
                                        key={value}
                                        onClick={() => updateFilter("variantType", active ? undefined : value)}
                                        className="flex-1 py-px text-[8px] font-medium rounded transition-colors border"
                                        style={active ? {
                                            borderColor: color,
                                            backgroundColor: `${color}15`,
                                            color: color,
                                        } : {
                                            borderColor: '#f3f4f6',
                                            backgroundColor: 'white',
                                            color: '#d1d5db',
                                        }}
                                    >
                                        {label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Family scope (only when ambiguous) */}
                    {filters.family.length !== 1 && (
                        <div className="flex items-center gap-1">
                            <span className="text-[8px] text-gray-300 uppercase tracking-wider font-medium w-8 flex-shrink-0">Fam</span>
                            <Select
                                style={{ width: "100%" }}
                                placeholder="Any family"
                                value={filters.variantFamily}
                                options={variantFamilyOptions}
                                onChange={(v) => updateFilter("variantFamily", v || undefined)}
                                allowClear size="small"
                            />
                        </div>
                    )}

                    {/* Collapsible: position range (always) + residue change (only for substitutions) */}
                    <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
                        <CollapsibleTrigger className="w-full flex items-center gap-1 py-0.5 text-[8px] text-gray-300 hover:text-gray-400 uppercase tracking-wider font-medium transition-colors">
                            <ChevronDown className={`h-2 w-2 transition-transform ${advancedOpen ? "" : "-rotate-90"}`} />
                            Position{filters.variantType === "substitution" ? " / Residue" : ""}
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                            <div className="space-y-1 pt-0.5">
                                <div className="flex items-center gap-1">
                                    <span className="text-[8px] text-gray-300 uppercase tracking-wider font-medium w-8 flex-shrink-0">Pos</span>
                                    <div className="flex gap-0.5 items-center flex-1">
                                        <Input placeholder={positionRange ? `${positionRange.min_position}` : "Min"}
                                            className="rounded border-gray-200 h-5 text-[9px]"
                                            value={filters.variantPosMin ?? ""}
                                            onChange={(e) => updateFilter("variantPosMin", e.target.value ? Number(e.target.value) : undefined)} />
                                        <span className="text-gray-300 text-[8px]">--</span>
                                        <Input placeholder={positionRange ? `${positionRange.max_position}` : "Max"}
                                            className="rounded border-gray-200 h-5 text-[9px]"
                                            value={filters.variantPosMax ?? ""}
                                            onChange={(e) => updateFilter("variantPosMax", e.target.value ? Number(e.target.value) : undefined)} />
                                    </div>
                                </div>
                                {/* Residue change -- only meaningful for substitutions */}
                                {filters.variantType === "substitution" && (
                                    <div className="flex items-center gap-1">
                                        <span className="text-[8px] text-gray-300 uppercase tracking-wider font-medium w-8 flex-shrink-0">Res</span>
                                        <div className="flex gap-0.5 items-center flex-1">
                                            <Input placeholder="Wild-type" maxLength={1}
                                                className="text-center font-mono h-5 text-[9px] uppercase rounded border-gray-200"
                                                value={filters.variantWildType ?? ""}
                                                onChange={(e) => updateFilter("variantWildType", e.target.value ? e.target.value.toUpperCase() : undefined)} />
                                            <span className="text-gray-300 text-[8px]">-&gt;</span>
                                            <Input placeholder="Observed" maxLength={1}
                                                className="text-center font-mono h-5 text-[9px] uppercase rounded border-gray-200"
                                                value={filters.variantObserved ?? ""}
                                                onChange={(e) => updateFilter("variantObserved", e.target.value ? e.target.value.toUpperCase() : undefined)} />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </CollapsibleContent>
                    </Collapsible>
                </div>
            </div>
        </div>
    );
}
