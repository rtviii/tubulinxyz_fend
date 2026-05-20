// src/components/structure/StructureSidebar.tsx

import { useAppSelector, useAppDispatch } from '@/store/store';
import { useRouter } from 'next/navigation';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { selectComponentState } from '@/components/molstar/state/selectors';
import { getFamilyForChain, StructureProfile } from '@/lib/profile_utils';
import { getHexForFamily, TUBULIN_GHOST_COLORS } from '@/components/molstar/colors/palette';
import type { MolstarInstance } from '@/components/molstar/services/MolstarInstance';
import type { PolymerComponent, LigandComponent } from '@/components/molstar/core/types';
import type { PolypeptideEntity, NonpolymerEntity } from '@/store/tubxz_api';
import { setExpertHintActive } from '@/store/slices/chainFocusSlice';
import {
  Eye,
  EyeOff,
  Focus,
  AlignLeft,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';

// ────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────

const TUBULIN_GREEK: Record<string, string> = {
  alpha: '\u03B1',
  beta: '\u03B2',
  gamma: '\u03B3',
  delta: '\u03B4',
  epsilon: '\u03B5',
  zeta: '\u03B6',
  eta: '\u03B7',
};

function familyDisplayName(family?: string | null): string {
  if (!family) return 'Unclassified';
  const tubulinMatch = family.match(/^tubulin_(\w+)$/);
  if (tubulinMatch) {
    const name = tubulinMatch[1];
    const greek = TUBULIN_GREEK[name];
    if (greek) return `${greek}-tubulin`;
    return name.charAt(0).toUpperCase() + name.slice(1) + '-tubulin';
  }
  const mapMatch = family.match(/^map_(\w+)/);
  if (mapMatch) {
    return mapMatch[1].split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }
  return family;
}

// Ordering priority for the entity list: α/β tubulin first, then other tubulins,
// then MAPs, then any other classified entity, then unclassified last.
function familyRank(family?: string): number {
  if (!family) return 99;
  if (family === 'tubulin_alpha') return 0;
  if (family === 'tubulin_beta') return 1;
  if (family.startsWith('tubulin_')) return 2;
  if (family.startsWith('map_')) return 3;
  return 4;
}

function methodLabel(m?: string | null): string {
  if (!m) return '';
  if (m === 'ELECTRON MICROSCOPY') return 'cryo-EM';
  if (m === 'X-RAY DIFFRACTION') return 'X-ray';
  return m;
}

function ghostHex(family?: string | null): string {
  const c = TUBULIN_GHOST_COLORS[family ?? ''] ?? TUBULIN_GHOST_COLORS.Default;
  const r = (c >> 16) & 0xFF;
  const g = (c >> 8) & 0xFF;
  const b = c & 0xFF;
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

function familyBorderColor(family?: string | null, ghost = false): string {
  return ghost ? ghostHex(family) : getHexForFamily(family);
}

function getPolymerEntityInfo(profile: StructureProfile | null, chainId: string) {
  if (!profile) return null;
  for (const poly of profile.polypeptides) {
    if (poly.auth_asym_id !== chainId) continue;
    const entity = profile.entities[poly.entity_id];
    if (!entity) continue;
    return { poly, entity };
  }
  return null;
}

function getNonpolymerEntityInfo(
  profile: StructureProfile | null,
  _compId: string,
  authAsymId: string,
  authSeqId: number
) {
  if (!profile) return null;
  for (const np of profile.nonpolymers) {
    if (np.auth_asym_id !== authAsymId || np.auth_seq_id !== authSeqId) continue;
    const entity = profile.entities[np.entity_id];
    if (!entity) continue;
    return { np, entity };
  }
  return null;
}

interface EntityGroup {
  entityId: string;
  entity: PolypeptideEntity;
  family: string | undefined;
  chains: PolymerComponent[];
}

function groupChainsByEntity(
  polymerComponents: PolymerComponent[],
  profile: StructureProfile | null
): EntityGroup[] {
  if (!profile) {
    // Fallback: one group per chain
    return polymerComponents.map(c => ({
      entityId: c.chainId,
      entity: { entity_id: c.chainId, one_letter_code: '', one_letter_code_can: '', sequence_length: 0 },
      family: undefined,
      chains: [c],
    }));
  }

  const groups = new Map<string, EntityGroup>();
  for (const chain of polymerComponents) {
    const poly = profile.polypeptides.find(p => p.auth_asym_id === chain.chainId);
    if (!poly) continue;
    const entity = profile.entities[poly.entity_id];
    if (!entity || entity.type === 'non-polymer') continue;
    const existing = groups.get(poly.entity_id);
    if (existing) {
      existing.chains.push(chain);
    } else {
      const family = 'family' in entity ? (entity.family ?? undefined) : undefined;
      groups.set(poly.entity_id, {
        entityId: poly.entity_id,
        entity: entity as PolypeptideEntity,
        family,
        chains: [chain],
      });
    }
  }
  return Array.from(groups.values()).sort((a, b) => {
    const r = familyRank(a.family) - familyRank(b.family);
    if (r !== 0) return r;
    return familyDisplayName(a.family).localeCompare(familyDisplayName(b.family));
  });
}

// Debounced hover intent: only fire `onEnter` after the cursor rests for `delay`
// ms, so skating across dozens of rows doesn't trigger expensive highlights or
// Redux dispatches. `onLeave` fires immediately and cancels any pending enter.
function useHoverIntent(onEnter: () => void, onLeave: () => void, delay = 70) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const enterRef = useRef(onEnter);
  const leaveRef = useRef(onLeave);
  enterRef.current = onEnter;
  leaveRef.current = onLeave;

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return useMemo(() => ({
    onMouseEnter: () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        timer.current = null;
        enterRef.current();
      }, delay);
    },
    onMouseLeave: () => {
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
      leaveRef.current();
    },
  }), [delay]);
}

