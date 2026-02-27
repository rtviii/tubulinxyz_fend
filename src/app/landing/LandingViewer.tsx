'use client';

import { useRef, useEffect, useState } from 'react';
import { useMolstarInstance } from '@/components/molstar/services/MolstarInstanceManager';
import { createClassificationFromProfile } from '@/services/profile_service';
import type { StructureProfile } from '@/lib/profile_utils';
import { API_BASE_URL } from '@/config';
import { Color } from 'molstar/lib/mol-util/color';
import { PluginCommands } from 'molstar/lib/mol-plugin/commands';
import { DefaultPluginUISpec } from 'molstar/lib/mol-plugin-ui/spec';
import { PluginConfig } from 'molstar/lib/mol-plugin/config';
import type { MolstarInstanceId } from '@/components/molstar/core/types';

const LANDING_SPEC = {
  ...DefaultPluginUISpec(),
  config: [
    [PluginConfig.Viewport.ShowControls, false],
    [PluginConfig.Viewport.ShowSettings, false],
    [PluginConfig.Viewport.ShowAnimation, false],
    [PluginConfig.Viewport.ShowScreenshotControls, false],
    [PluginConfig.Viewport.ShowReset, false],
    [PluginConfig.Viewport.ShowExpand, false],
    [PluginConfig.Viewport.ShowSelectionMode, false],
    [PluginConfig.Viewport.ShowTrajectoryControls, false],
    [PluginConfig.Viewport.ShowIllumination, false],
    [PluginConfig.Viewport.ShowToggleFullscreen, false],
    [PluginConfig.Viewport.ShowXR, 'never'],
  ],
  components: {
    ...DefaultPluginUISpec().components,
    controls: { left: 'none', right: 'none', top: 'none', bottom: 'none' },
    remoteState: 'none',
    disableDragOverlay: true,
    hideTaskOverlay: true,
    viewport: {
      ...DefaultPluginUISpec().components?.viewport,
      controls: {
        settingsControls: [],
        selectionControls: [],
        traceControls: [],
      },
    },
  },
  layout: {
    initial: {
      showControls: false,
      isExpanded: false,
      regionState: {
        left: 'hidden',
        right: 'hidden',
        top: 'hidden',
        bottom: 'hidden',
      },
    },
  },
};

type Props = {
  pdbId: string;
  instanceId: MolstarInstanceId;
};

export default function LandingViewer({ pdbId, instanceId }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { instance, isInitialized } = useMolstarInstance(containerRef, instanceId, LANDING_SPEC);
  const loadedRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!isInitialized || !instance || loadedRef.current) return;
    loadedRef.current = true;

    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/structures/${pdbId.toUpperCase()}/profile`);
        if (!res.ok) throw new Error(`Profile ${res.status}`);
        const profile: StructureProfile = await res.json();
        const classification = createClassificationFromProfile(profile);

        const ok = await instance.loadStructure(pdbId.toUpperCase(), classification);
        if (!ok) throw new Error('loadStructure failed');

        await instance.setStructureGhostColors(true);

        const plugin = instance.viewer.ctx;
        if (plugin?.canvas3d) {
          await PluginCommands.Canvas3D.SetSettings(plugin, {
            settings: {
              renderer: {
                ...plugin.canvas3d.props.renderer,
                backgroundColor: Color.fromRgb(255, 255, 255),
              },
            },
          });
          plugin.canvas3d.setProps({
            camera: {
              ...plugin.canvas3d.props.camera,
              helper: { axes: false, grid: false },
            },
            trackball: {
              ...plugin.canvas3d.props.trackball,
              animate: { name: 'spin', params: { speed: 0.12 } },
            },
          });
          plugin.managers.camera.reset();
        }
      } catch (e) {
        console.error(`[LandingViewer:${instanceId}]`, e);
        setError(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [isInitialized, instance, pdbId, instanceId]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !instance) return;
    const obs = new ResizeObserver(() => {
      requestAnimationFrame(() => instance.viewer.handleResize());
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, [instance]);

  return (
    <div className="landing-viewer-wrap relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/80">
          <div className="animate-spin h-6 w-6 border-2 border-slate-400 border-t-transparent rounded-full" />
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/80">
          <p className="text-sm text-slate-400">Failed to load {pdbId}</p>
        </div>
      )}
    </div>
  );
}