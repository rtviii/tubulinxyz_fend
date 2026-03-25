'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
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
  getMolstarLigandColor,
  TUBULIN_GHOST_COLORS,
} from '@/components/molstar/colors/palette';
import { formatFamilyShort } from '@/lib/formatters';

/** Human-readable names for common nucleotides */
const NUCLEOTIDE_NAMES: Record<string, string> = {
  GTP: 'GTP (energy molecule)',
  GDP: 'GDP (spent energy molecule)',
  GNP: 'GTP analog (non-hydrolyzable)',
  GSP: 'GTP analog',
  ATP: 'ATP (energy molecule)',
  ADP: 'ADP (spent energy molecule)',
  ANP: 'ATP analog',
  ACP: 'ATP analog',
};

/** Human-readable names for common drugs/ligands */
const LIGAND_NAMES: Record<string, string> = {
  TXL: 'Taxol (anti-cancer drug)',
  TA1: 'Taxol (paclitaxel)',
  EP: 'Epothilone A (anti-cancer)',
  EPB: 'Epothilone B (anti-cancer)',
  VLB: 'Vinblastine (anti-cancer drug)',
  COL: 'Colchicine (anti-inflammatory)',
  LOC: 'Colchicine analog',
  CN2: 'Colchicine derivative',
  MG: 'Magnesium ion',
  ZN: 'Zinc ion',
  CA: 'Calcium ion',
};

const NUCLEOTIDE_IDS = new Set([
  'GTP', 'GDP', 'GNP', 'GSP', 'GMPPCP', 'GMPPNP', 'GPPNHP', 'GTPS',
  'ATP', 'ADP', 'ANP', 'ACP',
]);

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
};

