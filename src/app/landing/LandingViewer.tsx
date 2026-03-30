'use client';

import { useRef, useEffect, useState } from 'react';
import Link from 'next/link';
import { useMolstarInstance } from '@/components/molstar/services/MolstarInstanceManager';
import { createClassificationFromProfile } from '@/services/profile_service';
import type { StructureProfile } from '@/lib/profile_utils';
import { API_BASE_URL } from '@/config';
import { Color } from 'molstar/lib/mol-util/color';
import { PluginCommands } from 'molstar/lib/mol-plugin/commands';
import { DefaultPluginUISpec } from 'molstar/lib/mol-plugin-ui/spec';
import { PluginConfig } from 'molstar/lib/mol-plugin/config';
import type { MolstarInstanceId } from '@/components/molstar/core/types';
import type { PluginUISpec } from 'molstar/lib/mol-plugin-ui/spec';
import { useAppSelector } from '@/store/store';
import {
  selectPolymerComponents,
  selectLigandComponents,
} from '@/components/molstar/state/selectors';
import {
  getHexForLigand,
  getMolstarGhostColor,
  TUBULIN_GHOST_COLORS,
} from '@/components/molstar/colors/palette';
import { formatFamilyShort } from '@/lib/formatters';

const EMPTY_CLASSIFICATION: Record<string, string> = {};

/** Human-readable names for common nucleotides */
const NUCLEOTIDE_NAMES: Record<string, string> = {
  GTP: 'GTP',
  GDP: 'GDP',
  GNP: 'GTP analog',
  GSP: 'GTP analog',
  ATP: 'ATP',
  ADP: 'ADP',
  ANP: 'ATP analog',
  ACP: 'ATP analog',
};

/** Human-readable names for common drugs/ligands */
const LIGAND_NAMES: Record<string, string> = {
  TXL: 'Taxol',
  TA1: 'Paclitaxel',
  EP: 'Epothilone A',
  EPB: 'Epothilone B',
  VLB: 'Vinblastine',
  COL: 'Colchicine',
  LOC: 'Colchicine analog',
  CN2: 'Colchicine derivative',
  MG: 'Mg ion',
  ZN: 'Zn ion',
  CA: 'Ca ion',
};

const NUCLEOTIDE_IDS = new Set([
  'GTP', 'GDP', 'GNP', 'GSP', 'GMPPCP', 'GMPPNP', 'GPPNHP', 'GTPS',
  'ATP', 'ADP', 'ANP', 'ACP',
]);

/** Friendly names for tubulin families */
const FAMILY_FRIENDLY: Record<string, string> = {
  tubulin_alpha: 'Alpha tubulin',
  tubulin_beta: 'Beta tubulin',
  tubulin_gamma: 'Gamma tubulin',
  tubulin_delta: 'Delta tubulin',
  tubulin_epsilon: 'Epsilon tubulin',
};

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
    controls: { left: 'none', right: 'none', top: 'none', bottom: 'none' },
    remoteState: 'none',
    disableDragOverlay: true,
    hideTaskOverlay: true,
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
  type: string;
  description: string;
  citation: string;
  spinning?: boolean;
  showLigands?: boolean;
  showNucleotides?: boolean;
  chainFilter?: string[];
};

