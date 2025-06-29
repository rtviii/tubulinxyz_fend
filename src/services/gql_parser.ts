import { TubulinClass, TubulinClassification } from "@/components/molstar/molstar_preset";

// A basic type definition for the part of the GraphQL response we care about.
// This helps with type safety and autocompletion.
type PolymerEntity = {
    rcsb_polymer_entity_container_identifiers: {
        auth_asym_ids: string[];
    };
    rcsb_polymer_entity: {
        pdbx_description: string;
    };
};

type RcsbEntry = {
    polymer_entities: PolymerEntity[];
};

/**
 * Parses the raw GraphQL response to create a map of chain IDs to their tubulin class.
 * @param gqlData The raw data object from the RCSB GraphQL response.
 * @returns A TubulinClassification map (e.g., { 'A': TubulinClass.Alpha, 'B': TubulinClass.Beta }).
 */
export function createTubulinClassificationMap(gqlData: any): TubulinClassification {
    const classificationMap: TubulinClassification = {};
    
    // Safely access the nested data
    const entry: RcsbEntry | undefined = gqlData?.entries?.[0];
    if (!entry || !entry.polymer_entities) {
        console.warn("GraphQL data is missing 'entries' or 'polymer_entities'.");
        return {};
    }

    // Iterate over each polymer entity (e.g., the unique alpha chain, the unique beta chain)
    for (const entity of entry.polymer_entities) {
        const description = entity.rcsb_polymer_entity.pdbx_description.toLowerCase();
        let tubulinType: TubulinClass | null = null;

        // Determine if it's an alpha or beta tubulin from the description
        if (description.includes("alpha")) {
            tubulinType = TubulinClass.Alpha;
        } else if (description.includes("beta")) {
            tubulinType = TubulinClass.Beta;
        }

        // If we identified a type, map all of its chains
        if (tubulinType) {
            const chainIds = entity.rcsb_polymer_entity_container_identifiers.auth_asym_ids;
            if (chainIds) {
                for (const chainId of chainIds) {
                    classificationMap[chainId] = tubulinType;
                }
            }
        }
    }

    return classificationMap;
}