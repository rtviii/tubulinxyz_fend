/**
 * Maps NCBI taxIds to the species text strings used in Variant records
 * (Morissette's abbreviation form, e.g. "H. sapiens").
 *
 * This exists because Variant nodes don't carry tax_id directly — only the
 * free-text `species` field. The Add Track modal lets users browse a NCBI
 * taxonomy tree; selections are converted to variant.species text strings
 * here before being passed to the backend as `species_names`.
 *
 * Long-term: re-ingest variants with concrete tax_id and use
 * `species_tax_ids` on the variant FilterSpec directly. See
 * notes/annotation_tracks_roadmap.md.
 */

/** taxId -> the abbreviation form used in variant.species (Morisette's). */
export const VARIANT_SPECIES_BY_TAXID: Record<number, string> = {
  9606: 'H. sapiens',
  10090: 'M. musculus',
  10116: 'R. norvegicus',
  9913: 'B. taurus',
  9615: 'C. familiaris',
  9685: 'F. catus',
  9986: 'O. cuniculus',
  9031: 'G. gallus',
  7955: 'D. rerio',
  8364: 'X. tropicalis',
  8355: 'X. laevis',
  7227: 'D. melanogaster',
  6239: 'C. elegans',
  4932: 'S. cerevisiae',
  4896: 'S. pombe',
  44689: 'D. discoideum',
  5759: 'G. lamblia',
  5722: 'T. vaginalis',
  5811: 'T. gondii',
  5833: 'P. falciparum',
  3702: 'A. thaliana',
};

/** Convert a list of NCBI taxIds (e.g. from a TreeSelect) into the species
 *  text strings that variant.species actually contains. taxIds with no
 *  mapping are dropped (the user will see fewer matches but no error). */
export function taxIdsToVariantSpeciesNames(taxIds: number[]): string[] {
  const out = new Set<string>();
  for (const t of taxIds) {
    const name = VARIANT_SPECIES_BY_TAXID[t];
    if (name) out.add(name);
  }
  return Array.from(out);
}
