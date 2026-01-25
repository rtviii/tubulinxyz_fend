import { emptySplitApi as api } from "./emptyApi";
export const addTagTypes = [
  "Structures",
  "Polymers",
  "Ligands",
  "MSA Alignment",
  "Annotations",
  "Health",
] as const;
const injectedRtkApi = api
  .enhanceEndpoints({
    addTagTypes,
  })
  .injectEndpoints({
    endpoints: (build) => ({
      getTaxonomyTreeStructuresTaxonomyTreeTaxTypeGet: build.query<
        GetTaxonomyTreeStructuresTaxonomyTreeTaxTypeGetApiResponse,
        GetTaxonomyTreeStructuresTaxonomyTreeTaxTypeGetApiArg
      >({
        query: (queryArg) => ({
          url: `/structures/taxonomy-tree/${queryArg.taxType}`,
        }),
        providesTags: ["Structures"],
      }),
      listStructuresStructuresGet: build.query<
        ListStructuresStructuresGetApiResponse,
        ListStructuresStructuresGetApiArg
      >({
        query: (queryArg) => ({
          url: `/structures`,
          params: {
            cursor: queryArg.cursor,
            limit: queryArg.limit,
            search: queryArg.search,
            ids: queryArg.ids,
            resMin: queryArg.resMin,
            resMax: queryArg.resMax,
            yearMin: queryArg.yearMin,
            yearMax: queryArg.yearMax,
            expMethod: queryArg.expMethod,
            polyState: queryArg.polyState,
            sourceTaxa: queryArg.sourceTaxa,
            hostTaxa: queryArg.hostTaxa,
            ligands: queryArg.ligands,
            family: queryArg.family,
            uniprot: queryArg.uniprot,
            hasVariants: queryArg.hasVariants,
            variantFamily: queryArg.variantFamily,
            variantType: queryArg.variantType,
            variantPosMin: queryArg.variantPosMin,
            variantPosMax: queryArg.variantPosMax,
            variantWildType: queryArg.variantWildType,
            variantObserved: queryArg.variantObserved,
            variantSource: queryArg.variantSource,
            variantPhenotype: queryArg.variantPhenotype,
          },
        }),
        providesTags: ["Structures"],
      }),
      getFacetsStructuresFacetsGet: build.query<
        GetFacetsStructuresFacetsGetApiResponse,
        GetFacetsStructuresFacetsGetApiArg
      >({
        query: () => ({ url: `/structures/facets` }),
        providesTags: ["Structures"],
      }),
      getTaxonomyStructuresTaxonomyTaxTypeGet: build.query<
        GetTaxonomyStructuresTaxonomyTaxTypeGetApiResponse,
        GetTaxonomyStructuresTaxonomyTaxTypeGetApiArg
      >({
        query: (queryArg) => ({
          url: `/structures/taxonomy/${queryArg.taxType}`,
        }),
        providesTags: ["Structures"],
      }),
      getFamiliesStructuresFamiliesGet: build.query<
        GetFamiliesStructuresFamiliesGetApiResponse,
        GetFamiliesStructuresFamiliesGetApiArg
      >({
        query: () => ({ url: `/structures/families` }),
        providesTags: ["Structures"],
      }),
      getStructureStructuresRcsbIdGet: build.query<
        GetStructureStructuresRcsbIdGetApiResponse,
        GetStructureStructuresRcsbIdGetApiArg
      >({
        query: (queryArg) => ({ url: `/structures/${queryArg.rcsbId}` }),
        providesTags: ["Structures"],
      }),
      getStructureProfileStructuresRcsbIdProfileGet: build.query<
        GetStructureProfileStructuresRcsbIdProfileGetApiResponse,
        GetStructureProfileStructuresRcsbIdProfileGetApiArg
      >({
        query: (queryArg) => ({
          url: `/structures/${queryArg.rcsbId}/profile`,
        }),
        providesTags: ["Structures"],
      }),
      listPolymersPolymersGet: build.query<
        ListPolymersPolymersGetApiResponse,
        ListPolymersPolymersGetApiArg
      >({
        query: (queryArg) => ({
          url: `/polymers`,
          params: {
            cursor: queryArg.cursor,
            limit: queryArg.limit,
            resMin: queryArg.resMin,
            resMax: queryArg.resMax,
            yearMin: queryArg.yearMin,
            yearMax: queryArg.yearMax,
            sourceTaxa: queryArg.sourceTaxa,
            family: queryArg.family,
            uniprot: queryArg.uniprot,
            motif: queryArg.motif,
            seqLenMin: queryArg.seqLenMin,
            seqLenMax: queryArg.seqLenMax,
            hasVariants: queryArg.hasVariants,
          },
        }),
        providesTags: ["Polymers"],
      }),
      listLigandsLigandsGet: build.query<
        ListLigandsLigandsGetApiResponse,
        ListLigandsLigandsGetApiArg
      >({
        query: (queryArg) => ({
          url: `/ligands`,
          params: {
            cursor: queryArg.cursor,
            limit: queryArg.limit,
            search: queryArg.search,
            ids: queryArg.ids,
            hasDrugbank: queryArg.hasDrugbank,
            inStructures: queryArg.inStructures,
          },
        }),
        providesTags: ["Ligands"],
      }),
      ligandOptionsLigandsOptionsGet: build.query<
        LigandOptionsLigandsOptionsGetApiResponse,
        LigandOptionsLigandsOptionsGetApiArg
      >({
        query: (queryArg) => ({
          url: `/ligands/options`,
          params: {
            search: queryArg.search,
            limit: queryArg.limit,
          },
        }),
        providesTags: ["Ligands"],
      }),
      getLigandNeighborhoodsLigandsNeighborhoodsRcsbIdAuthAsymIdGet:
        build.query<
          GetLigandNeighborhoodsLigandsNeighborhoodsRcsbIdAuthAsymIdGetApiResponse,
          GetLigandNeighborhoodsLigandsNeighborhoodsRcsbIdAuthAsymIdGetApiArg
        >({
          query: (queryArg) => ({
            url: `/ligands/neighborhoods/${queryArg.rcsbId}/${queryArg.authAsymId}`,
          }),
          providesTags: ["Ligands"],
        }),
      alignSequenceMsaSequencePost: build.mutation<
        AlignSequenceMsaSequencePostApiResponse,
        AlignSequenceMsaSequencePostApiArg
      >({
        query: (queryArg) => ({
          url: `/msa/sequence`,
          method: "POST",
          body: queryArg.alignmentRequest,
        }),
        invalidatesTags: ["MSA Alignment"],
      }),
      getMasterProfileMsaMasterGet: build.query<
        GetMasterProfileMsaMasterGetApiResponse,
        GetMasterProfileMsaMasterGetApiArg
      >({
        query: () => ({ url: `/msa/master` }),
        providesTags: ["MSA Alignment"],
      }),
      getVariantsAtPositionEndpointAnnotationsVariantsFamilyPositionGet:
        build.query<
          GetVariantsAtPositionEndpointAnnotationsVariantsFamilyPositionGetApiResponse,
          GetVariantsAtPositionEndpointAnnotationsVariantsFamilyPositionGetApiArg
        >({
          query: (queryArg) => ({
            url: `/annotations/variants/${queryArg.family}/${queryArg.position}`,
          }),
          providesTags: ["Annotations"],
        }),
      getVariantsInRangeAnnotationsRangeFamilyGet: build.query<
        GetVariantsInRangeAnnotationsRangeFamilyGetApiResponse,
        GetVariantsInRangeAnnotationsRangeFamilyGetApiArg
      >({
        query: (queryArg) => ({
          url: `/annotations/range/${queryArg.family}`,
          params: {
            start: queryArg.start,
            end: queryArg.end,
          },
        }),
        providesTags: ["Annotations"],
      }),
      getPolymerAnnotationsAnnotationsPolymerRcsbIdAuthAsymIdGet: build.query<
        GetPolymerAnnotationsAnnotationsPolymerRcsbIdAuthAsymIdGetApiResponse,
        GetPolymerAnnotationsAnnotationsPolymerRcsbIdAuthAsymIdGetApiArg
      >({
        query: (queryArg) => ({
          url: `/annotations/polymer/${queryArg.rcsbId}/${queryArg.authAsymId}`,
        }),
        providesTags: ["Annotations"],
      }),
      getVariantStatsAnnotationsStatsFamilyGet: build.query<
        GetVariantStatsAnnotationsStatsFamilyGetApiResponse,
        GetVariantStatsAnnotationsStatsFamilyGetApiArg
      >({
        query: (queryArg) => ({ url: `/annotations/stats/${queryArg.family}` }),
        providesTags: ["Annotations"],
      }),
      healthHealthGet: build.query<
        HealthHealthGetApiResponse,
        HealthHealthGetApiArg
      >({
        query: () => ({ url: `/health` }),
        providesTags: ["Health"],
      }),
    }),
    overrideExisting: false,
  });
