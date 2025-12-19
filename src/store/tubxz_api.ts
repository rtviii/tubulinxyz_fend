import { emptySplitApi as api } from "./emptyApi";
export const addTagTypes = [
  "Structures",
  "Polymers",
  "Ligands",
  "MSA Alignment",
  "Grid",
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
            hasMutations: queryArg.hasMutations,
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
      getGridGridPdbIdGet: build.query<
        GetGridGridPdbIdGetApiResponse,
        GetGridGridPdbIdGetApiArg
      >({
        query: (queryArg) => ({ url: `/grid/${queryArg.pdbId}` }),
        providesTags: ["Grid"],
      }),
      getMutationsAtPositionAnnotationsMutationsFamilyVersionPositionGet:
        build.query<
          GetMutationsAtPositionAnnotationsMutationsFamilyVersionPositionGetApiResponse,
          GetMutationsAtPositionAnnotationsMutationsFamilyVersionPositionGetApiArg
        >({
          query: (queryArg) => ({
            url: `/annotations/mutations/${queryArg.family}/${queryArg.version}/${queryArg.position}`,
          }),
          providesTags: ["Annotations"],
        }),
      getModificationsAtPositionAnnotationsModificationsFamilyVersionPositionGet:
        build.query<
          GetModificationsAtPositionAnnotationsModificationsFamilyVersionPositionGetApiResponse,
          GetModificationsAtPositionAnnotationsModificationsFamilyVersionPositionGetApiArg
        >({
          query: (queryArg) => ({
            url: `/annotations/modifications/${queryArg.family}/${queryArg.version}/${queryArg.position}`,
          }),
          providesTags: ["Annotations"],
        }),
      getAllAnnotationsAtPositionAnnotationsAllFamilyVersionPositionGet:
        build.query<
          GetAllAnnotationsAtPositionAnnotationsAllFamilyVersionPositionGetApiResponse,
          GetAllAnnotationsAtPositionAnnotationsAllFamilyVersionPositionGetApiArg
        >({
          query: (queryArg) => ({
            url: `/annotations/all/${queryArg.family}/${queryArg.version}/${queryArg.position}`,
          }),
          providesTags: ["Annotations"],
        }),
      getAnnotationsInRangeAnnotationsRangeFamilyVersionGet: build.query<
        GetAnnotationsInRangeAnnotationsRangeFamilyVersionGetApiResponse,
        GetAnnotationsInRangeAnnotationsRangeFamilyVersionGetApiArg
      >({
        query: (queryArg) => ({
          url: `/annotations/range/${queryArg.family}/${queryArg.version}`,
          params: {
            start: queryArg.start,
            end: queryArg.end,
          },
        }),
        providesTags: ["Annotations"],
      }),
      getPolymerMutationsAnnotationsPolymerRcsbIdAuthAsymIdMutationsGet:
        build.query<
          GetPolymerMutationsAnnotationsPolymerRcsbIdAuthAsymIdMutationsGetApiResponse,
          GetPolymerMutationsAnnotationsPolymerRcsbIdAuthAsymIdMutationsGetApiArg
        >({
          query: (queryArg) => ({
            url: `/annotations/polymer/${queryArg.rcsbId}/${queryArg.authAsymId}/mutations`,
          }),
          providesTags: ["Annotations"],
        }),
      getPolymerModificationsAnnotationsPolymerRcsbIdAuthAsymIdModificationsGet:
        build.query<
          GetPolymerModificationsAnnotationsPolymerRcsbIdAuthAsymIdModificationsGetApiResponse,
          GetPolymerModificationsAnnotationsPolymerRcsbIdAuthAsymIdModificationsGetApiArg
        >({
          query: (queryArg) => ({
            url: `/annotations/polymer/${queryArg.rcsbId}/${queryArg.authAsymId}/modifications`,
          }),
          providesTags: ["Annotations"],
        }),
      getPolymerAllAnnotationsAnnotationsPolymerRcsbIdAuthAsymIdAllGet:
        build.query<
          GetPolymerAllAnnotationsAnnotationsPolymerRcsbIdAuthAsymIdAllGetApiResponse,
          GetPolymerAllAnnotationsAnnotationsPolymerRcsbIdAuthAsymIdAllGetApiArg
        >({
          query: (queryArg) => ({
            url: `/annotations/polymer/${queryArg.rcsbId}/${queryArg.authAsymId}/all`,
          }),
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
  sourceTaxa?: number[] | null;
  hostTaxa?: number[] | null;
  ligands?: string[] | null;
  family?: string[] | null;
  uniprot?: string[] | null;
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
  hasMutations?: boolean | null;
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
export type AlignSequenceMsaSequencePostApiResponse =
  /** status 200 Successful Response */ AlignmentResponse;
export type AlignSequenceMsaSequencePostApiArg = {
  alignmentRequest: AlignmentRequest;
};
export type GetMasterProfileMsaMasterGetApiResponse =
  /** status 200 Successful Response */ any;
export type GetMasterProfileMsaMasterGetApiArg = void;
export type GetGridGridPdbIdGetApiResponse =
  /** status 200 Successful Response */ GridData;
export type GetGridGridPdbIdGetApiArg = {
  pdbId: string;
};
export type GetMutationsAtPositionAnnotationsMutationsFamilyVersionPositionGetApiResponse =
  /** status 200 Successful Response */ {
    [key: string]: any;
  };
export type GetMutationsAtPositionAnnotationsMutationsFamilyVersionPositionGetApiArg =
  {
    family: string;
    version: string;
    position: number;
  };
export type GetModificationsAtPositionAnnotationsModificationsFamilyVersionPositionGetApiResponse =
  /** status 200 Successful Response */ {
    [key: string]: any;
  };
export type GetModificationsAtPositionAnnotationsModificationsFamilyVersionPositionGetApiArg =
  {
    family: string;
    version: string;
    position: number;
  };
export type GetAllAnnotationsAtPositionAnnotationsAllFamilyVersionPositionGetApiResponse =
  /** status 200 Successful Response */ {
    [key: string]: any;
  };
export type GetAllAnnotationsAtPositionAnnotationsAllFamilyVersionPositionGetApiArg =
  {
    family: string;
    version: string;
    position: number;
  };
export type GetAnnotationsInRangeAnnotationsRangeFamilyVersionGetApiResponse =
  /** status 200 Successful Response */ {
    [key: string]: any;
  };
export type GetAnnotationsInRangeAnnotationsRangeFamilyVersionGetApiArg = {
  family: string;
  version: string;
  /** Start position (inclusive) */
  start: number;
  /** End position (inclusive) */
  end: number;
};
export type GetPolymerMutationsAnnotationsPolymerRcsbIdAuthAsymIdMutationsGetApiResponse =
  /** status 200 Successful Response */ {
    [key: string]: any;
  };
export type GetPolymerMutationsAnnotationsPolymerRcsbIdAuthAsymIdMutationsGetApiArg =
  {
    rcsbId: string;
    authAsymId: string;
  };
export type GetPolymerModificationsAnnotationsPolymerRcsbIdAuthAsymIdModificationsGetApiResponse =
  /** status 200 Successful Response */ {
    [key: string]: any;
  };
export type GetPolymerModificationsAnnotationsPolymerRcsbIdAuthAsymIdModificationsGetApiArg =
  {
    rcsbId: string;
    authAsymId: string;
  };
export type GetPolymerAllAnnotationsAnnotationsPolymerRcsbIdAuthAsymIdAllGetApiResponse =
  /** status 200 Successful Response */ {
    [key: string]: any;
  };
export type GetPolymerAllAnnotationsAnnotationsPolymerRcsbIdAuthAsymIdAllGetApiArg =
  {
    rcsbId: string;
    authAsymId: string;
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
  /** Total matching results (before pagination) */
  total_count: number;
  /** Cursor for next page. Null if no more results. */
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
export type FilterFacets = {
  total_structures: number;
  exp_methods: FacetValue[];
  tubulin_families: FacetValue[];
  year_range: RangeValue;
  resolution_range: RangeValue;
  top_ligands: LigandFacet[];
};
export type PolypeptideEntitySummary = {
  parent_rcsb_id: string;
  entity_id: string;
  pdbx_description?: string | null;
  family?: string | null;
  sequence_length?: number | null;
  src_organism_names?: string[];
  uniprot_accessions?: string[];
  mutation_count?: number | null;
};
export type PolypeptideListResponse = {
  data: PolypeptideEntitySummary[];
  /** Total matching results (before pagination) */
  total_count: number;
  /** Cursor for next page. Null if no more results. */
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
  /** Total matching results (before pagination) */
  total_count: number;
  /** Cursor for next page. Null if no more results. */
  next_cursor?: string | null;
  /** Whether more results exist */
  has_more: boolean;
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
export type SubunitData = {
  id: string;
  auth_asym_id: string;
  protofilament: number;
  subunitIndex: number;
  monomerType: string;
};
export type GridData = {
  subunits: SubunitData[];
  structure_type: string;
  metadata: {
    [key: string]: any;
  };
};
export const {
  useGetTaxonomyTreeStructuresTaxonomyTreeTaxTypeGetQuery,
  useListStructuresStructuresGetQuery,
  useGetFacetsStructuresFacetsGetQuery,
  useGetTaxonomyStructuresTaxonomyTaxTypeGetQuery,
  useGetFamiliesStructuresFamiliesGetQuery,
  useGetStructureStructuresRcsbIdGetQuery,
  useListPolymersPolymersGetQuery,
  useListLigandsLigandsGetQuery,
  useLigandOptionsLigandsOptionsGetQuery,
  useAlignSequenceMsaSequencePostMutation,
  useGetMasterProfileMsaMasterGetQuery,
  useGetGridGridPdbIdGetQuery,
  useGetMutationsAtPositionAnnotationsMutationsFamilyVersionPositionGetQuery,
  useGetModificationsAtPositionAnnotationsModificationsFamilyVersionPositionGetQuery,
  useGetAllAnnotationsAtPositionAnnotationsAllFamilyVersionPositionGetQuery,
  useGetAnnotationsInRangeAnnotationsRangeFamilyVersionGetQuery,
  useGetPolymerMutationsAnnotationsPolymerRcsbIdAuthAsymIdMutationsGetQuery,
  useGetPolymerModificationsAnnotationsPolymerRcsbIdAuthAsymIdModificationsGetQuery,
  useGetPolymerAllAnnotationsAnnotationsPolymerRcsbIdAuthAsymIdAllGetQuery,
  useHealthHealthGetQuery,
} = injectedRtkApi;
