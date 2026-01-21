// src/app/msalite/components/BindingSitePanel.tsx
'use client';

import { MapPin, Eye, EyeOff, Focus } from 'lucide-react';

// ============================================================
// Types
// ============================================================

export interface BindingSiteRegion {
  id: string;
  name: string;
  color: string;
  // MSA positions (will be translated to auth_seq_ids via mapping)
  regions: { start: number; end: number }[];
}

interface BindingSitePanelProps {
  sites: BindingSiteRegion[];
  onSiteToggle: (siteId: string, enabled: boolean) => void;
  onSiteFocus: (siteId: string) => void;
  activeSites: Set<string>;
}

// ============================================================
// Default binding sites (mock data for tubulin)
// ============================================================

export const TUBULIN_BINDING_SITES: BindingSiteRegion[] = [
  {
    id: 'colchicine',
    name: 'Colchicine',
    color: '#e6194b',
    regions: [{ start: 247, end: 260 }, { start: 314, end: 320 }],
  },
  {
    id: 'taxol',
    name: 'Paclitaxel (Taxol)',
    color: '#3cb44b',
    regions: [{ start: 22, end: 28 }, { start: 225, end: 232 }, { start: 272, end: 278 }],
  },
  {
    id: 'vinblastine',
    name: 'Vinblastine',
    color: '#ffe119',
    regions: [{ start: 175, end: 182 }, { start: 212, end: 218 }],
  },
  {
    id: 'gtp',
    name: 'GTP/GDP',
    color: '#4363d8',
    regions: [{ start: 10, end: 20 }, { start: 140, end: 148 }],
  },
  {
    id: 'mapt',
    name: 'MAP/Tau',
    color: '#f58231',
    regions: [{ start: 430, end: 445 }],
  },
];

// ============================================================
// Helper to expand regions to individual positions
// ============================================================

export function expandRegionsToPositions(regions: { start: number; end: number }[]): number[] {
  const positions: number[] = [];
  for (const { start, end } of regions) {
    for (let i = start; i <= end; i++) {
      positions.push(i);
    }
  }
  return positions;
}

// ============================================================
// Component
// ============================================================

export function BindingSitePanel({
  sites,
  onSiteToggle,
  onSiteFocus,
  activeSites,
}: BindingSitePanelProps) {
  return (
    <div className="space-y-1">
      {sites.map((site) => {
        const isActive = activeSites.has(site.id);
        const totalPositions = site.regions.reduce((sum, r) => sum + (r.end - r.start + 1), 0);
        const rangeLabel = site.regions
          .map(r => r.start === r.end ? `${r.start}` : `${r.start}-${r.end}`)
          .join(', ');

        return (
          <div
            key={site.id}
            className={`
              flex items-center gap-2 px-2 py-1.5 rounded text-xs
              transition-colors cursor-pointer
              ${isActive ? 'bg-gray-100' : 'hover:bg-gray-50'}
            `}
            onClick={() => onSiteToggle(site.id, !isActive)}
          >
            {/* Color indicator */}
            <div
              className="w-3 h-3 rounded-sm flex-shrink-0 border border-black/10"
              style={{ backgroundColor: isActive ? site.color : '#e5e5e5' }}
            />

            {/* Name and range */}
            <div className="flex-1 min-w-0">
              <div className={`font-medium truncate ${isActive ? 'text-gray-800' : 'text-gray-600'}`}>
                {site.name}
              </div>
              <div className="text-gray-400 text-[10px] truncate">
                {rangeLabel} ({totalPositions} pos)
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onSiteFocus(site.id);
                }}
                className="p-1 hover:bg-gray-200 rounded text-gray-400 hover:text-gray-600"
                title="Focus on site"
              >
                <Focus size={12} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}