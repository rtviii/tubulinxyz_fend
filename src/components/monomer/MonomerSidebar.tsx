import { useMemo, useState, useCallback } from 'react';
import { ArrowLeft, Plus, EyeOff, Eye, Download, X, Focus } from 'lucide-react';
import { getFamilyForChain, StructureProfile } from '@/lib/profile_utils';
import { formatFamilyShort } from '@/lib/formatters';
import { makeChainKey } from '@/lib/chain_key';
import { useAppDispatch, useAppSelector } from '@/store/store';
import {
  hideAllVisibility,
  toggleAllLigandsByChemId,
  toggleModificationType,
  selectAllUniqueLigandIds,
  selectAllLigandSitesForExport,
  selectPrimaryChainKey,
  selectChainData,
  selectChainVisibility,
  clearChain,
} from '@/store/slices/annotationsSlice';
import {
  setHoveredChain,
  toggleSelectedChain,
  selectHoveredChainKey,
  selectSelectedChainKey,
} from '@/store/slices/chainFocusSlice';
import { LIGAND_IGNORE_IDS } from '@/components/molstar/colors/palette';
import type { MolstarInstance } from '@/components/molstar/services/MolstarInstance';
import type { PolymerComponent, AlignedStructure } from '@/components/molstar/core/types';
import type { MSAHandle } from '@/components/msa/types';
import { AlignmentDialog } from './AlignmentDialog';
import { ModificationsPanel } from '@/components/annotations/ModificationsPanel';

export interface MonomerSidebarProps {
  activeChainId: string | null;
  polymerComponents: PolymerComponent[];
  alignedStructures: AlignedStructure[];
  instance: MolstarInstance | null;
  pdbId: string | null;
  profile: StructureProfile | null;
  masterLength: number;
  msaRef: React.RefObject<MSAHandle>;
  alignDialogOpen?: boolean;
  onAlignDialogOpenChange?: (open: boolean) => void;
}

