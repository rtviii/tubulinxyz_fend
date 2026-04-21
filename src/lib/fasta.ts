// src/lib/fasta.ts
// Tiny parser used by the "Raw FASTA" add-polymer tab.
// Accepts either a full FASTA record (">header\nSEQ...") or plain letters.

export interface ParsedFasta {
  name: string;
  sequence: string;
}

export type ParseResult = ParsedFasta | { error: string };

export function parseFastaOrPlain(input: string, fallbackName: string): ParseResult {
  const trimmed = input.trim();
  if (!trimmed) return { error: 'Empty input' };

  let name = fallbackName;
  let body = trimmed;

  if (trimmed.startsWith('>')) {
    const nl = trimmed.indexOf('\n');
    if (nl < 0) return { error: 'FASTA header present but no sequence' };
    const header = trimmed.slice(1, nl).trim();
    const firstTok = header.split(/\s+/)[0];
    if (firstTok) name = firstTok;
    body = trimmed.slice(nl + 1);
  }

  if (body.indexOf('>') >= 0) {
    return { error: 'Multiple FASTA records — paste one sequence at a time' };
  }

  const sequence = body.replace(/\s+/g, '').toUpperCase();
  if (!/^[A-Z*\-]+$/.test(sequence)) {
    return { error: 'Sequence contains non-letter characters' };
  }
  if (sequence.length < 20) {
    return { error: 'Sequence too short (minimum 20 residues)' };
  }

  return { name: name || fallbackName, sequence };
}
