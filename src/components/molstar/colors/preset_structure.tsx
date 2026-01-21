import { Structure } from 'molstar/lib/mol-model/structure';
import { MolScriptBuilder as MS } from 'molstar/lib/mol-script/language/builder';
import { StateObjectRef } from 'molstar/lib/mol-state';
import { StructureRepresentationPresetProvider } from 'molstar/lib/mol-plugin-state/builder/structure/representation-preset';
import { ParamDefinition as PD } from 'molstar/lib/mol-util/param-definition';
import { Color } from 'molstar/lib/mol-util/color';
import { getLigandInstances, getResidueSequence, ResidueData } from './preset-helpers';
import { MapFamily, TubulinFamily } from '@/store/tubxz_api';
// Import the generated types from your API

export type TubulinClassification = Record<string, TubulinFamily | MapFamily | string>;

// ============================================================
// VIBRANT COLOR PALETTES
// ============================================================

const TubulinFamilyColors: Record<string, Color> = {
    "tubulin_alpha"  : Color(0x3784F0),   // Strong Blue
    "tubulin_beta"   : Color(0xEB6134),   // Deep Red/Orange
    "tubulin_gamma"  : Color(0x884EA0),   // Royal Purple
    "tubulin_delta"  : Color(0x1D8348),   // Forest Green
    "tubulin_epsilon": Color(0xD4AC0D),   // Golden Yellow
    "Default"        : Color(0xBDC3C7)
};

const MapFamilyColors: Record<string, Color> = {
    // End-binding/Stabilizers (Cool Cyans/Teals)
    "map_eb_family": Color(0x00CED1),
    "map_camsap1"  : Color(0x20B2AA),
    "map_camsap2"  : Color(0x48D1CC),
    "map_camsap3"  : Color(0x40E0D0),

    // Motors & Severing (Vibrant Pinks/Magentas)
    "map_kinesin13"  : Color(0xFF1493),
    "map_katanin_p60": Color(0xFF69B4),
    "map_spastin"    : Color(0xDA70D6),

    // Structural/Classical MAPs (Vivid Oranges)
    "map_tau"         : Color(0xFF8C00),
    "map_map2"        : Color(0xE67E22),
    "map_doublecortin": Color(0xD35400),

    // Centrosomal/GCPs (Deep Blues)
    "map_gcp2_3": Color(0x1F618D),
    "map_gcp4"  : Color(0x2874A6),
    "map_gcp5_6": Color(0x2E86C1),

    // Enzymes (Vivid Greens)
    "map_vash_detyrosinase"    : Color(0x27AE60),
    "map_atat1"                : Color(0x2ECC71),
    "map_ttll_glutamylase_long": Color(0xA9DFBF),
};

const LigandAnchors: Record<string, Color> = {
    'GTP': Color(0x859799), // Neon Green
    'GDP': Color(0xFFD700), // Gold
    'TXL': Color(0xFF00FF), // Magenta (Taxol)
    'VLB': Color(0x00FFFF), // Cyan (Vinblastine)
    'MG': Color(0xFF4500), // Bright Orange (Ion)
};

// ============================================================
// UTILITIES
// ============================================================

function getPolymerColor(family?: string): Color {

    if (!family) return TubulinFamilyColors.Default;
    if (TubulinFamilyColors[family]) return TubulinFamilyColors[family];
    if (MapFamilyColors[family]) return MapFamilyColors[family];

    // Dynamic Fallback: High saturation for unknown families
    let hash = 0;
    for (let i = 0; i < family.length; i++) hash = family.charCodeAt(i) + ((hash << 5) - hash);
    return hslToRgb(Math.abs(hash) % 360, 75, 55);
}

function getLigandColor(compId: string): Color {
    if (LigandAnchors[compId]) return LigandAnchors[compId];
    let hash = 0;
    for (let i = 0; i < compId.length; i++) hash = compId.charCodeAt(i) + ((hash << 5) - hash);
    return hslToRgb(Math.abs(hash) % 360, 85, 60);
}

