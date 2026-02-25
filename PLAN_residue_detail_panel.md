## Residue Detail Panel - Implementation Plan

### What exists already

The frontend has a `ResidueInfoOverlay` component (`src/components/molstar/overlay/ResidueInfoOverlay.tsx`) that subscribes to molstar's click/hover events via `instance.viewer.subscribeToClick` and `subscribeToHover`. It currently shows chain ID and auth_seq_id. Click pins it, click again unpins.

The `useViewerSync` hook already resolves `authSeqId` → `masterIndex` via `positionMapping` (a Redux selector from `sequence_registry`). `positionMapping` is keyed by master alignment index (1-based) and maps to `authSeqId`. The reverse map (`authToMasterRef`) is already built inside `useViewerSync` as `authToMasterRef.current[authSeqId] = masterIndex`.

The `chainKey` format is `{PDBID}:{authAsymId}` and the active family is available from `profile` via `getFamilyForChain`. RTK Query codegen is already set up - new endpoints just need a pydantic model on the fastapi side and the frontend picks up the types automatically after running codegen.

---

### What needs to be built

**Backend** - one new fastapi endpoint:

```
GET /residues/{family}/{master_index}/annotations
```

Response model roughly:

```python
class ResidueAnnotationSummary(BaseModel):
    master_index: int
    family: str
    conservation: float | None
    variants: list[CrossChainVariant]      # all variants at this position across all chains
    ligand_proximity: list[LigandProximity] # which ligands are near this position in any structure
    structures_with_data: int

class CrossChainVariant(BaseModel):
    pdb_id: str
    chain_id: str
    wild_type: str
    observed: str
    type: str   # substitution | deletion | insertion
    phenotype: str | None
    source: str | None

class LigandProximity(BaseModel):
    pdb_id: str
    ligand_id: str
    ligand_name: str | None
    distance_angstrom: float | None
```

**Frontend**

Enrich `ResidueInfoOverlay` to accept the active family and the `authToMaster` mapping, fire an RTK Query hook when a residue is pinned, and render the result. The component stays in `src/components/molstar/overlay/` and the query hook gets added to `tubxz_api.ts` after codegen.

The data flow on click:

```
click fires in MolstarViewer
  → subscribeToClick callback in ResidueInfoOverlay
  → resolve authSeqId → masterIndex via authToMasterRef
  → set pinned state { chainId, authSeqId, masterIndex }
  → RTK Query fires GET /residues/{family}/{masterIndex}/annotations
  → render result in overlay card
```

The overlay card itself should be a fixed-position panel anchored to bottom-left of the molstar container (already positioned `absolute bottom-4 left-4` in the current implementation), wide enough to show a small table of cross-chain variants. Not a drawer, not a sidebar - it should feel like a tooltip that you pinned.

**Wiring in the page**

In `src/app/structures/[rcsb_id]/page.tsx`, pass two additional props to `ResidueInfoOverlay`:

```tsx
<ResidueInfoOverlay
  instance={instance}
  family={activeFamily}
  authToMaster={authToMasterRef}  // expose this ref from useViewerSync
  getLabel={(info) => null}       // can remove getLabel once the query-driven version is in
/>
```

To expose `authToMasterRef` from `useViewerSync`, just add it to the return value - it's already built there, just not currently returned.

---

### Suggested order of work

1. Design and implement the fastapi endpoint + pydantic models, verify it returns sensible data via the fastapi docs UI.
2. Run RTK codegen to pick up the new endpoint types.
3. Enrich `ResidueInfoOverlay` to fire the query on pin and render variants + ligand proximity.
4. Expose `authToMasterRef` from `useViewerSync` and wire it into the overlay via the page.
5. Consider adding a small "jump to this position in MSA" button inside the overlay that calls `msaRef.current?.jumpToRange(masterIndex, masterIndex)` - you already have all the pieces for that.