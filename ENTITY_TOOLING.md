# Entity tooling — end-to-end reference

A synthesis of how the LLM-driven "entity tooling" surface works across this
frontend (`fend_tubulinxyz`) and the backend (`tubulinxyz` at
`/Users/rtviii/dev/tubulinxyz`): what affordances the model is given, how its
output is grounded against the database, and how it lands as UI. Distilled from
`PLAN_llm_entity_tooling.md`, the curated-verb plan, and the code as of
2026-05-27.

The deeper / more chronological material lives in `PLAN_llm_entity_tooling.md`
(working spec + session logs) and `~/.claude/plans/let-s-plan-first-what-bubbly-wombat.md`
(curated-verb plan). This doc is the navigable summary.

---

## 1. The three endpoints

There are three independent translation endpoints, each owned by one page. They
share infrastructure (translator, facet loader, universal prompt preamble) but
have different vocabularies and different response shapes.

| Endpoint                 | Owning page                        | Drives                                                     |
|--------------------------|------------------------------------|------------------------------------------------------------|
| `POST /nl_query/filters` | `/structures` (catalogue)          | Catalogue filter state (`UiFilters`)                       |
| `POST /nl_query/global`  | `/` (landing)                      | Ranked `ActionCard`s + a short blurb; one card = one URL   |
| `POST /nl_query/viewer`  | `/structures/[rcsb_id]` (detail)   | In-viewer actions, surfaced entities, optional nav card    |

All three are defined in
`/Users/rtviii/dev/tubulinxyz/api/routers/router_nl_query.py`. The translator
implementation is `api/nl_translator/openai_compat_impl.py`; the parallel
`anthropic_impl.py` path is a stub for `/global` and not kept in sync.

---

## 2. Layered architecture

Four layers, in order from "most navigation, least state" to "most state, least
navigation":

- **Layer 1 — Navigation (`ActionCard`, 6 kinds).** Stable. One click = one URL
  navigation. Lives in `src/components/assistant/globalCommandDispatcher.ts`
  (`cardToHref(card, queries) -> { href }`). Used by `/global` cards and by
  `/viewer` "navigation intent" responses.
- **Layer 2 — In-viewer actions (`ViewerAction`, 10 kinds today including
  `AlignChain`).** Dispatched against a `MolstarInstance` via
  `src/components/assistant/viewerCommandDispatcher.ts`. Mostly camera /
  visibility / highlight + the new in-place align verb.
- **Layer 3 — Entity surfacing (`EntityRef`, 7 kinds).** Rendered as interactive
  pills by `ViewerAssistantPanel.tsx` and inline by `PillifiedText.tsx`.
  Bidirectional sync with Molstar (hover/click). Not a side-effect — just a
  surfacing channel.
- **Layer 4 — Filter inference.** `/nl_query/filters` only. Backend returns a
  filter object; `src/app/structures/nlFilterMapper.ts` maps it onto the
  catalogue page's `UiFilters`.

Two cross-cutting affordances:

- **Anti-hallucination resolver** — backend turns LLM *intent* (organism +
  family + ligand selectors) into real `(rcsb_id, auth_asym_id)` by querying
  Neo4j. The LLM never has to "know" PDB ids. Lives in
  `api/nl_translator/resolve.py`.
- **Hydration / existence check** — every entity reference is existence-checked
  against Neo4j before being returned; cards that don't survive are dropped.
  Lives in `api/nl_translator/hydration.py`. Runs after `resolve` for `/global`;
  also gates nav cards on `/viewer`.

---

## 3. Universal prompt preamble

`_build_universal_preamble(facets)` in `openai_compat_impl.py` is prepended to
both `/global` and `/viewer` system prompts. Single source of truth for:

