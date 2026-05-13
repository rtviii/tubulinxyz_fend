// src/config.ts
// Relative path: nginx (or any reverse proxy on the same origin) routes /api/* to the backend.
// This means a single pre-built image works for any deployment domain without rebuild.
export const API_BASE_URL = '/api';