"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowRight } from "lucide-react";
import { type StructureSummary } from "@/store/tubxz_api";
import { API_BASE_URL } from "@/config";
import { LIGAND_IGNORE_IDS } from "@/components/molstar/colors/palette";
import { buildStructureUrl } from "@/lib/url_state";

// ── Ligand name lookup type ──
export type LigandLookup = Record<string, string>; // chemical_id -> chemical_name

/** Nucleotides + ions to hide from the card ligand display (they're ubiquitous and uninteresting) */
const CARD_LIGAND_HIDE = new Set([
  ...LIGAND_IGNORE_IDS,
  // Nucleotides
  "GTP", "GDP", "GCP", "GSP", "G2P", "G2N", "ANP", "ACP", "ATP", "ADP", "GP2", "O3G",
  // Ions
  "MG", "ZN", "CA", "MN", "NA", "K", "CL", "ZPN",
  // Phosphate mimics
  "BEF", "AF3", "ALF",
]);

// ── Structure Card ──

export const StructureCard = ({ structure, ligandLookup }: { structure: StructureSummary; ligandLookup: LigandLookup }) => {
  const organism = structure.src_organism_names?.[0] || "Unknown";
  const imageUrl = `${API_BASE_URL}/structures/${structure.rcsb_id}/thumbnail`;

  const formatOrganism = (name: string) => {
    if (!name || name === "Unknown") return { genus: "Unknown", species: "" };
    const parts = name.split(" ");
    return { genus: parts[0], species: parts.slice(1).join(" ") };
  };
  const { genus, species } = formatOrganism(organism);

  const allLigandIds = structure.ligand_ids ?? [];
  const meaningfulLigands = allLigandIds.filter(id => !CARD_LIGAND_HIDE.has(id));
  const mapFamilies = (structure.polymer_families ?? []).filter(f => f.startsWith("map_"));
  const authors = structure.citation_rcsb_authors ?? [];
  const authorLine = authors.length === 0 ? null
    : authors.length <= 2 ? authors.join(", ")
    : `${authors[0]} et al.`;

  return (
    <a href={buildStructureUrl(structure.rcsb_id)} className="group block h-full">
      <div className="w-full h-full bg-white rounded-lg border border-gray-200 overflow-hidden transition-all duration-200 hover:shadow-md hover:border-gray-300 flex flex-col">
        {/* Image */}
        <div className="relative h-48 bg-gradient-to-br from-gray-50 to-gray-100 overflow-hidden">
          <img
            src={imageUrl}
            alt={`Structure ${structure.rcsb_id}`}
            className="w-full h-full object-cover transition-all duration-300 group-hover:brightness-110 group-hover:blur-[1px]"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.onerror = null;
              target.src = `https://placehold.co/400x300/f8fafc/94a3b8?text=${structure.rcsb_id}`;
            }}
          />
          <div className="absolute top-2 left-2 bg-black/70 text-white text-[11px] font-mono font-bold px-2 py-0.5 rounded">
            {structure.rcsb_id}
          </div>
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <ArrowRight className="w-8 h-8 text-white/30" strokeWidth={1.5} />
          </div>
        </div>

        {/* Content */}
        <div className="p-3 flex-grow flex flex-col gap-1.5">
          <p className="text-[13px] leading-tight">
            <span className="italic font-medium text-gray-900">{genus}</span>
            {species && <span className="italic text-gray-500"> {species}</span>}
          </p>

          <p
            className="text-[11px] text-gray-400 line-clamp-2 leading-snug flex-grow"
            title={structure.citation_title || undefined}
          >
            {structure.citation_title || "No title available"}
          </p>

          {authorLine && (
            <p className="text-[9px] text-gray-300 truncate" title={authors.join(", ")}>
              {authorLine}
            </p>
          )}
        </div>

        {/* Bottom metadata */}
        <div className="px-3 pb-2.5 flex items-center gap-1.5 flex-wrap text-[9px] text-gray-400">
          {structure.citation_year && (
            <span className="bg-gray-50 px-1.5 py-0.5 rounded">{structure.citation_year}</span>
          )}
          {structure.resolution && (
            <span className="bg-gray-50 px-1.5 py-0.5 rounded">{structure.resolution.toFixed(1)} A</span>
          )}
          {structure.expMethod && (
            <span className="bg-gray-50 px-1.5 py-0.5 rounded truncate max-w-[80px]" title={structure.expMethod}>
              {structure.expMethod === "ELECTRON MICROSCOPY" ? "cryo-EM"
                : structure.expMethod === "X-RAY DIFFRACTION" ? "X-ray"
                : structure.expMethod}
            </span>
          )}
          {meaningfulLigands.length > 0 && (
            <LigandPopover ligandIds={meaningfulLigands} lookup={ligandLookup} />
          )}
          {mapFamilies.length > 0 && (
            <MapPopover families={mapFamilies} />
          )}
        </div>
      </div>
    </a>
  );
};

