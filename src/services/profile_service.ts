import { TubulinClassification } from "@/components/molstar/molstar_preset_computed_residues";

/**
 * Maps the backend TubulinStructure profile to a Molstar-compatible classification map.
 * Key: auth_asym_id (e.g., "A")
 * Value: family string (e.g., "tubulin_alpha" or "map_tau")
 */
export function createClassificationFromProfile(profile: any): TubulinClassification {
    const classification: TubulinClassification = {};
    
    if (!profile || !profile.polypeptides) return classification;

    // The backend TubulinStructure has a 'polypeptides' list and an 'entities' map
    // Each Polypeptide instance has an entity_id and an auth_asym_id
    for (const poly of profile.polypeptides) {
        const entity = profile.entities[poly.entity_id];
        
        if (entity && entity.family) {
            // entity.family is the Enum value from TubulinFamily or MapFamily
            classification[poly.auth_asym_id] = entity.family;
        }
    }

    return classification;
}