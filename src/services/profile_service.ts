import { TubulinClassification } from "@/components/molstar/colors/preset_structure";

/**
 * Maps the backend TubulinStructure profile to a Molstar-compatible classification map.
 * Key: auth_asym_id (e.g., "A")
 * Value: family string (e.g., "tubulin_alpha" or "map_tau")
 */
export function createClassificationFromProfile(profile: any): TubulinClassification {
    const classification: TubulinClassification = {};
    
    if (!profile || !profile.polypeptides) return classification;

    for (const poly of profile.polypeptides) {
        const entity = profile.entities[poly.entity_id];
        if (entity && entity.family) {
            classification[poly.auth_asym_id] = entity.family;
        }
    }

    return classification;
}