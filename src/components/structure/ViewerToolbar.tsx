// src/components/structure/ViewerToolbar.tsx
'use client';

import { useRef, useEffect, useState } from 'react';
import { useAppSelector, useAppDispatch } from '@/store/store';
import { setGhostMode, setLabelsEnabled } from '@/components/molstar/state/molstarInstancesSlice';
import type { MolstarInstance } from '@/components/molstar/services/MolstarInstance';
import type { MolstarInstanceId } from '@/components/molstar/core/types';
import { Tag, Eye, ExternalLink, Sparkles } from 'lucide-react';
import { ExplorerPanel } from '@/components/explorer/ExplorerPanel';
import type { ExplorerContext } from '@/components/explorer/types';
import type { StructureProfile } from '@/lib/profile_utils';

function abbreviateMethod(method: string): string {
  const upper = method.toUpperCase();
  if (upper.includes('ELECTRON MICROSCOPY') || upper.includes('CRYO')) return 'EM';
  if (upper.includes('X-RAY') || upper.includes('CRYSTAL')) return 'X-ray';
  if (upper.includes('NMR')) return 'NMR';
  if (upper.includes('NEUTRON')) return 'Neutron';
  return method;
}

function formatAuthors(authors: string[] | null): string | null {
  if (!authors || authors.length === 0) return null;
  if (authors.length === 1) return authors[0];
  if (authors.length <= 3) return authors.join(', ');
  return `${authors[0]}, ${authors[1]}, ... ${authors[authors.length - 1]}`;
}

interface ViewerToolbarProps {
  instanceId: MolstarInstanceId;
  instance: MolstarInstance | null;
  loadedStructure: string | null;
  profile: StructureProfile | null;
}