/** Shared portal popover that positions above the anchor */
function HoverPopover({
  anchor, open, children,
}: {
  anchor: React.RefObject<HTMLElement | null>;
  open: boolean;
  children: React.ReactNode;
}) {
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (open && anchor.current) {
      const rect = anchor.current.getBoundingClientRect();
      setPos({ top: rect.top + window.scrollY - 6, left: rect.left + window.scrollX });
    }
  }, [open, anchor]);

  if (!open) return null;
  return createPortal(
    <div
      className="absolute z-[9999] w-56 p-1.5 rounded-lg border border-slate-200/60 bg-white/95 backdrop-blur-sm shadow-lg"
      style={{ top: pos.top, left: pos.left, transform: "translateY(-100%)" }}
    >
      {children}
    </div>,
    document.body,
  );
}

const formatChemName = (name: string) =>
  name.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());

const MAP_LABEL: Record<string, string> = {
  map_eb_family: "EB family",
  map_ckap5_chtog: "CKAP5 / ch-TOG",
  map_ttll_glutamylase_short: "TTLL glutamylase (short)",
  map_ttll_glutamylase_long: "TTLL glutamylase (long)",
  map_ccp_deglutamylase: "CCP deglutamylase",
};

function formatMapFamily(f: string): string {
  if (MAP_LABEL[f]) return MAP_LABEL[f];
  return f.replace(/^map_/, "").split("_")
    .map(w => w.length <= 3 ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

/** Ligand popover with rich rows showing chemical ID + name */
function LigandPopover({ ligandIds, lookup }: { ligandIds: string[]; lookup: LigandLookup }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  return (
    <span
      ref={ref}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onClick={(e) => e.preventDefault()}
    >
      <span className="bg-emerald-50 text-emerald-500 px-1.5 py-0.5 rounded cursor-default">
        {ligandIds.length} {ligandIds.length === 1 ? "ligand" : "ligands"}
      </span>
      <HoverPopover anchor={ref} open={open}>
        {ligandIds.map(id => {
          const name = lookup[id];
          return (
            <div key={id} className="flex items-baseline gap-1.5 px-1.5 py-0.5 rounded hover:bg-gray-50">
              <span className="text-[9px] font-mono font-semibold text-gray-700 flex-shrink-0">{id}</span>
              {name && (
                <span className="text-[8px] text-gray-400 truncate">{formatChemName(name)}</span>
              )}
            </div>
          );
        })}
      </HoverPopover>
    </span>
  );
}

/** MAP families popover */
function MapPopover({ families }: { families: string[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  return (
    <span
      ref={ref}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onClick={(e) => e.preventDefault()}
    >
      <span className="bg-violet-50 text-violet-500 px-1.5 py-0.5 rounded cursor-default">
        {families.length} {families.length === 1 ? "MAP" : "MAPs"}
      </span>
      <HoverPopover anchor={ref} open={open}>
        {families.map(f => (
          <div key={f} className="flex items-baseline gap-1.5 px-1.5 py-0.5 rounded hover:bg-gray-50">
            <span className="text-[9px] font-medium text-violet-600">{formatMapFamily(f)}</span>
          </div>
        ))}
      </HoverPopover>
    </span>
  );
}
