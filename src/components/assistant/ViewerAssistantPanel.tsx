'use client';

// In-page assistant panel for the structure detail page. Sits as a floating
// overlay on /structures/[rcsb_id] and lists the entities (chains, residue
// ranges, ligands) the LLM mentioned via the MentionEntities tool, alongside
// any viewer actions it dispatched.
//
// Each pill has bidirectional sync to molstar:
//   - hover  → highlight* (transient glow)
//   - leave  → highlight* false (removes only that highlight)
//   - click  → focus* (camera centering)
//   - X      → remove pill + clear that highlight
// Panel X dismisses everything and clears all highlights/focus.

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { X, Eye, Layers, FlaskConical, MapPin, HelpCircle, Sparkles } from 'lucide-react';
import type { MolstarInstance } from '@/components/molstar/services/MolstarInstance';
import type { ActionCard, EntityKind, EntityRef, QuerySpec } from './globalTypes';
import type { AssistantSuggestedAction, AssistantViewerActionCall } from './types';
import { asAssistantTable } from './types';
import { CardChip } from './AssistantResultsPanel';
import { AssistantAnswer } from './AssistantAnswer';
import { AssistantTable } from './AssistantTable';
import { cardToHref } from './globalCommandDispatcher';
import { useAppDispatch } from '@/store/store';
import { showAssistantToast } from '@/store/slices/assistantToastSlice';

interface PillKindMeta {
  Icon: typeof Eye;
  tone: string;
  label: string;
}

const KIND_META: Record<EntityKind, PillKindMeta> = {
  chain: { Icon: Layers, tone: 'text-violet-600 bg-violet-50 border-violet-200', label: 'Chain' },
  residue_range: { Icon: MapPin, tone: 'text-emerald-600 bg-emerald-50 border-emerald-200', label: 'Range' },
  ligand: { Icon: FlaskConical, tone: 'text-amber-600 bg-amber-50 border-amber-200', label: 'Ligand' },
  structure: { Icon: Eye, tone: 'text-slate-600 bg-slate-50 border-slate-200', label: 'Structure' },
  polymer_entity: { Icon: Layers, tone: 'text-violet-600 bg-violet-50 border-violet-200', label: 'Entity' },
  family: { Icon: Layers, tone: 'text-rose-600 bg-rose-50 border-rose-200', label: 'Family' },
  variant: { Icon: HelpCircle, tone: 'text-rose-600 bg-rose-50 border-rose-200', label: 'Variant' },
};

export interface ViewerAssistantPanelProps {
  entities: EntityRef[];
  summary: string;
  // Optional navigation card — when the LLM emits EmitNavigationCard instead
  // of viewer actions. Rendered as a click-through chip; mutually exclusive
  // with `entities` in practice.
  navCard?: ActionCard | null;
  // Grounded textual answer (AssistantResult kind='answer'). Rendered as a
  // markdown block above the pills/cards.
  answer?: { markdown: string; data?: Record<string, unknown> | null } | null;
  // Routing cards (AssistantResult kind='cards' or attached to an answer).
  cards?: ActionCard[];
  // Query specs the cards reference by query_ref (drives full catalogue filters).
  queries?: QuerySpec[];
  // Viewer actions offered as clickable chips; clicking runs onRunAction.
  suggestedActions?: AssistantSuggestedAction[];
  onRunAction?: (action: AssistantViewerActionCall) => void | Promise<void>;
  instance: MolstarInstance | null;
  onDismiss: () => void;
}

