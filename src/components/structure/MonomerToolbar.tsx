'use client';

import type { MolstarInstance } from '@/components/molstar/services/MolstarInstance';
import type { MolstarInstanceId } from '@/components/molstar/core/types';
import { Mail } from 'lucide-react';
import type { StructureProfile } from '@/lib/profile_utils';
import {
  AppPill,
  PillDivider,
  PillAnchor,
} from '@/components/ui/AppPill';
import { GlobalNav } from '@/components/ui/GlobalNav';

interface MonomerToolbarProps {
  instanceId: MolstarInstanceId;
  instance: MolstarInstance | null;
  loadedStructure: string | null;
  profile: StructureProfile | null;
  activeChainId: string | null;
}

/**
 * Expert-mode pill: navigation only.
 * Structure/chain/chat now live in the top-left ChainAnchorPill.
 */
export function MonomerToolbar({
  instance,
}: MonomerToolbarProps) {
  const exitToEasyMode = () => instance?.exitMonomerView();

  return (
    <AppPill>
      <GlobalNav
        mode={{
          active: 'expert',
          onEasy: exitToEasyMode,
          onExpert: () => {},
        }}
      />
      <PillDivider />
      <PillAnchor
        href="mailto:feedback@tube.xyz?subject=tube.xyz%20feedback"
        icon={Mail}
        title="Send feedback"
      />
    </AppPill>
  );
}