- The GROUNDING rule ("do NOT author PDB ids from memory — express intent and
  let the backend resolve").
- The ORGANISM TAX IDS quick map (human=9606, mouse=10090, pig=9823,
  cow/bovine=9913, Toxoplasma=5811, yeast=4932, etc.).
- The KNOWN ORGANISMS grounding table — built at runtime by
  `_load_common_organisms()` in `facets_loader.py`, lists each common organism
  with its representative PDB ids fetched via Cypher. Ids in the table are real.
- Ligand naming conventions, the tubulin family glossary, etc.

Each per-endpoint prompt then appends its own ACTIONS AVAILABLE list, current
state block, and few-shot examples.

---

## 4. `/nl_query/filters` — catalogue filter inference

Simplest of the three. Used by the catalogue page (`/structures`) when a user
types into the chat input there.

Request (`NLQueryRequest`):
- `text: str`
- `target: "structures" | "polymers" | "ligands"`
- `current_filters: Optional[Dict]`

Server flow:
1. `load_facet_context()` → cached `FacetContext` (1h TTL).
2. `translator.translate(text, target, facets, current_filters)` calls the LLM
   with a target-typed Pydantic tool (`StructureFilters` /
   `PolypeptideEntityFilters` / `LigandFilters`) and returns either filters or a
   clarification.
3. Response: `{ target, filters?, summary, clarification? }`.

Frontend: `src/app/structures/page.tsx` chat input → POST → on success
`nlFilterMapper.ts` translates the backend filter shape into the page's
`UiFilters` state (snake-case ↔ camelCase, etc.). Pills/confirmation UX
isolates AI from manual edits (see the curated-verb plan's notes).

Vocabulary at this endpoint is the existing filter Pydantic — no `EntityRef` or
`ActionCard`.

---

## 5. `/nl_query/global` — landing page action cards

The most ambitious endpoint. The LLM emits ONE tool call
(`emit_global_response`) that contains blurb + queries + ranked cards in a
single structured payload.

### Request

`NLGlobalRequest { text }`. No view context — this is the front door.

### Tools (LLM-facing)

- `emit_global_response(blurb, queries, cards)` — the load-bearing tool.
- `request_clarification_global(question)` — escape hatch.

### Response envelope (`GlobalNLResponse`)

```
{
  blurb:   str,                # <= 180 chars, may be empty
  queries: QuerySpec[],        # <= 3, each targets structures|polymers|ligands
  cards:   ActionCard[],       # <= 6 ranked
  validation: Record<card_i, { ok, reason? }>   # server-populated
}
```

Pydantic in `api/nl_translator/global_actions.py`; TS mirror in
`src/components/assistant/globalTypes.ts` (kept manually in sync — small
surface, codegen not worth it).

### Server-side post-processing

After `translate_global` returns:

1. **Resolve** (`api/nl_translator/resolve.py::resolve_response`). For every
   entity-bearing card (`open_structure` / `open_expert` / `inspect_ligand`),
   convert the LLM's selectors (`primary_organism_id`, `aligned_organism_ids`,
   `family`, `chemical_id`) into real `(rcsb_id, auth_asym_id)` via
   `resolve_representative` (entity-level Cypher, ranked by resolution ascending,
   5-min positive cache). Unresolvable cards are dropped. `inspect_ligand`
   degrades to a ligand catalogue if no bound structure is found.
2. **Hydrate** (`api/nl_translator/hydration.py`). Batched existence check
   against Neo4j over the surviving `(structure, chain, ligand, family)` tuples.
   `validation` is populated; cards whose primary entity doesn't pass are
   dropped, `aligned` refs that don't pass are stripped (and `open_expert`
   downgrades to clarify or drops if all aligned were stripped).
3. Return `{ kind: "global", response: hydrated }` or `{ kind: "clarify", ... }`.

This pipeline is what stops the LLM from putting hallucinated PDB ids on cards.

### Frontend consumption

- `src/app/page.tsx` (landing) wraps `LandingChatPanel` which uses
  `AssistantResultsPanel` (embedded).
- `AssistantResultsPanel.tsx` renders the blurb (with inline entity pills via
  `PillifiedText`) + the ranked card grid (`CardChip`).
- `CardChip` click → `cardToHref(card, queries)` →
  `dispatch(showAssistantToast(card))` → `router.push(href)`.
- `AssistantToastHost` (mounted in `app/layout.tsx`) formats per-action lines
  (`summarizeCardLines` in `cardSummary.ts`) and shows a transient bottom-right
  toast; tax-id → organism name via `useGetTaxonomyFlatQuery`.

### Card kinds and their URLs

See [§ 7. Vocabularies — ActionCard].

---

## 6. `/nl_query/viewer` — in-page operations on the structure detail page

The LLM is given the current viewer state and a set of action tools; it emits
zero or more tool calls per turn. Three mutually-exclusive response kinds.

