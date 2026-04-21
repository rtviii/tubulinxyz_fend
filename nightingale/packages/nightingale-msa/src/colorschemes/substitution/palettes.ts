import type { Category } from "./categorize";

export type Palette = Record<Category, string>;

// Warm palette — original "Substitution Salience" colors.
export const PALETTE_SALIENCE: Palette = {
  gap:          "#ffffff",
  consensus:    "#f0f0f0",
  ambiguous:    "#cdc4b4",
  common:       "#e8c87a",
  conservative: "#e09850",
  radical:      "#c8553a",
};

// Grayscale palette — classic Clustal-style shading collapsed to three tones.
// Conservation reads as solid black columns; "reasonable" substitutions are
// a single mid-gray; everything divergent is white. Leaves visual room for
// ligand / variant / PTM cell-color overlays to pop.
export const PALETTE_BW: Palette = {
  gap:          "#ffffff",
  consensus:    "#000000", // black
  common:       "#9ca3af", // mid gray (frequent substitution)
  conservative: "#9ca3af", // mid gray (same biochem group as consensus)
  radical:      "#ffffff", // white (distant substitution)
  ambiguous:    "#ffffff", // white (no column consensus)
};

// Legend display order and human labels, shared across both palettes.
export const LEGEND_ORDER: Array<{ category: Category; label: string; desc: string }> = [
  { category: "consensus",    label: "Consensus",    desc: "Matches the most frequent residue in the column" },
  { category: "ambiguous",    label: "Ambiguous",    desc: "No residue exceeds 40% frequency -- column is too diverse" },
  { category: "common",       label: "Common sub.",  desc: "Differs from consensus but itself is frequent (>30%)" },
  { category: "conservative", label: "Conservative", desc: "Rare substitution, same biochemical group (similar chemistry)" },
  { category: "radical",      label: "Radical",      desc: "Rare substitution across biochemical groups (different chemistry)" },
];
