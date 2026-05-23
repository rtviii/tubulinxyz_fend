# Poster spec — tube.xyz at EMBL course

A2 portrait (420 × 594 mm). Three-column grid above a wide footer strip.
Below is the panel layout, per-panel copy, and notes on what visual assets
are needed.

## Candidate titles (final choice TBC)

1. **tube.xyz: a unified-coordinate atlas of tubulin structures, isotypes, mutations, modifications and binding sites**
2. **One coordinate system for every tubulin residue: a structural atlas linking PDB, isotypes and the tubulin code**
3. **tube.xyz: interactive cross-structure exploration of tubulin binding sites, variants and post-translational modifications**

## Visual layout

```
+-----------------------------------------------------------+
|  [TITLE]                                                  |
|  authors • affiliations • logos                           |
+----------------------------+------------------------------+
|  (1) Motivation / abstract |  (2) Database overview       |
|      + heterodimer inset   |       counts table           |
|      with binding sites    |       graph schema           |
+----------------------------+------------------------------+
|  (3) Pipeline / architecture diagram (full width)         |
|      ingest -> ETL -> Neo4j -> API -> frontend            |
+----------------------------+------------------------------+
|  (4) Frontend: 1D-3D sync  |  (5) Natural-language layer  |
|      screenshot + callouts |       screenshot + callouts  |
+----------------------------+------------------------------+
|  (6) Footer: URL • repos • QR codes • refs • acks         |
+-----------------------------------------------------------+
```

Print rules of thumb at A2: body text 16–18 pt minimum, headings 28–36 pt,
title 48–60 pt. Leave ≥10 mm margins.

---

## Panel 1 — Motivation & abstract (~38% of upper row width)

Use the trimmed version of the abstract from `abstract.md`:

> The *tubulin code* — combinations of α/β isotypes and a wide variety of
> post-translational modifications — modulates microtubule composition
> and interactions with motors, MAPs and small molecules (Janke &
> Magiera 2020). ~800 tubulin-containing PDB structures capture the
> conformational landscape and over two dozen drug- and protein-binding
> pockets (Steinmetz & Prota 2018; Mühlethaler *et al.* 2021), while the
> TubulinDB (Abbaali *et al.* 2023) catalogues thousands of disease-linked
> mutations and PTMs in Universal Tubulin Numbering. The structural and
> annotation layers live in separate resources and resist joint queries.
>
> **tube.xyz** places every tubulin residue into a single master-alignment
> coordinate system per family (α, β, γ, δ, ε) and ingests TubulinDB
> annotations onto the same frame via UTN. A Mol*-based 3D viewer is
> coupled bidirectionally to a Nightingale MSA; expert mode overlays
> several PDB chains onto the master sequence for cross-structure
> comparison. A natural-language interface resolves queries to real PDB
> identifiers through a Neo4j Cypher resolver — never through the
> language model.

**Inset graphic** — α/β heterodimer (e.g. PDB **5SYE** or **1JFF**) with
the six classical drug-binding sites labelled, residue-specific notation
adapted from Steinmetz & Prota 2018:

- **Taxane** site (β-tubulin, luminal): helix H7, strand S7, loops H6–H7,
  M-loop (S7–H9), S9–S10. *Stabilising.*
- **Laulimalide / peloruside** site (β-tubulin, outward face): helices
  H9, H10; loops H9–H9', H10–S9. *Stabilising.*
- **Colchicine** site (β-tubulin, intra-dimer): H7, H8, T7 loop, S8, S9
  of β + T5 loop of α. *Destabilising.*
- **Vinca** site (β1–α2 inter-dimer): H6 turn, T5, H6–H7 of β1 + H10, S9,
  T7 of α2. *Destabilising.*
- **Maytansine** site (α–β inter-dimer near GTP): H10–S9, S8, H8 of α +
  H3', H11, H11', T3-, T5-, H11–H11' loops of β. *Destabilising.*
- **Pironetin** site (α-tubulin, **covalent** to Cys316): S8, S10, H7;
  buried pocket of H7, S4, S5, S6. *Destabilising.*

Optional callout: *Mühlethaler et al. 2021 extends this map to **27
distinct sites**, including 11 sites without any structurally
characterised ligand or protein partner — a roadmap for future
binding-pocket annotation.*

---

## Panel 2 — Database overview (~62% of upper row width)

### Counts table (use this exact wording)

