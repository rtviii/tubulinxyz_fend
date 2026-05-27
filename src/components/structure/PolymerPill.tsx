'use client';

import { useMemo, useState } from 'react';
import { Eye, EyeOff, Focus, ArrowUpRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAppSelector } from '@/store/store';
import { getHexForFamily, TUBULIN_GHOST_COLORS } from '@/components/molstar/colors/palette';
import type { StructureProfile } from '@/lib/profile_utils';
import type { MolstarInstance } from '@/components/molstar/services/MolstarInstance';
import type { PolymerComponent } from '@/components/molstar/core/types';
import type { PolypeptideEntity } from '@/store/tubxz_api';

// ── Helpers (compact copies of StructureSidebar's grouping code) ──

const TUBULIN_GREEK: Record<string, string> = {
  alpha: 'α',
  beta: 'β',
  gamma: 'γ',
  delta: 'δ',
  epsilon: 'ε',
  zeta: 'ζ',
  eta: 'η',
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
  return family;
}

function familyGlyph(family?: string | null): string {
  if (!family) return '?';
  const tubulinMatch = family.match(/^tubulin_(\w+)$/);
  if (tubulinMatch) {
    const greek = TUBULIN_GREEK[tubulinMatch[1]];
    if (greek) return greek;
  }
  return family.slice(0, 1).toUpperCase();
}

function familyRank(family?: string): number {
  if (!family) return 99;
  if (family === 'tubulin_alpha') return 0;
  if (family === 'tubulin_beta') return 1;
  if (family.startsWith('tubulin_')) return 2;
  if (family.startsWith('map_')) return 3;
  return 4;
}

