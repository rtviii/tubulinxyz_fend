/**
 * Auto-resolves annotation tracks against the backend.
 *
 * Watches the annotationTracks slice for tracks whose `resolved` is null and
 * are not currently loading or errored, then POSTs each to
 * /api/annotations/track/resolve and dispatches the result.
 *
 * Mount once at a high level (root of the structures page suffices) — it's
 * idempotent and cheap when there are no pending tracks.
 */
import { useEffect, useRef } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/store';
import {
  selectAllTracks,
  setTrackLoading,
  setTrackResolved,
  setTrackError,
  type TrackEntry,
  type ResolvedPosition,
} from '@/store/slices/annotationTracksSlice';

async function resolveTrackOnce(entry: TrackEntry): Promise<ResolvedPosition[]> {
  const res = await fetch('/api/annotations/track/resolve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ spec: entry.spec.filters }),
  });
  if (!res.ok) {
    let detail: string;
    try {
      const body = await res.json();
      detail = body.detail ?? JSON.stringify(body);
    } catch {
      detail = await res.text();
    }
    throw new Error(`resolve failed (${res.status}): ${detail}`);
  }
  const json = await res.json();
  return json.positions ?? [];
}

export function useResolveTracks() {
  const dispatch = useAppDispatch();
  const tracks = useAppSelector(selectAllTracks);
  // Guard against re-firing for the same track while a request is in flight,
  // even if the slice hasn't yet observed the setTrackLoading dispatch (e.g.
  // during the same effect tick).
  const inFlight = useRef<Set<string>>(new Set());

  useEffect(() => {
    for (const t of tracks) {
      if (t.resolved != null) continue;
      if (t.isLoading || t.error) continue;
      if (inFlight.current.has(t.spec.id)) continue;

      inFlight.current.add(t.spec.id);
      dispatch(setTrackLoading(t.spec.id));

      resolveTrackOnce(t)
        .then(positions => {
          dispatch(setTrackResolved({ id: t.spec.id, positions }));
        })
        .catch(err => {
          dispatch(setTrackError({ id: t.spec.id, error: String(err?.message ?? err) }));
        })
        .finally(() => {
          inFlight.current.delete(t.spec.id);
        });
    }
  }, [tracks, dispatch]);
}
