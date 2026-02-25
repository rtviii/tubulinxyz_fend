// src/components/annotations/LigandsPanel.tsx
'use client';

import { Eye, EyeOff, Focus, ExternalLink } from 'lucide-react';
import { LigandSite } from '@/store/slices/annotationsSlice';
import { LIGAND_IGNORE_IDS } from '../molstar/colors/palette';

interface LigandsPanelProps {
  ligandSites: LigandSite[];
  visibleLigandIds: Set<string>;
  onToggleLigand: (siteId: string) => void;
  onFocusLigand: (siteId: string) => void;
  onShowAll: () => void;
  onHideAll: () => void;
}

export function LigandsPanel({
  ligandSites,
  visibleLigandIds,
  onToggleLigand,
  onFocusLigand,
  onShowAll,
  onHideAll,
}: LigandsPanelProps) {
  if (ligandSites.length === 0) return null;

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">
          Ligand Sites ({ligandSites.length})
        </span>
        <div className="flex gap-1 text-xs">
          <button
            onClick={onShowAll}
            className="text-blue-600 hover:text-blue-800"
          >
            Show all
          </button>
          <span className="text-gray-300">|</span>
          <button
            onClick={onHideAll}
            className="text-gray-500 hover:text-gray-700"
          >
            Hide all
          </button>
        </div>
      </div>

      {/* Ligand list */}
      <div className="space-y-1">
        {ligandSites
        .filter(n=>!LIGAND_IGNORE_IDS.has(n.ligandId))
        .map(site => (
          <LigandSiteRow
            key={site.id}
            site={site}
            isVisible={visibleLigandIds.has(site.id)}
            onToggle={() => onToggleLigand(site.id)}
            onFocus={() => onFocusLigand(site.id)}
          />
        ))}
      </div>
    </div>
  );
}

function LigandSiteRow({
  site,
  isVisible,
  onToggle,
  onFocus,
}: {
  site: LigandSite;
  isVisible: boolean;
  onToggle: () => void;
  onFocus: () => void;
}) {
  return (
    <div className="group flex items-center gap-2 py-1.5 px-2 rounded hover:bg-gray-50">
      {/* Color indicator */}
      <div
        className="w-3 h-3 rounded-full flex-shrink-0"
        style={{ backgroundColor: site.color }}
      />

      {/* Main info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium truncate">{site.ligandId}</span>
          {site.ligandName !== site.ligandId && (
            <span className="text-xs text-gray-400 truncate hidden sm:inline">
              {site.ligandName}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-[10px] text-gray-400">
          <span>{site.residueCount} residues</span>
          {site.drugbankId && (
            
              <a href={`https://go.drugbank.com/drugs/${site.drugbankId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-0.5 text-blue-500 hover:text-blue-700"
              onClick={e => e.stopPropagation()}
            >
              {site.drugbankId}
              <ExternalLink size={8} />
            </a>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={onFocus}
          className="p-1 text-gray-300 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity"
          title="Focus"
        >
          <Focus size={14} />
        </button>
        <button
          onClick={onToggle}
          className="p-1 text-gray-400 hover:text-gray-700"
        >
          {isVisible ? <Eye size={14} /> : <EyeOff size={14} />}
        </button>
      </div>
    </div>
  );
}