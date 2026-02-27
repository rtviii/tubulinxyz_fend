// src/components/explorer/types.ts

import type { MolstarInstance } from '@/components/molstar/services/MolstarInstance';
import type { StructureProfile } from '@/lib/profile_utils';

export interface ExplorerContext {
  instance: MolstarInstance | null;
  profile: StructureProfile | null;
  pdbId: string | null;
}

export interface ExplorerQuestion {
  id: string;
  label: string;
  description: string;
  /** Whether this question applies to the current structure */
  available: boolean;
  /** Whether data is currently loading */
  isLoading: boolean;
  /** Whether this question's visualization is currently active */
  isActive: boolean;
  execute: () => Promise<void>;
  clear: () => Promise<void>;
}