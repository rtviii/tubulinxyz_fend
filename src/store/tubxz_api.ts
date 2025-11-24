import { emptySplitApi as api } from "./emptyApi";
export const addTagTypes = ["Structures", "Polymers", "Ligands"] as const;
const injectedRtkApi = api
  .enhanceEndpoints({
    addTagTypes,
  })
  .injectEndpoints({
    endpoints: (build) => ({
      allStructureIdsStructuresAllIdsGet: build.query<
        AllStructureIdsStructuresAllIdsGetApiResponse,
        AllStructureIdsStructuresAllIdsGetApiArg
      >({
        query: () => ({ url: `/structures/all_ids` }),
        providesTags: ["Structures"],
      }),
      randomStructureStructuresRandomGet: build.query<
        RandomStructureStructuresRandomGetApiResponse,
        RandomStructureStructuresRandomGetApiArg
      >({
        query: () => ({ url: `/structures/random` }),
        providesTags: ["Structures"],
      }),
      getStructureStructuresRcsbIdGet: build.query<
        GetStructureStructuresRcsbIdGetApiResponse,
        GetStructureStructuresRcsbIdGetApiArg
      >({
        query: (queryArg) => ({ url: `/structures/${queryArg.rcsbId}` }),
        providesTags: ["Structures"],
      }),
      listStructuresStructuresListPost: build.mutation<
        ListStructuresStructuresListPostApiResponse,
        ListStructuresStructuresListPostApiArg
      >({
        query: (queryArg) => ({
          url: `/structures/list`,
          method: "POST",
          body: queryArg.structureFilterParams,
        }),
        invalidatesTags: ["Structures"],
      }),
      getTaxaStructuresTaxaSourceOrHostGet: build.query<
        GetTaxaStructuresTaxaSourceOrHostGetApiResponse,
        GetTaxaStructuresTaxaSourceOrHostGetApiArg
      >({
        query: (queryArg) => ({
          url: `/structures/taxa/${queryArg.sourceOrHost}`,
        }),
        providesTags: ["Structures"],
      }),
      getTaxaDictStructuresTaxaDictAllGet: build.query<
        GetTaxaDictStructuresTaxaDictAllGetApiResponse,
        GetTaxaDictStructuresTaxaDictAllGetApiArg
      >({
        query: () => ({ url: `/structures/taxa_dict/all` }),
        providesTags: ["Structures"],
      }),
      listPolymersPolymersListPost: build.mutation<
        ListPolymersPolymersListPostApiResponse,
        ListPolymersPolymersListPostApiArg
      >({
        query: (queryArg) => ({
          url: `/polymers/list`,
          method: "POST",
          body: queryArg.polymersFilterParams,
        }),
        invalidatesTags: ["Polymers"],
      }),
      getTubulinFamiliesPolymersFamiliesGet: build.query<
        GetTubulinFamiliesPolymersFamiliesGetApiResponse,
        GetTubulinFamiliesPolymersFamiliesGetApiArg
      >({
        query: () => ({ url: `/polymers/families` }),
        providesTags: ["Polymers"],
      }),
      listAllLigandsLigandsAllGet: build.query<
        ListAllLigandsLigandsAllGetApiResponse,
        ListAllLigandsLigandsAllGetApiArg
      >({
        query: () => ({ url: `/ligands/all` }),
        providesTags: ["Ligands"],
      }),
      alignSequenceMsaprofileSequencePost: build.mutation<
        AlignSequenceMsaprofileSequencePostApiResponse,
        AlignSequenceMsaprofileSequencePostApiArg
      >({
        query: (queryArg) => ({
          url: `/msaprofile/sequence`,
          method: "POST",
          body: queryArg.alignmentRequest,
        }),
      }),
      getMasterProfileMsaprofileMasterGet: build.query<
        GetMasterProfileMsaprofileMasterGetApiResponse,
        GetMasterProfileMsaprofileMasterGetApiArg
      >({
        query: () => ({ url: `/msaprofile/master` }),
      }),
      getGridGridPdbIdGet: build.query<
        GetGridGridPdbIdGetApiResponse,
        GetGridGridPdbIdGetApiArg
      >({
        query: (queryArg) => ({ url: `/grid/${queryArg.pdbId}` }),
      }),
      rootGet: build.query<RootGetApiResponse, RootGetApiArg>({
        query: () => ({ url: `/` }),
      }),
    }),
    overrideExisting: false,
  });