export { injectedRtkApi as tubxz_api };
export type GetTaxonomyTreeStructuresTaxonomyTreeTaxTypeGetApiResponse =
  /** status 200 Successful Response */ any;
export type GetTaxonomyTreeStructuresTaxonomyTreeTaxTypeGetApiArg = {
  taxType: string;
};
export type ListStructuresStructuresGetApiResponse =
  /** status 200 Successful Response */ StructureListResponse;
export type ListStructuresStructuresGetApiArg = {
  cursor?: string | null;
  limit?: number;
  search?: string | null;
  ids?: string[] | null;
  resMin?: number | null;
  resMax?: number | null;
  yearMin?: number | null;
  yearMax?: number | null;
  expMethod?: string[] | null;
  polyState?: string[] | null;
  sourceTaxa?: string[] | null;
  hostTaxa?: string[] | null;
  ligands?: string[] | null;
  family?: string[] | null;
  uniprot?: string[] | null;
  hasVariants?: boolean | null;
  variantFamily?: string | null;
  variantType?: string | null;
  variantPosMin?: number | null;
  variantPosMax?: number | null;
  variantWildType?: string | null;
  variantObserved?: string | null;
  variantSource?: string | null;
  variantPhenotype?: string | null;
};
export type GetFacetsStructuresFacetsGetApiResponse =
  /** status 200 Successful Response */ FilterFacets;
