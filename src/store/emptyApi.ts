// src/store/emptyApi.ts
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';


function stripNulls(params: Record<string, any> | undefined) {
  if (!params) return params;

  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v === null || v === undefined) continue;

    if (Array.isArray(v) && v.length === 0) continue;
    if (typeof v === "string" && v.trim() === "") continue;

    out[k] = v;
  }
  return out;
}

const rawBaseQuery = fetchBaseQuery({ baseUrl: "http://localhost:8000/" });

const baseQuery: typeof rawBaseQuery = async (args, api, extraOptions) => {
  if (typeof args === "object" && args != null && "params" in args) {
    const a = args as { params?: Record<string, any> };
    return rawBaseQuery(
      { ...args, params: stripNulls(a.params) },
      api,
      extraOptions
    );
  }
  return rawBaseQuery(args, api, extraOptions);
};

export const emptySplitApi = createApi({
  reducerPath: "tubxz_api",
  baseQuery, // <- use the wrapped one
  endpoints: () => ({}),
});