### Request

`NLViewerRequest { text, view_context }`, where `ViewContextBody`:

```
{
  rcsb_id, chain_ids, ligand_keys,
  view_mode,             # "structure" | "monomer" (easy | expert)
  active_monomer_chain,
  active_family,         # new; tubulin family of the active chain
}
```

Frontend builds this at `src/app/structures/[rcsb_id]/page.tsx` in the
`assistantValue.handle` closure before POSTing.

### Tools (LLM-facing)

Registered automatically from `VIEWER_ACTION_MODELS` in
`api/nl_translator/viewer_actions.py` by `_build_viewer_tools()`:

Camera/focus: `FocusChain`, `FocusResidue`, `FocusResidueRange`, `ClearFocus`.
Visibility:   `SetChainVisibility`, `IsolateChain`.
Highlight:    `HighlightChain`, `HighlightResidueRange`, `ClearHighlight`.
Alignment:    `AlignChain` (expert mode only; resolved server-side).
Companion:    `MentionEntities`, `EmitNavigationCard`, `RequestClarification`.

The prompt teaches when to use what — most relevantly:

- `EmitNavigationCard` for "switch to another structure / browse the catalogue"
  intent (and is mutually exclusive with action tools).
- `RequestClarification` for ambiguity, missing chains, etc.
- `AlignChain` is the in-place "add a sequence to the current alignment" path
  for expert mode. The LLM emits `organism_id` (e.g. 9913 for bovine); the
  backend resolves it to a real chain of `active_family`. The prompt
  specifically prohibits `EmitNavigationCard` and `RequestClarification` for
  add-a-sequence intent.

### Server-side post-processing

`_interpret_viewer_openai` returns a `ViewerTranslationResult` (actions,
entities, nav_card, clarification, summary). The route then:

1. If `clarification` is set → return `{ kind: "clarify", clarification, card }`
   (the nav card may travel alongside; resolved + dropped on failure).
2. Else if `nav_card` is set → resolve the card; if it resolves return
   `{ kind: "nav_card", card }`, else downgrade to a clarify.
3. Else → resolve any `AlignChain` actions in place
   (`organism_id` + `active_family` → real `(rcsb_id, auth_asym_id)`; drop if
   unresolvable). Then envelope each remaining action as
   `{ type: ClassName, args: model_dump }` and return
   `{ kind: "viewer_actions", actions, entities, summary }`.

`EntityRef`s arriving via `MentionEntities` are passed through loosely
validated.

### Frontend consumption

`src/app/structures/[rcsb_id]/page.tsx` decides what to do with the response:

- `clarify` → show the clarification (and an optional companion nav card) in
  `ViewerAssistantPanel`.
- `nav_card` → render the card as a `CardChip` in the panel. Clicking it goes
  through the same `cardToHref` + toast path as landing cards.
- `viewer_actions` → call
  `dispatchViewerActions(instance, actions, { alignChain: alignChainById })`
  which walks the list and runs each against the live `MolstarInstance`. The
  `alignChain` ctx callback (`alignChainById`) calls
  `instance.loadAlignedStructure` + `alignChainFromProfile` +
  `styleAlignedChainAsGhost`, with a no-op guard if the resolved chain is the
  primary itself or already aligned.
- Surfaced entities are stored in page state and rendered as pills by
  `ViewerAssistantPanel`. Pills hover/click sync to the Molstar viewer.

---

## 7. Vocabularies

### `EntityRef` (7 kinds; flat schema, `kind` discriminator)

| kind             | typical payload                                        |
|------------------|--------------------------------------------------------|
| `structure`      | `rcsb_id`                                              |
| `chain`          | `rcsb_id`, `auth_asym_id`                              |
| `polymer_entity` | `rcsb_id`, `entity_id`                                 |
| `family`         | `family` (literal-union)                               |
| `ligand`         | `chemical_id`, optional `in_structure`/instance coords |
| `variant`        | `family`, `master_index`, `wild_type`, `observed`     |
| `residue_range`  | `rcsb_id`, `auth_asym_id`, `start`, `end`             |

Pydantic: `api/nl_translator/global_actions.py`. TS mirror:
`src/components/assistant/globalTypes.ts`. Used both by `/global` (cards and
inline pill derivation) and by `/viewer` (MentionEntities).

