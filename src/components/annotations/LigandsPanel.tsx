'use client';

import { useState } from 'react';
import { ChevronRight, Eye, EyeOff, Focus, Download, ExternalLink } from 'lucide-react';
import { LigandSite } from '@/store/slices/annotationsSlice';
import { LIGAND_IGNORE_IDS } from '@/components/molstar/colors/palette';

interface LigandsPanelProps {
  ligandSites: LigandSite[];
  visibleLigandIds: Set<string>;
  pdbId: string;
  chainId: string;
  onToggleLigand: (siteId: string) => void;
  onFocusLigand: (siteId: string) => void;
  onShowAll: () => void;
  onHideAll: () => void;
}

export function LigandsPanel({
  ligandSites,
  visibleLigandIds,
  pdbId,
  chainId,
  onToggleLigand,
  onFocusLigand,
  onShowAll,
  onHideAll,
}: LigandsPanelProps) {
  const [expanded, setExpanded] = useState(true);
  const filtered = ligandSites.filter(s => !LIGAND_IGNORE_IDS.has(s.ligandId));
  if (filtered.length === 0) return null;

  const visibleCount = filtered.filter(s => visibleLigandIds.has(s.id)).length;

  return (
    <div>
      <div
        onClick={() => setExpanded(e => !e)}
        className="flex items-center gap-1 w-full text-left py-0.5 cursor-pointer select-none"
      >
        <ChevronRight
          size={10}
          className={`text-gray-300 transition-transform duration-100 ${expanded ? 'rotate-90' : ''}`}
        />
        <span className="text-[10px] font-medium text-gray-500">
          Ligands ({filtered.length})
        </span>
        {visibleCount > 0 && (
          <span className="text-[9px] text-blue-400">{visibleCount} on</span>
        )}
        <div className="ml-auto flex gap-1 text-[9px]" onClick={e => e.stopPropagation()}>
          <button onClick={onShowAll} className="text-blue-500 hover:text-blue-700">all</button>
          <span className="text-gray-200">|</span>
          <button onClick={onHideAll} className="text-gray-400 hover:text-gray-600">none</button>
        </div>
      </div>

      {expanded && (
        <div className="border border-gray-100 rounded bg-white overflow-hidden">
          {filtered.map(site => {
            const isVisible = visibleLigandIds.has(site.id);
            return (
              <LigandRow
                key={site.id}
                site={site}
                pdbId={pdbId}
                chainId={chainId}
                isVisible={isVisible}
                onToggle={() => onToggleLigand(site.id)}
                onFocus={() => onFocusLigand(site.id)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function LigandRow({
  site,
  pdbId,
  chainId,
  isVisible,
  onToggle,
  onFocus,
}: {
  site: LigandSite;
  pdbId: string;
  chainId: string;
  isVisible: boolean;
  onToggle: () => void;
  onFocus: () => void;
}) {
  return (
    <div className="group flex items-center gap-1.5 px-1.5 py-1 hover:bg-gray-50 text-[10px] border-b border-gray-50 last:border-b-0">
      {/* Color indicator */}
      <div
        className="w-1.5 h-4 rounded-sm flex-shrink-0"
        style={{ backgroundColor: isVisible ? site.color : '#e0e0e0' }}
      />

      {/* Ligand ID */}
      <span className="w-10 font-mono font-semibold text-gray-700 flex-shrink-0 truncate">
        {site.ligandId}
      </span>

      {/* Ligand name */}
      <span
        className="flex-1 min-w-0 text-gray-400 truncate"
        title={site.ligandName}
      >
        {site.ligandName}
      </span>

      {/* Residue count */}
      <span className="w-8 text-right text-gray-400 flex-shrink-0 tabular-nums">
        {site.residueCount}r
      </span>

      {/* Ligand chain:seqId */}
      <span className="w-10 font-mono text-[9px] text-gray-300 flex-shrink-0 text-right">
        {site.ligandChain}:{site.ligandAuthSeqId}
      </span>

      {/* Actions */}
      <div className="flex items-center gap-0.5 flex-shrink-0 ml-0.5">
        {site.drugbankId && (

          <a
            href={`https://go.drugbank.com/drugs/${site.drugbankId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="p-0.5 text-gray-200 hover:text-blue-500 opacity-0 group-hover:opacity-100"
            onClick={e => e.stopPropagation()}
            title={site.drugbankId}
          >
            <ExternalLink size={9} />
          </a>
        )}
        <button
          onClick={onToggle}
          className="p-0.5 text-gray-300 hover:text-gray-600"
          title={isVisible ? 'Hide' : 'Show'}
        >
          {isVisible ? <Eye size={10} /> : <EyeOff size={10} />}
        </button>
        <button
          onClick={onFocus}
          className="p-0.5 text-gray-200 hover:text-blue-500 opacity-0 group-hover:opacity-100"
          title="Focus in viewer"
        >
          <Focus size={10} />
        </button>
        <button
          onClick={() => downloadSiteJSON(site, pdbId, chainId)}
          className="p-0.5 text-gray-200 hover:text-green-500 opacity-0 group-hover:opacity-100"
          title="Download binding site data"
        >
          <Download size={10} />
        </button>
      </div>
    </div>
  );
}

function downloadSiteJSON(site: LigandSite, pdbId: string, chainId: string) {
  const data = {
    pdbId,
    chainId,
    ligandId: site.ligandId,
    ligandName: site.ligandName,
    ligandChain: site.ligandChain,
    ligandAuthSeqId: site.ligandAuthSeqId,
    drugbankId: site.drugbankId,
    residueCount: site.residueCount,
    masterIndices: site.masterIndices,
    authSeqIds: site.authSeqIds,
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${pdbId}_${chainId}_${site.ligandId}_${site.ligandChain}${site.ligandAuthSeqId}_binding_site.json`;
  a.click();
  URL.revokeObjectURL(url);
}