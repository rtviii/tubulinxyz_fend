// src/services/alignment_service.ts
import { AlignmentRequest, AlignmentResponse } from "@/app/msa-viewer/types";

const API_BASE_URL = "http://localhost:8000";

export const AlignmentService = {
  /**
   * Sends an observed sequence to the backend to be aligned against the Master.
   */
  async alignSequence(payload: AlignmentRequest): Promise<AlignmentResponse> {
    const response = await fetch(`${API_BASE_URL}/msaprofile/sequence`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Backend Error (${response.status}): ${errText}`);
    }

    return await response.json();
  }
};