// ────────────────────────────────────────────
// Main Sidebar
// ────────────────────────────────────────────

interface StructureSidebarProps {
  loadedStructure: string | null;
  polymerComponents: PolymerComponent[];
  ligandComponents: LigandComponent[];
  instance: MolstarInstance | null;
  error: string | null;
  profile: StructureProfile | null;
  onShowSequence?: (chainId: string | null) => void;
  activeSequenceChainId?: string | null;
  activeTab?: 'chains' | 'ligands';
  onTabChange?: (tab: 'chains' | 'ligands') => void;
}

export function StructureSidebar({
  loadedStructure,
  polymerComponents,
  ligandComponents,
  instance,
  error,
  profile,
  onShowSequence,
  activeSequenceChainId,
  activeTab: controlledTab,
  onTabChange,
}: StructureSidebarProps) {
  const router = useRouter();
  const [internalTab, setInternalTab] = useState<'chains' | 'ligands'>('chains');
  const activeTab = controlledTab ?? internalTab;
  const setActiveTab = onTabChange ?? setInternalTab;

  const ghostMode = useAppSelector(
    s => s.molstarInstances.instances.structure?.ghostMode ?? false
  );
  const labelsEnabled = useAppSelector(
    s => s.molstarInstances.instances.structure?.labelsEnabled ?? true
  );

  const isLandingStructure =
    loadedStructure === '1JFF' || loadedStructure === '6WVM';
  const isDimer = loadedStructure === '1JFF';

  const entityGroups = useMemo(
    () => groupChainsByEntity(polymerComponents, profile),
    [polymerComponents, profile]
  );

  const authors = profile?.citation_rcsb_authors ?? [];
  const authorLine = authors.length === 0 ? null
    : authors.length <= 2 ? authors.join(', ')
    : `${authors[0]} et al.`;
  const doi = profile?.citation_pdbx_doi;
  const doiHref = doi ? (doi.startsWith('http') ? doi : `https://doi.org/${doi}`) : null;

  return (
    <div className="flex flex-col max-h-full">
      {isLandingStructure && (
        <div className="px-4 pt-3 pb-2 border-b border-gray-100">
          <button
            onClick={() => router.push(`/structures/${isDimer ? '6WVM' : '1JFF'}`)}
            className="text-[10px] px-2 py-0.5 rounded border border-gray-200 text-gray-500 hover:border-blue-300 hover:text-blue-600 transition-colors"
          >
            Switch to {isDimer ? 'Lattice (6WVM)' : 'Dimer (1JFF)'}
          </button>
        </div>
      )}

      {error && (
        <div className="text-red-500 text-xs mx-4 mt-2 p-2 bg-red-50 rounded">
          {error}
        </div>
      )}

      {/* Structure citation / metadata */}
      {profile && (
        <div className="px-3 pt-2.5 pb-2 border-b border-gray-100">
          {profile.citation_title && (
            <p
              className="text-[11px] text-gray-500 leading-snug line-clamp-2"
              title={profile.citation_title}
            >
              {profile.citation_title}
            </p>
          )}
          {(authorLine || profile.citation_year) && (
            <p className="text-[9px] text-gray-400 truncate mt-0.5" title={authors.join(', ')}>
              {authorLine}
              {authorLine && profile.citation_year ? ' · ' : ''}
              {profile.citation_year ?? ''}
            </p>
          )}
          <div className="flex items-center gap-1 flex-wrap mt-1.5 text-[9px] text-gray-400">
            <span className="bg-gray-50 px-1.5 py-0.5 rounded font-mono">{profile.rcsb_id}</span>
            {profile.resolution ? (
              <span className="bg-gray-50 px-1.5 py-0.5 rounded">{profile.resolution.toFixed(1)} Å</span>
            ) : null}
            {profile.expMethod && (
              <span className="bg-gray-50 px-1.5 py-0.5 rounded" title={profile.expMethod}>
                {methodLabel(profile.expMethod)}
              </span>
            )}
            {doiHref && (
              <a
                href={doiHref}
                target="_blank"
                rel="noopener noreferrer"
                className="px-1.5 py-0.5 rounded text-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
              >
                DOI
              </a>
            )}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-gray-100">
        <button
          onClick={() => setActiveTab('chains')}
          className={`flex-1 py-2 text-[11px] font-medium uppercase tracking-wider transition-colors
            ${activeTab === 'chains'
              ? 'text-gray-700 border-b-2 border-gray-700'
              : 'text-gray-400 hover:text-gray-600'
            }`}
        >
          Chains ({polymerComponents.length})
        </button>
        <button
          onClick={() => setActiveTab('ligands')}
          className={`flex-1 py-2 text-[11px] font-medium uppercase tracking-wider transition-colors
            ${activeTab === 'ligands'
              ? 'text-gray-700 border-b-2 border-gray-700'
              : 'text-gray-400 hover:text-gray-600'
            }`}
        >
          Ligands ({ligandComponents.length})
        </button>
      </div>

      {/* Scrollable content */}
      <div className="min-h-0 overflow-y-auto">
        <div className="px-3 py-2">
          {activeTab === 'chains' && (
            <div className="space-y-1">
              {entityGroups.map(group => (
                <EntityGroupSection
                  key={group.entityId}
                  group={group}
                  instance={instance}
                  profile={profile}
                  ghostMode={ghostMode}
                  labelsEnabled={labelsEnabled}
                  onShowSequence={onShowSequence}
                  activeSequenceChainId={activeSequenceChainId}
                />
              ))}
            </div>
          )}

          {activeTab === 'ligands' && (
            <div className="space-y-0.5">
              {ligandComponents.length === 0 ? (
                <p className="text-xs text-gray-400 py-4 text-center">
                  No ligands in this structure
                </p>
              ) : (
                ligandComponents.map(ligand => (
                  <LigandRow
                    key={ligand.uniqueKey}
                    ligand={ligand}
                    instance={instance}
                    profile={profile}
                    ghostMode={ghostMode}
                    labelsEnabled={labelsEnabled}
                  />
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────
// EntityGroupSection
// ────────────────────────────────────────────

const EntityGroupSection = memo(function EntityGroupSection({
  group,
  instance,
  profile,
  ghostMode,
  labelsEnabled,
  onShowSequence,
  activeSequenceChainId,
}: {
  group: EntityGroup;
  instance: MolstarInstance | null;
  profile: StructureProfile | null;
  ghostMode: boolean;
  labelsEnabled: boolean;
  onShowSequence?: (chainId: string | null) => void;
  activeSequenceChainId?: string | null;
}) {
  // Auto-collapse entities with many chains
  const [collapsed, setCollapsed] = useState(group.chains.length > 10);

  const chainIds = useMemo(() => group.chains.map(c => c.chainId), [group.chains]);

  // Single read of componentStates — avoids thrashing the shared per-key selector
  // once per chain on every store update; yields a stable boolean.
  const anyVisible = useAppSelector(state => {
    const cs = state.molstarInstances.instances.structure?.componentStates;
    return cs ? chainIds.some(id => cs[id]?.visible ?? true) : true;
  });

  const displayName = familyDisplayName(group.family);
  const nameColor = familyBorderColor(group.family, false);
  const entity = group.entity;
  const uniprotIds = entity.uniprot_accessions;
  const organism = entity.src_organism_names?.[0];
  const seqLen = entity.sequence_length;
  const isotype = entity.isotype;
  const description = entity.pdbx_description;

  const headerHover = useHoverIntent(
    () => instance?.highlightChains(chainIds, true),
    () => instance?.highlightChains(chainIds, false)
  );

  const toggleAllVisibility = (visible: boolean) => {
    for (const chain of group.chains) {
      instance?.setChainVisibility(chain.chainId, visible);
    }
  };

  const focusEntity = () => {
    if (group.chains[0]) instance?.focusChain(group.chains[0].chainId);
  };

  return (
    <div>
      {/* Entity header */}
      <div
        className="group flex items-center gap-1.5 px-2 py-1.5 rounded cursor-pointer hover:bg-gray-50/60 transition-colors"
        {...headerHover}
        onClick={() => setCollapsed(!collapsed)}
      >
        <span className="flex-shrink-0 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity">
          {collapsed ? <ChevronRight size={11} /> : <ChevronDown size={11} />}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-1.5">
            <span className="text-xs font-semibold truncate" style={{ color: nameColor }}>{displayName}</span>
            {isotype && (
              <span className="px-1 rounded bg-gray-100 text-gray-500 text-[9px] flex-shrink-0">{isotype}</span>
            )}
            {uniprotIds?.[0] && (
              <a
                href={`https://www.uniprot.org/uniprot/${uniprotIds[0]}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[9px] text-blue-400 hover:text-blue-600 flex-shrink-0"
                onClick={e => e.stopPropagation()}
              >
                {uniprotIds[0]}
              </a>
            )}
          </div>
          <div className="text-[10px] text-gray-400 flex items-center gap-1.5">
            {organism && <span className="truncate">{organism}</span>}
            {seqLen ? <span className="flex-shrink-0">{seqLen} aa</span> : null}
            <span className="flex-shrink-0">{group.chains.length} chain{group.chains.length !== 1 ? 's' : ''}</span>
          </div>
          {description && description !== displayName && (
            <div className="text-[10px] text-gray-400 truncate leading-tight">{description}</div>
          )}
        </div>
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <button
            onClick={e => { e.stopPropagation(); toggleAllVisibility(!anyVisible); }}
            className="p-0.5 text-gray-400 hover:text-gray-600 transition-colors"
            title={anyVisible ? 'Hide all chains' : 'Show all chains'}
          >
            {anyVisible ? <Eye size={12} /> : <EyeOff size={12} />}
          </button>
          <button
            onClick={e => { e.stopPropagation(); focusEntity(); }}
            className="p-0.5 text-gray-400 hover:text-gray-600 transition-colors"
            title="Focus entity"
          >
            <Focus size={12} />
          </button>
        </div>
      </div>

      {/* Chain rows — densely grouped under entity header */}
      {!collapsed && (
        <div className="ml-4 mt-0.5 space-y-px">
          {group.chains.map(chain => (
            <ChainRow
              key={chain.chainId}
              chain={chain}
              instance={instance}
              profile={profile}
              ghostMode={ghostMode}
              labelsEnabled={labelsEnabled}
              onShowSequence={onShowSequence}
              isSequenceActive={activeSequenceChainId === chain.chainId}
            />
          ))}
        </div>
      )}
    </div>
  );
});

// ────────────────────────────────────────────
// ChainRow
// ────────────────────────────────────────────

const ChainRow = memo(function ChainRow({
  chain,
  instance,
  profile,
  ghostMode,
  labelsEnabled,
  onShowSequence,
  isSequenceActive,
}: {
  chain: PolymerComponent;
  instance: MolstarInstance | null;
  profile: StructureProfile | null;
  ghostMode: boolean;
  labelsEnabled: boolean;
  onShowSequence?: (chainId: string | null) => void;
  isSequenceActive?: boolean;
}) {
  const componentState = useAppSelector(state =>
    selectComponentState(state, 'structure', chain.chainId)
  );
  const dispatch = useAppDispatch();

  const rowHover = useHoverIntent(
    () => {
      instance?.highlightChain(chain.chainId, true);
      if (labelsEnabled) instance?.showComponentLabel(chain.chainId);
    },
    () => {
      instance?.highlightChain(chain.chainId, false);
      instance?.hideComponentLabel();
    }
  );

  // Hovering either action icon signals the pill's "Expert Mode" button to
  // highlight — makes clear that these row icons are the per-chain expert-mode
  // entry points.
  const expertHint = {
    onMouseEnter: () => dispatch(setExpertHintActive(true)),
    onMouseLeave: () => dispatch(setExpertHintActive(false)),
  };

  return (
    <div
      className={`group flex items-center justify-between py-0.5 px-2 rounded transition-colors
        ${componentState.hovered ? 'bg-blue-50' : 'hover:bg-gray-50'}
        ${!componentState.visible ? 'opacity-40' : ''}`}
      {...rowHover}
    >
      <span className="text-[11px] font-mono text-gray-500 truncate">Chain {chain.chainId}</span>
      <div
        className={`flex items-center gap-0.5 flex-shrink-0 ml-1 transition-opacity
          ${isSequenceActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
      >
        <button
          onClick={e => {
            e.stopPropagation();
            onShowSequence?.(isSequenceActive ? null : chain.chainId);
          }}
          {...expertHint}
          className={`p-1 transition-colors ${isSequenceActive ? 'text-blue-500' : 'text-gray-400 hover:text-blue-600'}`}
          title={isSequenceActive ? 'Hide sequence' : 'Show sequence'}
        >
          <AlignLeft size={13} />
        </button>
        <button
          onClick={e => {
            e.stopPropagation();
            instance?.enterMonomerView(chain.chainId);
          }}
          {...expertHint}
          className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
          title="Open expert mode for this chain"
        >
          <Focus size={13} />
        </button>
      </div>
    </div>
  );
});

// ────────────────────────────────────────────
// LigandRow (expandable)
// ────────────────────────────────────────────

function LigandRow({
  ligand,
  instance,
  profile,
  ghostMode,
  labelsEnabled,
}: {
  ligand: LigandComponent;
  instance: MolstarInstance | null;
  profile: StructureProfile | null;
  ghostMode: boolean;
  labelsEnabled: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const componentState = useAppSelector(state =>
    selectComponentState(state, 'structure', ligand.uniqueKey)
  );

  const info = getNonpolymerEntityInfo(profile, ligand.compId, ligand.authAsymId, ligand.authSeqId);
  const entity = info?.entity as NonpolymerEntity | undefined;
  const chemName = entity?.chemical_name;

  const parentFamily = getFamilyForChain(profile, ligand.authAsymId);
  const parentName = parentFamily ? familyDisplayName(parentFamily) : null;
  const parentColor = familyBorderColor(parentFamily, false);

  // Expanded details
  const drugbankDesc = entity?.nonpolymer_comp?.drugbank?.drugbank_info?.description;
  const formulaWeight = entity?.formula_weight;
  const smiles = entity?.SMILES_stereo ?? entity?.SMILES;

  const rowHover = useHoverIntent(
    () => { if (labelsEnabled) instance?.showComponentLabel(ligand.uniqueKey); },
    () => { instance?.hideComponentLabel(); }
  );

  return (
    <div
      className={`rounded-md transition-colors
        ${componentState.hovered ? 'bg-stone-50' : 'hover:bg-gray-50'}
        ${!componentState.visible ? 'opacity-40' : ''}`}
      {...rowHover}
    >
      {/* Compact row */}
      <div
        className="flex items-center justify-between py-2 px-2.5 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1.5">
            <span className="text-xs font-mono font-medium text-gray-800">{ligand.compId}</span>
            {chemName && (
              <span className="text-[10px] text-gray-400 truncate">{chemName}</span>
            )}
          </div>
          {parentName && (
            <div className="text-[10px] mt-0.5" style={{ color: parentColor }}>
              {parentName}
            </div>
          )}
        </div>
        <div className="flex items-center gap-0.5 flex-shrink-0 ml-1">
          <button
            onClick={e => {
              e.stopPropagation();
              instance?.setLigandVisibility(ligand.uniqueKey, !componentState.visible);
            }}
            className="p-1 text-gray-400 hover:text-gray-700 transition-colors"
            title={componentState.visible ? 'Hide ligand' : 'Show ligand'}
          >
            {componentState.visible ? <Eye size={14} /> : <EyeOff size={14} />}
          </button>
          <button
            onClick={e => {
              e.stopPropagation();
              instance?.focusLigand(ligand.uniqueKey);
            }}
            className="p-1 text-gray-400 hover:text-gray-700 transition-colors"
            title="Focus camera"
          >
            <Focus size={14} />
          </button>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="px-3 pb-2 text-[10px] text-gray-500 space-y-1 border-t border-gray-100 pt-1.5">
          {drugbankDesc && (
            <p className="leading-tight">{drugbankDesc}</p>
          )}
          {formulaWeight != null && (
            <div>MW: {formulaWeight.toFixed(1)} Da</div>
          )}
          {smiles && (
            <div className="font-mono text-[9px] break-all text-gray-400">
              SMILES: {smiles}
            </div>
          )}
          {!drugbankDesc && !formulaWeight && !smiles && (
            <div className="text-gray-300 italic">No additional data available</div>
          )}
        </div>
      )}
    </div>
  );
}