export type GetFacetsStructuresFacetsGetApiArg = void;
export type GetTaxonomyStructuresTaxonomyTaxTypeGetApiResponse =
  /** status 200 Successful Response */ any;
export type GetTaxonomyStructuresTaxonomyTaxTypeGetApiArg = {
  taxType: string;
};
export type GetFamiliesStructuresFamiliesGetApiResponse =
  /** status 200 Successful Response */ any;
export type GetFamiliesStructuresFamiliesGetApiArg = void;
export type GetStructureStructuresRcsbIdGetApiResponse =
  /** status 200 Successful Response */ any;
export type GetStructureStructuresRcsbIdGetApiArg = {
  rcsbId: string;
};
export type GetStructureProfileStructuresRcsbIdProfileGetApiResponse =
  /** status 200 Successful Response */ TubulinStructure;
export type GetStructureProfileStructuresRcsbIdProfileGetApiArg = {
  rcsbId: string;
};
export type ListPolymersPolymersGetApiResponse =
  /** status 200 Successful Response */ PolypeptideListResponse;
export type ListPolymersPolymersGetApiArg = {
  cursor?: string | null;
  limit?: number;
  resMin?: number | null;
  resMax?: number | null;
  yearMin?: number | null;
  yearMax?: number | null;
  sourceTaxa?: number[] | null;
  family?: string[] | null;
  uniprot?: string | null;
  motif?: string | null;
  seqLenMin?: number | null;
  seqLenMax?: number | null;
  hasVariants?: boolean | null;
};
export type ListLigandsLigandsGetApiResponse =
  /** status 200 Successful Response */ LigandListResponse;