export function ViewerToolbar({ instanceId, instance, loadedStructure, profile }: ViewerToolbarProps) {
  const dispatch = useAppDispatch();
  const ghostMode = useAppSelector(s => s.molstarInstances.instances[instanceId]?.ghostMode ?? false);
  const labelsEnabled = useAppSelector(s => s.molstarInstances.instances[instanceId]?.labelsEnabled ?? true);
  const [showAssistant, setShowAssistant] = useState(false);
  const [showMeta, setShowMeta] = useState(false);
  const assistantRef = useRef<HTMLDivElement>(null);

  const toggleGhost = () => {
    const next = !ghostMode;
    dispatch(setGhostMode({ instanceId, ghostMode: next }));
    instance?.setStructureGhostColors(next);
  };

  const toggleLabels = () => {
    dispatch(setLabelsEnabled({ instanceId, labelsEnabled: !labelsEnabled }));
    if (labelsEnabled) instance?.hideComponentLabel();
  };

  const explorerContext: ExplorerContext = {
    instance,
    profile,
    pdbId: loadedStructure,
  };

  // Close assistant on outside click
  useEffect(() => {
    if (!showAssistant) return;
    const handler = (e: MouseEvent) => {
      if (assistantRef.current && !assistantRef.current.contains(e.target as Node)) {
        setShowAssistant(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showAssistant]);

  const organism = profile?.src_organism_names?.[0] ?? null;
  const method = profile?.expMethod ? abbreviateMethod(profile.expMethod) : null;

  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10
                    flex items-center gap-0 px-1 py-0.5
                    rounded-full bg-white/80 backdrop-blur border border-slate-200/60
                    shadow-sm text-[11px]">

      {/* Structure slug — hover for metadata */}
      <div
        className="relative"
        onMouseEnter={() => setShowMeta(true)}
        onMouseLeave={() => setShowMeta(false)}
      >
        <div className="flex items-baseline gap-1.5 px-2 py-1 cursor-default">
          <span className="font-mono font-semibold text-slate-700">{loadedStructure}</span>
          {organism && (
            <span className="italic text-slate-400 text-[10px]">{organism}</span>
          )}
        </div>

        {/* Hover metadata panel */}
        {showMeta && profile && (
          <div className="absolute left-0 top-full mt-1
                         w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-50 p-3 space-y-1.5">
            <div className="flex items-baseline gap-2">
              <span className="font-mono font-semibold text-sm text-gray-800">{loadedStructure}</span>
              {profile.polymerization_state && profile.polymerization_state !== 'unknown' && (
                <span className="text-[10px] text-gray-400 font-medium uppercase">{profile.polymerization_state}</span>
              )}
              {method && (
                <span className={`text-[9px] font-semibold px-1 py-px rounded border ${
                  method === 'EM' ? 'bg-teal-50 text-teal-600 border-teal-200'
                    : method === 'X-ray' ? 'bg-violet-50 text-violet-600 border-violet-200'
                    : 'bg-gray-50 text-gray-500 border-gray-200'
                }`}>{method}</span>
              )}
              {profile.resolution != null && (
                <span className="text-[10px] font-mono text-gray-400">{profile.resolution} {'\u00C5'}</span>
              )}
            </div>

            {profile.citation_title && (
              <p className="text-[11px] text-gray-600 leading-snug">
                {profile.citation_title}
              </p>
            )}

            {(profile.citation_rcsb_authors || profile.citation_year) && (
              <div className="flex items-baseline justify-between text-[10px] text-gray-400">
                <span className="italic truncate mr-2">
                  {formatAuthors(profile.citation_rcsb_authors ?? null)}
                </span>
                {profile.citation_year && (
                  <span className="flex-shrink-0">{profile.citation_year}</span>
                )}
              </div>
            )}

            {profile.citation_pdbx_doi && (
              <a
                href={`https://doi.org/${profile.citation_pdbx_doi}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-blue-400 hover:text-blue-600 block truncate"
              >
                {profile.citation_pdbx_doi}
              </a>
            )}

            {organism && (
              <div className="text-[10px] italic text-gray-400">{organism}</div>
            )}

            {profile.pdbx_keywords && (
              <div className="text-[10px] text-gray-400 truncate" title={profile.pdbx_keywords}>
                {profile.pdbx_keywords}
              </div>
            )}

            {loadedStructure && (
              <a
                href={`https://www.rcsb.org/structure/${loadedStructure}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-blue-400 hover:text-blue-600 flex items-center gap-1"
              >
                <ExternalLink size={10} /> RCSB PDB
              </a>
            )}
          </div>
        )}
      </div>

      <div className="w-px h-4 bg-slate-200" />

      {/* Tool icons */}
      <button
        onClick={toggleLabels}
        className={`p-1.5 rounded-full transition-colors ${
          labelsEnabled ? 'text-slate-600 hover:text-slate-800' : 'text-slate-300 hover:text-slate-500'
        }`}
        title={labelsEnabled ? 'Disable hover labels' : 'Enable hover labels'}
      >
        <Tag size={13} />
      </button>

      <button
        onClick={toggleGhost}
        className={`p-1.5 rounded-full transition-colors ${
          ghostMode ? 'text-stone-600 hover:text-stone-800' : 'text-slate-300 hover:text-slate-500'
        }`}
        title={ghostMode ? 'Vivid colors' : 'Ghost colors'}
      >
        <Eye size={13} />
      </button>

      <div className="w-px h-4 bg-slate-200" />

      <div className="relative">
        <button
          onClick={() => setShowAssistant(!showAssistant)}
          className={`p-1.5 rounded-full transition-colors ${
            showAssistant ? 'text-blue-500' : 'text-slate-300 hover:text-slate-500'
          }`}
          title="AI Assistant"
        >
          <Sparkles size={13} />
        </button>
        {showAssistant && (
          <div
            ref={assistantRef}
            className="absolute right-0 top-full mt-2
                       w-72 bg-white border border-gray-200 rounded-lg shadow-lg z-50 p-3"
          >
            <ExplorerPanel context={explorerContext} />
          </div>
        )}
      </div>
    </div>
  );
}
