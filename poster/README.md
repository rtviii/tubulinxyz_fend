# Poster build notes

**A1 portrait**, `tikzposter`, all-LaTeX with TikZ for the counts table
and `\includegraphics` for the central showcase (3D + MSA).

## Overleaf quickstart

1. Create a new Overleaf project (Blank project).
2. Upload `tubexyz_poster.zip` via `New Project → Upload Project`, **or**
   drag every file in this folder into the project preserving the
   `tikz/` and `figures/` subdirectory structure.
3. `Menu → Settings → Compiler` → **XeLaTeX**.
4. `Menu → Settings → Main document` → `poster.tex`.
5. Click `Recompile`. First build runs twice automatically to settle
   TikZ overlay positions.

The `% !TEX program = xelatex` magic comment at the top of `poster.tex`
makes most editors (Overleaf, TeXShop, VS Code LaTeX-Workshop) pick the
right compiler automatically.

## Local build

```
cd poster
xelatex poster.tex
xelatex poster.tex   # second pass
```

## Layout

The poster has one central anchor: **TUBB3 disease-mutation map on
β-tubulin**, drawn from the TubulinDB (Abbaali 2023) literature layer
and built off PDB **6S8L:B**.

```
┌──────────────────────────────────────────────────────────────┐
│ Title · authors · affiliations                               │
├────────────────────────────┬─────────────────────────────────┤
│ Motivation (compact)       │ Database overview               │
│                            │  - counts table                 │
│                            │  - one-paragraph pipeline note  │
├────────────────────────────┴─────────────────────────────────┤
│ Showcase: TUBB3 disease mutations                            │
│ ┌────────────────────────┐  ┌───────────────────────────┐    │
│ │ figures/showcase_3d.png│  │ Residue chip (R262)       │    │
│ │ (Mol* render)          │  │ - Substitutions reported  │    │
│ │                        │  │ - Conservation note       │    │
│ │                        │  │ - Reference (Tischfield)  │    │
│ └────────────────────────┘  └───────────────────────────┘    │
│ phenotype legend                                             │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ figures/showcase_msa.png (β-isotype MSA, full width)     │ │
│ └──────────────────────────────────────────────────────────┘ │
│ interpretation: positions identical across all β-isotypes... │
├──────────────────────────────────────────────────────────────┤
│ Other queries the chatbot handles                            │
│   #1 Filter + binding site    "Where does taxol bind..."     │
│   #2 Cross-species comparison "Compare GTP site..."          │
│   #3 Annotation transfer      "Highlight phospho sites..."   │
├──────────────────────────────────────────────────────────────┤
│ Footer: refs + acknowledgements + QR codes                   │
└──────────────────────────────────────────────────────────────┘
```

## Files

```
poster.tex                       <- main document, edit me
references.tex                   <- 3 key refs (others can live in a
                                    handout next to the poster)
README.md                        <- this file
tikz/
  counts_table.tex               <- database counts (used in row 1)
  architecture_diagram.tex       <- (unused in current layout, kept
                                    in case you switch to a denser
                                    layout or want to swap a panel)
  schema_diagram.tex             <- (unused, same reason)
  annotated_expert_mode.tex      <- (unused legacy A2 callouts)
figures/
  showcase_3d.png                <- TUBB3 disease map render (TODO)
  showcase_msa.png               <- β-isotype MSA strip (TODO)
  README.md                      <- how to produce the two images
```

## Producing the two figures (step-by-step)

See `figures/README.md` for the click-by-click recipe. Summary:

1. **`figures/showcase_3d.png`** — open `localhost:3000/structures/6S8L`
   in expert mode on chain B (TUBB3). Manually colour residues 205, 262,
   401, 410, 417 by phenotype (legend in `poster.tex`). Show GTP and
   plinabulin desaturated for context. Screenshot at 3000+ px width.

2. **`figures/showcase_msa.png`** — in the same expert mode, expand the
   bottom MSA panel; add all 9 β-isotypes; set viewport to master
   positions ~200–420; turn on the variants aux row. Crop the MSA
   panel out at 4000+ px width.

Once both files are in `figures/`, search `poster.tex` for the two
`\fbox{\parbox{...}}` blocks marked with TODO comments and swap them
for `\includegraphics{figures/showcase_3d}` and
`\includegraphics{figures/showcase_msa}`. Compile twice.

## What's still placeholder

- [ ] Final author affiliations in `\institute{...}` (~line 65 of
       `poster.tex`)
- [ ] Acknowledgements / funding line (search for "TBC")
- [ ] Institutional logos (see `figures/README.md`)
- [ ] `figures/showcase_3d.png`
- [ ] `figures/showcase_msa.png`

## What's been deliberately cut

The previous A2 draft had a separate Architecture diagram (ingest → ETL
→ Neo4j → API → frontend) and three larger query-showcase tiles. Both
made the layout overflow even at A1. The architecture diagram lives
in `tikz/architecture_diagram.tex` if you want to add it back (or use
it on a handout), but for the poster itself, Carsten's "don't overcharge"
advice pointed the right way: the central TUBB3 visual + the compact
"other queries" tabular list does the same work in half the space.

## Tikzposter knobs that matter

- `\tikzposterlatexaffectionproofoff` --- removes the "LaTeX TikZposter"
  watermark in the title block.
- `\settitle{...}` --- overrides the title block layout (default
  `\Huge` font overflows even A1).
- Inside any TikZ node with multi-line text, set
  `align=left, text width=Xcm` --- otherwise `\\` is silently ignored
  and text overflows horizontally, which silently breaks the page
  layout (this was the gotcha that ate hours on the A2 version).
- `\block{}{...}` with empty title --- borderless block, used for the
  footer.

## Document-class options used

```
\documentclass[
  a1paper, portrait, 15pt,
  margin=10mm,              % outer page margin
  innermargin=8mm,          % inside-block margin
  blockverticalspace=4mm,   % gap between blocks
  colspace=8mm              % gap between columns
]{tikzposter}
```