export default function LandingViewer({ pdbId, instanceId, type, description, citation }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  // @ts-ignore
  const { instance, isInitialized } = useMolstarInstance(containerRef, instanceId, LANDING_SPEC as PluginUISpec);
  const loadedRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [spinning, setSpinning] = useState(true);
  const [showLigands, setShowLigands] = useState(false);
  const [showNucleotides, setShowNucleotides] = useState(false);
  const [hoverInfo, setHoverInfo] = useState<{ text: string; color: string } | null>(null);

  // Selectors for components
  const polymerComponents = useAppSelector(s => selectPolymerComponents(s, instanceId));
  const ligandComponents = useAppSelector(s => selectLigandComponents(s, instanceId));

  // Classify ligands
  const nucleotideLigands = ligandComponents.filter(l => NUCLEOTIDE_IDS.has(l.compId));
  const drugLigands = ligandComponents.filter(l => !NUCLEOTIDE_IDS.has(l.compId));

  // Get classification for hover labels
  const classification = useAppSelector(
    s => s.molstarInstances.instances[instanceId]?.tubulinClassification ?? {}
  );

  // Hover: 3D labels (ghost colors) + info bar
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
        setHoverInfo(null);
        return;
      }

      // Identify what was hovered
      const ligMatch = ligLookup.get(`${info.chainId}_${info.authSeqId}`);
      let key: string | null = null;

      if (ligMatch) {
        key = ligMatch.uniqueKey;
        const name = NUCLEOTIDE_NAMES[ligMatch.compId] ?? LIGAND_NAMES[ligMatch.compId] ?? ligMatch.compId;
        setHoverInfo({
          text: name,
          color: getHexForLigand(ligMatch.compId),
        });
        // Show 3D label with ligand color
        instance.showComponentLabel(key);
      } else if (chainIds.has(info.chainId)) {
        key = info.chainId;
        const family = classification[info.chainId];
        const familyName = family ? formatFamilyShort(family) : 'Protein';
        const friendly = familyFriendly(family);
        setHoverInfo({
          text: `${familyName} (Chain ${info.chainId})${friendly ? ' -- ' + friendly : ''}`,
          color: ghostHex(family ?? 'Default'),
        });
        // Show 3D label with ghost color
        const mgr = (instance as any).ensureLabelManager?.();
        if (mgr) {
          const comp = (instance as any).getComponent?.(key);
          if (comp) {
            const structure = instance.viewer.getStructureFromRef(comp.ref);
            if (structure) {
              const { structureToLoci } = require('@/components/molstar/core/queries');
              const loci = structureToLoci(structure);
              const ghostColor = getMolstarGhostColor(family);
              const text = familyName
                ? `Chain ${info.chainId} \u00B7 ${familyName}`
                : `Chain ${info.chainId}`;
              mgr.showHover(loci, text, ghostColor);
            }
          }
        }
      } else {
        if (prevKey) instance.hideComponentLabel();
        setHoverInfo(null);
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

        const ok = await instance.loadStructure(pdbId.toUpperCase(), cls);
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

  // Toggle handlers
  const toggleSpin = useCallback(() => {
    const plugin = instance?.viewer?.ctx;
    if (!plugin?.canvas3d) return;
    const next = !spinning;
    plugin.canvas3d.setProps({
      trackball: {
        ...plugin.canvas3d.props.trackball,
        animate: next
          ? { name: 'spin', params: { speed: 0.12 } }
          : { name: 'off', params: {} },
      },
    });
    setSpinning(next);
  }, [instance, spinning]);

  const toggleLigands = useCallback(() => {
    if (!instance) return;
    const next = !showLigands;
    for (const lig of drugLigands) {
      instance.setLigandVisibility(lig.uniqueKey, next);
    }
    setShowLigands(next);
  }, [instance, showLigands, drugLigands]);

  const toggleNucleotides = useCallback(() => {
    if (!instance) return;
    const next = !showNucleotides;
    for (const lig of nucleotideLigands) {
      instance.setLigandVisibility(lig.uniqueKey, next);
    }
    setShowNucleotides(next);
  }, [instance, showNucleotides, nucleotideLigands]);

  const hasLigands = drugLigands.length > 0;
  const hasNucleotides = nucleotideLigands.length > 0;

  return (
    <div
      className="landing-viewer-wrap relative w-full h-full"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div ref={containerRef} className="w-full h-full" />

      {/* Structure label — top-left, clickable link to detail page */}
      <Link
        href={`/structures/${pdbId}`}
        className="absolute top-3 left-3 z-10 max-w-[70%]
                   px-3 py-2 rounded-lg bg-white/85 backdrop-blur
                   border border-slate-200/60
                   hover:bg-white hover:border-slate-300 hover:shadow-sm
                   transition-all duration-150 group/label"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-1.5 text-[13px] font-medium text-slate-800
                        group-hover/label:text-blue-600 transition-colors">
          <span className="font-mono">{pdbId}</span>
          <span className="text-slate-300">&mdash;</span>
          <span>{type}</span>
          <span aria-hidden className="text-slate-400 text-[10px] ml-0.5 group-hover/label:translate-x-0.5 transition-transform">&rarr;</span>
        </div>
        <p className="mt-0.5 text-[10px] text-slate-400 leading-relaxed line-clamp-2">
          {description} <span className="text-slate-300">{citation}</span>
        </p>
      </Link>

      {/* Controls row — bottom-right */}
      {!loading && !error && (
        <div className="absolute bottom-3 right-3 z-10 flex items-center gap-1.5">
          {hasNucleotides && (
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleNucleotides(); }}
              className={`flex items-center gap-1 px-2 h-7 rounded-full text-[11px] font-medium
                         backdrop-blur border transition-all duration-150 shadow-sm
                         ${showNucleotides
                  ? 'bg-blue-50/90 border-blue-300 text-blue-700'
                  : 'bg-white/80 border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-white'
                }`}
              title={showNucleotides ? 'Hide nucleotides (GTP, GDP -- energy molecules bound to tubulin)' : 'Show nucleotides (GTP, GDP -- energy molecules bound to tubulin)'}
            >
              <NucleotideIcon active={showNucleotides} />
              <span>Nucleotides</span>
            </button>
          )}
          {hasLigands && (
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleLigands(); }}
              className={`flex items-center gap-1 px-2 h-7 rounded-full text-[11px] font-medium
                         backdrop-blur border transition-all duration-150 shadow-sm
                         ${showLigands
                  ? 'bg-green-50/90 border-green-300 text-green-700'
                  : 'bg-white/80 border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-white'
                }`}
              title={showLigands ? 'Hide bound drugs and small molecules' : 'Show bound drugs and small molecules'}
            >
              <LigandIcon active={showLigands} />
              <span>Taxol</span>
            </button>
          )}
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleSpin(); }}
            className="flex items-center justify-center w-7 h-7 rounded-full
                       bg-white/80 backdrop-blur border border-slate-200
                       text-slate-500 hover:text-slate-700 hover:bg-white
                       transition-all duration-150 shadow-sm"
            title={spinning ? 'Pause rotation' : 'Resume rotation'}
          >
            {spinning ? (
              <svg width="12" height="12" viewBox="0 0 14 14" fill="currentColor">
                <rect x="3" y="2" width="3" height="10" rx="0.5" />
                <rect x="8" y="2" width="3" height="10" rx="0.5" />
              </svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 14 14" fill="currentColor">
                <path d="M3 1.5v11l9-5.5z" />
              </svg>
            )}
          </button>
        </div>
      )}

      {/* Hover info bar — bottom-left */}
      {hoverInfo && (
        <div className="absolute bottom-3 left-3 z-10 flex items-center gap-2
                        px-2.5 py-1 rounded-md bg-white/90 backdrop-blur border border-slate-200
                        shadow-sm transition-opacity duration-100">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: hoverInfo.color }}
          />
          <span className="text-[11px] font-medium text-slate-600 whitespace-nowrap">
            {hoverInfo.text}
          </span>
        </div>
      )}

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

// ── Helpers ──

/** Short beginner-friendly description for tubulin families */
function familyFriendly(family?: string | null): string {
  if (!family) return '';
  const map: Record<string, string> = {
    tubulin_alpha: 'one half of the tubulin dimer',
    tubulin_beta: 'the other half of the tubulin dimer',
    tubulin_gamma: 'nucleates new microtubules',
    tubulin_delta: 'found at centrioles',
    tubulin_epsilon: 'found at centrioles',
  };
  return map[family] ?? '';
}

/** Convert ghost color to hex for the hover info bar */
function ghostHex(family: string): string {
  const c = TUBULIN_GHOST_COLORS[family] ?? TUBULIN_GHOST_COLORS.Default;
  const r = (c >> 16) & 0xFF;
  const g = (c >> 8) & 0xFF;
  const b = c & 0xFF;
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// ── Mini icons ──

function NucleotideIcon({ active }: { active: boolean }) {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="8" cy="8" r="3" fill={active ? 'currentColor' : 'none'} />
      <path d="M8 2v3M8 11v3M2 8h3M11 8h3" />
    </svg>
  );
}

function LigandIcon({ active }: { active: boolean }) {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M8 3L13 6v4l-5 3-5-3V6z" fill={active ? 'currentColor' : 'none'} />
    </svg>
  );
}
