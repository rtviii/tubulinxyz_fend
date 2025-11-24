// src/store/emptyApi.ts
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

export const emptySplitApi = createApi({
  reducerPath: 'tubxz_api', // <--- CHANGE THIS (Controls name in Redux DevTools)
  baseQuery: fetchBaseQuery({ baseUrl: 'http://localhost:8000/' }),
  endpoints: () => ({}),
});