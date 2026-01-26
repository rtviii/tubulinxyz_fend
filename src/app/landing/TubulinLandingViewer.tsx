'use client';

import React, { useEffect, useRef } from 'react';
import { useMolstarInstance } from '@/components/molstar/services/MolstarInstanceManager';
import { landingSpec } from '@/components/molstar/specs/landingSpec';

import { Color } from 'molstar/lib/mol-util/color';
import { PluginCommands } from 'molstar/lib/mol-plugin/commands';
import { StateTransforms } from 'molstar/lib/mol-plugin-state/transforms';
import { STYLIZED_POSTPROCESSING } from '@/components/molstar/rendering/postprocessing-config';
import type { MolstarInstanceId } from '@/components/molstar/core/types';

type Props = {
    pdbId: string; // e.g. '1JFF' | '9G0T'
    instanceId: MolstarInstanceId; // e.g. 'landing_1jff' | 'landing_9g0t'
    onViewer?: (viewer: any | null) => void;
};

export default function TubulinLandingViewer({ pdbId, instanceId, onViewer }: Props) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const { instance, isInitialized } = useMolstarInstance(containerRef, instanceId, landingSpec);

    useEffect(() => {
        if (!isInitialized || !instance) return;
        onViewer?.(instance.viewer);
        return () => onViewer?.(null);
    }, [isInitialized, instance, onViewer]);

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
            const structure = await viewer.loadFromUrl(url, true, upper);
            if (cancelled) return;

            await plugin.builders.structure.representation.addRepresentation(structure, {
                type: 'cartoon',
                color: 'uniform',
                colorParams: { value: Color(0xffffff) },
                typeParams: { alpha: 0.15, tubularHelices: true, detail: 1 },
            });

            await plugin.dataTransaction(async () => {
                const update = plugin.build();
                update
                    .to(structure.ref)
                    .group(StateTransforms.Misc.CreateGroup, { label: 'Annotations' }, { ref: 'annotations_group' });

                await PluginCommands.State.Update(plugin, { state: plugin.state.data, tree: update });
            });

            // postprocessing + lighting
            plugin.managers.structure.component.setOptions({
                ...plugin.managers.structure.component.state.options,
                ignoreLight: true,
            });
            plugin.canvas3d?.setProps({ postprocessing: STYLIZED_POSTPROCESSING });

            // background
            const renderer = plugin.canvas3d?.props.renderer;
            await PluginCommands.Canvas3D.SetSettings(plugin, {
                settings: { renderer: { ...renderer, backgroundColor: Color.fromRgb(255, 255, 255) } },
            });

            // camera setup
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
    }, [isInitialized, instance, pdbId]);

    return (
        <div ref={containerRef} className="molstar-embed molstar-landing w-full h-full relative overflow-hidden" />
    );
}