| Layer | Content | Source | Count |
|---|---|---|---|
| Structures | tubulin-containing PDB entries | RCSB Search API (InterPro **IPR000217**) | ~800 |
| Tubulin families represented | α, β, γ, δ, ε *(ζ has no experimental structures; Findeisen 2014)* | HMM classification | 5 of 6 |
| MAP / tubulin-modifying-enzyme families | EBs, kinesins (-1/-5/-13), dynein, katanin, CKAP5, TPX2, TTL, tau, MAP2/4/7, PRC1, CAMSAPs, vasohibin–SVBP, ATAT1, TTLLs, … | HMM classification (curated seeds) | 39 |
| Human α/β isotypes | TUBA1A–TUBA8, TUBB1–TUBB8 | UniProt lookup + alignment fallback | 16 |
| Structural variants | substitutions, insertions, deletions vs. master consensus | MUSCLE profile alignment | per-entity |
| Literature mutations | clinical + model-organism missense variants | **TubulinDB** (Abbaali *et al.* 2023) | ~5,200 |
| Literature modifications | tubulin-body PTMs (acetylation, methylation, phosphorylation, polyamination, ubiquitinylation, palmitoylation, sumoylation) + C-terminal-tail PTMs (tyrosination / detyrosination, polyglutamylation, polyglycylation, Δ2/Δ3-tubulin) | TubulinDB + Janke & Magiera 2020 | ~1,950 |
| Ligand binding sites | per-structure residue contacts | Mol* (headless) → master-alignment lift | per-structure |
| Taxonomy | NCBI lineage paths (source + host organism) | NCBI / ete3 | ~hundreds |

### Inline schema diagram

Render the Mermaid diagram in `database_overview.md` here. The bottom of
the panel calls out the **join key**:

> *`Variant.master_index` is indexed in Neo4j. This single coordinate
> makes every literature mutation, structural variant, PTM, and
> ligand-contact comparable across the entire dataset.*

---

## Panel 3 — Pipeline / architecture diagram (full width)

Render the Mermaid diagram from `architecture_diagram.md`. The diagram is
designed to be read left-to-right in three horizontal lanes:

1. **Ingest** (top lane): RCSB Search API → RCSB GraphQL → CIF coords;
   parallel inputs from NCBI taxonomy (ete3) and Morisette CSVs.
2. **Process & store** (middle lane): five-phase ETL → Neo4j graph.
3. **Serve** (bottom lane): FastAPI → Next.js frontend with Mol* +
   Nightingale + NL chat.

### Side callouts to drop alongside the diagram

**(A) Universal residue index**
> Each tubulin entity is profile-aligned against a per-family master MSA.
> The resulting bidirectional map (`label_seq_id ↔ master_index ↔
> auth_seq_id`) is what lets a click on column 162 of the β-master
> highlight L246 in 1JFF chain B, L240 in 6WVM chain D, and the same
> position in any other deposited β-tubulin structure.

**(B) Isotype calling, two-tier**
> Tier 1: lookup of the entity's UniProt accession against a curated
> map → HGNC symbol (TUBA1A, TUBB3, …).
> Tier 2 fallback: pairwise alignment against human isotype reference
> sequences, requiring ≥85 % identity. Handles novel sequences and
> species variants where UniProt is silent.

**(C) Anti-hallucination resolver for the natural-language layer**
> The language model never authors a PDB identifier. It emits an organism
> + family selector (e.g. *"human α-tubulin"*), and a Neo4j Cypher query
> returns the actual top-resolution structure. Cards whose entities fail
> existence-check in the database are dropped before the response is
> sent to the user.

---

## Panel 4 — Frontend: 1D-3D sync (~50% of lower row width)

Screenshot of **expert mode**, captured at A4 width. Required content:

- Mol* 3D viewer at the top with two or three chains aligned to a master
- Nightingale MSA at the bottom with the same chains as rows
- Auxiliary rows below the MSA showing a ligand-binding-site track and a
  variants track
- A residue highlighted in both views (e.g. the GTP site, residues
  140–180 of β-master)

### Callouts (numbered annotations)

1. *Hover or click here ↔ here.* Same residue selected in both views via
   the Redux position-mapping store.
2. *Variant overpaint.* Coloured cells in the MSA are literature or
   structural variants painted on top of the base colouring scheme
   (Clustal / Zappo / salience).
3. *Ligand-binding-site overlay row.* Master-alignment columns where any
   chain in this structure contacts the focused ligand.
4. *Multi-structure alignment.* Several PDB chains aligned onto the
   master sequence simultaneously; gaps reflect insertions/deletions in
   the individual sequences.

---

## Panel 5 — Natural-language layer (~50% of lower row width)

Screenshot of the **landing page chat input** with a worked example.
Suggested query: *"compare the GTP site in human and Toxoplasma
α-tubulin"*.

The screenshot should show the response panel beneath the input:

- one short blurb (≤180 chars)
- two or three typed action cards
  (e.g. `Expert mode → 6S8L:A vs 9Y9Z:1A`, `Catalogue → α-tubulin from
  Toxoplasma`)
- entity pills inside the blurb that the user can click to drill in

### Callouts

1. *Up to six typed cards*, ranked by specificity. One short blurb above.
2. *Resolved against the database.* Every `rcsb_id` on every card came
   from a Neo4j Cypher query — not from the LLM.
