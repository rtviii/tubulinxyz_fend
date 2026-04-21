'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { useListStructuresQuery } from '@/store/tubxz_api';
import { useDebounce } from '@/lib/useDebounce';

/**
 * Small pill-embedded combobox letting users jump to another PDB structure
 * without going back to the catalogue. Hits the same /structures search API.
 */
export function PdbQuickPicker({ currentPdbId }: { currentPdbId?: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const debounced = useDebounce(query.trim(), 200);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data, isFetching } = useListStructuresQuery(
    { search: debounced || null, limit: 8 },
    { skip: !open || debounced.length === 0 }
  );

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const navigateTo = (rcsb_id: string) => {
    setOpen(false);
    setQuery('');
    if (rcsb_id !== currentPdbId) {
      router.push(`/structures/${rcsb_id}`);
    }
  };

  const items = data?.data ?? [];

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1 px-1.5 py-1.5 rounded-full
                   text-slate-400 hover:text-slate-700 transition-colors"
        title="Jump to another structure"
        type="button"
      >
        <Search size={13} />
      </button>

      {open && (
        <div
          className="absolute left-0 top-full mt-2 w-64 bg-white border border-gray-200
                     rounded-lg shadow-lg z-50 p-1.5"
        >
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="PDB id, organism, keyword..."
            className="w-full h-7 rounded border border-slate-200 px-2 text-[11px]
                       focus:outline-none focus:border-slate-400 placeholder:text-slate-400"
            onKeyDown={e => {
              if (e.key === 'Escape') setOpen(false);
              if (e.key === 'Enter' && items.length > 0) navigateTo(items[0].rcsb_id);
            }}
          />

          <div className="mt-1.5 max-h-64 overflow-y-auto">
            {debounced.length === 0 ? (
              <p className="text-[10px] text-slate-400 px-2 py-2">Type to search structures.</p>
            ) : isFetching ? (
              <p className="text-[10px] text-slate-400 px-2 py-2">Searching...</p>
            ) : items.length === 0 ? (
              <p className="text-[10px] text-slate-400 px-2 py-2">No matches.</p>
            ) : (
              items.map(item => {
                const organism = item.src_organism_names?.[0];
                const isCurrent = item.rcsb_id === currentPdbId;
                return (
                  <button
                    key={item.rcsb_id}
                    onClick={() => navigateTo(item.rcsb_id)}
                    disabled={isCurrent}
                    className={`w-full text-left px-2 py-1.5 rounded flex items-baseline gap-2
                               ${isCurrent ? 'opacity-40 cursor-default' : 'hover:bg-slate-50'}`}
                  >
                    <span className="font-mono font-semibold text-[11px] text-slate-700">{item.rcsb_id}</span>
                    {organism && (
                      <span className="italic text-[10px] text-slate-400 truncate flex-1">{organism}</span>
                    )}
                    {item.resolution != null && (
                      <span className="text-[9px] font-mono text-slate-400 flex-shrink-0">
                        {item.resolution}
                        {'\u00C5'}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
