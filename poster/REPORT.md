# tube.xyz EMBL course poster — session state report

This document is the continuity hand-off from the previous session.
A new session should be able to read it once and pick up where we
stopped. The poster is being prepared for an EMBL course (microtubule /
tubulin biology audience). Authors: A. Kushner, M. Igaev, C. Janke,
M. O. Steinmetz.

## TL;DR (where we are right now)

- Abstract is **locked at 251 words**, lives in `abstract.md` at the
  repo root.
- Poster is **A1 portrait**, built in `tikzposter` (LaTeX + TikZ).
  Source files in `poster/`; compiles with `xelatex` twice.
- **Typography** is now Helvetica Neue (via `fontspec`) to match the
  web UI's neutral sans-serif look. Body is 12pt with selective bumps
  per block. Title at 42pt.
- **Block style** is custom (`tubeBlock`): white body, no frame, thin
  hairline under the title --- in the spirit of the UI's card
  aesthetic. No coloured title bars anywhere.
- **Three showcases** with **numbered descriptive sentence titles**
  (EMBL style):
  - **1. Disease mutations in TUBB3 cluster at conserved positions of
    the structured face of β-tubulin** (central, large 3D + MSA strip
    + extended explanation).
  - **2. Taxane (TA1) contacts cluster on the M-loop of β-tubulin and
    project as an aux row onto the master alignment** (left side).
  - **3. Phosphorylation tracks on TUBB3 reveal surface-accessible
    regulatory sites including β-S172** (right side).
- The R262 residue-chip card has been **dropped** from the central
  showcase --- it will appear inside the actual 3D screenshot
  rendered out of expert mode.
- **Architecture diagram** is now a compact, polished, grouped
  layered diagram (SOURCES / PROCESS / STORE / SERVE) sitting next to
  the references block at the bottom of the page.
- Database overview (counts table + catalogue thumbnail) stays at the
  top right.
- Footer references include **Tischfield 2010 *Cell*** as [4].
- Image work remains: `catalogue.png`, `showcase_3d/msa.png`,
  `ligand_3d/msa.png`, `ptm_3d/msa.png`. Recipes in
  `figures/README.md`.

---

## 1. The abstract

Locked at 251 words. Maxim's feedback applied (worked-example query
removed, replaced with general one-liner). File: `abstract.md` at the
repo root.

Title: **tube.xyz: an interactive structural atlas of the tubulin code**

Three paragraphs:

