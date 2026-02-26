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
      getTaxonomyTree: build.query<
        GetTaxonomyTreeApiResponse,
        GetTaxonomyTreeApiArg
      >({
        query: (queryArg) => ({
          url: `/structures/taxonomy-tree/${queryArg.taxType}`,
        }),
        providesTags: ["Structures"],
      }),
      listStructures: build.query<
        ListStructuresApiResponse,
        ListStructuresApiArg
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
      getStructureFacets: build.query<
        GetStructureFacetsApiResponse,
        GetStructureFacetsApiArg
      >({
        query: () => ({ url: `/structures/facets` }),
        providesTags: ["Structures"],
      }),
      getTaxonomyFlat: build.query<
        GetTaxonomyFlatApiResponse,
        GetTaxonomyFlatApiArg
      >({
        query: (queryArg) => ({
          url: `/structures/taxonomy/${queryArg.taxType}`,
        }),
        providesTags: ["Structures"],
      }),
      listFamilies: build.query<ListFamiliesApiResponse, ListFamiliesApiArg>({
        query: () => ({ url: `/structures/families` }),
        providesTags: ["Structures"],
      }),
      getStructure: build.query<GetStructureApiResponse, GetStructureApiArg>({
        query: (queryArg) => ({ url: `/structures/${queryArg.rcsbId}` }),
        providesTags: ["Structures"],
      }),
      getStructureProfile: build.query<
        GetStructureProfileApiResponse,
        GetStructureProfileApiArg
      >({
        query: (queryArg) => ({
          url: `/structures/${queryArg.rcsbId}/profile`,
        }),
        providesTags: ["Structures"],
      }),
      listPolymers: build.query<ListPolymersApiResponse, ListPolymersApiArg>({
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
      listLigands: build.query<ListLigandsApiResponse, ListLigandsApiArg>({
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
      listLigandOptions: build.query<
        ListLigandOptionsApiResponse,
        ListLigandOptionsApiArg
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
      getPolymerLigandNeighborhoods: build.query<
        GetPolymerLigandNeighborhoodsApiResponse,
        GetPolymerLigandNeighborhoodsApiArg
      >({
        query: (queryArg) => ({
          url: `/ligands/neighborhoods/${queryArg.rcsbId}/${queryArg.authAsymId}`,
        }),
        providesTags: ["Ligands"],
      }),
      alignSequence: build.mutation<
        AlignSequenceApiResponse,
        AlignSequenceApiArg
      >({
        query: (queryArg) => ({
          url: `/msa/sequence`,
          method: "POST",
          body: queryArg.alignmentRequest,
          params: {
            family: queryArg.family,
          },
        }),
        invalidatesTags: ["MSA Alignment"],
      }),
      getMasterProfile: build.query<
        GetMasterProfileApiResponse,
        GetMasterProfileApiArg
      >({
        query: (queryArg) => ({
          url: `/msa/master`,
          params: {
            family: queryArg.family,
          },
        }),
        providesTags: ["MSA Alignment"],
      }),
      getVariantsAtPosition: build.query<
        GetVariantsAtPositionApiResponse,
        GetVariantsAtPositionApiArg
      >({
        query: (queryArg) => ({
          url: `/annotations/variants/${queryArg.family}/${queryArg.position}`,
        }),
        providesTags: ["Annotations"],
      }),
      getVariantsInRange: build.query<
        GetVariantsInRangeApiResponse,
        GetVariantsInRangeApiArg
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
      getPolymerAnnotations: build.query<
        GetPolymerAnnotationsApiResponse,
        GetPolymerAnnotationsApiArg
      >({
        query: (queryArg) => ({
          url: `/annotations/polymer/${queryArg.rcsbId}/${queryArg.authAsymId}`,
        }),
        providesTags: ["Annotations"],
      }),
      getVariantStats: build.query<
        GetVariantStatsApiResponse,
        GetVariantStatsApiArg
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
export type GetTaxonomyTreeApiResponse =
  /** status 200 Successful Response */ TaxonomyTreeNode[];
export type GetTaxonomyTreeApiArg = {
  taxType: string;
};
export type ListStructuresApiResponse =
  /** status 200 Successful Response */ StructureListResponse;
export type ListStructuresApiArg = {
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
export type GetStructureFacetsApiResponse =
  /** status 200 Successful Response */ FilterFacets;
export type GetStructureFacetsApiArg = void;
export type GetTaxonomyFlatApiResponse =
  /** status 200 Successful Response */ TaxonomyFlatNode[];
export type GetTaxonomyFlatApiArg = {
  taxType: string;
};
export type ListFamiliesApiResponse =
  /** status 200 Successful Response */ FamilyCount[];
export type ListFamiliesApiArg = void;
export type GetStructureApiResponse =
  /** status 200 Successful Response */ StructureDetail;
export type GetStructureApiArg = {
  rcsbId: string;
};
export type GetStructureProfileApiResponse =
  /** status 200 Successful Response */ TubulinStructure;
export type GetStructureProfileApiArg = {
  rcsbId: string;
};
export type ListPolymersApiResponse =
  /** status 200 Successful Response */ PolypeptideListResponse;
export type ListPolymersApiArg = {
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
export type ListLigandsApiResponse =
  /** status 200 Successful Response */ LigandListResponse;
export type ListLigandsApiArg = {
  cursor?: string | null;
  limit?: number;
  search?: string | null;
  ids?: string[] | null;
  hasDrugbank?: boolean | null;
  inStructures?: string[] | null;
};
export type ListLigandOptionsApiResponse =
  /** status 200 Successful Response */ LigandListResponse;
export type ListLigandOptionsApiArg = {
  /** Search by ID or name */
  search?: string | null;
  limit?: number;
};
export type GetPolymerLigandNeighborhoodsApiResponse =
  /** status 200 Successful Response */ PolymerNeighborhoodsResponse;
export type GetPolymerLigandNeighborhoodsApiArg = {
  rcsbId: string;
  authAsymId: string;
};
export type AlignSequenceApiResponse =
  /** status 200 Successful Response */ AlignmentResponse;
export type AlignSequenceApiArg = {
  /** Which master alignment to align against */
  family: TubulinFamily;
  alignmentRequest: AlignmentRequest;
};
export type GetMasterProfileApiResponse =
  /** status 200 Successful Response */ MasterProfileInfo;
export type GetMasterProfileApiArg = {
  /** Which master alignment to return */
  family: TubulinFamily;
};
export type GetVariantsAtPositionApiResponse =
  /** status 200 Successful Response */ PositionAnnotationsResponse;
export type GetVariantsAtPositionApiArg = {
  family: string;
  position: number;
};
export type GetVariantsInRangeApiResponse =
  /** status 200 Successful Response */ VariantRangeSummary;
export type GetVariantsInRangeApiArg = {
  family: string;
  /** Start position (inclusive) */
  start: number;
  /** End position (inclusive) */
  end: number;
};
export type GetPolymerAnnotationsApiResponse =
  /** status 200 Successful Response */ PolymerAnnotationsResponse;
export type GetPolymerAnnotationsApiArg = {
  rcsbId: string;
  authAsymId: string;
};
export type GetVariantStatsApiResponse =
  /** status 200 Successful Response */ VariantStats;
export type GetVariantStatsApiArg = {
  family: string;
};
export type HealthHealthGetApiResponse =
  /** status 200 Successful Response */ any;
export type HealthHealthGetApiArg = void;
export type TaxonomyTreeNode = {
  value: number;
  title: string;
  children?: TaxonomyTreeNode[] | null;
};
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
export type TaxonomyFlatNode = {
  tax_id: number;
  name: string;
  rank?: string | null;
  structure_count: number;
};
export type FamilyCount = {
  family: string;
  count: number;
};
export type StructureDetail = {
  structure: {
    [key: string]: any;
  };
  polypeptide_entities: {
    [key: string]: any;
  }[];
  ligand_entities: {
    [key: string]: any;
  }[];
  polypeptide_instances: {
    [key: string]: any;
  }[];
  ligand_instances: {
    [key: string]: any;
  }[];
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
export type EntityIndexMapping = {
  label_seq_id_to_master: {
    [key: string]: number | null;
  };
  master_to_label_seq_id: {
    [key: string]: number | null;
  };
};
export type ChainIndexMappingData = {
  auth_seq_id_to_master: {
    [key: string]: number | null;
  };
  master_to_auth_seq_id: {
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
  entity_index_mapping?: EntityIndexMapping | null;
  chain_index_mappings?: {
    [key: string]: ChainIndexMappingData;
  };
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
  auth_seq_id: number;
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
  auth_seq_id: number;
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
export type LigandNeighborhood = {
  ligand_id: string;
  ligand_name?: string | null;
  ligand_auth_asym_id: string;
  ligand_auth_seq_id: number;
  residues?: BindingSiteResidue[];
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
  /** PDB auth_seq_ids, 1:1 with sequence */
  auth_seq_ids?: number[] | null;
};
export type MasterProfileInfo = {
  profile_path: string;
  profile_exists: boolean;
  num_sequences: number;
  alignment_length: number;
  sequences: {
    [key: string]: any;
  }[];
  full_alignment: string;
  muscle_binary: string;
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
export type VariantRangeSummary = {
  family: string;
  range: {
    [key: string]: number;
  };
  positions_with_variants: number;
  data: {
    [key: string]: {
      [key: string]: any;
    }[];
  };
};
export type PolymerAnnotationsResponse = {
  rcsb_id: string;
  auth_asym_id: string;
  entity_id: string;
  family: string | null;
  variants: VariantAnnotation[];
  total_count: number;
};
export type VariantStats = {
  family: string;
  by_type: {
    [key: string]: number;
  };
  position_range: {
    [key: string]: number | null;
  };
  total_variants: number;
};
export const {
  useGetTaxonomyTreeQuery,
  useListStructuresQuery,
  useGetStructureFacetsQuery,
  useGetTaxonomyFlatQuery,
  useListFamiliesQuery,
  useGetStructureQuery,
  useGetStructureProfileQuery,
  useListPolymersQuery,
  useListLigandsQuery,
  useListLigandOptionsQuery,
  useGetPolymerLigandNeighborhoodsQuery,
  useAlignSequenceMutation,
  useGetMasterProfileQuery,
  useGetVariantsAtPositionQuery,
  useGetVariantsInRangeQuery,
  useGetPolymerAnnotationsQuery,
  useGetVariantStatsQuery,
  useHealthHealthGetQuery,
} = injectedRtkApi;