3. *Deep-linked URL state.* Clicking a card navigates to a URL like
   `/structures/6S8L?mode=monomer&chain=A&align=9Y9Z:1A&range=140-180`.
   The URL is the source of truth: shareable, bookmarkable, and the
   viewer state is reconstructed on page load.

---

## Panel 6 — Footer (full width)

- **URL:** [tube.xyz](https://tube.xyz)
- **Repos:** github.com/rtviii/tubulinxyz (backend) · github.com/rtviii/tubulinxyz_fend (frontend)
- **DeepWiki:** deepwiki.com/rtviii/tubulinxyz · deepwiki.com/rtviii/tubulinxyz_fend (include QR codes)
- **References:**
  1. Abbaali I, Truong D, Day SD, *et al.* (2023). The tubulin database: linking mutations, modifications, ligands and local interactions. *PLoS ONE* **18**(12): e0295279. *(Source of TubulinDB / UTN annotations.)*
  2. Janke C, Magiera MM (2020). The tubulin code and its role in controlling microtubule properties and functions. *Nat. Rev. Mol. Cell Biol.* **21**, 307–326.
  3. Steinmetz MO, Prota AE (2018). Microtubule-targeting agents: strategies to hijack the cytoskeleton. *Trends Cell Biol.* **28**(10), 776–792.
  4. Mühlethaler T, Gioia D, Prota AE, Sharpe ME, Cavalli A, Steinmetz MO (2021). Comprehensive analysis of binding sites in tubulin. *Angew. Chem. Int. Ed.* **60**, 13331–13342. *(27 sites by combined MD + crystallographic fragment screen.)*
  5. Nsamba ET, Gupta ML (2022). Tubulin isotypes — functional insights from model organisms. *J. Cell Sci.* **135**, jcs259539.
  6. Akhmanova A, Steinmetz MO (2015). Control of microtubule organization and dynamics: two ends in the limelight. *Nat. Rev. Mol. Cell Biol.* **16**, 711–726.
  7. Manka SW, Moores CA (2018). Microtubule structure by cryo-EM: snapshots of dynamic instability. *Nat. Struct. Mol. Biol.*
  8. Alushin GM, Lander GC, Kellogg EH, *et al.* (2014). High-resolution microtubule structures reveal the structural transitions in αβ-tubulin upon GTP hydrolysis. *Cell*.
  9. Prota AE, Bargsten K, Zurwerra D, *et al.* (2014). A new tubulin-binding site and pharmacophore for microtubule-destabilizing anticancer drugs. *Proc. Natl. Acad. Sci. USA*.
  10. Findeisen P, Mühlhausen S, Dempewolf S, *et al.* (2014). Six subgroups and extensive recent duplications characterize the evolution of the eukaryotic tubulin protein family. *Genome Biol. Evol.* **6**(9), 2274–2288.
  11. Sehnal D, Bittrich S, Deshpande M, *et al.* (2021). Mol* Viewer: modern web app for 3D visualization and analysis of large biomolecular structures. *Nucleic Acids Res.* **49**, W431–W437.
  12. Edgar RC (2004). MUSCLE: multiple sequence alignment with high accuracy and high throughput. *Nucleic Acids Res.* **32**, 1792–1797.
  13. Eddy SR (2011). Accelerated profile HMM searches. *PLoS Comput. Biol.* **7**(10): e1002195. *(HMMER / PyHMMER.)*
- **Acknowledgements** *(fill in)*
- **Logos** *(fill in — institutional logos for the author affiliations)*

---

## Assets needed before final layout

- [ ] Final author list & affiliations
- [ ] Three high-quality screenshots:
  - landing page with chat input + example cards
  - expert mode with MSA + 3D + binding-site overlay (suggested: taxane
    site in β-tubulin — visually striking M-loop)
  - catalogue page (optional, only if footer leaves room)
- [ ] Institutional logos
- [ ] α/β heterodimer figure with labelled binding sites (we can render
      this in Mol* with our own colour scheme — see
      `src/components/molstar/colors/palette.ts`)
- [ ] DeepWiki QR codes (use any QR generator on the two URLs)
- [ ] Codebase rename: internal references to "Morisette" should be
      updated to "Abbaali" / "TubulinDB" to match the actual citation
      (Abbaali I, Truong D, Day SD *et al.* 2023; the senior author is
      Morrissette, UCI — the codebase has misspelled the name).
      *Tracked separately as a spawned task.*

## Suggested tooling

For final layout: **Inkscape** (vector, free) or **Adobe Illustrator**
gives the most control. **LaTeX `tikzposter`** or **`baposter`** also
work if you prefer text-driven layout. For the Mermaid diagrams, render
to SVG with the Mermaid CLI:

```
npx -y @mermaid-js/mermaid-cli -i poster/architecture_diagram.md -o poster/architecture.svg
npx -y @mermaid-js/mermaid-cli -i poster/database_overview.md -o poster/database.svg
```

…then drop the SVGs straight into the layout tool.
