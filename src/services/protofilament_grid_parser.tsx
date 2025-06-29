import { TubulinClass, TubulinClassification } from "@/components/molstar/molstar_preset";
import { GridData, SubunitData } from "@/components/protofilament_grid";

/**
 * Creates a plausible 2D grid layout from GraphQL data using a heuristic approach.
 * This is a prototype method and assumes chains are ordered somewhat logically.
 * @param gqlData The raw data object from the RCSB GraphQL response.
 * @param classificationMap The map of chain IDs to their alpha/beta class.
 * @returns A GridData object for the ProtofilamentGrid component.
 */
export function buildGridDataFromGql(gqlData: any, classificationMap: TubulinClassification): GridData {
    const subunits: SubunitData[] = [];
    const entry = gqlData?.entries?.[0];

    if (!entry) return { subunits: [] };

    const allChains = Object.keys(classificationMap).sort();

    // Heuristic: Assume 13 protofilaments for a standard microtubule. This is a big assumption for a prototype.
    const numProtofilaments = 13;
    let pfIndex = 0;
    let suIndex = 0;

    for (const chainId of allChains) {
        const type = classificationMap[chainId];
        
        subunits.push({
            id: `pf${pfIndex}-${chainId}`,
            auth_asym_id: chainId,
            protofilament: pfIndex,
            subunitIndex: suIndex,
            monomerType: type === TubulinClass.Alpha ? 'α' : 'β',
        });

        // Move to the next "slot" in the grid
        pfIndex++;
        if (pfIndex >= numProtofilaments) {
            pfIndex = 0;
            suIndex++;
        }
    }
    
    return { subunits };
}