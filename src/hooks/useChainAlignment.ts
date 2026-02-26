// src/hooks/useChainAlignment.ts
/**
 * Builds chain alignment data from pre-computed profile data.
 *
 * NO runtime MUSCLE call. Reads entity_index_mapping and chain_index_mappings
 * from the profile that's already fetched via useGetStructureProfileQuery.
 */

import { useCallback, useRef, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/store';
import {
  addSequence,
  setPositionMapping,
  selectIsChainAligned,
  PositionMapping,
} from '@/store/slices/sequence_registry';
import { formatFamilyShort } from '@/lib/formatters';
import { makeChainKey } from '@/lib/chain_key';
import type { TubulinStructure, PolypeptideEntity } from '@/store/tubxz_api';

export interface AlignmentResult {
  sequenceId: string;
  alignedSequence: string;
  mapping: PositionMapping;
}

/**
 * Find the PolypeptideEntity that owns a given chain (auth_asym_id).
 */
function findEntityForChain(
  profile: TubulinStructure,
  chainId: string
): PolypeptideEntity | null {
  for (const entity of Object.values(profile.entities)) {
    if (
      'one_letter_code_can' in entity &&
      entity.pdbx_strand_ids?.includes(chainId)
    ) {
      return entity as PolypeptideEntity;
    }
  }
  return null;
}

/**
 * Build an MSA-aligned sequence row from entity-level mapping.
 *
 * Walks master positions 1..masterLength. For each position, looks up the
 * canonical position (label_seq_id) and emits the residue from
 * one_letter_code_can, or '-' for genetic deletions / unmapped positions.
 */
function buildAlignedRow(
  entity: PolypeptideEntity,
  masterLength: number
): string {
  const masterToCanonical =
    entity.entity_index_mapping?.master_to_label_seq_id;
  if (!masterToCanonical) return '-'.repeat(masterLength);

  const canonicalSeq = entity.one_letter_code_can;
  const chars: string[] = [];

  for (let masterPos = 1; masterPos <= masterLength; masterPos++) {
    const key = String(masterPos);
    const canonicalPos = masterToCanonical[key] as number | null | undefined;
    if (canonicalPos == null) {
      chars.push('-');
    } else {
      chars.push(canonicalSeq[canonicalPos - 1] ?? 'X');
    }
  }

  return chars.join('');
}

/**
 * Build a position mapping (master_index -> auth_seq_id) for a specific chain
 * from the pre-computed chain_index_mappings on the entity.
 *
 * This is what drives Molstar sync: click MSA column N -> highlight
 * auth_seq_id in 3D, and vice versa.
 */
function buildPositionMapping(
  entity: PolypeptideEntity,
  chainId: string
): PositionMapping {
  const chainMapping = entity.chain_index_mappings?.[chainId];
  if (!chainMapping) return {};

  const mapping: PositionMapping = {};
  for (const [masterStr, authSeqId] of Object.entries(
    chainMapping.master_to_auth_seq_id
  )) {
    if (authSeqId != null) {
      mapping[Number(masterStr)] = authSeqId;
    }
  }
  return mapping;
}

/**
 * Core hook: builds chain alignment data from the pre-computed profile.
 * Synchronous -- no network call, no loading state.
 */
export function useChainAlignment() {
  const dispatch = useAppDispatch();
  const builtRef = useRef<Set<string>>(new Set());

  const alignChainFromProfile = useCallback(
    (
      profile: TubulinStructure,
      chainId: string,
      masterLength: number
    ): AlignmentResult | null => {
      const pdbId = profile.rcsb_id;
      const key = makeChainKey(pdbId, chainId);

      // Already built for this chain in this session
      if (builtRef.current.has(key)) return null;
      builtRef.current.add(key);

      const entity = findEntityForChain(profile, chainId);
      if (!entity || !entity.entity_index_mapping) {
        console.warn(
          `[useChainAlignment] No entity or mapping for ${pdbId}:${chainId}`
        );
        builtRef.current.delete(key);
        return null;
      }

      const alignedSequence = buildAlignedRow(entity, masterLength);
      const positionMapping = buildPositionMapping(entity, chainId);

      const formattedFamily = formatFamilyShort(entity.family ?? undefined);
      const displayName = formattedFamily
        ? `${formattedFamily} - ${pdbId}:${chainId}`
        : `${pdbId}:${chainId}`;

      dispatch(
        addSequence({
          id: key,
          name: displayName,
          sequence: alignedSequence,
          originType: 'pdb',
          chainRef: { pdbId, chainId },
          family: entity.family ?? undefined,
        })
      );

      dispatch(
        setPositionMapping({
          sequenceId: key,
          mapping: positionMapping,
        })
      );

      return { sequenceId: key, alignedSequence, mapping: positionMapping };
    },
    [dispatch]
  );

  const resetBuiltCache = useCallback(() => {
    builtRef.current.clear();
  }, []);

  return { alignChainFromProfile, resetBuiltCache };
}

/**
 * Convenience hook for auto-aligning on mount in MonomerMSAPanel.
 * Replaces the old useEffect that triggered a MUSCLE round-trip.
 *
 * Usage:
 *   const { isAligned } = useAutoAlignFromProfile(profile, chainId, masterLength);
 */
export function useAutoAlignFromProfile(
  profile: TubulinStructure | undefined,
  chainId: string,
  masterLength: number
) {
  const { alignChainFromProfile } = useChainAlignment();

  const pdbId = profile?.rcsb_id ?? null;
  const isAligned = useAppSelector((state) =>
    pdbId ? selectIsChainAligned(state, pdbId, chainId) : false
  );

  useEffect(() => {
    if (!profile || !chainId || !masterLength || isAligned) return;
    alignChainFromProfile(profile, chainId, masterLength);
  }, [profile, chainId, masterLength, isAligned, alignChainFromProfile]);

  return { isAligned };
}