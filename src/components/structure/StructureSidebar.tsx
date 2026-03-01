// src/components/structure/StructureSidebar.tsx

import { useAppSelector } from '@/store/store';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { selectComponentState } from '@/components/molstar/state/selectors';
import { getFamilyForChain, StructureProfile } from '@/lib/profile_utils';
import { formatFamilyShort } from '@/lib/formatters';
import { getHexForFamily, getHexForLigand } from '@/components/molstar/colors/palette';
import type { MolstarInstance } from '@/components/molstar/services/MolstarInstance';
import type { PolymerComponent, LigandComponent } from '@/components/molstar/core/types';
import {
  Eye,
  EyeOff,
  Focus,
  Microscope,
  ExternalLink,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { ExplorerPanel } from '@/components/explorer/ExplorerPanel';
import type { ExplorerContext } from '@/components/explorer/types';

interface StructureSidebarProps {
  loadedStructure: string | null;
  polymerComponents: PolymerComponent[];
  ligandComponents: LigandComponent[];
  instance: MolstarInstance | null;
  error: string | null;
  profile: StructureProfile | null;
}

export function StructureSidebar({
  loadedStructure,
  polymerComponents,
  ligandComponents,
  instance,
  error,
  profile,
}: StructureSidebarProps) {
  const router = useRouter();
  const [ghostMode, setGhostMode] = useState(false);
  const [ligandsExpanded, setLigandsExpanded] = useState(false);

  const toggleGhost = () => {
    const next = !ghostMode;
    setGhostMode(next);
    instance?.setStructureGhostColors(next);
  };

  const isLandingStructure =
    loadedStructure === '1JFF' || loadedStructure === '6WVM';
  const isDimer = loadedStructure === '1JFF';

  const explorerContext: ExplorerContext = {
    instance,
    profile,
    pdbId: loadedStructure,
  };

  return (
    <div className="h-full bg-white border-r border-gray-200 flex flex-col overflow-hidden">
      {/* Header block */}
      <div className="px-4 pt-4 pb-3 border-b border-gray-100">
        <div className="flex items-baseline justify-between gap-2 mb-1">
          <div className="flex items-baseline gap-2">
            <h1 className="text-base font-semibold tracking-tight">
              {loadedStructure ?? 'No Structure'}
            </h1>
            {profile?.polymerization_state &&
              profile.polymerization_state !== 'unknown' && (
                <span className="text-[10px] text-gray-400 font-medium uppercase">
                  {profile.polymerization_state}
                </span>
              )}
          </div>
          {loadedStructure && (
            <div className="flex items-center gap-1 flex-shrink-0">
              
              <a
                href={`https://www.rcsb.org/structure/${loadedStructure}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-0.5 text-gray-300 hover:text-blue-500 transition-colors"
                title="RCSB PDB"
              >
                <ExternalLink size={12} />
              </a>
              <button
                onClick={toggleGhost}
                title={ghostMode ? 'Restore colors' : 'Ghost alpha/beta'}
                className={`px-1.5 py-0.5 rounded text-[10px] font-medium border transition-colors ${
                  ghostMode
                    ? 'bg-stone-100 border-stone-300 text-stone-600'
                    : 'bg-white border-gray-200 text-gray-400 hover:text-gray-600 hover:border-gray-300'
                }`}
              >
                {ghostMode ? 'Vivid' : 'Ghost'}
              </button>
            </div>
          )}
      </div>

      {profile?.citation_title && (
        <p className="text-xs text-gray-600 leading-snug mb-1">
          {profile.citation_title}
        </p>
      )}

      {(profile?.citation_rcsb_authors || profile?.citation_year) && (
        <div className="flex items-baseline justify-between text-[11px] text-gray-400 mb-1.5">
          <span className="italic truncate mr-2">
            {formatAuthors(profile?.citation_rcsb_authors ?? null)}
          </span>
          {profile?.citation_year && (
            <span className="flex-shrink-0">{profile.citation_year}</span>
          )}
        </div>
      )}

      {profile?.citation_pdbx_doi && (

<a
        href = {`https://doi.org/${profile.citation_pdbx_doi}`}
      target="_blank"
      rel="noopener noreferrer"
      className="text-[10px] text-blue-400 hover:text-blue-600 block truncate mb-2"
          >
      {profile.citation_pdbx_doi}
    </a>
  )
}

{ profile && <MetadataGrid profile={profile} /> }

{
  isLandingStructure && (
    <div className="flex items-center gap-1 mt-2">
      <button
        onClick={() =>
          router.push(`/structures/${isDimer ? '6WVM' : '1JFF'}`)
        }
        className="text-[10px] px-2 py-0.5 rounded border border-gray-200 text-gray-500 hover:border-blue-300 hover:text-blue-600 transition-colors"
      >
        Switch to {isDimer ? 'Lattice (6WVM)' : 'Dimer (1JFF)'}
      </button>
    </div>
  )
}
      </div >

  { error && (
    <div className="text-red-500 text-xs mx-4 mt-2 p-2 bg-red-50 rounded">
      {error}
    </div>
  )}

{/* Scrollable content */ }
<div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-4">
  <section>
    <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">
      Chains
    </h2>
    <div className="space-y-0.5">
      {polymerComponents.map(chain => (
        <ChainRow
          key={chain.chainId}
          chain={chain}
          instance={instance}
          profile={profile}
        />
      ))}
    </div>
  </section>

  {ligandComponents.length > 0 && (
    <section>
      <button
        onClick={() => setLigandsExpanded(!ligandsExpanded)}
        className="flex items-center gap-1 text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5 hover:text-gray-700"
      >
        {ligandsExpanded ? (
          <ChevronDown size={12} />
        ) : (
          <ChevronRight size={12} />
        )}
        Ligands
        <span className="text-gray-300 font-normal normal-case">
          ({ligandComponents.length})
        </span>
      </button>
      {ligandsExpanded && (
        <div className="space-y-0.5">
          {ligandComponents.map(ligand => (
            <LigandRow
              key={ligand.uniqueKey}
              ligand={ligand}
              instance={instance}
              profile={profile}
            />
          ))}
        </div>
      )}
    </section>
  )}

  <ExplorerPanel context={explorerContext} />
</div>
    </div >
  );
}

// ────────────────────────────────────────────
// MetadataGrid
// ────────────────────────────────────────────

function MetadataGrid({ profile }: { profile: StructureProfile }) {
  const { expMethod, resolution, deposition_date, src_organism_names, pdbx_keywords } =
    profile;

  const methodRes = [
    expMethod ? abbreviateMethod(expMethod) : null,
    resolution != null ? `${resolution} \u00C5` : null,
  ]
    .filter(Boolean)
    .join(' \u00B7 ');

  const year = deposition_date ? new Date(deposition_date).getFullYear() : null;
  const organisms = src_organism_names?.length
    ? src_organism_names.join(', ')
    : null;

  return (
    <div className="text-[11px] text-gray-500 space-y-0.5">
      {methodRes && (
        <div className="flex items-center gap-1.5">
          <MethodBadge method={expMethod} />
          <span>{methodRes}</span>
          {year && <span className="text-gray-300">({year})</span>}
        </div>
      )}
      {organisms && (
        <div className="truncate" title={organisms}>
          {organisms}
        </div>
      )}
      {pdbx_keywords && (
        <div className="text-gray-400 truncate" title={pdbx_keywords}>
          {pdbx_keywords}
        </div>
      )}
    </div>
  );
}

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
// Helpers
// ────────────────────────────────────────────

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

/** Look up a polymer entity from profile by chain id */
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

/** Look up a nonpolymer entity from profile by compId + chain + seqId */
function getNonpolymerEntityInfo(
  profile: StructureProfile | null,
  compId: string,
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
// ChainRow
// ────────────────────────────────────────────

function ChainRow({
  chain,
  instance,
  profile,
}: {
  chain: PolymerComponent;
  instance: MolstarInstance | null;
  profile: StructureProfile | null;
}) {
  const componentState = useAppSelector(state =>
    selectComponentState(state, 'structure', chain.chainId)
  );

  const family = getFamilyForChain(profile, chain.chainId);
  const familyLabel = family ? formatFamilyShort(family) : null;
  const hexColor = getHexForFamily(family);

  // Pull richer info from profile
  const info = getPolymerEntityInfo(profile, chain.chainId);
  const organism = info?.entity && 'src_organism_names' in info.entity
    ? (info.entity.src_organism_names as string[] | undefined)?.[0]
    : null;
  const uniprotId = info?.entity && 'uniprot_id' in info.entity
    ? (info.entity.uniprot_id as string | undefined)
    : null;

  return (
    <div
      className={`flex items-center justify-between py-1.5 px-2 rounded text-sm cursor-pointer transition-colors ${componentState.hovered ? 'bg-blue-50' : 'hover:bg-gray-50'
        }`}
      onMouseEnter={() => {
        instance?.highlightChain(chain.chainId, true);
        instance?.showComponentLabel(chain.chainId);
      }}
      onMouseLeave={() => {
        instance?.highlightChain(chain.chainId, false);
        instance?.hideComponentLabel();
      }}
      onClick={() => instance?.focusChain(chain.chainId)}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span
          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: hexColor }}
        />
        <div className="min-w-0">
          <div className="flex items-baseline gap-1.5">
            <span className="font-mono text-xs font-semibold">{chain.chainId}</span>
            {familyLabel && (
              <span className="text-[10px] text-gray-500">{familyLabel}</span>
            )}
          </div>
          {(organism || uniprotId) && (
            <div className="text-[9px] text-gray-400 truncate">
              {organism}
              {organism && uniprotId && ' \u00B7 '}
              {uniprotId}
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-0.5 flex-shrink-0">
        <button
          onClick={e => {
            e.stopPropagation();
            instance?.enterMonomerView(chain.chainId);
          }}
          className="p-1 text-gray-300 hover:text-blue-600 transition-colors"
          title="Open monomer view"
        >
          <Microscope size={13} />
        </button>
        <button
          onClick={e => {
            e.stopPropagation();
            instance?.focusChain(chain.chainId);
          }}
          className="p-1 text-gray-300 hover:text-gray-600 transition-colors"
        >
          <Focus size={13} />
        </button>
        <button
          onClick={e => {
            e.stopPropagation();
            instance?.setChainVisibility(chain.chainId, !componentState.visible);
          }}
          className="p-1 text-gray-300 hover:text-gray-600 transition-colors"
        >
          {componentState.visible ? <Eye size={13} /> : <EyeOff size={13} />}
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
}: {
  ligand: LigandComponent;
  instance: MolstarInstance | null;
  profile: StructureProfile | null;
}) {
  const componentState = useAppSelector(state =>
    selectComponentState(state, 'structure', ligand.uniqueKey)
  );

  const hexColor = getHexForLigand(ligand.compId);
  const info = getNonpolymerEntityInfo(profile, ligand.compId, ligand.authAsymId, ligand.authSeqId);
  const chemName = info?.entity && 'chemical_name' in info.entity
    ? (info.entity.chemical_name as string | undefined)
    : null;

  // Which chain family is this ligand bound near?
  const parentFamily = getFamilyForChain(profile, ligand.authAsymId);
  const parentFamilyLabel = parentFamily ? formatFamilyShort(parentFamily) : null;

  return (
    <div
      className={`flex items-center justify-between py-1.5 px-2 rounded text-sm cursor-pointer transition-colors ${componentState.hovered ? 'bg-blue-50' : 'hover:bg-gray-50'
        }`}
      onMouseEnter={() => {
        instance?.highlightLigand(ligand.uniqueKey, true);
        instance?.showComponentLabel(ligand.uniqueKey);
      }}
      onMouseLeave={() => {
        instance?.highlightLigand(ligand.uniqueKey, false);
        instance?.hideComponentLabel();
      }}
      onClick={() => instance?.focusLigand(ligand.uniqueKey)}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span
          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: hexColor }}
        />
        <div className="min-w-0">
          <div className="flex items-baseline gap-1.5">
            <span className="font-mono text-xs font-semibold">{ligand.compId}</span>
            <span className="text-[10px] text-gray-400">
              {ligand.authAsymId}:{ligand.authSeqId}
            </span>
          </div>
          {(chemName || parentFamilyLabel) && (
            <div className="text-[9px] text-gray-400 truncate">
              {chemName}
              {chemName && parentFamilyLabel && ' \u00B7 '}
              {parentFamilyLabel && (
                <span style={{ color: getHexForFamily(parentFamily) }}>
                  {parentFamilyLabel}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-0.5 flex-shrink-0">
        <button
          onClick={e => {
            e.stopPropagation();
            instance?.focusLigand(ligand.uniqueKey);
          }}
          className="p-1 text-gray-300 hover:text-gray-600 transition-colors"
        >
          <Focus size={13} />
        </button>
        <button
          onClick={e => {
            e.stopPropagation();
            instance?.setLigandVisibility(ligand.uniqueKey, !componentState.visible);
          }}
          className="p-1 text-gray-300 hover:text-gray-600 transition-colors"
        >
          {componentState.visible ? <Eye size={13} /> : <EyeOff size={13} />}
        </button>
      </div>
    </div>
  );
}