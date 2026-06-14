'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Focus, ArrowUpRight } from 'lucide-react';
import { useAppSelector } from '@/store/store';
import { getHexForFamily, TUBULIN_GHOST_COLORS } from '@/components/molstar/colors/palette';
import { isAlignableFamily } from '@/lib/profile_utils';
import type { StructureProfile } from '@/lib/profile_utils';
import type { MolstarInstance } from '@/components/molstar/services/MolstarInstance';
import type { PolymerComponent } from '@/components/molstar/core/types';
import type { PolypeptideEntity } from '@/store/tubxz_api';

// ── Family helpers ──

const TUBULIN_GREEK: Record<string, string> = {
  alpha: 'α',
  beta: 'β',
  gamma: 'γ',
  delta: 'δ',
  epsilon: 'ε',
  zeta: 'ζ',
  eta: 'η',
};

export function familyDisplayName(family?: string | null): string {
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

export function familyGlyph(family?: string | null): string {
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

export interface EntityGroup {
  entityId: string;
  entity: PolypeptideEntity | null;
  family: string | undefined;
  chains: PolymerComponent[];
}

export function groupChainsByEntity(
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

// ── PolymerFamilyToolbox: one chip + hover popover per entity group ──

interface PolymerFamilyToolboxProps {
  group: EntityGroup;
  loadedStructure: string | null;
  instance: MolstarInstance | null;
  /** Expert (monomer) mode: chain rows switch the active chain instead of
   *  opening a new expert view, and the chip highlights when it owns the
   *  active chain. */
  isMonomerView?: boolean;
  activeChainId?: string | null;
  /** Switch the active monomer chain (expert mode). */
  onSwitchChain?: (chainId: string) => void;
}

export function PolymerFamilyToolbox({
  group,
  loadedStructure,
  instance,
  isMonomerView = false,
  activeChainId = null,
  onSwitchChain,
}: PolymerFamilyToolboxProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const chainIds = useMemo(() => group.chains.map(c => c.chainId), [group.chains]);

  const anyVisible = useAppSelector(state => {
    const cs = state.molstarInstances.instances.structure?.componentStates;
    return cs ? chainIds.some(id => cs[id]?.visible ?? true) : true;
  });

  // Whether this family has an MSA alignment (i.e. its chains can open in
  // expert mode). Non-alignable families (other tubulins, MAPs, unclassified)
  // are still listed and focusable in 3D, just not openable in expert view.
  const alignable = isAlignableFamily(group.family);
  // In expert mode, light up the chip whose family owns the active chain.
  const ownsActiveChain = isMonomerView && activeChainId != null && chainIds.includes(activeChainId);

  const familyName = familyDisplayName(group.family);
  const familyColor = getHexForFamily(group.family);
  const entity = group.entity;
  const isotype = entity && 'isotype' in entity ? entity.isotype : null;
  const uniprot = entity?.uniprot_accessions?.[0];
  const organism = entity?.src_organism_names?.[0];

  const toggleAll = () => {
    if (!instance) return;
    for (const id of chainIds) instance.setChainVisibility(id, !anyVisible);
  };
  const focusFirst = () => {
    if (group.chains[0]) instance?.focusChain(group.chains[0].chainId);
  };
  const enterExpertOnChain = (chainId: string) => {
    // Prefer the imperative path (same as the toolbar's Expert button): the
    // structure page snapshots URL state only at mount, so a router.push to the
    // already-loaded page wouldn't switch views. Fall back to a URL navigation
    // when no live instance is available (e.g. cross-page entry).
    if (instance) {
      instance.enterMonomerView(chainId);
      return;
    }
    if (loadedStructure) {
      router.push(`/structures/${loadedStructure}?mode=monomer&chain=${chainId}`);
    }
  };

  const closeTimer = useMemo(() => ({ id: 0 as any }), []);
  const handleEnter = () => {
    if (closeTimer.id) clearTimeout(closeTimer.id);
    setOpen(true);
  };
  const handleLeave = () => {
    closeTimer.id = setTimeout(() => setOpen(false), 80);
  };

  return (
    <div
      className="relative"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      {/* ── Chip ── */}
      <button
        type="button"
        className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full
                   border bg-white hover:bg-slate-50 text-[10px] transition-colors
                   ${ownsActiveChain ? 'border-slate-400 ring-1 ring-slate-300' : 'border-slate-200/80'}`}
        style={{ backgroundColor: ghostHex(group.family) + '18' }}
        title={isMonomerView ? `${familyName} — switch chain` : familyName}
      >
        <span
          className="font-semibold text-[11px] leading-none"
          style={{ color: familyColor }}
        >
          {familyGlyph(group.family)}
        </span>
        <span className="text-slate-500 text-[9px]">{group.chains.length}</span>
      </button>

      {/* ── Popover ── */}
      {open && (
        <div
          className="absolute left-0 top-[calc(100%+4px)] z-30
                     w-[18rem] max-h-[60vh] overflow-y-auto rounded-lg
                     border border-slate-200 bg-white shadow-lg text-[11px]"
        >
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
            {!isMonomerView && (
              <button
                onClick={toggleAll}
                className="p-0.5 text-slate-400 hover:text-slate-700"
                title={anyVisible ? 'Hide all chains in this group' : 'Show all chains in this group'}
              >
                {anyVisible ? <Eye size={11} /> : <EyeOff size={11} />}
              </button>
            )}
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
          {!alignable && (
            <div className="px-2 pb-1 text-[9px] text-amber-600/90 leading-snug">
              No alignment yet — expert / MSA view unavailable for this family.
            </div>
          )}
          <div className="px-1 pb-1 flex flex-wrap gap-0.5 border-t border-slate-100 pt-1">
            {group.chains.map(chain => (
              <ChainChip
                key={chain.chainId}
                chainId={chain.chainId}
                instance={instance}
                mode={isMonomerView ? 'expert' : 'easy'}
                isActive={chain.chainId === activeChainId}
                alignable={alignable}
                onEnterExpert={() => enterExpertOnChain(chain.chainId)}
                onSwitch={() => onSwitchChain?.(chain.chainId)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const NO_ALIGN_TIP = 'No alignment for this family yet — expert / MSA view unavailable';

function ChainChip({
  chainId,
  instance,
  mode,
  isActive,
  alignable,
  onEnterExpert,
  onSwitch,
}: {
  chainId: string;
  instance: MolstarInstance | null;
  mode: 'easy' | 'expert';
  isActive: boolean;
  alignable: boolean;
  onEnterExpert: () => void;
  onSwitch: () => void;
}) {
  const visible = useAppSelector(
    state => state.molstarInstances.instances.structure?.componentStates?.[chainId]?.visible ?? true
  );

  const handleEnter = () => instance?.highlightChain(chainId, true);
  const handleLeave = () => instance?.highlightChain(chainId, false);

  // Expert mode: the chain row IS the switch control. Active chain is marked;
  // non-alignable chains are inert with a disclaimer tooltip.
  if (mode === 'expert') {
    const tip = isActive
      ? 'Current chain'
      : alignable
        ? `Switch to chain ${chainId}`
        : NO_ALIGN_TIP;
    return (
      <div
        className={`group/chain flex items-center gap-0.5 pl-1.5 pr-0.5 py-px rounded
                    border text-[10px] font-mono transition-colors
                    ${isActive
                      ? 'border-slate-400 bg-slate-100 text-slate-900'
                      : alignable
                        ? 'border-slate-200 bg-white text-slate-700'
                        : 'border-slate-100 bg-slate-50 text-slate-300'}`}
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
      >
        <button
          onClick={() => { if (!isActive && alignable) onSwitch(); }}
          disabled={isActive || !alignable}
          className="px-0.5 disabled:cursor-default"
          title={tip}
        >
          {chainId}
        </button>
        <button
          onClick={() => instance?.focusChain(chainId)}
          className="p-0.5 text-slate-300 hover:text-slate-700"
          title="Focus in 3D"
        >
          <Focus size={9} />
        </button>
      </div>
    );
  }

  // Easy mode: visibility + focus + (gated) open-in-expert.
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
        onClick={() => { if (alignable) onEnterExpert(); }}
        disabled={!alignable}
        className="p-0.5 text-slate-300 hover:text-blue-600 disabled:text-slate-200 disabled:cursor-default"
        title={alignable ? 'Open in expert mode' : NO_ALIGN_TIP}
      >
        <ArrowUpRight size={9} />
      </button>
    </div>
  );
}