export type ListLigandsLigandsGetApiArg = {
  cursor?: string | null;
  limit?: number;
  search?: string | null;
  ids?: string[] | null;
  hasDrugbank?: boolean | null;
  inStructures?: string[] | null;
};
export type LigandOptionsLigandsOptionsGetApiResponse =
  /** status 200 Successful Response */ LigandListResponse;
export type LigandOptionsLigandsOptionsGetApiArg = {
  /** Search by ID or name */
  search?: string | null;
  limit?: number;
};
export type GetLigandNeighborhoodsLigandsNeighborhoodsRcsbIdAuthAsymIdGetApiResponse =
  /** status 200 Successful Response */ PolymerNeighborhoodsResponse;
export type GetLigandNeighborhoodsLigandsNeighborhoodsRcsbIdAuthAsymIdGetApiArg =
  {
    rcsbId: string;
    authAsymId: string;
  };
export type AlignSequenceMsaSequencePostApiResponse =
  /** status 200 Successful Response */ AlignmentResponse;
export type AlignSequenceMsaSequencePostApiArg = {
  alignmentRequest: AlignmentRequest;
};
export type GetMasterProfileMsaMasterGetApiResponse =
  /** status 200 Successful Response */ any;
export type GetMasterProfileMsaMasterGetApiArg = void;
export type GetVariantsAtPositionEndpointAnnotationsVariantsFamilyPositionGetApiResponse =
  /** status 200 Successful Response */ PositionAnnotationsResponse;
export type GetVariantsAtPositionEndpointAnnotationsVariantsFamilyPositionGetApiArg =
  {
    family: string;
    position: number;
  };
export type GetVariantsInRangeAnnotationsRangeFamilyGetApiResponse =
  /** status 200 Successful Response */ {
    [key: string]: any;
  };
export type GetVariantsInRangeAnnotationsRangeFamilyGetApiArg = {
  family: string;
  /** Start position (inclusive) */
  start: number;
  /** End position (inclusive) */
  end: number;
};
export type GetPolymerAnnotationsAnnotationsPolymerRcsbIdAuthAsymIdGetApiResponse =
  /** status 200 Successful Response */ PolymerAnnotationsResponse;
export type GetPolymerAnnotationsAnnotationsPolymerRcsbIdAuthAsymIdGetApiArg = {
  rcsbId: string;
  authAsymId: string;
};
export type GetVariantStatsAnnotationsStatsFamilyGetApiResponse =
  /** status 200 Successful Response */ {
    [key: string]: any;
  };
export type GetVariantStatsAnnotationsStatsFamilyGetApiArg = {
  family: string;
};
export type HealthHealthGetApiResponse =
  /** status 200 Successful Response */ any;
