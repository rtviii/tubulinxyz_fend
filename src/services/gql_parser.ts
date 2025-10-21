import { TubulinClass, TubulinClassification } from "@/components/molstar/molstar_preset";

// Type definitions for GraphQL response
type PolymerEntity = {
    rcsb_polymer_entity_container_identifiers?: {
        auth_asym_ids?: string[];
    };
    rcsb_polymer_entity?: {
        pdbx_description?: string;
    };
    pfams?: Array<{
        rcsb_pfam_description?: string;
        rcsb_pfam_comment?: string;
    }>;
    rcsb_polymer_entity_annotation?: Array<{
        description?: string;
        name?: string;
    }>;
};

type RcsbEntry = {
    rcsb_id?: string;
    polymer_entities?: PolymerEntity[];
};

/**
 * Parses the raw GraphQL response to create a map of chain IDs to their tubulin class.
 * Enhanced version with better error handling and multiple keyword sources.
 */
export function createTubulinClassificationMap(gqlData: any): TubulinClassification {
    const classificationMap: TubulinClassification = {};
    
    // Safely access the nested data with detailed logging
    const entry: RcsbEntry | undefined = gqlData?.entries?.[0];
    
    if (!entry) {
        console.warn("⚠️ GraphQL data is missing 'entries'");
        return {};
    }
    
    if (!entry.polymer_entities || entry.polymer_entities.length === 0) {
        console.warn("⚠️ GraphQL data is missing 'polymer_entities'");
        return {};
    }
    
    console.log(`📊 Analyzing ${entry.polymer_entities.length} polymer entities for ${entry.rcsb_id || 'unknown'}...`);
    
    // Iterate over each polymer entity
    entry.polymer_entities.forEach((entity, index) => {
        // Get chain IDs with null safety
        const chainIds = entity.rcsb_polymer_entity_container_identifiers?.auth_asym_ids || [];
        
        if (chainIds.length === 0) {
            console.warn(`⚠️ Entity ${index}: No chain IDs found`);
            return;
        }
        
        // Collect all text sources for classification
        const textSources: string[] = [];
        
        // 1. Main description
        const mainDescription = entity.rcsb_polymer_entity?.pdbx_description;
        if (mainDescription) {
            textSources.push(mainDescription);
        }
        
        // 2. Pfam annotations
        if (entity.pfams && entity.pfams.length > 0) {
            entity.pfams.forEach(pfam => {
                if (pfam.rcsb_pfam_description) {
                    textSources.push(pfam.rcsb_pfam_description);
                }
                if (pfam.rcsb_pfam_comment) {
                    textSources.push(pfam.rcsb_pfam_comment);
                }
            });
        }
        
        // 3. Other annotations
        if (entity.rcsb_polymer_entity_annotation && entity.rcsb_polymer_entity_annotation.length > 0) {
            entity.rcsb_polymer_entity_annotation.forEach(ann => {
                if (ann.description) {
                    textSources.push(ann.description);
                }
                if (ann.name) {
                    textSources.push(ann.name);
                }
            });
        }
        
        // Combine all text and convert to lowercase for matching
        const combinedText = textSources.join(' ').toLowerCase();
        
        console.log(`🔍 Entity ${index} (chains: ${chainIds.join(', ')}):`);
        console.log(`   Main description: "${mainDescription || 'N/A'}"`);
        console.log(`   Total text sources: ${textSources.length}`);
        console.log(`   Combined text: "${combinedText.substring(0, 100)}${combinedText.length > 100 ? '...' : ''}"`);
        
        // Determine tubulin type with multiple keyword checks
        let tubulinType: TubulinClass | null = null;
        
        // Check for alpha tubulin keywords
        const hasAlpha = 
            entity.rcsb_polymer_entity.pdbx_description.toLowerCase().includes('alpha')
            // combinedText.includes('α-tubulin') || 
            // combinedText.includes('alpha-tubulin') ||
            // combinedText.includes('tuba1') ||
            // combinedText.includes('tuba ') ||
            // combinedText.includes('tubulin alpha') ||
            // combinedText.includes('alpha tubulin');
        
        // Check for beta tubulin keywords
        const hasBeta = 
            entity.rcsb_polymer_entity.pdbx_description.toLowerCase().includes('beta') 
            // combinedText.includes('β-tubulin') || 
            // combinedText.includes('beta-tubulin') ||
            // combinedText.includes('tubb') ||
            // combinedText.includes('tubulin beta') ||
            // combinedText.includes('beta tubulin');
        
        if (hasAlpha) {
            tubulinType = TubulinClass.Alpha;
            console.log(`   ✅ Classified as ALPHA tubulin`);
        } else if (hasBeta) {
            tubulinType = TubulinClass.Beta;
            console.log(`   ✅ Classified as BETA tubulin`);
        } else if (combinedText.includes('tubulin')) {
            console.log(`   ⚠️ Found "tubulin" but couldn't determine alpha/beta`);
            console.log(`   🔍 Full text for manual inspection:`, combinedText);
        } else {
            console.log(`   ❌ Not identified as tubulin`);
        }
        
        // Map all chains to the identified type
        if (tubulinType) {
            chainIds.forEach(chainId => {
                classificationMap[chainId] = tubulinType;
                console.log(`   🎨 Mapped chain ${chainId} → ${tubulinType}`);
            });
        }
    });
    
    console.log(`\n🎨 Final Classification Map:`, classificationMap);
    
    if (Object.keys(classificationMap).length === 0) {
        console.warn(`\n⚠️ WARNING: No tubulin classification found!`);
        console.warn(`   Possible reasons:`);
        console.warn(`   1. Structure is not a tubulin protein`);
        console.warn(`   2. Descriptions don't contain "alpha" or "beta" keywords`);
        console.warn(`   3. Non-standard naming convention`);
    }
    
    return classificationMap;
}