export function ViewerAssistantPanel({ entities, summary, navCard, answer, cards, queries, suggestedActions, onRunAction, instance, onDismiss }: ViewerAssistantPanelProps) {
  const router = useRouter();
  const dispatch = useAppDispatch();

  // Local copy so users can dismiss individual pills without bouncing back.
  const [pills, setPills] = useState<EntityRef[]>(entities);
  useEffect(() => setPills(entities), [entities]);

  // Reverse sync: molstar hover → pill emphasis. Subscribe to the viewer's
  // hover stream and track which pill (if any) the cursor is over in 3D.
  const [hoveredPillIdx, setHoveredPillIdx] = useState<number | null>(null);
  useEffect(() => {
    if (!instance?.viewer) return;
    const unsub = instance.viewer.subscribeToHover((info) => {
      if (!info) { setHoveredPillIdx(null); return; }
      const idx = pills.findIndex(e => matchesHover(e, info.chainId, info.authSeqId));
      setHoveredPillIdx(idx >= 0 ? idx : null);
    });
    return unsub;
  }, [instance, pills]);

  const handleDismiss = () => {
    if (instance) {
      try { instance.clearHighlight(); } catch { /* noop */ }
      try { instance.clearFocus(); } catch { /* noop */ }
    }
    onDismiss();
  };

  const handleNavClick = (card: ActionCard) => {
    const { href } = cardToHref(card, queries ?? []);
    if (href && href !== '#') {
      dispatch(showAssistantToast(card));
      router.push(href);
    }
  };

  const cardList = cards ?? [];
  const chips = suggestedActions ?? [];
  if (pills.length === 0 && !summary && !navCard && !answer && cardList.length === 0 && chips.length === 0) return null;

  return (
    <div className="absolute top-3 right-3 z-30 w-[320px] pointer-events-auto">
      <div className="rounded-xl border border-slate-200/80 bg-white/95 backdrop-blur-sm shadow-lg overflow-hidden">
        {/* Header: summary + dismiss */}
        <div className="px-3 py-2 flex items-start gap-2 border-b border-slate-100">
          <div className="flex-1 min-w-0">
            {summary ? (
              <p className="text-[11px] text-slate-600 leading-snug">{summary}</p>
            ) : (
              <p className="text-[10px] text-slate-400 uppercase tracking-wider">
                {pills.length} {pills.length === 1 ? 'item' : 'items'}
              </p>
            )}
          </div>
          <button
            onClick={handleDismiss}
            className="flex-shrink-0 p-0.5 rounded text-slate-300 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            aria-label="Dismiss panel"
          >
            <X size={12} />
          </button>
        </div>

        {/* Grounded textual answer (+ optional structured table from data.table) */}
        {answer && (() => {
          const table = asAssistantTable((answer.data as Record<string, unknown> | null)?.table);
          return (
            <div className="px-3 py-2 border-b border-slate-100 space-y-2">
              {answer.markdown && <AssistantAnswer markdown={answer.markdown} />}
              {table && <AssistantTable table={table} />}
            </div>
          );
        })()}

        {/* Suggested actions — clickable chips that visualize the answer's data */}
        {chips.length > 0 && (
          <div className="px-2 py-2 flex flex-wrap gap-1.5 border-b border-slate-100">
            {chips.map((s, i) => (
              <button
                key={i}
                type="button"
                onClick={() => onRunAction?.(s.action)}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-violet-200 bg-violet-50 text-violet-700 text-[11px] font-medium hover:bg-violet-100 hover:border-violet-300 transition-colors"
                title="Visualize this in the viewer / MSA"
              >
                <Sparkles size={11} />
                {s.label}
              </button>
            ))}
          </div>
        )}

        {/* Navigation card (when LLM emitted EmitNavigationCard instead of actions) */}
        {navCard && (
          <div className="p-2">
            <CardChip
              card={navCard}
              queries={[]}
              ok={true}
              onClick={() => handleNavClick(navCard)}
            />
          </div>
        )}

        {/* Routing cards (kind='cards', or cards attached to an answer) */}
        {cardList.length > 0 && (
          <div className="p-2 flex flex-col gap-1.5">
            {cardList.map((card, i) => (
              <CardChip
                key={i}
                card={card}
                queries={[]}
                ok={true}
                onClick={() => handleNavClick(card)}
              />
            ))}
          </div>
        )}

        {/* Pills */}
        {pills.length > 0 && (
          <div className="p-2 flex flex-wrap gap-1.5">
            {pills.map((e, i) => (
              <EntityPill
                key={`${e.kind}-${i}`}
                entity={e}
                instance={instance}
                hoveredFrom3D={hoveredPillIdx === i}
                onRemove={() => {
                  applyHighlight(instance, e, false);
                  setPills(prev => prev.filter((_, idx) => idx !== i));
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Individual entity pill
// ---------------------------------------------------------------------------

function EntityPill({
  entity,
  instance,
  hoveredFrom3D = false,
  onRemove,
}: {
  entity: EntityRef;
  instance: MolstarInstance | null;
  hoveredFrom3D?: boolean;
  onRemove: () => void;
}) {
  const meta = KIND_META[entity.kind] ?? KIND_META.structure;
  const interactive = isInteractive(entity);
  const label = labelFor(entity);

  return (
    <div
      className={`
        group inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[10px] font-medium transition-all
        ${meta.tone}
        ${interactive ? 'cursor-pointer hover:shadow-sm hover:scale-[1.02]' : 'cursor-default opacity-80'}
        ${hoveredFrom3D ? 'ring-2 ring-offset-1 ring-current scale-[1.04]' : ''}
      `}
      onMouseEnter={() => interactive && applyHighlight(instance, entity, true)}
      onMouseLeave={() => interactive && applyHighlight(instance, entity, false)}
      onClick={() => interactive && applyFocus(instance, entity)}
      title={interactive ? 'Click to focus, hover to highlight' : meta.label}
    >
      <meta.Icon size={9} />
      <span className="font-mono">{label}</span>
      <button
        type="button"
        onClick={(ev) => {
          ev.stopPropagation();
          onRemove();
        }}
        className="ml-0.5 text-current opacity-40 hover:opacity-100 transition-opacity"
        aria-label="Remove"
      >
        <X size={9} />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Per-entity dispatch helpers
// ---------------------------------------------------------------------------

function isInteractive(e: EntityRef): boolean {
  if (e.kind === 'chain') return !!e.auth_asym_id;
  if (e.kind === 'residue_range') return !!e.auth_asym_id && e.start !== undefined && e.end !== undefined;
  if (e.kind === 'ligand') return !!e.auth_asym_id && e.auth_seq_id !== undefined;
  return false;
}

// Does a molstar hover (chainId + authSeqId) land inside this entity?
function matchesHover(e: EntityRef, chainId: string, authSeqId: number): boolean {
  if (e.kind === 'chain') {
    return e.auth_asym_id === chainId;
  }
  if (e.kind === 'residue_range') {
    return (
      e.auth_asym_id === chainId &&
      e.start !== undefined &&
      e.end !== undefined &&
      authSeqId >= e.start &&
      authSeqId <= e.end
    );
  }
  if (e.kind === 'ligand') {
    return e.auth_asym_id === chainId && e.auth_seq_id === authSeqId;
  }
  return false;
}

function labelFor(e: EntityRef): string {
  switch (e.kind) {
    case 'chain':
      return e.auth_asym_id ?? '?';
    case 'residue_range':
      return e.auth_asym_id && e.start !== undefined && e.end !== undefined
        ? `${e.auth_asym_id}:${e.start}-${e.end}`
        : 'range';
    case 'ligand':
      if (e.chemical_id && e.auth_asym_id && e.auth_seq_id !== undefined) {
        return `${e.chemical_id} @ ${e.auth_asym_id}:${e.auth_seq_id}`;
      }
      return e.chemical_id ?? 'ligand';
    case 'structure':
      return e.rcsb_id ?? 'structure';
    case 'polymer_entity':
      return e.rcsb_id && e.entity_id ? `${e.rcsb_id}:${e.entity_id}` : 'entity';
    case 'family':
      return formatFamily(e.family ?? '');
    case 'variant':
      return e.wild_type && e.master_index !== undefined && e.observed
        ? `${e.wild_type}${e.master_index}${e.observed}`
        : 'variant';
    default:
      return '?';
  }
}

function formatFamily(f: string): string {
  if (f.startsWith('tubulin_')) {
    const suffix = f.slice('tubulin_'.length);
    const sym = ({ alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε' } as Record<string, string>)[suffix];
    return sym ? `${sym}-tubulin` : f;
  }
  return f;
}

function applyHighlight(instance: MolstarInstance | null, e: EntityRef, on: boolean): void {
  if (!instance) return;
  try {
    if (e.kind === 'chain' && e.auth_asym_id) {
      instance.highlightChain(e.auth_asym_id, on);
    } else if (e.kind === 'residue_range' && e.auth_asym_id && e.start !== undefined && e.end !== undefined) {
      instance.highlightResidueRange(e.auth_asym_id, e.start, e.end, on);
    } else if (e.kind === 'ligand' && e.auth_asym_id && e.auth_seq_id !== undefined) {
      // Ligands are single residues in molstar terms.
      instance.highlightResidueRange(e.auth_asym_id, e.auth_seq_id, e.auth_seq_id, on);
    }
  } catch { /* swallow — molstar can throw if state changed underneath */ }
}

function applyFocus(instance: MolstarInstance | null, e: EntityRef): void {
  if (!instance) return;
  try {
    if (e.kind === 'chain' && e.auth_asym_id) {
      instance.focusChain(e.auth_asym_id);
    } else if (e.kind === 'residue_range' && e.auth_asym_id && e.start !== undefined && e.end !== undefined) {
      instance.focusResidueRange(e.auth_asym_id, e.start, e.end);
    } else if (e.kind === 'ligand' && e.auth_asym_id && e.auth_seq_id !== undefined) {
      instance.focusResidue(e.auth_asym_id, e.auth_seq_id);
    }
  } catch { /* swallow */ }
}