export type HealthHealthGetApiArg = void;
export type ValidationError = {
  loc: (string | number)[];
  msg: string;
  type: string;
};
export type HttpValidationError = {
  detail?: ValidationError[];
};
export type StructureSummary = {
  rcsb_id: string;
  resolution?: number | null;
  expMethod?: string | null;
  citation_title?: string | null;
  citation_year?: number | null;
  deposition_date?: string | null;
  src_organism_names?: string[];
  pdbx_keywords?: string | null;
  entity_count?: number | null;
  ligand_count?: number | null;
};
export type StructureListResponse = {
  data: StructureSummary[];
  /** Total matching results before pagination */
  total_count: number;
  /** Cursor for next page */
  next_cursor?: string | null;
  /** Whether more results exist */
  has_more: boolean;
};
export type FacetValue = {
  value: string;
  count: number;
};
export type RangeValue = {
  min?: number | null;
  max?: number | null;
};
export type LigandFacet = {
  chemical_id: string;
  chemical_name?: string | null;
  count: number;
};
export type VariantsByFamily = {
  family: string;
  variant_count: number;
  structure_count: number;
};
export type CommonVariant = {
  family?: string | null;
  position?: number | null;
  wild_type?: string | null;
  observed?: string | null;
  variant_type: string;
  count: number;
};
export type VariantPositionRange = {
  family: string;
  min_position: number;
  max_position: number;
};
export type FilterFacets = {
  total_structures: number;
  exp_methods?: FacetValue[];
  tubulin_families?: FacetValue[];
  year_range: RangeValue;
  resolution_range: RangeValue;
  top_ligands?: LigandFacet[];
  variants_by_family?: VariantsByFamily[];
  common_variants?: CommonVariant[];
  variant_position_ranges?: VariantPositionRange[];
};
export type TubulinFamily =
  | "tubulin_alpha"
  | "tubulin_beta"
  | "tubulin_gamma"
  | "tubulin_delta"
  | "tubulin_epsilon";
export type MapFamily =
  | "map_atat1"
  | "map_camsap1"
  | "map_camsap2"
  | "map_camsap3"
  | "map_ccp_deglutamylase"
  | "map_cfap53"
  | "map_ckap5_chtog"
  | "map_clasp"
  | "map_clip115"
  | "map_clip170"
  | "map_doublecortin"
  | "map_eb_family"
  | "map_fap20_cfap20"
  | "map_gcp2_3"
  | "map_gcp4"
  | "map_gcp5_6"
  | "map_katanin_p60"
  | "map_kinesin13"
  | "map_map1_heavy"
  | "map_map1s"
  | "map_map2"
  | "map_map4"
  | "map_map7"
  | "map_nme7"
  | "map_nme8"
  | "map_numa"
  | "map_pacrg"
  | "map_prc1"
  | "map_rib72_efhc"
  | "map_spag6"
  | "map_spastin"
  | "map_stathmin"
  | "map_tacc"
  | "map_tau"
  | "map_tpx2"
  | "map_ttll_glutamylase_long"
  | "map_ttll_glutamylase_short"
  | "map_vash_detyrosinase";