export { injectedRtkApi as tubxz_api };
export type AllStructureIdsStructuresAllIdsGetApiResponse =
  /** status 200 Successful Response */ string[];
export type AllStructureIdsStructuresAllIdsGetApiArg = void;
export type RandomStructureStructuresRandomGetApiResponse =
  /** status 200 Successful Response */ any;
export type RandomStructureStructuresRandomGetApiArg = void;
export type GetStructureStructuresRcsbIdGetApiResponse =
  /** status 200 Successful Response */ any;
export type GetStructureStructuresRcsbIdGetApiArg = {
  rcsbId: string;
};
export type ListStructuresStructuresListPostApiResponse =
  /** status 200 Successful Response */ any;
export type ListStructuresStructuresListPostApiArg = {
  structureFilterParams: StructureFilterParams;
};
export type GetTaxaStructuresTaxaSourceOrHostGetApiResponse =
  /** status 200 Successful Response */ any;
export type GetTaxaStructuresTaxaSourceOrHostGetApiArg = {
  sourceOrHost: string;
};
export type GetTaxaDictStructuresTaxaDictAllGetApiResponse =
  /** status 200 Successful Response */ any;
export type GetTaxaDictStructuresTaxaDictAllGetApiArg = void;
export type ListPolymersPolymersListPostApiResponse =
  /** status 200 Successful Response */ any;
export type ListPolymersPolymersListPostApiArg = {
  polymersFilterParams: PolymersFilterParams;
};
export type GetTubulinFamiliesPolymersFamiliesGetApiResponse =
  /** status 200 Successful Response */ string[];
export type GetTubulinFamiliesPolymersFamiliesGetApiArg = void;
export type ListAllLigandsLigandsAllGetApiResponse =
  /** status 200 Successful Response */ any;
export type ListAllLigandsLigandsAllGetApiArg = void;
export type AlignSequenceMsaprofileSequencePostApiResponse =
  /** status 200 Successful Response */ AlignmentResponse;
export type AlignSequenceMsaprofileSequencePostApiArg = {
  alignmentRequest: AlignmentRequest;
};
export type GetMasterProfileMsaprofileMasterGetApiResponse =
  /** status 200 Successful Response */ any;
export type GetMasterProfileMsaprofileMasterGetApiArg = void;
export type GetGridGridPdbIdGetApiResponse =
  /** status 200 Successful Response */ GridData;
export type GetGridGridPdbIdGetApiArg = {
  pdbId: string;
};
export type RootGetApiResponse = /** status 200 Successful Response */ any;
export type RootGetApiArg = void;
export type ValidationError = {
  loc: (string | number)[];
  msg: string;
  type: string;
};
export type HttpValidationError = {
  detail?: ValidationError[];
};
export type StructureFilterParams = {
  cursor?: string | null;
  limit?: number;
  year?: [number | null, number | null] | null;
  search?: string | null;
  resolution?: [number | null, number | null] | null;
  source_taxa?: number[] | null;
  host_taxa?: number[] | null;
  polymerization_state?: string[] | null;
};
export type PolymersFilterParams = {
  cursor     ?: [string | null, string | null] | (string | null)[] | string | null;
  limit      ?: number;
  year       ?: [number | null, number | null] | null;
  search     ?: string | null;
  resolution ?: [number | null, number | null] | null;
  source_taxa?: number[] | null;
  host_taxa  ?: number[] | null;
  family     ?: string[] | null;
  uniprot_id ?: string | null;
  has_motif  ?: string | null;
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
  useAllStructureIdsStructuresAllIdsGetQuery,
  useRandomStructureStructuresRandomGetQuery,
  useGetStructureStructuresRcsbIdGetQuery,
  useListStructuresStructuresListPostMutation,
  useGetTaxaStructuresTaxaSourceOrHostGetQuery,
  useGetTaxaDictStructuresTaxaDictAllGetQuery,
  useListPolymersPolymersListPostMutation,
  useGetTubulinFamiliesPolymersFamiliesGetQuery,
  useListAllLigandsLigandsAllGetQuery,
  useAlignSequenceMsaprofileSequencePostMutation,
  useGetMasterProfileMsaprofileMasterGetQuery,
  useGetGridGridPdbIdGetQuery,
  useRootGetQuery,
} = injectedRtkApi;