export default function LandingViewer({
  pdbId, instanceId, type, description, citation,
  spinning: spinningProp = true,
  showLigands: showLigandsProp = false,
  showNucleotides: showNucleotidesProp = false,
  chainFilter,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  // @ts-ignore
  const { instance, isInitialized } = useMolstarInstance(containerRef, instanceId, LANDING_SPEC as PluginUISpec);
  const loadedRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Selectors for components
  const polymerComponents = useAppSelector(s => selectPolymerComponents(s, instanceId));
  const ligandComponents = useAppSelector(s => selectLigandComponents(s, instanceId));

  // Classify ligands
  const nucleotideLigands = ligandComponents.filter(l => NUCLEOTIDE_IDS.has(l.compId));
  const drugLigands = ligandComponents.filter(l => !NUCLEOTIDE_IDS.has(l.compId));

  // Get classification for hover labels (stable reference via shallowEqual)
  const classification = useAppSelector(
    s => s.molstarInstances.instances[instanceId]?.tubulinClassification ?? EMPTY_CLASSIFICATION,
  );


  // Hover: show friendly 3D labels only (no separate info bar)
  useEffect(() => {
    if (!instance) return;

    const ligLookup = new Map<string, typeof ligandComponents[0]>();
    for (const lig of ligandComponents) {
      ligLookup.set(`${lig.authAsymId}_${lig.authSeqId}`, lig);
    }
    const chainIds = new Set(polymerComponents.map(p => p.chainId));

    let prevKey: string | null = null;

    const unsub = instance.viewer.subscribeToHover((info) => {
      if (!info) {
        if (prevKey) {
          instance.hideComponentLabel();
          prevKey = null;
        }
        return;
      }

      const ligMatch = ligLookup.get(`${info.chainId}_${info.authSeqId}`);
      let key: string | null = null;

      if (ligMatch) {
        key = ligMatch.uniqueKey;
        instance.showComponentLabel(key);
      } else if (chainIds.has(info.chainId)) {
        key = info.chainId;
        const family = classification[info.chainId];
        const friendly = FAMILY_FRIENDLY[family] ?? 'Protein';

        const mgr = (instance as any).ensureLabelManager?.();
        if (mgr) {
          const comp = (instance as any).getComponent?.(key);
          if (comp) {
            const structure = instance.viewer.getStructureFromRef(comp.ref);
            if (structure) {
              const { structureToLoci } = require('@/components/molstar/core/queries');
              const loci = structureToLoci(structure);
              const ghostColor = getMolstarGhostColor(family);
              mgr.showHover(loci, friendly, ghostColor);
            }
          }
        }
      } else {
        if (prevKey) instance.hideComponentLabel();
        key = null;
      }

      prevKey = key;
    });
    return unsub;
  }, [instance, ligandComponents, polymerComponents, classification]);

  // Load structure
  useEffect(() => {
    if (!isInitialized || !instance || loadedRef.current) return;
    loadedRef.current = true;

    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/structures/${pdbId.toUpperCase()}/profile`);
        if (!res.ok) throw new Error(`Profile ${res.status}`);
        const profile: StructureProfile = await res.json();
        const cls = createClassificationFromProfile(profile);

        const ok = await instance.loadStructure(pdbId.toUpperCase(), cls, chainFilter);
        if (!ok) throw new Error('loadStructure failed');

        await instance.setStructureGhostColors(true);

        // Hide all ligands and nucleotides initially
        const state = instance['instanceState'];
        if (state?.components) {
          for (const [key, comp] of Object.entries(state.components)) {
            if ((comp as any).type === 'ligand') {
              instance.setLigandVisibility(key, false);
            }
          }
        }

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
          plugin.managers.camera.reset(undefined, 0);
          // Zoom in closer after reset
          setTimeout(() => {
            if (plugin.canvas3d) {
              const snapshot = plugin.canvas3d.camera.getSnapshot();
              const radius = snapshot.radius;
              plugin.canvas3d.requestCameraReset({
                snapshot: { ...snapshot, radius: radius * 0.75 },
                durationMs: 0,
              });
            }
          }, 100);
        }
      } catch (e) {
        console.error(`[LandingViewer:${instanceId}]`, e);
        setError(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [isInitialized, instance, pdbId, instanceId]);

  // Resize observer
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !instance) return;
    const obs = new ResizeObserver(() => {
      requestAnimationFrame(() => instance.viewer.handleResize());
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, [instance]);

  // Sync spin from props
  useEffect(() => {
    const plugin = instance?.viewer?.ctx;
    if (!plugin?.canvas3d) return;
    plugin.canvas3d.setProps({
      trackball: {
        ...plugin.canvas3d.props.trackball,
        animate: spinningProp
          ? { name: 'spin', params: { speed: 0.12 } }
          : { name: 'off', params: {} },
      },
    });
  }, [instance, spinningProp]);

  // Sync ligand visibility from props
  useEffect(() => {
    if (!instance) return;
    for (const lig of drugLigands) {
      instance.setLigandVisibility(lig.uniqueKey, showLigandsProp);
    }
  }, [instance, showLigandsProp, drugLigands]);

  // Sync nucleotide visibility from props
  useEffect(() => {
    if (!instance) return;
    for (const lig of nucleotideLigands) {
      instance.setLigandVisibility(lig.uniqueKey, showNucleotidesProp);
    }
  }, [instance, showNucleotidesProp, nucleotideLigands]);

  return (
    <div
      className="landing-viewer-wrap relative w-full h-full"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div ref={containerRef} className="w-full h-full rounded-xl overflow-hidden" />

      {/* Structure label -- bottom-left, transparent overlay */}
      <Link
        href={`/structures/${pdbId}`}
        className="absolute bottom-3 left-3 z-10 max-w-[80%]
                   px-2.5 py-1.5 rounded-lg bg-white/40 backdrop-blur-sm
                   hover:bg-white/70 transition-all duration-150 group/label"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-1.5 text-[12px] font-medium text-slate-700/80
                        group-hover/label:text-slate-900 transition-colors">
          <span className="font-mono font-semibold">{pdbId}</span>
          <span className="text-slate-400/60">&mdash;</span>
          <span className="font-light">{type}</span>
          <span aria-hidden className="text-slate-400/60 text-[10px] ml-0.5 opacity-0
                group-hover/label:opacity-100 group-hover/label:translate-x-0.5 transition-all">
            &rarr;
          </span>
        </div>
        <p className="mt-0.5 text-[9px] text-slate-400/70 leading-relaxed line-clamp-1
                      group-hover/label:text-slate-500">
          {description}
        </p>
      </Link>

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/80 rounded-xl">
          <div className="animate-spin h-6 w-6 border-2 border-slate-400 border-t-transparent rounded-full" />
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/80 rounded-xl">
          <p className="text-sm text-slate-400">Failed to load {pdbId}</p>
        </div>
      )}
    </div>
  );
}
