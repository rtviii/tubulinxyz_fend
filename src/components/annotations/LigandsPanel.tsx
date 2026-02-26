'use client';
import { ExternalLink } from 'lucide-react';
import { LigandSite } from '@/store/slices/annotationsSlice';
import { LIGAND_IGNORE_IDS } from '@/components/molstar/colors/palette';

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
  const filtered = ligandSites.filter(s => !LIGAND_IGNORE_IDS.has(s.ligandId));
  if (filtered.length === 0) return null;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-[10px] font-medium text-gray-500">
          Ligands ({filtered.length})
        </span>
        <div className="ml-auto flex gap-1 text-[9px]">
          <button onClick={onShowAll} className="text-blue-500 hover:text-blue-700">all</button>
          <span className="text-gray-200">|</span>
          <button onClick={onHideAll} className="text-gray-400 hover:text-gray-600">none</button>
        </div>
      </div>

      {/* Pill grid */}
      <div className="flex flex-wrap gap-1">
        {filtered.map(site => {
          const isVisible = visibleLigandIds.has(site.id);
          return (
            <LigandPill
              key={site.id}
              site={site}
              isVisible={isVisible}
              onToggle={() => onToggleLigand(site.id)}
              onFocus={() => onFocusLigand(site.id)}
            />
          );
        })}
      </div>
    </div>
  );
}

function LigandPill({
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
  // Parse hex to rgba for the tinted background
  const tintBg = isVisible ? hexToRgba(site.color, 0.1) : 'transparent';
  const borderColor = isVisible ? site.color : hexToRgba(site.color, 0.3);

  return (
    <div
      className={`
        group relative flex items-center gap-1 px-1.5 py-0.5 rounded-full cursor-pointer
        border text-[10px] transition-colors select-none
        ${isVisible ? 'text-gray-700' : 'text-gray-400'}
      `}
      style={{
        borderColor,
        backgroundColor: tintBg,
      }}
      onClick={onToggle}
      onDoubleClick={(e) => { e.stopPropagation(); onFocus(); }}
      title={`${site.ligandName} -- ${site.residueCount} residues. Click to toggle, double-click to focus.`}
    >
      <span className="font-mono font-medium leading-none">{site.ligandId}</span>
      <span className="text-[8px] text-gray-400 leading-none">{site.residueCount}</span>

      {site.drugbankId && (

        <a href = {`https://go.drugbank.com/drugs/${site.drugbankId}`}
      target="_blank"
      rel="noopener noreferrer"
      className="text-blue-400 hover:text-blue-600 hidden group-hover:inline-flex"
      onClick={e => e.stopPropagation()}
      title={site.drugbankId}
        >
      <ExternalLink size={8} />
    </a>
  )
}
    </div >
  );
}

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return `rgba(128,128,128,${alpha})`;
  return `rgba(${r},${g},${b},${alpha})`;
}