export type IndexMappingData = {
  observed_to_master: {
    [key: string]: number | null;
  };
  master_to_observed: {
    [key: string]: number | null;
  };
};
export type VariantType = "substitution" | "insertion" | "deletion";
export type SequenceVariant = {
  type: VariantType;
  source?: string;
  master_index?: number | null;
  observed_index?: number | null;
  wild_type?: string | null;
  observed?: string | null;
  uniprot_id?: string | null;
  phenotype?: string | null;
  reference?: string | null;
};
export type PolypeptideEntity = {
  type?: "polymer";
  polymer_type?: "Protein";
  entity_id: string;
  pdbx_description?: string | null;
  pdbx_strand_ids?: string[];
  one_letter_code: string;
  one_letter_code_can: string;
  sequence_length: number;
  src_organism_names?: string[];
  host_organism_names?: string[];
  src_organism_ids?: number[];
  host_organism_ids?: number[];
  family?: TubulinFamily | MapFamily | null;
  uniprot_accessions?: string[];
  index_mapping?: IndexMappingData | null;
  variants?: SequenceVariant[];
  alignment_stats?: {
    [key: string]: any;
  };
};
export type PolynucleotideEntity = {
  entity_id: string;
  type?: "polymer";
  pdbx_description?: string | null;
  formula_weight?: number | null;
  pdbx_strand_ids?: string[];
  polymer_type: string;
  one_letter_code: string;
  one_letter_code_can: string;
  sequence_length: number;
  src_organism_names?: string[];
  src_organism_ids?: number[];
};
export type DrugbankContainerIdentifiers = {
  drugbank_id: string;
};
export type DrugbankInfo = {
  cas_number?: string | null;
  description?: string | null;
};
export type Drugbank = {
  drugbank_container_identifiers?: DrugbankContainerIdentifiers | null;
  drugbank_info?: DrugbankInfo | null;
};
export type RcsbChemCompTarget = {
  interaction_type?: string | null;
  name?: string | null;
  provenance_source?: string | null;
  reference_database_accession_code?: string | null;
  reference_database_name?: string | null;
};
export type NonpolymerComp = {
  drugbank?: Drugbank | null;
  rcsb_chem_comp_target?: RcsbChemCompTarget[] | null;
};
export type NonpolymerEntity = {
  entity_id: string;
  type?: "non-polymer";
  pdbx_description?: string | null;
  formula_weight?: number | null;
  pdbx_strand_ids?: string[];
  chemical_id: string;
  chemical_name: string;
  nonpolymer_comp?: NonpolymerComp | null;
  SMILES?: string | null;
  SMILES_stereo?: string | null;
  InChI?: string | null;
  InChIKey?: string | null;
  num_instances?: number;
};
export type Polypeptide = {
  parent_rcsb_id: string;
  auth_asym_id: string;
  asym_id: string;
  entity_id: string;
  assembly_id: number;
};
export type Polynucleotide = {
  parent_rcsb_id: string;
  auth_asym_id: string;
  asym_id: string;
  entity_id: string;
  assembly_id: number;
};
export type Nonpolymer = {
  parent_rcsb_id: string;
  auth_asym_id: string;
  asym_id: string;
  entity_id: string;
  assembly_id: number;
};
export type InstanceIdentifier = {
  entity_id: string;
  auth_asym_id: string;
  asym_id?: string | null;
};
export type AssemblyInstancesMap = {
  rcsb_id: string;
  nonpolymer_entity_instances?:
    | {
        [key: string]: InstanceIdentifier;
      }[]
    | null;
  polymer_entity_instances: {
    [key: string]: InstanceIdentifier;
  }[];
};
export type BindingSiteResidue = {
  auth_asym_id: string;
  observed_index: number;
  comp_id: string;
  master_index?: number | null;
};
export type LigandBindingSite = {
  ligand_comp_id: string;
  ligand_auth_asym_id: string;
  ligand_auth_seq_id: number;
  residues: BindingSiteResidue[];
};
export type TubulinStructure = {
  rcsb_id: string;
  expMethod: string;
  resolution: number;
  deposition_date?: string | null;
  pdbx_keywords?: string | null;
  pdbx_keywords_text?: string | null;
  rcsb_external_ref_id: string[];
  rcsb_external_ref_type: string[];
  rcsb_external_ref_link: string[];
  citation_year?: number | null;
  citation_rcsb_authors?: string[] | null;
  citation_title?: string | null;
  citation_pdbx_doi?: string | null;
  src_organism_ids?: number[];
  src_organism_names?: string[];
  host_organism_ids?: number[];
  host_organism_names?: string[];
  entities: {
    [key: string]: PolypeptideEntity | PolynucleotideEntity | NonpolymerEntity;
  };
  polypeptides: Polypeptide[];
  polynucleotides: Polynucleotide[];
  nonpolymers: Nonpolymer[];
  assembly_map?: AssemblyInstancesMap[] | null;
  ligand_binding_sites?: LigandBindingSite[];
  polymerization_state?:
    | ("monomer" | "dimer" | "oligomer" | "filament" | "unknown")
    | null;
};
export type PolypeptideEntitySummary = {
  parent_rcsb_id: string;
  entity_id: string;
  pdbx_description?: string | null;
  family?: string | null;
  sequence_length?: number | null;
  src_organism_names?: string[];
  uniprot_accessions?: string[];
  variant_count?: number | null;
};
export type PolypeptideListResponse = {
  data: PolypeptideEntitySummary[];
  /** Total matching results before pagination */
  total_count: number;
  /** Cursor for next page */
  next_cursor?: string | null;
  /** Whether more results exist */
  has_more: boolean;
};
export type LigandSummary = {
  chemical_id: string;
  chemical_name?: string | null;
  drugbank_id?: string | null;
  formula_weight?: number | null;
  /** Number of structures containing this ligand */
  structure_count?: number | null;
};
export type LigandListResponse = {
  data: LigandSummary[];
  /** Total matching results before pagination */
  total_count: number;
  /** Cursor for next page */
  next_cursor?: string | null;
  /** Whether more results exist */
  has_more: boolean;
};
export type BindingSiteResidue2 = {
  auth_asym_id: string;
  observed_index: number;
  comp_id: string;
  master_index?: number | null;
};
export type LigandNeighborhood = {
  ligand_id: string;
  ligand_name?: string | null;
  ligand_auth_asym_id: string;
  residues?: BindingSiteResidue2[];
  residue_count: number;
  drugbank_id?: string | null;
};
export type PolymerNeighborhoodsResponse = {
  rcsb_id: string;
  auth_asym_id: string;
  neighborhoods: LigandNeighborhood[];
  total_ligands: number;
  total_residues: number;
};
export type Annotation = {
  start: number;
  end: number;
  label: string;
  metadata?: {
    [key: string]: any;
  };
};
export type AlignmentResponse = {
  sequence_id: string;
  aligned_sequence: string;
  mapping: number[];
  mapped_annotations: Annotation[];
  statistics: {
    [key: string]: any;
  };
  original_sequence: string;
};
export type AlignmentRequest = {
  /** The observed single-letter amino acid sequence */
  sequence: string;
  /** Unique identifier for the sequence */
  sequence_id?: string | null;
  annotations?:
    | {
        [key: string]: any;
      }[]
    | null;
  /** The PDB auth_seq_ids corresponding 1:1 to the sequence characters. */
  auth_seq_ids?: number[] | null;
};
export type VariantAnnotation = {
  type: string;
  master_index?: number | null;
  observed_index?: number | null;
  wild_type?: string | null;
  observed?: string | null;
  source: string;
  uniprot_id?: string | null;
  phenotype?: string | null;
  reference?: string | null;
  rcsb_id: string;
  entity_id: string;
};
export type PositionAnnotationsResponse = {
  position: number;
  family: string;
  variants: VariantAnnotation[];
  total_count: number;
};
export type PolymerAnnotationsResponse = {
  rcsb_id: string;
  auth_asym_id: string;
  entity_id: string;
  family: string | null;
  variants: VariantAnnotation[];
  total_count: number;
};
export const {
  useGetTaxonomyTreeStructuresTaxonomyTreeTaxTypeGetQuery,
  useListStructuresStructuresGetQuery,
  useGetFacetsStructuresFacetsGetQuery,
  useGetTaxonomyStructuresTaxonomyTaxTypeGetQuery,
  useGetFamiliesStructuresFamiliesGetQuery,
  useGetStructureStructuresRcsbIdGetQuery,
  useGetStructureProfileStructuresRcsbIdProfileGetQuery,
  useListPolymersPolymersGetQuery,
  useListLigandsLigandsGetQuery,
  useLigandOptionsLigandsOptionsGetQuery,
  useGetLigandNeighborhoodsLigandsNeighborhoodsRcsbIdAuthAsymIdGetQuery,
  useAlignSequenceMsaSequencePostMutation,
  useGetMasterProfileMsaMasterGetQuery,
  useGetVariantsAtPositionEndpointAnnotationsVariantsFamilyPositionGetQuery,
  useGetVariantsInRangeAnnotationsRangeFamilyGetQuery,
  useGetPolymerAnnotationsAnnotationsPolymerRcsbIdAuthAsymIdGetQuery,
  useGetVariantStatsAnnotationsStatsFamilyGetQuery,
  useHealthHealthGetQuery,
} = injectedRtkApi;