function ghostHex(family?: string | null): string {
  const c = TUBULIN_GHOST_COLORS[family ?? ''] ?? TUBULIN_GHOST_COLORS.Default;
  const r = (c >> 16) & 0xFF;
  const g = (c >> 8) & 0xFF;
  const b = c & 0xFF;
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

interface EntityGroup {
  entityId: string;
  entity: PolypeptideEntity | null;
  family: string | undefined;
  chains: PolymerComponent[];
}

function groupChainsByEntity(
  polymerComponents: PolymerComponent[],
  profile: StructureProfile | null
): EntityGroup[] {
  if (!profile) {
    return polymerComponents.map(c => ({
      entityId: c.chainId,
      entity: null,
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

// ── Component ──

interface PolymerPillProps {
  loadedStructure: string | null;
  polymerComponents: PolymerComponent[];
  profile: StructureProfile | null;
  instance: MolstarInstance | null;
}

export function PolymerPill({
  loadedStructure,
  polymerComponents,
  profile,
  instance,
}: PolymerPillProps) {
  const [open, setOpen] = useState(false);

  const groups = useMemo(
    () => groupChainsByEntity(polymerComponents, profile),
    [polymerComponents, profile]
  );

  const closeTimer = useMemo(() => ({ id: 0 as any }), []);
  const handleEnter = () => {
    if (closeTimer.id) clearTimeout(closeTimer.id);
    setOpen(true);
  };
  const handleLeave = () => {
    closeTimer.id = setTimeout(() => setOpen(false), 100);
  };

  if (groups.length === 0) return null;

  return (
    <div
      className="relative"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      {/* ── Compact pill: family glyph + chain count ── */}
      <div
        className="flex items-center gap-1 px-1.5 py-0.5
                   rounded-full bg-white/80 backdrop-blur border border-slate-200/60
                   shadow-sm text-[10px]"
      >
        {groups.map(g => (
          <div
            key={g.entityId}
            className="flex items-center gap-1 px-1.5 py-px rounded-full"
            style={{ backgroundColor: ghostHex(g.family) + '20' }}
            title={familyDisplayName(g.family)}
          >
            <span
              className="font-semibold text-[11px] leading-none"
              style={{ color: getHexForFamily(g.family) }}
            >
              {familyGlyph(g.family)}
            </span>
            <span className="text-slate-500 text-[9px]">{g.chains.length}</span>
          </div>
        ))}
      </div>

      {/* ── Popover ── */}
      {open && (
        <div
          className="absolute left-0 top-[calc(100%+4px)] z-30
                     w-[18rem] max-h-[60vh] overflow-y-auto rounded-lg
                     border border-slate-200 bg-white shadow-lg text-[11px]"
        >
          {groups.map(g => (
            <EntityGroupRow
              key={g.entityId}
              group={g}
              instance={instance}
              loadedStructure={loadedStructure}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function EntityGroupRow({
  group,
  instance,
  loadedStructure,
}: {
  group: EntityGroup;
  instance: MolstarInstance | null;
  loadedStructure: string | null;
}) {
  const router = useRouter();
  const familyName = familyDisplayName(group.family);
  const familyColor = getHexForFamily(group.family);
  const entity = group.entity;
  const isotype = entity && 'isotype' in entity ? entity.isotype : null;
  const uniprot = entity?.uniprot_accessions?.[0];
  const organism = entity?.src_organism_names?.[0];

  const chainIds = group.chains.map(c => c.chainId);

  const anyVisible = useAppSelector(state => {
    const cs = state.molstarInstances.instances.structure?.componentStates;
    return cs ? chainIds.some(id => cs[id]?.visible ?? true) : true;
  });

  const toggleAll = () => {
    if (!instance) return;
    for (const id of chainIds) instance.setChainVisibility(id, !anyVisible);
  };

  const focusFirst = () => {
    if (group.chains[0]) instance?.focusChain(group.chains[0].chainId);
  };

  const enterExpertOnChain = (chainId: string) => {
    if (!loadedStructure) return;
    router.push(`/structures/${loadedStructure}?mode=monomer&chain=${chainId}`);
  };

  return (
    <div className="border-b border-slate-100 last:border-b-0">
      {/* Header */}
      <div className="px-2 pt-1.5 pb-1 flex items-center gap-1.5">
        <span
          className="font-semibold text-[11px] truncate flex-1"
          style={{ color: familyColor }}
          title={familyName}
        >
          {familyName}
        </span>
        {isotype && (
          <span className="px-1 py-px rounded bg-gray-100 text-gray-500 text-[9px] flex-shrink-0">
            {isotype}
          </span>
        )}
        {uniprot && (
          <a
            href={`https://www.uniprot.org/uniprot/${uniprot}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[9px] text-blue-400 hover:text-blue-600 flex-shrink-0"
          >
            {uniprot}
          </a>
        )}
        <button
          onClick={toggleAll}
          className="p-0.5 text-slate-400 hover:text-slate-700"
          title={anyVisible ? 'Hide all chains in this group' : 'Show all chains in this group'}
        >
          {anyVisible ? <Eye size={11} /> : <EyeOff size={11} />}
        </button>
        <button
          onClick={focusFirst}
          className="p-0.5 text-slate-400 hover:text-slate-700"
          title="Focus entity"
        >
          <Focus size={11} />
        </button>
      </div>
      {organism && (
        <div className="px-2 pb-1 text-[9px] text-slate-400 italic truncate">
          {organism}
        </div>
      )}

      {/* Chain rows */}
      <div className="px-1 pb-1 flex flex-wrap gap-0.5">
        {group.chains.map(chain => (
          <ChainChip
            key={chain.chainId}
            chainId={chain.chainId}
            instance={instance}
            onEnterExpert={() => enterExpertOnChain(chain.chainId)}
          />
        ))}
      </div>
    </div>
  );
}

function ChainChip({
  chainId,
  instance,
  onEnterExpert,
}: {
  chainId: string;
  instance: MolstarInstance | null;
  onEnterExpert: () => void;
}) {
  const visible = useAppSelector(
    state => state.molstarInstances.instances.structure?.componentStates?.[chainId]?.visible ?? true
  );

  const handleEnter = () => instance?.highlightChain(chainId, true);
  const handleLeave = () => instance?.highlightChain(chainId, false);

  return (
    <div
      className={`group/chain flex items-center gap-0.5 pl-1.5 pr-0.5 py-px rounded
                  border text-[10px] font-mono transition-colors
                  ${visible
                    ? 'border-slate-200 bg-white text-slate-700'
                    : 'border-slate-100 bg-slate-50 text-slate-400'}`}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      <span>{chainId}</span>
      <button
        onClick={() => instance?.setChainVisibility(chainId, !visible)}
        className="p-0.5 text-slate-300 hover:text-slate-700"
        title={visible ? 'Hide' : 'Show'}
      >
        {visible ? <Eye size={9} /> : <EyeOff size={9} />}
      </button>
      <button
        onClick={() => instance?.focusChain(chainId)}
        className="p-0.5 text-slate-300 hover:text-slate-700"
        title="Focus"
      >
        <Focus size={9} />
      </button>
      <button
        onClick={onEnterExpert}
        className="p-0.5 text-slate-300 hover:text-blue-600"
        title="Open in expert mode"
      >
        <ArrowUpRight size={9} />
      </button>
    </div>
  );
}