function downloadJSON(data: any, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const FAMILY_SHORT: Record<string, string> = {
  tubulin_alpha: '\u03B1',
  tubulin_beta: '\u03B2',
  tubulin_gamma: '\u03B3',
  tubulin_delta: '\u03B4',
  tubulin_epsilon: '\u03B5',
};

export function MonomerSidebar({
  activeChainId,
  polymerComponents,
  alignedStructures,
  instance,
  pdbId,
  profile,
  masterLength,
  msaRef,
  alignDialogOpen: externalOpen,
  onAlignDialogOpenChange,
}: MonomerSidebarProps) {
  const dispatch = useAppDispatch();
  const [internalOpen, setInternalOpen] = useState(false);
  const alignDialogOpen = externalOpen ?? internalOpen;
  const setAlignDialogOpen = onAlignDialogOpenChange ?? setInternalOpen;

  const hoveredChainKey = useAppSelector(selectHoveredChainKey);
  const selectedChainKey = useAppSelector(selectSelectedChainKey);

  const activeFamily = activeChainId
    ? getFamilyForChain(profile, activeChainId)
    : undefined;
  const formattedFamily = activeFamily ? formatFamilyShort(activeFamily) : null;

  // Global annotation state
  const allLigandIds = useAppSelector(selectAllUniqueLigandIds);
  const allSitesForExport = useAppSelector(selectAllLigandSitesForExport);
  const filteredLigandIds = useMemo(
    () => allLigandIds.filter(l => !LIGAND_IGNORE_IDS.has(l.chemId)),
    [allLigandIds]
  );

  // Aligned chain sections
  const alignedSections = useMemo(() => {
    return alignedStructures.map(a => ({
      chainKey: makeChainKey(a.sourcePdbId, a.sourceChainId),
      pdbId: a.sourcePdbId,
      chainId: a.sourceChainId,
      family: a.family,
      id: a.id,
      targetChainId: a.targetChainId,
      rmsd: a.rmsd,
      visible: a.visible,
    }));
  }, [alignedStructures]);

  const handleSolo = useCallback((soloChainKey: string) => {
    if (!instance || !activeChainId) return;
    for (const a of alignedStructures) {
      const ck = makeChainKey(a.sourcePdbId, a.sourceChainId);
      instance.setAlignedStructureVisible(a.targetChainId, a.id, ck === soloChainKey);
    }
  }, [instance, activeChainId, alignedStructures]);

  // ── Export helpers ──

  const handleExportAll = useCallback(() => {
    const filtered = allSitesForExport.filter(s => !LIGAND_IGNORE_IDS.has(s.ligandId));
    if (filtered.length === 0) return;

    const grouped: Record<string, typeof filtered> = {};
    for (const site of filtered) {
      if (!grouped[site.ligandId]) grouped[site.ligandId] = [];
      grouped[site.ligandId].push(site);
    }

    const payload = {
      exported_at: new Date().toISOString(),
      primary: pdbId && activeChainId ? `${pdbId}_${activeChainId}` : null,
      total_sites: filtered.length,
      by_ligand: grouped,
    };

    const prefix = pdbId ?? 'export';
    downloadJSON(payload, `${prefix}_all_ligand_sites.json`);
  }, [allSitesForExport, pdbId, activeChainId]);

  const handleExportByChemId = useCallback((chemId: string) => {
    const sites = allSitesForExport.filter(s => s.ligandId === chemId);
    if (sites.length === 0) return;

    const payload = {
      exported_at: new Date().toISOString(),
      ligand_id: chemId,
      primary: pdbId && activeChainId ? `${pdbId}_${activeChainId}` : null,
      total_sites: sites.length,
      sites,
    };

    const prefix = pdbId ?? 'export';
    downloadJSON(payload, `${prefix}_${chemId}_binding_sites.json`);
  }, [allSitesForExport, pdbId, activeChainId]);

  const hasAnySites = filteredLigandIds.length > 0;

  // Global modifications (family-level)
  const primaryKey = useAppSelector(selectPrimaryChainKey);
  const primaryData = useAppSelector(state => primaryKey ? selectChainData(state, primaryKey) : null);
  const primaryVisibility = useAppSelector(state => primaryKey ? selectChainVisibility(state, primaryKey) : null);
  const globalModifications = primaryData?.modifications ?? [];
  const globalVisibleModTypes = primaryVisibility?.visibleModificationTypes ?? [];

  const handleToggleModType = useCallback((modType: string) => {
    if (primaryKey) dispatch(toggleModificationType({ chainKey: primaryKey, modType }));
  }, [dispatch, primaryKey]);

  return (
    <div className="h-full bg-white border-r border-gray-200 flex flex-col overflow-hidden text-xs">
      {/* ── Header ── */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 flex-shrink-0">
        <button
          onClick={() => instance?.exitMonomerView()}
          className="p-1 text-gray-400 hover:text-gray-700 flex-shrink-0"
          title="Back to structure view"
        >
          <ArrowLeft size={14} />
        </button>

        <span className="font-semibold text-sm text-gray-800 truncate">
          {pdbId}
          <span className="text-gray-400 mx-0.5">/</span>
          {activeChainId}
        </span>

        {formattedFamily && (
          <span className="text-[10px] text-gray-400 flex-shrink-0">({formattedFamily})</span>
        )}

        <div className="ml-auto flex items-center gap-0.5 flex-shrink-0">
          {polymerComponents.map(chain => (
            <button
              key={chain.chainId}
              onClick={() => {
                if (chain.chainId !== activeChainId) instance?.switchMonomerChain(chain.chainId);
              }}
              className={`w-6 h-6 text-[10px] font-mono rounded ${
                chain.chainId === activeChainId
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {chain.chainId}
            </button>
          ))}
        </div>
      </div>

      {/* ── Scrollable content ── */}
      <div className="flex-1 min-h-0 overflow-y-auto">

        {/* ── Ligand toggles ── */}
        {(filteredLigandIds.length > 0) && (
          <div className="px-3 py-2 border-b border-gray-100">
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                Ligands ({filteredLigandIds.length})
              </span>
              <div className="ml-auto flex items-center gap-0.5">
                <button
                  onClick={() => dispatch(hideAllVisibility())}
                  className="p-0.5 text-gray-300 hover:text-gray-600"
                  title="Hide all"
                >
                  <EyeOff size={11} />
                </button>
                {hasAnySites && (
                  <button
                    onClick={handleExportAll}
                    className="p-0.5 text-gray-300 hover:text-green-600"
                    title="Export all ligand binding sites (JSON)"
                  >
                    <Download size={11} />
                  </button>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-1">
              {filteredLigandIds.map(lig => (
                <div key={lig.chemId} className="group/lig relative flex items-center">
                  <button
                    onClick={() => dispatch(toggleAllLigandsByChemId(lig.chemId))}
                    className={`flex items-center gap-0.5 pl-1.5 pr-1 py-0.5 text-[9px] font-mono font-medium rounded-l border transition-colors ${
                      lig.anyVisible
                        ? 'text-white border-transparent'
                        : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}
                    style={lig.anyVisible ? { backgroundColor: lig.color, borderColor: lig.color } : undefined}
                    title={`Toggle ${lig.chemId} across all chains (${lig.count} sites)`}
                  >
                    {lig.chemId}
                    <span className={`text-[8px] ${lig.anyVisible ? 'text-white/70' : 'text-gray-300'}`}>
                      {lig.count}
                    </span>
                  </button>
                  <button
                    onClick={() => handleExportByChemId(lig.chemId)}
                    className={`px-0.5 py-0.5 text-[9px] rounded-r border-l-0 border transition-colors opacity-0 group-hover/lig:opacity-100 ${
                      lig.anyVisible
                        ? 'text-white/70 hover:text-white border-transparent'
                        : 'bg-white border-gray-200 text-gray-300 hover:text-green-500'
                    }`}
                    style={lig.anyVisible ? { backgroundColor: lig.color, borderColor: lig.color } : undefined}
                    title={`Export all ${lig.chemId} binding sites (JSON)`}
                  >
                    <Download size={8} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Aligned chains ── */}
        {alignedSections.length > 0 && (
          <div className="px-3 py-2 border-b border-gray-100">
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                Aligned ({alignedSections.length})
              </span>
              <button
                onClick={() => setAlignDialogOpen(true)}
                className="ml-auto p-0.5 text-gray-300 hover:text-blue-600"
                title="Add alignment"
              >
                <Plus size={11} />
              </button>
            </div>
            <div className="space-y-0.5">
              {alignedSections.map(a => {
                const familyLabel = a.family ? (FAMILY_SHORT[a.family] ?? '') : '';
                const isHovered = hoveredChainKey === a.chainKey;
                const isSelected = selectedChainKey === a.chainKey;

                return (
                  <div
                    key={a.chainKey}
                    className={`flex items-center gap-1.5 px-1.5 py-1 rounded text-[10px] transition-colors
                      ${isSelected ? 'bg-green-50 ring-1 ring-green-300' : isHovered ? 'bg-blue-50/50' : 'hover:bg-gray-50'}
                    `}
                    onMouseEnter={() => dispatch(setHoveredChain(a.chainKey))}
                    onMouseLeave={() => dispatch(setHoveredChain(null))}
                    onClick={() => dispatch(toggleSelectedChain(a.chainKey))}
                  >
                    {familyLabel && (
                      <span className="text-gray-400 w-3 text-center flex-shrink-0">{familyLabel}</span>
                    )}
                    <span className="font-mono text-gray-700 flex-shrink-0">
                      {a.pdbId}:{a.chainId}
                    </span>
                    {a.rmsd != null && (
                      <span className="text-gray-400">{a.rmsd.toFixed(2)}A</span>
                    )}

                    <div className="ml-auto flex items-center gap-0.5 flex-shrink-0">
                      <button
                        onClick={e => { e.stopPropagation(); handleSolo(a.chainKey); }}
                        className="p-0.5 text-gray-300 hover:text-blue-600"
                        title="Solo"
                      >
                        <Focus size={10} />
                      </button>
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          instance?.setAlignedStructureVisible(a.targetChainId, a.id, !a.visible);
                        }}
                        className="p-0.5 text-gray-300 hover:text-gray-600"
                        title={a.visible ? 'Hide' : 'Show'}
                      >
                        {a.visible ? <Eye size={10} /> : <EyeOff size={10} />}
                      </button>
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          instance?.removeAlignedStructureById(a.targetChainId, a.id);
                          dispatch(clearChain(a.chainKey));
                        }}
                        className="p-0.5 text-gray-300 hover:text-red-500"
                        title="Remove"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Add alignment button when no aligned chains */}
        {alignedSections.length === 0 && (
          <div className="px-3 py-2 border-b border-gray-100">
            <button
              onClick={() => setAlignDialogOpen(true)}
              className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-blue-600"
            >
              <Plus size={11} />
              Add alignment
            </button>
          </div>
        )}

        {/* ── Modifications (family-level) ── */}
        {globalModifications.length > 0 && (
          <div className="px-3 py-2">
            <div className="mb-1.5">
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                Modifications
              </span>
            </div>
            <ModificationsPanel
              modifications={globalModifications}
              visibleModificationTypes={globalVisibleModTypes}
              onToggleModificationType={handleToggleModType}
            />
          </div>
        )}
      </div>

      {alignDialogOpen && activeChainId && (
        <AlignmentDialog
          targetChainId={activeChainId}
          targetFamily={activeFamily}
          instance={instance}
          masterLength={masterLength}
          alignedStructures={alignedStructures}
          primaryPdbId={pdbId}
          onClose={() => setAlignDialogOpen(false)}
        />
      )}
    </div>
  );
}
