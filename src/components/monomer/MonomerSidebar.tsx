import { useMemo, useState, useCallback } from 'react';
import { ArrowLeft, Plus, EyeOff, Eye, Download } from 'lucide-react';
import { ChainRow } from './ChainRow';
import { getFamilyForChain, StructureProfile } from '@/lib/profile_utils';
import { formatFamilyShort } from '@/lib/formatters';
import { makeChainKey } from '@/lib/chain_key';
import { useAppDispatch, useAppSelector } from '@/store/store';
import {
  hideAllVisibility,
  toggleAllVariants,
  toggleAllLigandsByChemId,
  selectAnyVariantsVisible,
  selectAllUniqueLigandIds,
  selectAllLigandSitesForExport,
} from '@/store/slices/annotationsSlice';
import { LIGAND_IGNORE_IDS } from '@/components/molstar/colors/palette';
import type { MolstarInstance } from '@/components/molstar/services/MolstarInstance';
import type { PolymerComponent, AlignedStructure } from '@/components/molstar/core/types';
import type { MSAHandle } from '@/components/msa/types';
import { AlignmentDialog } from './AlignmentDialog';

export interface MonomerSidebarProps {
  activeChainId: string | null;
  polymerComponents: PolymerComponent[];
  alignedStructures: AlignedStructure[];
  instance: MolstarInstance | null;
  pdbId: string | null;
  profile: StructureProfile | null;
  masterLength: number;
  msaRef: React.RefObject<MSAHandle>;
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

export function MonomerSidebar({
  activeChainId,
  polymerComponents,
  alignedStructures,
  instance,
  pdbId,
  profile,
  masterLength,
  msaRef,
}: MonomerSidebarProps) {
  const dispatch = useAppDispatch();
  const [alignDialogOpen, setAlignDialogOpen] = useState(false);

  const activeFamily = activeChainId
    ? getFamilyForChain(profile, activeChainId)
    : undefined;
  const formattedFamily = activeFamily ? formatFamilyShort(activeFamily) : null;

  // Global annotation state
  const anyVariantsVisible = useAppSelector(selectAnyVariantsVisible);
  const allLigandIds = useAppSelector(selectAllUniqueLigandIds);
  const allSitesForExport = useAppSelector(selectAllLigandSitesForExport);
  const filteredLigandIds = useMemo(
    () => allLigandIds.filter(l => !LIGAND_IGNORE_IDS.has(l.chemId)),
    [allLigandIds]
  );

  const chainSections = useMemo(() => {
    const sections: Array<{
      chainKey: string;
      pdbId: string;
      chainId: string;
      isPrimary: boolean;
      family?: string;
      aligned?: { id: string; targetChainId: string; rmsd: number | null; visible: boolean };
    }> = [];

    if (pdbId && activeChainId) {
      sections.push({
        chainKey: makeChainKey(pdbId, activeChainId),
        pdbId,
        chainId: activeChainId,
        isPrimary: true,
        family: activeFamily,
      });
    }

    for (const a of alignedStructures) {
      sections.push({
        chainKey: makeChainKey(a.sourcePdbId, a.sourceChainId),
        pdbId: a.sourcePdbId,
        chainId: a.sourceChainId,
        isPrimary: false,
        family: a.family,
        aligned: {
          id: a.id,
          targetChainId: a.targetChainId,
          rmsd: a.rmsd,
          visible: a.visible,
        },
      });
    }

    return sections;
  }, [pdbId, activeChainId, activeFamily, alignedStructures]);

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

    // Group by ligand chemical ID
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

  return (
    <div className="h-full bg-white border-r border-gray-200 flex flex-col overflow-hidden text-xs">
      {/* ── Header ── */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100">
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

      {/* ── Toolbar ── */}
      <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-gray-100 bg-gray-50/50">
        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mr-auto">
          Monomers
        </span>

        <button
          onClick={() => setAlignDialogOpen(true)}
          className="p-1 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50"
          title="Add alignment"
        >
          <Plus size={13} />
        </button>

        <button
          onClick={() => dispatch(hideAllVisibility())}
          className="p-1 text-gray-400 hover:text-gray-700 rounded hover:bg-gray-100"
          title="Hide all annotations"
        >
          <EyeOff size={13} />
        </button>

        {hasAnySites && (
          <button
            onClick={handleExportAll}
            className="p-1 text-gray-400 hover:text-green-600 rounded hover:bg-green-50"
            title="Export all ligand binding sites (JSON)"
          >
            <Download size={13} />
          </button>
        )}
      </div>

      {/* ── Global annotation controls ── */}
      {chainSections.length > 0 && (filteredLigandIds.length > 0 || chainSections.length > 0) && (
        <div className="px-3 py-1.5 border-b border-gray-100 space-y-1.5">
          {/* Global variants toggle */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => dispatch(toggleAllVariants())}
              className={`flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-medium rounded border transition-colors ${
                anyVariantsVisible
                  ? 'bg-orange-50 border-orange-200 text-orange-600'
                  : 'bg-white border-gray-200 text-gray-400 hover:border-gray-300'
              }`}
            >
              {anyVariantsVisible ? <Eye size={9} /> : <EyeOff size={9} />}
              All variants
            </button>
          </div>

          {/* Per-ligand global toggles with export */}
          {filteredLigandIds.length > 0 && (
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
          )}
        </div>
      )}

      {/* ── Chain list ── */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {chainSections.map(section => (
          <ChainRow
            key={section.chainKey}
            chainKey={section.chainKey}
            pdbId={section.pdbId}
            chainId={section.chainId}
            isPrimary={section.isPrimary}
            family={section.family}
            aligned={section.aligned}
            instance={instance}
            msaRef={msaRef}
            onSolo={section.isPrimary ? undefined : handleSolo}
          />
        ))}
        {chainSections.length === 0 && (
          <p className="text-gray-400 text-center py-6">
            Enter monomer view to see annotations
          </p>
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