'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useMolstarInstance } from '@/components/molstar/services/MolstarInstanceManager';
import { landingSpec } from '@/components/molstar/specs/landingSpec';

import { Color } from 'molstar/lib/mol-util/color';
import { PluginCommands } from 'molstar/lib/mol-plugin/commands';
import { StateTransforms } from 'molstar/lib/mol-plugin-state/transforms';
import { STYLIZED_POSTPROCESSING } from '@/components/molstar/rendering/postprocessing-config';
import type { MolstarInstanceId } from '@/components/molstar/core/types';

import { MolScriptBuilder as MS } from 'molstar/lib/mol-script/language/builder';
import { StateObjectRef } from 'molstar/lib/mol-state';
import type { Structure } from 'molstar/lib/mol-model/structure';

// ============================================================
// Color palette (subset of your preset_structure.tsx)
// ============================================================

type Family = string;

const TubulinFamilyColors: Record<string, Color> = {
    tubulin_alpha  : Color(0x3784F0),   // Strong Blue
    tubulin_beta   : Color(0xEB6134),   // Deep Red/Orange
    tubulin_gamma  : Color(0x884EA0),   // Royal Purple
    tubulin_delta  : Color(0x1D8348),   // Forest Green
    tubulin_epsilon: Color(0xD4AC0D),   // Golden Yellow
    Default        : Color(0xBDC3C7),
};

const MapFamilyColors: Record<string, Color> = {
    // End-binding/Stabilizers (Cool Cyans/Teals)
    map_eb_family: Color(0x00CED1),
    map_camsap1: Color(0x20B2AA),
    map_camsap2: Color(0x48D1CC),
    map_camsap3: Color(0x40E0D0),

    // Motors & Severing (Vibrant Pinks/Magentas)
    map_kinesin13: Color(0xFF1493),
    map_katanin_p60: Color(0xFF69B4),
    map_spastin: Color(0xDA70D6),

    // Structural/Classical MAPs (Vivid Oranges)
    map_tau: Color(0xFF8C00),
    map_map2: Color(0xE67E22),
    map_doublecortin: Color(0xD35400),

    // Centrosomal/GCPs (Deep Blues)
    map_gcp2_3: Color(0x1F618D),
    map_gcp4: Color(0x2874A6),
    map_gcp5_6: Color(0x2E86C1),

    // Enzymes (Vivid Greens)
    map_vash_detyrosinase: Color(0x27AE60),
    map_atat1: Color(0x2ECC71),
    map_ttll_glutamylase_long: Color(0xA9DFBF),
};

function getPolymerColor(family?: string | null): Color {
    if (!family) return TubulinFamilyColors.Default;
    if (TubulinFamilyColors[family]) return TubulinFamilyColors[family];
    if (MapFamilyColors[family]) return MapFamilyColors[family];
    return TubulinFamilyColors.Default;
}

// ============================================================
// Landing profile parsing (public/landing/{PDB}.json)
// ============================================================

type LandingProfile = {
    entities?: Record<
        string,
        {
            type?: string;
            family?: string | null;
        }
    >;
    polypeptides?: Array<{
        auth_asym_id: string;
        entity_id: string;
    }>;
};

function buildChainFamilyMap(profile: LandingProfile | null): Record<string, Family> {
    if (!profile?.entities || !profile?.polypeptides) return {};
    const out: Record<string, Family> = {};

    for (const pep of profile.polypeptides) {
        const fam = profile.entities[pep.entity_id]?.family ?? null;
        if (fam) out[pep.auth_asym_id] = fam;
    }
    return out;
}

// ============================================================
// Component
// ============================================================

type Props = {
    pdbId: string;                  // e.g. "1JFF"
    instanceId: MolstarInstanceId;  // e.g. "landing_1jff"
    profileUrl?: string;            // e.g. "/landing/1JFF.json"
    onViewer?: (viewer: any | null) => void;
};

