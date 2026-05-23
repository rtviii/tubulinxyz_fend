# tube.xyz: an interactive structural atlas of the tubulin code

**Authors** — A. Kushner, M. Igaev, C. Janke, M. O. Steinmetz *(final author list TBC)*
**Affiliations** — *(TBC)*

---
The *tubulin code* — combinations of α/β isotypes and a wide variety of
post-translational modifications — modulates microtubule composition and
the interactions of tubulin with motors, MAPs and small molecules. The
PDB now holds ~1000 tubulin-containing structures,
capturing distinct conformational states, dozens of drug- and
protein-binding pockets, while curated compendia such as the TubulinDB catalogue thousands of disease-linked mutations and PTMs. This structural and annotation
layers, however, are documented in separate schemas, belong to different resources and thus resist co-exploration and synthesis.

We present **tube.xyz**, an interactive structural atlas that places
every recorded tubulin residue from every deposited structure into a single
"coordinate system" per family (α, β): sequence variants, ligand-binding contacts literature mutations and PTMs are programmaticaly lifted onto the common residue index. The coordinate substrate is deliberately pluggable: new annotation sources — clinical variant catalogues, fragment screens, new structures -- can be added to the atlas on a rolling basis via a simple mapping between theirs and the common residue indices.

A 2D MSA, 3D molecular viewers and an LLM-driven chatbot are provided to facilitate the navigation and export of this integrated data. It's our hope that this database and its integrative facilities can provide connective tissues between the structural data and the wealth of literature annotations while the web interface lets both the experts and students navigate the data.


---

*Word count: 273 (within 250–300 target).*
*Candidate alternative titles in `poster/poster_spec.md`.*

## Notes on framing

This draft has been updated after the second pass over the literature
workspace (`/Users/rtviii/paper-workspaces/tubulin/papers/`):

- **TubulinDB (Abbaali *et al.* 2023, PLoS ONE 18(12): e0295279)** is the
  source of the ~5,200 mutation and ~1,950 modification entries we
  ingest. Their work is the canonical curated annotation layer; the
  abstract now positions tube.xyz as the interactive structure-first
  substrate that sits *on top of* their data plus the full ~800-structure
  PDB corpus, rather than as a competing database. Important note:
  internally the codebase calls these CSVs "Morisette" (misspelling of
  the senior author **Morrissette**, UCI); see the spawned task to
  rename and re-cite throughout the codebase.
- **Janke & Magiera (2020) *Nat. Rev. Mol. Cell Biol.* 21, 307–326** is
  the canonical tubulin-code reference. The opening sentence adopts
  their framing of isotypes + PTMs modulating microtubule composition.
- **Steinmetz & Prota (2018) *Trends Cell Biol.* 28(10)** is the
  canonical MTA-binding-sites review (taxane, colchicine, vinca,
  laulimalide/peloruside, maytansine, pironetin). The Mühlethaler 2021
  fragment-screen paper extends this with 18 additional novel sites.
- **Findeisen *et al.* (2014) *Genome Biol. Evol.* 6(9): 2274–2288**
  identifies six tubulin subfamilies (α, β, γ, δ, ε, ζ); ζ has no
  experimentally determined structures yet — our atlas covers the five
  represented (α–ε).