1. Motivation — *tubulin code* framing (Janke's exact language),
   PDB scale (~1000 structures), TubulinDB (Abbaali 2023) as the
   literature layer, the "separate resources, resist co-exploration"
   problem.
2. The tool — master-alignment per family (α, β, γ, δ, ε), variants
   + ligand contacts + literature mutations + PTMs lifted onto the
   common residue index, *pluggable* substrate claim.
3. UI — MSA bidirectionally coupled to Mol*-based 3D viewer, plus
   LLM-driven chatbot that translates plain-language questions about
   binding sites, cross-species residue comparison, disease-linked
   mutations, and PTMs into navigation actions.

Closing line: *"connective tissue between structural data and the wealth
of literature annotations, while the web interface lets both experts and
students navigate the data."*

## 2. Poster overall design

A1 portrait (594 × 841 mm) was chosen after A2 turned out to be too
cramped at any reasonable font size. tikzposter document class. xelatex
compiler. The current `poster.tex` compiles to a single A1 page.

Document-class options that worked:

```
\documentclass[
  a1paper, portrait, 15pt,
  margin=10mm, innermargin=8mm,
  blockverticalspace=4mm, colspace=8mm
]{tikzposter}
```

### Target layout (final design we agreed on)

```
┌──────────────────────────────────────────────────────────┐
│ Title · authors · affiliations                           │
├────────────────────────┬─────────────────────────────────┤
│ Motivation/abstract    │ Database overview               │
│ (compact, ~50%)        │ - counts table (top)            │
│                        │ - catalogue thumbnail (bottom)  │
├────────────────────────┴─────────────────────────────────┤
│ Architecture (compact full-width strip, ~7 cm)           │
│ data sources → ETL → Neo4j → API → frontend              │
├──────────────────────────────────────────────────────────┤
│ ═══ CENTRAL SHOWCASE ═══                                 │
│ TUBB3 disease-mutation map (CFEOM + MCD on β-tubulin)    │
│ ┌─────────────────────┐  ┌──────────────────────────┐    │
│ │ 3D render (large)   │  │ Residue chip (R262)      │    │
│ └─────────────────────┘  └──────────────────────────┘    │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ MSA strip: β-isotypes + CFEOM/MCD annotation track   │ │
│ └──────────────────────────────────────────────────────┘ │
├──────────────────────────┬───────────────────────────────┤
│ Side: Ligand site        │ Side: PTM track               │
│ (TA1 or colchicine)      │ (phospho-β or acetyl-α-K40)   │
│ small 3D + MSA snippet   │ small 3D + MSA snippet        │
├──────────────────────────┴───────────────────────────────┤
│ Footer: 3 key refs · QR codes · acks                     │
└──────────────────────────────────────────────────────────┘
```

Vertical budget at A1 (~75 cm content area):
title 5 + row 1 14 + architecture 7 + central 25 + side row 14 +
footer 5 = **70 cm**. Fits with 5 cm slack.

Note: the current `poster.tex` does NOT yet include the architecture
strip, the catalogue thumbnail, or the two side showcases. It has the
central TUBB3 showcase + a compact "Other queries the chatbot handles"
table that will be REPLACED by the two side showcases in the new
session. Updating to this layout is the first task of the new session.

## 3. Central showcase: TUBB3 disease-mutation map

This is the headline visual of the poster. Single 3D structure +
residue chip + full-width MSA strip below.

### Why this showcase

- Carsten Janke specifically suggested clinical/disease mutations as a
  poster idea (his email earlier in the session).
- It integrates the literature variant layer AND the master alignment
  in one view — that's the "atlas" claim made obvious.
- Single structure means the central 3D is easy to art-direct (no
  cross-structure alignment complexity).
- The conservation-across-isotypes story is unambiguous at a glance:
  the disease mutations sit at residues conserved across all 9 human
  β-isotypes — that's why they're pathogenic.
- The residue-chip overlay pattern (from screenshot 4 in earlier
  conversation — C316 palmitoylation popup) is reused with R262
  variant data.

### Structure & PDB

Use **6S8L:B**. Verified in the running backend:

- 6S8L = La Sala *et al.* 2019, *Chem*, "Plinabulin Binding to Two
  Tubulin Isotypes". X-ray, 1.80 Å.
- Chain A (auth_asym_id) = TUBA1B (human α-tubulin)
- Chain B (auth_asym_id) = **TUBB3** (human β-tubulin) ← this is the
  one we want
- GTP at A:501, GDP at B:501, plinabulin at the colchicine pocket.
- Bonus: plinabulin can also be shown to demonstrate drug-binding
  annotation in the same structure.

### Disease positions (verified in the DB)

All five are stored as literature variants (`source="morisette"`,
`uniprot_id="Q13509"` for TUBB3) in the user's Neo4j. Pulled via
`GET /annotations/variants/tubulin_beta/{position}`.

| Master pos | TUBB3 mutations | Phenotype | Colour |
|---|---|---|---|
| 205 | E→K, E→A | cortical dysplasia / MCD | red |
| 262 | R→C, R→H, R→A | R→C/H: CFEOM (eye); R→A: kinesin defect | orange + purple |
| 410 | E→K, E→V | E→K: cortical dysplasia; E→V: CFEOM | red + orange |
| 417 | D→H, D→N | CFEOM | orange |
| 401 | E→K | TUBB3 SNP, cancer (different mechanism) | grey or muted |

Numbering check: master_index matches canonical TUBB3 numbering for the
structured domain (master 262 wild-type = R, master 410 WT = E, master
205 WT = E, master 417 WT = D — all verified).

### Phenotype palette

Three categories (NOT four — earlier draft confusion):

- **CFEOM / extraocular fibrosis** → orange (`#F39C12`)
- **Cortical dysplasia / MCD** → red (`#E74C3C`)
- **Biochemical (in-vitro kinesin defect)** → purple (`#8E44AD`)

### Provenance (so the poster citations are defensible)

The 5 positions come from **clinical literature**, curated into the
**TubulinDB (Abbaali 2023)**, ingested into the user's Neo4j.

Chain of provenance:

1. Tischfield *et al.* 2010 *Cell* — original TUBB3 disease paper
   (R262C → CFEOM, etc.)
2. Poirier *et al.* 2010 *Hum Mol Genet* — MCD-causing TUBB3 mutations.
3. Nsamba & Gupta 2022 *J Cell Sci* — modern review listing canonical
   TUBB3 tubulinopathy mutations (Box 1 of the review).
4. Abbaali *et al.* 2023 *PLoS ONE* — TubulinDB — curated all of the
   above plus other sources (BioMuta etc.) with Universal Tubulin
   Numbering.
5. User's backend ingests TubulinDB CSVs via
   `lib/etl/ingest_morisette.py` (note: codebase misspells
   "Morrissette" as "Morisette" — separate rename task spawned).

Phenotype strings in the DB sometimes contain "with X" suffixes — those
are co-occurring co-mutations the curators noted in the original case
reports, not numbering discrepancies.

### Residue chip card (R262)

The chip card is currently a TikZ-drawn vector card with hardcoded
R262 data. Contains:

- Header: "R262" + "6S8L:B · master 262"
- Substitutions reported:
  - R → C · CFEOM (orange dot)
  - R → H · CFEOM (orange dot)
  - R → A · kinesin defect (purple dot)
- Conservation: "R conserved in all 9 human β-isotypes."
- Reference: Tischfield *et al.* (2010) *Cell*.

Alternative: screenshot the actual UI residue chip from expert mode
(R262 picked) and use `\includegraphics` instead of the TikZ card.
Either works.

## 4. Side showcases

Two smaller panels alongside the central. Both should use the same
*new* annotation-track mechanism so the poster reads as
"three demonstrations of the same integrated platform."

### Side panel A — Ligand binding figure

**Two options**, open decision:

1. **Colchicine site (plinabulin in 6S8L)** — re-uses the central
   structure, no new render needed for the small 3D. The colchicine
   site is at the β-α inter-dimer interface in 6S8L. A simple zoom-in
   showing plinabulin + its contacts.
2. **Taxane site (TA1) in a different β-tubulin PDB** — canonical
   anti-cancer drug, surface-accessible (M-loop region), Steinmetz's
   territory. Needs picking a high-resolution human β-tubulin + TA1
   structure (query: `/structures?family=tubulin_beta&ligands=TA1&sourceTaxa=9606&resMax=3.5`).

Pitch from previous session: **Taxane** for canonical-drug
recognition, but **Colchicine** if minimising render work matters more.

### Side panel B — PTM track display

**Two options**, open decision:

1. **β-tubulin phosphorylation** — high density (~445 annotations in
   6S8L:B per the user's screenshot), surface-accessible positions
   like β-S172 (which modulates GTP affinity). Continuity with the
   central showcase (same chain, same MSA frame).
2. **α-tubulin K40 acetylation** — the iconic tubulin PTM, single
   position, kinesin-binding regulation. Janke's lab is THE
   acetylation authority. Drawback: K40 sits inside the microtubule
   lumen so it's less visually striking in a single-protomer 3D.

Pitch from previous session: **Phospho-β** for visual punch +
continuity; **α-K40** for maximum Janke-resonance. Open question —
ask Maxim/Carsten which they prefer for the live demo.

### Common visual structure for both side panels

- Small 3D snippet (~12 × 8 cm): a zoomed-in cartoon showing the
  relevant pocket / residues coloured by the annotation type.
- Small MSA snippet (~12 × 4 cm): a horizontal strip of the master
  alignment in the relevant residue range, with the new aux track
  active.
- Caption: 1–2 lines describing what the panel shows and the chatbot
  query that would produce it.

## 5. Supporting elements

### Database overview (right column of Row 1)

Counts table — already exists in `tikz/counts_table.tex`. Eight rows:
structures (~1000), tubulin families (5), MAP/enzyme families (39),
α/β isotypes (16), literature mutations (~5,200), literature
modifications (~1,950), binding sites (per-structure), taxonomy
(hundreds).

Plus a **small catalogue thumbnail** below the table. ~6 × 4 cm. A
screenshot of the structures catalogue page with the filter sidebar
visible and a few structure cards. Caption: *"~1000 indexed
tubulin-containing PDB structures, faceted browse by isotype,
organism, ligand, year, resolution, variant."*

This sells the "real database" claim without eating a separate row.

### Architecture diagram (full-width strip between Row 1 and central)

Single horizontal strip, ~6–8 cm tall. ~5 boxes:

```
RCSB · TubulinDB · NCBI   ─→   HMM + MUSCLE ETL   ─→   Neo4j
   (data sources)                  (pipeline)            (graph)

                                    ─→   FastAPI   ─→   Next.js / Mol* / Nightingale
                                          (api)            (frontend)
```

A flatter, simpler version of `tikz/architecture_diagram.tex` (which
still exists in the repo — needs to be reworked for compact horizontal
strip).

A tubulin-bio audience wants the bones of "data → integration → web",
not the 5-phase ETL breakdown. Keep it lean.

## 6. New backend/frontend features that enable the plan

Added by the user since the last layout discussion:

### Variants aux row creation

The user can now create custom MSA aux rows for variant data, not just
the per-chain auto-computed `variants(N)` row. This unlocks:

- A single-click "TUBB3 CFEOM mutations" track that paints the 5
  master positions (205, 262, 401, 410, 417).
- Filtering by source (literature vs structural), by uniprot ID, by
  phenotype text, by position range.

This is what makes the central showcase reproducible without
"manually select 5 residues then colour each in Mol*" — that whole
headache from the earlier draft instructions is gone.

### Ligand binding site controls

The user can now toggle ligand-binding-site annotations as MSA aux
rows. So the ligand showcase becomes a track painting the contact
positions of (say) TA1 across the β-tubulin alignment, sourced from
the existing `/ligands/canonical-site/{chemical_id}/{family}` endpoint
or per-structure neighborhoods.

### Implication

All three showcases now use the **same paradigm**: an aux row in the
MSA painting positions, coupled to 3D via 1D↔3D sync. Visually
consistent, reproducible, and the demos write themselves.

## 7. Database queries verified (for citation defensibility)

Reproducible Python (saves to `verify.py`):

```python
import requests

BASE = "http://localhost:8000"

# 1. TUBB3 disease mutations at the five master positions
for pos in [205, 262, 401, 410, 417]:
    r = requests.get(f"{BASE}/annotations/variants/tubulin_beta/{pos}").json()
    tubb3 = [v for v in r["variants"] if v.get("uniprot_id") == "Q13509"]
    print(f"master {pos}: {len(tubb3)} TUBB3 variants")
    for v in tubb3:
        print(f"  {v['wild_type']}->{v['observed']} pheno={v['phenotype']}")

# 2. GTP contacts on the candidate showcase chains (verifies the
#    earlier LLM-note range '140-180' as misleading; real contacts
#    span master 9-231 with the most-contiguous chunk 140-183)
for rcsb_id, chain in [("6S8L", "A"), ("9Y9Z", "1A")]:
    r = requests.get(f"{BASE}/ligands/neighborhoods/{rcsb_id}/{chain}").json()
    for n in r["neighborhoods"]:
        if n["ligand_id"] != "GTP":
            continue
        positions = sorted({res["master_index"] for res in n["residues"]
                            if res.get("master_index") is not None})
        print(f"\n{rcsb_id}:{chain}  GTP contacts: {len(positions)}")
        print(f"  positions: {positions}")
```

Both queries return real data; both should run cleanly against the
user's localhost backend.

## 8. References (current minimal list in the footer)

```
[1] Abbaali et al. (2023) PLoS ONE 18(12): e0295279 (TubulinDB)
[2] Janke & Magiera (2020) Nat. Rev. Mol. Cell Biol. 21, 307–326
[3] Steinmetz & Prota (2018) Trends Cell Biol. 28(10), 776–792
```

Fuller list in `poster_spec.md` for a handout if needed; currently
includes Mühlethaler 2021, Nsamba & Gupta 2022, Tischfield 2010,
Findeisen 2014, Sehnal 2021 (Mol*), Edgar 2004 (MUSCLE), Eddy 2011
(HMMER).

For the disease mutation showcase, Tischfield 2010 *Cell* and
Poirier 2010 *Hum Mol Genet* are the load-bearing primary clinical
references. Should at least Tischfield 2010 be added to the footer
list (in place of one of the existing 3, or as a 4th).

## 9. Current file state in `poster/`

```
poster/
├── poster.tex                    # A1 main document — compiles cleanly
├── references.tex                # 3 key refs + acks line
├── README.md                     # build/upload instructions, layout notes
├── REPORT.md                     # THIS file
├── tubexyz_poster.zip            # current Overleaf upload bundle
├── poster_spec.md                # narrative spec (panel-by-panel copy)
├── architecture_diagram.md       # Mermaid spec backup
├── database_overview.md          # Mermaid spec backup
├── tikz/
│   ├── counts_table.tex          # database counts (used in row 1)
│   ├── architecture_diagram.tex  # NEEDS REWORK: was a 3-lane diagram,
│   │                             # needs flattening to a horizontal strip
│   ├── schema_diagram.tex        # Neo4j schema (currently unused)
│   └── annotated_expert_mode.tex # legacy A2 callouts (unused)
├── figures/
│   ├── README.md                 # how to produce the two images
│   ├── showcase_3d.png           # TODO — TUBB3 disease 3D render
│   ├── showcase_msa.png          # TODO — β-isotype MSA strip
│   ├── catalogue.png             # TODO — catalogue page thumbnail
│   ├── ligand_3d.png             # TODO — small 3D for ligand showcase
│   ├── ligand_msa.png            # TODO — small MSA for ligand showcase
│   ├── ptm_3d.png                # TODO — small 3D for PTM showcase
│   └── ptm_msa.png               # TODO — small MSA for PTM showcase
└── ...
```

What `poster.tex` currently has and what needs to change:

- ✓ Title block, motivation, database overview (counts table only)
- ✓ Central TUBB3 showcase block (3D placeholder + chip + MSA strip)
- ✓ Catalogue thumbnail beneath counts table — **scaffolded as a
  `\fbox{\parbox{...}}` placeholder; awaiting `figures/catalogue.png`.**
- ✓ Architecture strip between Row 1 and central — **flattened to a
  horizontal 5-box chain in `tikz/architecture_diagram.tex` and pulled
  into a new `\block{Pipeline}` between Row 1 and the central showcase.**
- ✓ Two side showcase blocks (ligand + PTM) — **scaffolded as two
  half-width blocks via `\begin{columns}` after the central showcase
  (taxane TA1 on left, phospho-β on right). The old "Other queries the
  chatbot handles" table has been deleted.**
- ✓ Footer (refs, acks, QR codes) — **now lists 4 refs (Tischfield
  2010 added).**

## 10. Open decisions (resolved this session)

1. **PTM panel: phospho-β-tubulin or acetyl-α-K40?**
   → **Phospho-β-tubulin** chosen. Stays on TUBB3 / 6S8L:B for
   continuity with the central showcase; surface positions like β-S172
   are visually striking.

2. **Ligand panel: colchicine or taxane?**
   → **Taxane (TA1)** chosen. Canonical anti-cancer drug recognition,
   M-loop region (Steinmetz / Prota territory). PDB pick is still
   pending — query
   `/structures?family=tubulin_beta&ligands=TA1&sourceTaxa=9606&resMax=3.5`
   and use the top-resolution human hit; update the `<PDB:CHAIN>`
   placeholder in `poster.tex` accordingly.

3. **Tischfield 2010 *Cell* citation?**
   → **Added as 4th reference** in `references.tex`.

4. **Codebase rename "Morisette" → "Abbaali" / "TubulinDB"?**
   Still a separate spawned task; does not block the poster.

## 11. Next actions (remaining)

The LaTeX scaffolding is done. What's left is image production and
the final PDB pick for the taxane panel.

1. Pick the taxane (TA1) PDB:
   ```
   GET /structures?family=tubulin_beta&ligands=TA1&sourceTaxa=9606&resMax=3.5
   ```
   Take the top-resolution human hit. Update the `<PDB:CHAIN>`
   placeholder in `poster.tex` (search for `<PDB:CHAIN>`).
2. Render images, following `figures/README.md`:
   - `showcase_3d.png` (central TUBB3 disease 3D)
   - `showcase_msa.png` (central β-isotype MSA strip)
   - `catalogue.png` (catalogue browse thumbnail)
   - `ligand_3d.png` + `ligand_msa.png` (taxane side panel)
   - `ptm_3d.png` + `ptm_msa.png` (phospho-β side panel)
3. For each image: swap the `\fbox{\parbox{...}}` placeholder in
   `poster.tex` for `\includegraphics[width=0.97\linewidth]{figures/...}`.
4. Recompile (`xelatex poster.tex` twice) and inspect at 100 % zoom
   for silent clipping.
5. Rebuild `tubexyz_poster.zip` for Overleaf upload.
6. Send draft to Maxim and Carsten for review.

## 12. Lessons learned / gotchas (so the new session doesn't repeat them)

- **A2 portrait was too cramped** for this content density. A1
  portrait is the working size.
- **tikzposter does NOT auto-flow to multiple pages.** Content that
  overflows the page is silently clipped. Always check pdftotext or
  high-DPI render after each change.
- **TikZ nodes with `\\` need explicit `align=left, text width=Xcm`.**
  Otherwise `\\` is silently ignored, text overflows horizontally,
  and that overflow triggers the page-clip behaviour above. This was
  the single biggest gotcha — caused hours of debugging.
- **`\tikzposterlatexaffectionproofoff`** kills the
  "LaTeX TikZposter" watermark.
- **The earlier LLM-note "GTP site at master 140–180" was wrong.**
  Real GTP contacts span master 9–231 with the most-contiguous chunk
  being 140–183 (the T4-T5 region near the γ-phosphate). Verified
  against the running DB. Always verify LLM notes against the actual
  data.
- **Reference rows in the MSA (TUBB1, TUBB6, TUBB3, TUBB2A, TUBB,
  TUBB4A) ARE the master alignment** — they don't need to be added
  manually. Earlier draft instructions wrongly told the user to "Add
  TUBB1, TUBB2A, …" — that was incorrect.
- **The codebase has "Morisette" as a misspelling of "Morrissette"**
  (Naomi Morrissette, UCI, senior author of Abbaali 2023). Separate
  rename task. Doesn't affect the poster, just citation accuracy.
- **Carsten's "don't overcharge" advice is load-bearing.** Every time
  we tried to fit one more thing on the page, it overflowed. Resist.

## 13. Reference: chatbot showcase queries (from Maxim's email)

The chatbot is polished for these three query shapes — useful for the
"can I show you?" live demo at the poster session:

1. *"Where does taxol bind in a human tubulin structure resolved at
   or below 3.5 Å?"* — filter + binding-site lookup.
2. *"Compare the GTP binding site in human and Toxoplasma gondii
   α-tubulin."* — cross-species residue-level comparison. Resolves to
   `6S8L:A` (human, 1.80 Å) and `9Y9Z:1A` (T. gondii, 3.14 Å).
3. *"I'm interested in phosphorylation of T. gondii tubulin, but
   there is data only for human — compare sequences and highlight
   phosphorylation sites."* — annotation transfer across species.

These could be shown as a small text strip under the architecture
diagram OR as captions on the side showcases. Currently dropped
from the layout to keep things compact, but worth a callout
somewhere.

## 14. Email feedback (Maxim & Carsten, prior session)

Key directives:

- **Maxim**: remove the specific example query from the abstract or
  replace it with a general description. ✓ Done.
- **Maxim**: 3 polished showcase queries above are good demo material.
- **Carsten**: "the poster should also not be overcharged" — keep
  things glance-able. ✓ Architecture diagram was simplified; tile
  list was compressed.
- **Carsten**: disease-mutation map suggested as alternative central
  showcase. ✓ Adopted as the central showcase (replacing earlier GTP
  cross-species idea).
- **Carsten**: polyglutamylation example mentioned but flagged as
  hard to visualise (sits in unstructured CTT). ✗ Not pursued.
- **Carsten**: will give comments on amended abstract once shipped.
  PENDING — abstract is at 251 words, current state ready to send.

---

End of report.