/**
 * Fallback: Create alternating alpha/beta classification
 * Use this when automatic classification fails but you know it's tubulin
 */
export function createAlternatingClassification(chainIds: string[]): TubulinClassification {
    const map: TubulinClassification = {};
    
    chainIds.sort().forEach((chainId, index) => {
        // Alternate: even = alpha, odd = beta
        map[chainId] = index % 2 === 0 ? TubulinClass.Alpha : TubulinClass.Beta;
    });
    
    console.log('🔄 Using alternating fallback classification:', map);
    return map;
}

/**
 * Debug helper: Fetch and log raw GraphQL data
 */
export async function debugGraphQLResponse(pdbId: string, fetchFunction: (id: string) => Promise<any>) {
    console.log(`\n🐛 DEBUG: Fetching GraphQL data for ${pdbId}...\n`);
    
    try {
        const data = await fetchFunction(pdbId);
        
        console.log('📦 Full Response:', data);
        
        const entry = data?.entries?.[0];
        if (!entry) {
            console.error('❌ No entry found');
            return;
        }
        
        console.log(`\n✅ Entry ID: ${entry.rcsb_id}`);
        console.log(`✅ Polymer Entities: ${entry.polymer_entities?.length || 0}`);
        
        entry.polymer_entities?.forEach((entity: any, idx: number) => {
            console.log(`\n━━━ Entity ${idx + 1} ━━━`);
            console.log('Chains:', entity.rcsb_polymer_entity_container_identifiers?.auth_asym_ids);
            console.log('Description:', entity.rcsb_polymer_entity?.pdbx_description);
            console.log('Pfams:', entity.pfams?.map((p: any) => p.rcsb_pfam_description));
            console.log('Annotations:', entity.rcsb_polymer_entity_annotation?.map((a: any) => a.description));
        });
        
        console.log('\n🎨 Testing Classification...');
        const classification = createTubulinClassificationMap(data);
        console.log('Result:', classification);
        
        if (Object.keys(classification).length === 0) {
            console.log('\n💡 TIP: Try these known tubulin structures instead:');
            console.log('   - 6O2T (microtubule)');
            console.log('   - 3JAT (tubulin-colchicine)');
            console.log('   - 6WVR (tubulin)');
        }
        
    } catch (error) {
        console.error('❌ Error:', error);
    }
}