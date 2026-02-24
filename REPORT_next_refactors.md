# Refactor Continuation Report


## State of the codebase

The following has been completed in this session:

- Dead code deleted: `useChainAnnotationsData`, `useMonomerAnnotations`, `useAlignedChainAnnotations`, `src/lib/sync/`, `useSync.ts`, `src/lib/types/annotations.ts`, duplicate `utils.tsx`, duplicate `MSAHandle` type, `selectActiveColorRules` and all console.logs from `colorRulesSelector`
- `LigandSite` shape corrected: `neighborhoodAuthSeqIds` replaced with `masterIndices` and `authSeqIds`
- Backend `BindingSiteResidue` updated with `validation_alias` so graph blobs stay compatible while API exposes `auth_seq_id`
- RTK codegen updated, `colorRulesSelector` simplified, `positionMappings` dependency removed from the selector
- Default ligand visibility changed to empty (`visibleLigandIds: []`) so all ligands are not painted simultaneously on load

---

## Remaining tasks

### 1. Canonicalize chainKey

**Problem:** At least three key formats are in use simultaneously:

- `"${RCSB_ID}_${authAsymId}"` - used by annotation hooks and the slice
- `"${pdbId}_${chainId}__${family ?? 'unknown'}"` - used in `alignmentKey` in the page and `MonomerSidebar`
- Parsing logic in `colorRulesSelector` that strips `__family` suffix via `split('__')[0]` and then takes the last `_`-separated segment as `authAsymId`

This causes silent mismatches between the sequence registry, the annotations slice, and the color rules selector. The family suffix idea was never consistently applied and should be abandoned entirely.

**Fix:** Adopt `"${RCSB_ID_UPPERCASE}_${authAsymId}"` as the single canonical format everywhere. Audit every place that constructs or parses this key:

- `useChainAlignment.ts`: `const key = \`${pdbId}_${chainId}\`` - already correct
- `useMultiChainAnnotations.tsx`: `chainKey = \`${rcsbId.toUpperCase()}_${authAsymId}\`` - already correct
- `page.tsx`: remove `alignmentKey` entirely, it is unused after the family suffix is dropped
- `colorRulesSelector.ts`: replace the `split('__')[0]` / `parts[parts.length - 1]` parsing with a proper helper function, e.g.:

```ts
function authAsymIdFromChainKey(chainKey: string): string {
  const parts = chainKey.split('_');
  return parts[parts.length - 1];
}
```

This is correct as long as the format is strictly `RCSBID_CHAINID` where RCSB IDs are always 4 characters. If that assumption ever breaks, the helper is the one place to fix.

---

### 3. Split page.tsx

**Problem:** `src/app/structures/[rcsb_id]/page.tsx` is ~600 lines containing the page orchestration, two sidebar components, the MSA panel, and ~6 helper components all in one file. Logic and presentation are mixed throughout.

**Target structure:**

```
src/
  app/structures/[rcsb_id]/page.tsx        # thin orchestration only (~100 lines)
  components/structure/
    StructureSidebar.tsx                   # chain + ligand lists in structure view
    ChainRow.tsx
    LigandRow.tsx
  components/monomer/
    MonomerSidebar.tsx                     # chain switcher, aligned structures, annotation panels
    AlignedStructureRow.tsx
    AlignStructureForm.tsx
    MonomerMSAPanel.tsx                    # MSA panel with toolbar and ResizableMSAContainer
```

The page component itself should only be responsible for:
- Fetching the profile and loading the structure
- Owning the `msaRef` and `containerRef`
- Instantiating `useMolstarInstance`, `useChainAlignment`, `useAnnotationVisibility`, `useViewerSync`
- Passing derived state and callbacks down as props

The key thing to get right is the prop boundary between the page and `MonomerSidebar`. Currently `MonomerSidebar` receives ~15 props because the page owns all annotation state. This is fine - the alternative of pushing Redux selectors into the sidebar components directly would make them harder to test and reason about. Keep the page as the single Redux-connected component and pass props down explicitly.

`LigandSiteRow` defined in `page.tsx` is currently unused there (it's also defined inside `LigandsPanel`) - delete the duplicate.

`formatFamilyShort` is defined in `page.tsx` and duplicated in `useChainAlignment.ts` as `formatFamily`. Consolidate into a single `src/lib/formatters.ts` utility and import from both places.