function hslToRgb(h: number, s: number, l: number): Color {
    h /= 360; s /= 100; l /= 100;
    let r, g, b;
    const hue2rgb = (p: number, q: number, t: number) => {
        if (t < 0) t += 1; if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
    return Color.fromRgb(Math.round(r * 255), Math.round(g * 255), Math.round(b * 255));
}


export interface ComputedResidueAnnotation {
    auth_asym_id: string;
    auth_seq_id: number;
    method: string;
    confidence: number;
}

interface PolymerObject { ref: string; sequence: ResidueData[]; }
interface LigandObject { ref: string; }
export interface PresetObjects {
    objects_polymer: { [chainId: string]: PolymerObject };
    objects_ligand: { [uniqueKey: string]: LigandObject };
}

export const EnhancedTubulinSplitPreset = StructureRepresentationPresetProvider({
    id: 'tubulin-split-preset-computed-res',
    display: {
        name: 'Tubulin superfamily (vibrant discovery)',
        group: 'TubulinXYZ',
        description: 'protein families and luminescent ligands.'
    },
    params: () => ({
        ...StructureRepresentationPresetProvider.CommonParams,
        pdbId: PD.Text('', { description: 'PDB ID' }),
        tubulinClassification: PD.Value<TubulinClassification>({}, { isHidden: true }),
        computedResidues: PD.Value<ComputedResidueAnnotation[]>([], { isHidden: true })
    }),

    async apply(ref, params, plugin): Promise<Partial<PresetObjects>> {
        const structureCell = StateObjectRef.resolveAndCheck(plugin.state.data, ref);
        if (!structureCell) return {};

        const structure = structureCell.obj!.data;
        const { update } = StructureRepresentationPresetProvider.reprBuilder(plugin, params);
        const objects_polymer: { [k: string]: PolymerObject } = {};
        const objects_ligand: { [k: string]: LigandObject } = {};

        const computedResidues = params.computedResidues || [];

        // 1. Process Polymer Components
        const { auth_asym_id } = structure.model.atomicHierarchy.chains;
        const chainCount = structure.model.atomicHierarchy.chains._rowCount;

        for (let cI = 0; cI < chainCount; cI++) {
            const chainId = auth_asym_id.value(cI);
            const eI = structure.model.atomicHierarchy.index.getEntityFromChain(cI);
            if (structure.model.entities.data.type.value(eI) !== 'polymer') continue;

            const family = params.tubulinClassification[chainId];
            const chainColor = getPolymerColor(family);

            console.log(`Chain: ${chainId}, Family: ${family}, Color: ${chainColor}`);

            const component = await plugin.builders.structure.tryCreateComponentFromExpression(
                structureCell,
                MS.struct.generator.atomGroups({
                    'chain-test': MS.core.rel.eq([MS.struct.atomProperty.macromolecular.auth_asym_id(), chainId])
                }),
                `${params.pdbId}_${chainId}`,
                { label: `${family || 'Polymer'} (${chainId})` }
            );

            if (component) {
                // Apply vibrant cartoon representation
                await plugin.builders.structure.representation.addRepresentation(component, {
                    type: 'cartoon',
                    color: 'uniform',
                    colorParams: { value: chainColor }
                });

                objects_polymer[chainId] = {
                    ref: component.ref,
                    sequence: getResidueSequence(component, chainId)
                };
            }
        }

        // 2. Process Ligands
        const ligandInstances = getLigandInstances(structure);
        for (const instance of ligandInstances) {
            const ligandSelection = MS.struct.generator.atomGroups({
                'residue-test': MS.core.logic.and([
                    MS.core.rel.eq([MS.struct.atomProperty.macromolecular.label_comp_id(), instance.compId]),
                    MS.core.rel.eq([MS.struct.atomProperty.macromolecular.auth_asym_id(), instance.auth_asym_id]),
                    MS.core.rel.eq([MS.struct.atomProperty.macromolecular.auth_seq_id(), instance.auth_seq_id])
                ])
            });

            const component = await plugin.builders.structure.tryCreateComponentFromExpression(
                structureCell,
                ligandSelection,
                `${params.pdbId}_${instance.uniqueKey}`,
                { label: `Ligand ${instance.compId}` }
            );

            if (component) {
                await plugin.builders.structure.representation.addRepresentation(component, {
                    type: 'ball-and-stick',
                    color: 'uniform',
                    colorParams: { value: getLigandColor(instance.compId) },
                    typeParams: { emissive: 0.4, sizeFactor: 0.3 }
                });
                objects_ligand[instance.uniqueKey] = { ref: component.ref };
            }
        }

        await update.commit({ revertOnError: true });
        return { objects_polymer, objects_ligand };
    }
});