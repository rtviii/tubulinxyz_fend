// 1. We remove the `query($entry_ids: ...)` header and use a simple placeholder.
// Note the quotes around the placeholder, as the PDB ID needs to be a string in the final query.
const RCSB_GRAPHQL_QUERY = `
{
  entries(entry_ids: ["$RCSB_ID"]) {
    rcsb_id
    assemblies {
      polymer_entity_instances {
        rcsb_id
      }
    }
    polymer_entities {
      rcsb_polymer_entity_container_identifiers {
        asym_ids
        auth_asym_ids
        entry_id
        entity_id
      }
      pfams {
        rcsb_pfam_accession
        rcsb_pfam_comment
        rcsb_pfam_description
      }
      rcsb_entity_source_organism {
        ncbi_taxonomy_id
        scientific_name
      }
      rcsb_entity_host_organism {
        ncbi_taxonomy_id
        scientific_name
      }
      uniprots {
        rcsb_id
      }
      rcsb_polymer_entity {
        pdbx_description
      }
      entity_poly {
        pdbx_seq_one_letter_code
        pdbx_seq_one_letter_code_can
        pdbx_strand_id
        rcsb_entity_polymer_type
        rcsb_sample_sequence_length
        type
      }
      rcsb_polymer_entity_annotation {
        annotation_id
        assignment_version
        description
        name
        provenance_source
        type
      }
    }
  }
}
`;

/**
 * Fetches detailed metadata for a given PDB ID from the RCSB GraphQL API.
 * @param pdbId The 4-character PDB ID.
 * @returns The JSON data from the API.
 */
export const fetchRcsbGraphQlData = async (pdbId: string) => {
    try {
        // 2. We build the final query string here, just like in your Python example.
        const finalQuery = RCSB_GRAPHQL_QUERY.replace("$RCSB_ID", pdbId);

        const response = await fetch('https://data.rcsb.org/graphql', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            // 3. The body now contains only the final, complete query string.
            //    We no longer use the `variables` object.
            body: JSON.stringify({
                query: finalQuery 
            }),
        });

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`GraphQL request failed with status ${response.status}: ${errorBody}`);
        }

        const jsonData = await response.json();

        if (jsonData.errors) {
            throw new Error(`GraphQL query returned errors: ${JSON.stringify(jsonData.errors)}`);
        }
        
        return jsonData.data;

    } catch (error) {
        console.error("Error fetching RCSB GraphQL data:", error);
        throw error;
    }
};