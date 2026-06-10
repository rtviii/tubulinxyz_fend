'use client';

// Renders text with entity references (PDB ids, chemical ids, families) as
// inline clickable pills. Conservative: only matches entities that appear in
// the provided `entities` array — never invents pills from regex alone, so
// blurbs can't hallucinate clickable garbage.
//
// Used by AssistantResultsPanel on the front page to make blurbs feel like
// documents you can poke at, not search results.

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { buildCatalogueUrl, buildStructureUrl } from '@/lib/url_state';
import type { ActionCard } from './globalTypes';

export type InlineEntityTone = 'structure' | 'ligand' | 'family';

export interface InlineEntity {
  // Text to match in the source (case-insensitive). Must be a word.
  match: string;
  // Where to navigate when the pill is clicked.
  href: string;
  tone: InlineEntityTone;
}

const TONE_CLASS: Record<InlineEntityTone, string> = {
  structure: 'text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100',
  ligand: 'text-amber-700 bg-amber-50 border-amber-200 hover:bg-amber-100',
  family: 'text-rose-700 bg-rose-50 border-rose-200 hover:bg-rose-100',
};

export interface PillifiedTextProps {
  text: string;
  entities: InlineEntity[];
  className?: string;
  // When false, pills render as non-clickable spans (parent owns click).
  // Used inside CardChip where the whole card is the click target.
  interactive?: boolean;
}

export function PillifiedText({
  text,
  entities,
  className,
  interactive = true,
}: PillifiedTextProps) {
  const router = useRouter();
  const tokens = useMemo(() => tokenize(text, entities), [text, entities]);
  const pillClass = (tone: InlineEntityTone) =>
    `inline-flex items-baseline px-1 py-0 mx-0.5 rounded border text-[10px] font-mono font-semibold align-baseline ${TONE_CLASS[tone]}`;

  return (
    <span className={className}>
      {tokens.map((t, i) => {
        if (!t.entity) return <span key={i}>{t.text}</span>;
        if (!interactive) {
          return (
            <span key={i} className={pillClass(t.entity.tone)}>
              {t.text}
            </span>
          );
        }
        return (
          <button
            key={i}
            type="button"
            onClick={(ev) => {
              ev.stopPropagation();
              router.push(t.entity!.href);
            }}
            className={`${pillClass(t.entity.tone)} transition-colors hover:brightness-95 cursor-pointer`}
          >
            {t.text}
          </button>
        );
      })}
    </span>
  );
}

// Build InlineEntities for a single card's own fields (rcsb_id, chemical_id,
// family, focus_ligands, aligned). Used for non-interactive pillification of
// the card's `description` text — the parent card owns the click, so `href`
// is unused.
export function inlineEntitiesFromCard(card: {
  rcsb_id?: string;
  chemical_id?: string;
  family?: string;
  focus_ligands?: string[];
  aligned?: Array<{ rcsb_id: string; auth_asym_id: string }>;
}): InlineEntity[] {
  const seen = new Set<string>();
  const out: InlineEntity[] = [];
  const push = (match: string | undefined, tone: InlineEntityTone) => {
    if (!match) return;
    const key = `${tone}:${match.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ match, href: '', tone });
  };
  if (card.rcsb_id) push(card.rcsb_id.toUpperCase(), 'structure');
  if (card.chemical_id) push(card.chemical_id.toUpperCase(), 'ligand');
  for (const cid of card.focus_ligands ?? []) push(cid.toUpperCase(), 'ligand');
  if (card.family) push(card.family, 'family');
  for (const ar of card.aligned ?? []) push(ar.rcsb_id.toUpperCase(), 'structure');
  return out;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function entitiesFromGlobalResponse(response: { cards: ActionCard[] }): InlineEntity[] {
  const seen = new Set<string>();
  const out: InlineEntity[] = [];
  const push = (match: string | undefined, href: string, tone: InlineEntityTone) => {
    if (!match) return;
    const key = `${tone}:${match.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ match, href, tone });
  };

  for (const card of response.cards) {
    if (card.rcsb_id) {
      push(card.rcsb_id.toUpperCase(), buildStructureUrl(card.rcsb_id), 'structure');
    }
    if (card.chemical_id) {
      push(
        card.chemical_id.toUpperCase(),
        buildCatalogueUrl({ ligands: [card.chemical_id] }),
        'ligand',
      );
    }
    for (const cid of card.focus_ligands ?? []) {
      push(cid.toUpperCase(), buildCatalogueUrl({ ligands: [cid] }), 'ligand');
    }
    if (card.family) {
      push(card.family, buildCatalogueUrl({ family: [card.family] }), 'family');
    }
  }
  return out;
}

// Tokenize `text` against entity matches. Longest-first so e.g. "TA1" wins
// over hypothetical "TA" if both were registered.
function tokenize(
  text: string,
  entities: InlineEntity[],
): Array<{ text: string; entity?: InlineEntity }> {
  if (entities.length === 0 || !text) return [{ text }];
  const sorted = [...entities].sort((a, b) => b.match.length - a.match.length);
  const pattern = new RegExp(
    `\\b(${sorted.map(e => escapeRegex(e.match)).join('|')})\\b`,
    'gi',
  );

  const tokens: Array<{ text: string; entity?: InlineEntity }> = [];
  let lastIndex = 0;
  let m: RegExpExecArray | null;

  while ((m = pattern.exec(text)) !== null) {
    if (m.index > lastIndex) {
      tokens.push({ text: text.slice(lastIndex, m.index) });
    }
    const matched = m[1];
    const entity = sorted.find(e => e.match.toLowerCase() === matched.toLowerCase());
    tokens.push({ text: matched, entity });
    lastIndex = m.index + matched.length;
  }
  if (lastIndex < text.length) {
    tokens.push({ text: text.slice(lastIndex) });
  }
  return tokens;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
