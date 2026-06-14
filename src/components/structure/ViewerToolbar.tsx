// src/components/structure/ViewerToolbar.tsx
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
import { useAppSelector } from '@/store/store';
import { selectExpertHintActive } from '@/store/slices/chainFocusSlice';

interface ViewerToolbarProps {
  instanceId: MolstarInstanceId;
  instance: MolstarInstance | null;
  loadedStructure: string | null;
  profile: StructureProfile | null;
  /** Primary chain id to enter monomer view with when the user clicks "to expert". */
  defaultMonomerChainId?: string | null;
}

/**
 * Easy-mode pill: navigation only.
 * Structure slug + ligand chips now live in the top-left ChainAnchorPill.
 */
export function ViewerToolbar({
  instance,
  defaultMonomerChainId,
}: ViewerToolbarProps) {
  const enterExpertMode = () => {
    if (defaultMonomerChainId) instance?.enterMonomerView(defaultMonomerChainId);
  };
  const expertHintActive = useAppSelector(selectExpertHintActive);

  return (
    <AppPill>
      <GlobalNav
        mode={{
          active: 'easy',
          onEasy: () => {},
          onExpert: enterExpertMode,
          expertDisabled: !defaultMonomerChainId,
          expertTitle: defaultMonomerChainId
            ? undefined
            : 'No α/β tubulin chain with an alignment in this structure',
          expertHint: expertHintActive,
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