export default function TubulinLandingViewer({ pdbId, instanceId, profileUrl, onViewer }: Props) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const { instance, isInitialized } = useMolstarInstance(containerRef, instanceId, landingSpec);

    const [profile, setProfile] = useState<LandingProfile | null>(null);

    // Expose viewer once available
    useEffect(() => {
        if (!isInitialized || !instance) return;
        onViewer?.(instance.viewer);
        return () => onViewer?.(null);
    }, [isInitialized, instance, onViewer]);

    // Load landing profile JSON (classification)
    useEffect(() => {
        if (!profileUrl) {
            setProfile(null);
            return;
        }

        let cancelled = false;

        (async () => {
            try {
                const res = await fetch(profileUrl, { cache: 'no-store' });
                if (!res.ok) throw new Error(`Profile HTTP ${res.status}`);
                const json = (await res.json()) as LandingProfile;
                if (!cancelled) setProfile(json);
            } catch (e) {
                console.warn(`[landing] failed to load profile ${profileUrl}`, e);
                if (!cancelled) setProfile(null);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [profileUrl]);

    const chainFamilyMap = useMemo(() => buildChainFamilyMap(profile), [profile]);

    // Load and render structure
    useEffect(() => {
        if (!isInitialized || !instance) return;

        let cancelled = false;

        (async () => {
            const viewer = instance.viewer;
            const plugin = viewer.ctx;
            if (!plugin) return;

            await viewer.clear();

            const upper = pdbId.toUpperCase();
            const url = `https://models.rcsb.org/${upper}.bcif`;

            const structureRef = await viewer.loadFromUrl(url, true, upper);
            if (cancelled) return;

            const structureCell = StateObjectRef.resolveAndCheck(plugin.state.data, structureRef);
            const structure = structureCell?.obj?.data as Structure | undefined;
            if (!structureCell || !structure) return;

            // Paint polymer chains with colors derived from the landing profile classification
            const { auth_asym_id } = structure.model.atomicHierarchy.chains;
            const chainCount = structure.model.atomicHierarchy.chains._rowCount;

            for (let cI = 0; cI < chainCount; cI++) {
                const chainId = auth_asym_id.value(cI);

                // Only polymer entities
                const eI = structure.model.atomicHierarchy.index.getEntityFromChain(cI);
                const entityType = structure.model.entities.data.type.value(eI);
                if (entityType !== 'polymer') continue;

                const family = chainFamilyMap[chainId] ?? null;
                const chainColor = getPolymerColor(family);

                const component = await plugin.builders.structure.tryCreateComponentFromExpression(
                    structureCell,
                    MS.struct.generator.atomGroups({
                        'chain-test': MS.core.rel.eq([
                            MS.struct.atomProperty.macromolecular.auth_asym_id(),
                            chainId,
                        ]),
                    }),
                    `${upper}_${chainId}`,
                    { label: `${family ?? 'polymer'} (${chainId})` }
                );

                if (component) {
                    await plugin.builders.structure.representation.addRepresentation(component, {
                        type: 'cartoon',
                        color: 'uniform',
                        colorParams: { value: chainColor },
                        typeParams: { alpha: 0.25, tubularHelices: true, detail: 1 },
                    });
                }
            }

            // Create a group for future annotations (kept for parity with your previous landing viewer)
            await plugin.dataTransaction(async () => {
                const update = plugin.build();
                update
                    .to(structureRef.ref)
                    .group(StateTransforms.Misc.CreateGroup, { label: 'Annotations' }, { ref: 'annotations_group' });

                await PluginCommands.State.Update(plugin, { state: plugin.state.data, tree: update });
            });

            // Postprocessing + lighting
            plugin.managers.structure.component.setOptions({
                ...plugin.managers.structure.component.state.options,
                ignoreLight: true,
            });
            plugin.canvas3d?.setProps({ postprocessing: STYLIZED_POSTPROCESSING });

            // Background
            const renderer = plugin.canvas3d?.props.renderer;
            await PluginCommands.Canvas3D.SetSettings(plugin, {
                settings: { renderer: { ...renderer, backgroundColor: Color.fromRgb(255, 255, 255) } },
            });

            // Camera setup + slow spin
            plugin.managers.camera.reset();
            plugin.canvas3d?.setProps({
                camera: {
                    ...plugin.canvas3d.props.camera,
                    helper: { axes: false, grid: false },
                },
                trackball: {
                    ...plugin.canvas3d.props.trackball,
                    animate: { name: 'spin', params: { speed: 0.15 } },
                },
            });
        })();

        return () => {
            cancelled = true;
        };
    }, [isInitialized, instance, pdbId, chainFamilyMap]);

    return (
        <div
            ref={containerRef}
            className="molstar-embed molstar-landing w-full h-full relative overflow-hidden"
        />
    );
}