### `ActionCard` (6 kinds → 6 URL routes)

| action          | URL it builds                                                                |
|-----------------|------------------------------------------------------------------------------|
| `open_catalogue`| `/structures?<filters>` — from `queries[].id` or direct fields              |
| `open_structure`| `/structures/<rcsb_id>?chain=...&ligand=...`                                |
| `open_expert`   | `/structures/<rcsb_id>?mode=monomer&chain=...&align=...&range=...`          |
| `inspect_ligand`| `/structures/<rcsb_id>?mode=monomer&chain=X&focus_ligand=...`               |
| `view_variants` | `/structures?has_variants=true&variant_family=...&variantPosMin=...`        |
| `clarify`       | (no nav — inline question)                                                   |

Fields on `ActionCard` include both **selectors** the LLM sets
(`primary_organism_id`, `aligned_organism_ids`, `source_organism_ids`, `family`,
`chemical_id`) and **resolved fields** the backend fills (`rcsb_id`,
`primary_chain`, `aligned[]`). The frontend reads only the resolved fields.

URL → state serialization: `src/lib/url_state.ts` (`searchParamsToStructureView`
+ `buildStructureUrl`).

### `ViewerAction` (10 kinds)

Pydantic: `api/nl_translator/viewer_actions.py`. TS mirror:
`src/components/assistant/types.ts`. Dispatcher:
`src/components/assistant/viewerCommandDispatcher.ts`.

```
FocusChain | FocusResidue | FocusResidueRange | ClearFocus |
SetChainVisibility | IsolateChain |
HighlightChain | HighlightResidueRange | ClearHighlight |
AlignChain
```

Plus companion tools: `MentionEntities`, `EmitNavigationCard`,
`RequestClarification`. The curated-verb plan proposed an 11-verb vocabulary
(`ResetView`, `EnterMonomerView`, `OpenMSARange`, `ToggleAnnotation`,
`ApplyColorscheme`) and mode-gated tool registration; only `AlignChain` has
landed so far. The rest is still on the roadmap.

---

## 8. Anti-hallucination architecture (the most important piece)

Two failure modes the resolver/hydrator are designed against:

1. **Invented ids** — model emits a PDB id that doesn't exist (e.g. "8FEH").
2. **Real ids, wrong organism/family** — model emits a real id but mislabels
   its organism (existence check can't catch this).

The defense:

- **Express intent, not ids.** The LLM is instructed to set selector fields
  (`primary_organism_id`, `aligned_organism_ids`, `family`, `chemical_id`) and
  leave `rcsb_id` null, unless the user explicitly named a PDB id.
- **`resolve_representative(organism_id, family, ligand) → (rcsb_id, auth_asym_id)`**
  runs entity-level Cypher (`$tax IN e.src_organism_ids`), ranks by
  `s.resolution ASC`, 5-min positive cache. Granularity matters: organism is
  resolved at the entity level, NOT the parent structure's organism union —
  microtubule structures mix organisms (pig tubulin + human MAP), so a
  structure-level filter mislabels.
- **`resolve_card` / `resolve_response`** fill cards in place; cards that
  cannot resolve their primary entity are dropped.
- **`hydrate_response`** existence-checks every surviving ref; failed cards are
  dropped, partially-failed `aligned` lists are stripped (and the card
  downgrades if all aligned dropped).
- Same `resolve_representative` is reused for `AlignChain` actions and for
  `/viewer` nav cards — one resolver, one anti-hallucination contract.

The contract win: the resolver fills the same `rcsb_id`/`primary_chain`/
`aligned` fields the frontend already consumed, so the UI needed no changes —
cards just stopped lying.

---

## 9. URL deep-link schema

Catalogue (`/structures`) — param names mirror `ListStructuresApiArg`
camelCase so `nlFilterMapper` round-trips cheaply: `family`, `ligand`,
`expMethod`, `resMax`, `sourceTaxa`, `has_variants`, `variant_family`,
`variantPosMin`, etc.

Structure detail (`/structures/[rcsb_id]`):
- `?chain=A&ligand=TA1` — easy mode focus.
- `?mode=monomer&chain=B&align=5J2T:A,1JFF:A&range=240-260` — expert mode with
  MSA aligned chains and a focused residue range.

Hydration order on the detail page (today, mount-only):
1. Structure load (Molstar primary).
2. `enterMonomerView(chain)` if `mode=monomer`.
3. `setPendingAligns(align[])` — each loaded asynchronously, MSA registered.
4. `setPendingRange(range)` — Molstar focus.
5. MSA scroll to the master-index columns corresponding to the auth-range.

URL ↔ state in `src/lib/url_state.ts`. `dispatchViewerActions` does NOT write
back to the URL today.

---

## 10. Frontend assistant components

```
src/components/assistant/
├── globalTypes.ts            — TS mirror of /global Pydantic schema
├── types.ts                  — ViewerAction union + ViewerResponse envelopes
├── PillifiedText.tsx         — inline entity pills inside blurbs / descriptions
├── AssistantResultsPanel.tsx — landing card grid + CardChip
├── ViewerAssistantPanel.tsx  — structure-page floating panel
├── AssistantToastHost.tsx    — globally-mounted post-nav toast
├── cardSummary.ts            — summarizeCardLines used by the toast
├── globalCommandDispatcher.ts — cardToHref(card, queries) → URL
├── viewerCommandDispatcher.ts — ViewerAction → MolstarInstance calls
└── AssistantTargetContext.tsx — provider so the cross-page PillChatInput knows
                                  which endpoint to hit and how to handle results
```

`AssistantTargetProvider` is wrapped around each page; the chat input
(`PillChatInput` from `src/components/ui/AppPill.tsx`) reads it to know whether
to hit `/filters`, `/global`, or `/viewer` for the current context.

Toast state lives in `src/store/slices/assistantToastSlice.ts`; the host reads
the last clicked card and formats lines via `summarizeCardLines`.

---

## 11. Known limitations and latent issues

- **Structure→structure URL re-hydration.** Navigating between two
  `/structures/[id]` pages does NOT remount the page component (same dynamic
  route segment), and URL state is applied only once at mount via
  `urlHydratedRef` (deliberate, prevents router-writeback loops). Result: a
  ViewerAssistantPanel nav card pointing at a different structure loads the new
  primary but ignores its `mode`/`chain`/`align`/`range`. Open. See
  `PLAN_llm_entity_tooling.md` § ROADMAP.

- **Landing → viewer chained intent.** Queries typed into the landing-page chat
  hit `/nl_query/global` and emit `ActionCard`s — they cannot ALSO carry viewer
  actions (`AddAnnotationTrack`, `FocusBindingSite`, etc.) that should fire
  AFTER the user lands on the structure page. Result: "show GTP binding site in
  human alpha tubulin" from the landing chat opens the right structure in
  expert mode but does NOT focus the binding site or add a track. Same query
  works end-to-end from the expert-mode chat because that hits `/viewer`
  directly. Resolving this needs either (a) a `pendingActions` URL fragment
  the structure page replays once the chain/MSA is ready, or (b) the landing
  endpoint emitting a follow-up viewer call that the page picks up. The
  cross-page hydration sequencing is the same blocker as the structure→
  structure case above.

- **Redux store is session-long.** It's instantiated once in
  `src/app/layout.tsx`, so the `sequenceRegistry` slice (PDB sequences for the
  MSA) persists across navigations. Without cleanup, stale aligned rows linger
  and the `pendingAligns` dedup (`selectIsChainAligned`) skips re-loading
  fresh aligns into the new 3D scene. Fixed 2026-05-27 by dispatching
  `clearPdbSequences()` at the start of each structure load. See
  `~/.claude/projects/-Users-rtviii-dev-fend-tubulinxyz/memory/reference_redux_session_persistence.md`.

- **`/viewer` "where would X bind" projection refusal (Sonnet).** For queries
  about a ligand that isn't loaded, Sonnet emits clarification + nav card but
  consistently SKIPS `HighlightResidueRange` despite a HARD-RULE worked example.
  The interpreter currently drops actions when clarification is also emitted,
  so this is a prompt-tuning + interpreter-contract issue. Possible mitigations
  include Haiku for the viewer endpoint or relaxing the drop rule.

- **Resolver doesn't know what's already loaded.** "Add another human
  structure" while a human structure is already aligned resolves to the same
  one and is then no-op'd by the frontend dedup. Useful follow-up: pass loaded
  `(rcsb_id, chain)` list into the resolver as an exclude set.

- **`anthropic_impl.py` `translate_global` is a stub.** The global endpoint
  runs on the `openai_compat` translator only. Switching the env var to
  Anthropic native would break `/global` until that's filled in.

- **Mode-gating of viewer actions** (curated-verb plan, Phase 2) hasn't
  landed — the prompt asks the model to self-restrict (e.g. `AlignChain` in
  expert mode only). Robust path is `view_context.allowed_actions` filtering
  tools at registration time.

- **Curated-verb additions not yet landed:** `ResetView`, `EnterMonomerView`,
  `OpenMSARange`, `ToggleAnnotation`, `ApplyColorscheme`, plus an `AISession`
  ledger for AI/manual write isolation. See
  `~/.claude/plans/let-s-plan-first-what-bubbly-wombat.md`.

---

## 12. File map

Backend (`/Users/rtviii/dev/tubulinxyz`)

```
api/routers/router_nl_query.py        three POST routes
api/nl_translator/
├── interface.py                      ViewContext, FacetContext, TranslationResult, ViewerTranslationResult
├── facets_loader.py                  FacetContext loader (1h cache), common organism table
├── openai_compat_impl.py             OpenRouter translator, prompt builders, tool reg, interpreters
├── anthropic_impl.py                 parallel translator; /global path is a stub
├── global_actions.py                 EntityRef, ActionCard, QuerySpec, GlobalNLResponse
├── viewer_actions.py                 ViewerAction Pydantic models + tool registry
├── resolve.py                        resolve_representative + resolve_card + resolve_response
└── hydration.py                      batched Neo4j existence check, 5-min cache
```

Frontend (`/Users/rtviii/dev/fend_tubulinxyz`)

```
src/components/assistant/             see § 10
src/store/slices/
├── assistantToastSlice.ts            pending toast state
└── sequence_registry.ts              MSA sequences (session-long; clear on structure load)
src/app/
├── page.tsx                          landing
├── structures/
│   ├── page.tsx                      catalogue (uses nlFilterMapper)
│   ├── nlFilterMapper.ts             backend filters ↔ UiFilters
│   └── [rcsb_id]/page.tsx            structure detail — URL hydration, aligns,
│                                      AlignChain ctx, MSA range scroll, viewer panel
└── layout.tsx                        Redux Provider + AssistantToastHost mount
src/lib/url_state.ts                  URL ↔ structure-view (de)serializer
src/hooks/useViewerSync.ts            1D-3D sync (auth_seq_id ↔ master_index), msaRef.jumpToRange
src/hooks/useChainAlignment.ts        alignChainFromProfile (registers a chain's sequence in the MSA)
src/components/msa/                   MSA panel (Nightingale workspace)
src/store/tubxz_api.ts                auto-generated RTK Query (do not edit)
```

Workspace: `nightingale/` is a local fork used as yarn workspaces (rebuild via
`yarn rebuild-nightingale` after changes).

---

## 13. Glossary

- **`auth_asym_id`** — author-supplied chain id (e.g. "A", "1A"). What the user
  sees and what the frontend uses for chain references.
- **`entity_id`** — RCSB polypeptide entity id (e.g. "1"). Distinct from
  `auth_asym_id`; some flows look up one from the other via the structure
  profile's `polypeptides[].entity_id`/`auth_asym_id` mapping.
- **`master_index`** — column in the MSA's master/reference alignment (1-based).
  Different coordinate space from `auth_seq_id`; `positionMapping` (in
  `sequence_registry`) maps `master_index → auth_seq_id` for each registered
  chain.
- **`auth_seq_id`** — residue number in structure numbering. What the user
  types ("residue 240") and what `range=` URL params encode.
- **family** — `tubulin_alpha` | `tubulin_beta` | `tubulin_gamma` | ... A
  literal-union over `tubulin_families` in the FacetContext.
- **easy mode / expert mode** — frontend view modes (`view_mode` =
  `"structure"` vs `"monomer"`). Easy = whole-structure view; expert = monomer
  view with the MSA panel and per-chain ops.
- **resolved vs selector fields** — selector fields (`primary_organism_id`,
  etc.) are what the LLM emits to express intent; resolved fields
  (`rcsb_id`, `primary_chain`, `aligned[]`) are what the backend fills in and
  what the frontend consumes.
