'use client';

import { useState } from 'react';
import { ExternalLink } from 'lucide-react';
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

interface StructureSlugBlockProps {
  loadedStructure: string | null;
  profile: StructureProfile | null;
  /** Visual "current page" treatment (gray bg). */
  highlighted?: boolean;
  /** When provided, the slug becomes clickable (used in expert mode to step back to structure view). */
  onClick?: () => void;
  /** Accessible title attribute for the slug. */
  title?: string;
}

/**
 * Structure breadcrumb entry: PDB id + organism, with a hover popover
 * containing full citation metadata. Styled to live inside AppPill.
 */
export function StructureSlugBlock({
  loadedStructure,
  profile,
  highlighted = false,
  onClick,
  title,
}: StructureSlugBlockProps) {
  const [showMeta, setShowMeta] = useState(false);
  const organism = profile?.src_organism_names?.[0] ?? null;
  const method = profile?.expMethod ? abbreviateMethod(profile.expMethod) : null;

  const base = 'flex items-baseline gap-1.5 px-2 py-1 rounded-full transition-colors';
  const tone = highlighted
    ? 'bg-slate-100/70 text-slate-700'
    : onClick
    ? 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
    : 'text-slate-700 cursor-default';

  const content = (
    <>
      <span className="font-mono font-semibold">{loadedStructure}</span>
      {organism && <span className="italic text-slate-400 text-[10px]">{organism}</span>}
    </>
  );

  return (
    <div
      className="relative"
      onMouseEnter={() => setShowMeta(true)}
      onMouseLeave={() => setShowMeta(false)}
    >
      {onClick ? (
        <button type="button" onClick={onClick} title={title} className={`${base} ${tone}`}>
          {content}
        </button>
      ) : (
        <div title={title} className={`${base} ${tone}`}>
          {content}
        </div>
      )}

      {showMeta && profile && (
        <div
          className="absolute left-0 top-full mt-1
                     w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-50 p-3 space-y-1.5"
        >
          <div className="flex items-baseline gap-2">
            <span className="font-mono font-semibold text-sm text-gray-800">{loadedStructure}</span>
            {profile.polymerization_state && profile.polymerization_state !== 'unknown' && (
              <span className="text-[10px] text-gray-400 font-medium uppercase">{profile.polymerization_state}</span>
            )}
            {method && (
              <span
                className={`text-[9px] font-semibold px-1 py-px rounded border ${
                  method === 'EM'
                    ? 'bg-teal-50 text-teal-600 border-teal-200'
                    : method === 'X-ray'
                    ? 'bg-violet-50 text-violet-600 border-violet-200'
                    : 'bg-gray-50 text-gray-500 border-gray-200'
                }`}
              >
                {method}
              </span>
            )}
            {profile.resolution != null && (
              <span className="text-[10px] font-mono text-gray-400">
                {profile.resolution} {'\u00C5'}
              </span>
            )}
          </div>

          {profile.citation_title && (
            <p className="text-[11px] text-gray-600 leading-snug">{profile.citation_title}</p>
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

          {organism && <div className="text-[10px] italic text-gray-400">{organism}</div>}

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
  );
}
