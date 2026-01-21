// src/app/msalite/services/annotationSyncService.ts
import { MolstarInstance } from '@/components/molstar/services/MolstarInstance';
import { 
  applyCombinedColoring, 
  clearColorConfig,
  RowHighlight,
} from './msaColorService';
import { 
  AnnotationData, 
  EnabledAnnotations, 
  getBindingSiteColor,
  MUTATION_COLOR,
} from '../components/AnnotationPanel';
import { ResidueColoring } from '@/components/molstar/coloring/types';
import { Color } from 'molstar/lib/mol-util/color';
import { PositionMapping } from '@/store/slices/sequence_registry';

interface SyncColoringParams {
  annotations: AnnotationData;
  enabled: EnabledAnnotations;
  positionMapping: PositionMapping | null;
  chainId: string;
  activeSequenceIndex: number;
  instance: MolstarInstance | null;
  onMsaRedraw: () => void;
}

/**
 * Apply annotation coloring to both MSA and Molstar in sync.
 */
export function applyAnnotationColoring({
  annotations,
  enabled,
  positionMapping,
  chainId,
  activeSequenceIndex,
  instance,
  onMsaRedraw,
}: SyncColoringParams): void {
  const { bindingSites = [], mutations = [] } = annotations;
  const { bindingSites: enabledSites, showMutations } = enabled;

  // If nothing enabled, clear everything
  if (enabledSites.size === 0 && !showMutations) {
    clearColorConfig();
    instance?.restoreDefaultColors();
    onMsaRedraw();
    return;
  }

  // Build MSA coloring data
  const columnColors = new Map<number, string>();
  const rowHighlights: RowHighlight[] = [];

  // Build Molstar coloring data
  const molstarColorings: ResidueColoring[] = [];

  // Process binding sites
  bindingSites
    .filter((site) => enabledSites.has(site.id))
    .forEach((site) => {
      const colorHex = getBindingSiteColor(site);
      const colorInt = parseInt(colorHex.replace('#', ''), 16);

      site.positions.forEach((msaPos) => {
        // MSA: column-wide coloring
        columnColors.set(msaPos, colorHex);

        // Molstar: translate MSA position to auth_seq_id
        if (positionMapping) {
          const authSeqId = positionMapping[msaPos];
          if (authSeqId !== undefined) {
            molstarColorings.push({
              chainId,
              authSeqId,
              color: Color(colorInt),
            });
          }
        }
      });
    });

  // Process mutations
  if (showMutations && mutations.length > 0) {
    const mutationColorInt = parseInt(MUTATION_COLOR.replace('#', ''), 16);

    mutations.forEach((mut) => {
      // MSA: row-specific highlighting
      rowHighlights.push({
        rowIndex: activeSequenceIndex,
        start: mut.masterIndex,
        end: mut.masterIndex,
        color: MUTATION_COLOR,
      });

      // Molstar: translate MSA position to auth_seq_id
      if (positionMapping) {
        const authSeqId = positionMapping[mut.masterIndex];
        if (authSeqId !== undefined) {
          molstarColorings.push({
            chainId,
            authSeqId,
            color: Color(mutationColorInt),
          });
        }
      }
    });
  }

  // Apply to MSA
  if (columnColors.size > 0 || rowHighlights.length > 0) {
    applyCombinedColoring(columnColors, rowHighlights, '#f8f8f8');
  }
  onMsaRedraw();

  // Apply to Molstar
  if (instance && molstarColorings.length > 0) {
    instance.applyColorscheme('annotations', molstarColorings);
  } else if (instance) {
    instance.restoreDefaultColors();
  }
}

/**
 * Clear all annotation coloring from both MSA and Molstar.
 */
export function clearAnnotationColoring(
  instance: MolstarInstance | null,
  onMsaRedraw: () => void
): void {
  clearColorConfig();
  instance?.restoreDefaultColors();
  onMsaRedraw();
}