'use client';

import { useMemo } from 'react';
import type { MolstarInstance } from '@/components/molstar/services/MolstarInstance';
import type { MolstarInstanceId } from '@/components/molstar/core/types';
import { Home, LayoutGrid, Mail } from 'lucide-react';
import type { StructureProfile } from '@/lib/profile_utils';
import { getFamilyForChain, getIsotypeForChain } from '@/lib/profile_utils';

const FAMILY_GREEK: Record<string, string> = {
  tubulin_alpha: '\u03B1',
  tubulin_beta: '\u03B2',
  tubulin_gamma: '\u03B3',
  tubulin_delta: '\u03B4',
  tubulin_epsilon: '\u03B5',
};
import {
  AppPill,
  PillDivider,
  PillNavLink,
  PillAnchor,
  PillChatInput,
  PillCrumb,
} from '@/components/ui/AppPill';
import { StructureSlugBlock } from './StructureSlugBlock';

interface MonomerToolbarProps {
  instanceId: MolstarInstanceId;
  instance: MolstarInstance | null;
  loadedStructure: string | null;
  profile: StructureProfile | null;
  activeChainId: string | null;
}

/**
 * Expert-mode pill (viewMode === 'monomer', chain-focused view).
 *
 * Layout:
 *   [ Home · Structures · ( PDB+species, clickable back to easy ) · ( Chain / isotype, highlighted = current ) ]
 *   |  chat · feedback
 */
export function MonomerToolbar({
  instance,
  loadedStructure,
  profile,
  activeChainId,
}: MonomerToolbarProps) {
  const exitToEasyMode = () => instance?.exitMonomerView();

  const chainLabel = useMemo(() => {
    if (!activeChainId) return null;
    const isotype = getIsotypeForChain(profile, activeChainId);
    if (isotype) return isotype;
    const family = getFamilyForChain(profile, activeChainId);
    const greek = family ? FAMILY_GREEK[family] : undefined;
    if (greek) return `${greek}-tubulin · ${activeChainId}`;
    return `Chain ${activeChainId}`;
  }, [profile, activeChainId]);

  return (
    <AppPill>
      {/* ── Left: breadcrumb ── */}
      <PillNavLink href="/" icon={Home} title="Home" />
      <PillNavLink href="/structures" icon={LayoutGrid} title="Structures" />
      <StructureSlugBlock
        loadedStructure={loadedStructure}
        profile={profile}
        onClick={exitToEasyMode}
        title="Back to structure (easy mode)"
      />
      {chainLabel && (
        <PillCrumb highlighted title={`Chain ${activeChainId ?? ''}`}>
          <span className="font-mono font-semibold text-[11px]">{chainLabel}</span>
        </PillCrumb>
      )}

      <PillDivider />

      {/* ── Right: tools ── */}
      <PillChatInput placeholder="Ask about this chain..." widthClass="w-56" />

      <PillDivider />

      <PillAnchor
        href="mailto:feedback@tube.xyz?subject=tube.xyz%20feedback"
        icon={Mail}
        title="Send feedback"
      />
    </AppPill>
  );
}
