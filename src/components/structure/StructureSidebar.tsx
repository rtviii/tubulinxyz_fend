// src/components/structure/StructureSidebar.tsx

import { useAppSelector } from '@/store/store';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { selectComponentState } from '@/components/molstar/state/selectors';
import { getFamilyForChain, StructureProfile } from '@/lib/profile_utils';
import { getHexForFamily, TUBULIN_GHOST_COLORS } from '@/components/molstar/colors/palette';
import type { MolstarInstance } from '@/components/molstar/services/MolstarInstance';
import type { PolymerComponent, LigandComponent } from '@/components/molstar/core/types';
import {
  Eye,
  EyeOff,
  Focus,
  Microscope,
  AlignLeft,
} from 'lucide-react';

// ────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────

function familyDisplayName(family?: string | null): string {
  if (!family) return 'Unclassified';
  const tubulinMatch = family.match(/^tubulin_(\w+)$/);
  if (tubulinMatch) {
    const name = tubulinMatch[1];
    return name.charAt(0).toUpperCase() + name.slice(1) + '-tubulin';
  }
  const mapMatch = family.match(/^map_(\w+)/);
  if (mapMatch) {
    return mapMatch[1].split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }
  return family;
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

function abbreviateMethod(method: string): string {
  const upper = method.toUpperCase();
  if (upper.includes('ELECTRON MICROSCOPY') || upper.includes('CRYO')) return 'EM';
  if (upper.includes('X-RAY') || upper.includes('CRYSTAL')) return 'X-ray';
  if (upper.includes('NMR')) return 'NMR';
  if (upper.includes('NEUTRON')) return 'Neutron';
  return method;
}

function formatAuthors(authors: string[] | null): string | null {
  if (!authors || authors.length === 0) return null;
  if (authors.length === 1) return authors[0];
  if (authors.length <= 3) return authors.join(', ');
  return `${authors[0]}, ${authors[1]}, ... ${authors[authors.length - 1]}`;
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
}: StructureSidebarProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'chains' | 'ligands'>('chains');

  const ghostMode = useAppSelector(
    s => s.molstarInstances.instances.structure?.ghostMode ?? false
  );
  const labelsEnabled = useAppSelector(
    s => s.molstarInstances.instances.structure?.labelsEnabled ?? true
  );

  const isLandingStructure =
    loadedStructure === '1JFF' || loadedStructure === '6WVM';
  const isDimer = loadedStructure === '1JFF';

  return (
    <div className="h-full bg-white border-r border-gray-200 flex flex-col overflow-hidden">
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

      {/* ── Tabs ── */}
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

      {/* ── Scrollable content ── */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="px-3 py-2">
          {activeTab === 'chains' && (
            <div className="space-y-0.5">
              {polymerComponents.map(chain => (
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
// MethodBadge
// ────────────────────────────────────────────

function MethodBadge({ method }: { method?: string | null }) {
  if (!method) return null;
  const abbr = abbreviateMethod(method);
  const color =
    abbr === 'EM'
      ? 'bg-teal-50 text-teal-600 border-teal-200'
      : abbr === 'X-ray'
        ? 'bg-violet-50 text-violet-600 border-violet-200'
        : 'bg-gray-50 text-gray-500 border-gray-200';

  return (
    <span className={`text-[9px] font-semibold px-1 py-px rounded border ${color}`}>
      {abbr}
    </span>
  );
}

// ────────────────────────────────────────────
// ChainRow
// ────────────────────────────────────────────

function ChainRow({
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

  const family = getFamilyForChain(profile, chain.chainId);
  const displayName = familyDisplayName(family);
  const borderColor = familyBorderColor(family, ghostMode);

  const info = getPolymerEntityInfo(profile, chain.chainId);
  const uniprotIds = info?.entity && 'uniprot_accessions' in info.entity
    ? (info.entity.uniprot_accessions as string[] | undefined)
    : null;

  return (
    <div
      className={`relative flex items-center justify-between py-2 px-2.5 rounded-md cursor-pointer transition-colors
        ${componentState.hovered ? 'bg-stone-50' : 'hover:bg-gray-50'}
        ${!componentState.visible ? 'opacity-40' : ''}`}
      style={{ borderLeft: `3px solid ${borderColor}` }}
      onMouseEnter={() => {
        instance?.highlightChain(chain.chainId, true);
        if (labelsEnabled) instance?.showComponentLabel(chain.chainId);
      }}
      onMouseLeave={() => {
        instance?.highlightChain(chain.chainId, false);
        instance?.hideComponentLabel();
      }}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5">
          <span className="text-xs font-medium text-gray-800">{displayName}</span>
          <span className="text-[10px] font-mono text-gray-300">{chain.chainId}</span>
          {uniprotIds?.[0] && (
            <a
              href={`https://www.uniprot.org/uniprot/${uniprotIds[0]}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[9px] text-blue-400 hover:text-blue-600"
              onClick={e => e.stopPropagation()}
            >
              {uniprotIds[0]}
            </a>
          )}
        </div>
      </div>
      <div className="flex items-center gap-0.5 flex-shrink-0 ml-1">
        <button
          onClick={e => {
            e.stopPropagation();
            onShowSequence?.(isSequenceActive ? null : chain.chainId);
          }}
          className={`p-1 transition-colors ${isSequenceActive ? 'text-blue-500' : 'text-gray-400 hover:text-blue-600'}`}
          title={isSequenceActive ? 'Hide sequence' : 'Show sequence'}
        >
          <AlignLeft size={14} />
        </button>
        <button
          onClick={e => {
            e.stopPropagation();
            instance?.enterMonomerView(chain.chainId);
          }}
          className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
          title="Open monomer view"
        >
          <Microscope size={14} />
        </button>
        <button
          onClick={e => {
            e.stopPropagation();
            instance?.focusChain(chain.chainId);
          }}
          className="p-1 text-gray-400 hover:text-gray-700 transition-colors"
          title="Focus camera"
        >
          <Focus size={14} />
        </button>
        <button
          onClick={e => {
            e.stopPropagation();
            instance?.setChainVisibility(chain.chainId, !componentState.visible);
          }}
          className="p-1 text-gray-400 hover:text-gray-700 transition-colors"
          title={componentState.visible ? 'Hide' : 'Show'}
        >
          {componentState.visible ? <Eye size={14} /> : <EyeOff size={14} />}
        </button>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────
// LigandRow
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
  const componentState = useAppSelector(state =>
    selectComponentState(state, 'structure', ligand.uniqueKey)
  );

  const info = getNonpolymerEntityInfo(profile, ligand.compId, ligand.authAsymId, ligand.authSeqId);
  const chemName = info?.entity && 'chemical_name' in info.entity
    ? (info.entity.chemical_name as string | undefined)
    : null;

  const parentFamily = getFamilyForChain(profile, ligand.authAsymId);
  const parentName = parentFamily ? familyDisplayName(parentFamily) : null;
  const parentColor = familyBorderColor(parentFamily, ghostMode);

  return (
    <div
      className={`flex items-center justify-between py-2 px-2.5 rounded-md cursor-pointer transition-colors
        ${componentState.hovered ? 'bg-stone-50' : 'hover:bg-gray-50'}
        ${!componentState.visible ? 'opacity-40' : ''}`}
      style={{ borderLeft: `3px solid ${parentColor}` }}
      onMouseEnter={() => {
        instance?.highlightLigand(ligand.uniqueKey, true);
        if (labelsEnabled) instance?.showComponentLabel(ligand.uniqueKey);
      }}
      onMouseLeave={() => {
        instance?.highlightLigand(ligand.uniqueKey, false);
        instance?.hideComponentLabel();
      }}
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
            instance?.focusLigand(ligand.uniqueKey);
          }}
          className="p-1 text-gray-400 hover:text-gray-700 transition-colors"
          title="Focus camera"
        >
          <Focus size={14} />
        </button>
        <button
          onClick={e => {
            e.stopPropagation();
            instance?.setLigandVisibility(ligand.uniqueKey, !componentState.visible);
          }}
          className="p-1 text-gray-400 hover:text-gray-700 transition-colors"
          title={componentState.visible ? 'Hide' : 'Show'}
        >
          {componentState.visible ? <Eye size={14} /> : <EyeOff size={14} />}
        </button>
      </div>
    </div>
  );
}
