# Figures

The poster compiles without these (the `fbox` placeholders in
`poster.tex` render in their place). Drop the real assets here when you
have them, then swap the placeholder `\fbox{\parbox{...}}` blocks for
`\includegraphics`.

## Expected files

### `showcase_3d.png` (or `.pdf`)

The central 3D image of the disease-mutation showcase. Render in Mol*
inside the tube.xyz expert mode:

1. Navigate to `http://localhost:3000/structures/6S8L?mode=monomer&chain=B`.
   (6S8L:B is TUBB3, the human β-tubulin chain confirmed in the DB.)
2. In expert mode, the bottom MSA panel should show the master
   alignment around TUBB3.
3. Apply manual residue colouring to the five disease positions:
   - **205, 410** → red (cortical dysplasia / MCD)
     `E205K, E205A; E410K`
   - **262, 417, 410** → orange (CFEOM / extraocular fibrosis)
     `R262C, R262H; D417H, D417N; E410V`
   - **262** → purple (biochemical in-vitro phenotype)
     `R262A`
   - (R262 is double-coded since it carries both clinical and
     biochemical phenotypes. Either render two markers at that position
     or use the dominant phenotype.)
4. Show side chains as ball-and-stick at those positions.
5. Keep GTP (entity 4, at A:501 nucleotide site) visible at the
   intra-dimer interface, desaturated to muted grey.
6. Plinabulin sits at the colchicine site between A and B. Show muted.
7. Camera should expose all five mutation positions without occlusion.
   Tilt slightly to expose the M-loop near E410.
8. Export at 3000+ px width. Convert to PDF or use the PNG directly.

Once placed, in `poster.tex` search for `figures/showcase_3d.png` and
replace the surrounding `\fbox{\parbox{...}}` with:

```latex
\includegraphics[width=0.97\linewidth]{figures/showcase_3d}
```

### `showcase_msa.png`

Full-width strip showing the β-isotype alignment with the disease
columns boxed.

1. In the same expert-mode view, expand the MSA panel as wide as the
   window allows.
2. Add the other β-isotypes via "Add alignment / Add polymer" so the
   stack contains: TUBB1, TUBB2A, TUBB2B, **TUBB3** (reference, top or
   highlighted), TUBB4A, TUBB4B, TUBB5, TUBB6, TUBB8.
3. Use the salience-mono colour scheme as the base so the variant
   overlay below pops.
4. Turn on the variants aux row (literature source).
5. Set the MSA viewport to master positions ~200–420 so all five
   mutation columns (205, 262, 401, 410, 417) are visible at once.
6. Manually mark / box those five columns (either in the UI if there's
   a "pin column" affordance, or annotate over the screenshot later).
7. Take a screenshot of just the MSA panel (crop off the 3D viewer
   above). Aim for ~4000 px wide so the print at A1 stays sharp.

Once placed, in `poster.tex` search for `figures/showcase_msa.png` and
replace the `\fbox{\parbox{...}}` with:

```latex
\includegraphics[width=0.99\linewidth]{figures/showcase_msa}
```

## Optional / future

### `chatbot.png`

Not used in the current layout. The three "other queries" tiles are
text-only on this version of the poster. If you want to include a
chatbot screenshot later (perhaps as a small inset alongside the
showcase tiles), crop just the `<PillChatInput>` + the suggested-
question row from the landing page.

### Institutional logos

Drop logo files in this directory and add to the title block:

```latex
\titlegraphic{\includegraphics[height=2cm]{figures/logo_psi.pdf}\,
              \includegraphics[height=2cm]{figures/logo_curie.pdf}}
```

Put that before `\begin{document}` in `poster.tex`.
