"use client";

import { useState } from "react";
import { FlaskConical, Search, X, Plus, Database } from "lucide-react";
import { useTopology } from "@/lib/store/topology";
import { cn } from "@/lib/utils";

export function ChemistryPanel() {
  const chemistry = useTopology((s) => s.chemistry);
  const addCompound = useTopology((s) => s.addCompound);
  const clearChemistry = useTopology((s) => s.clearChemistry);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = async () => {
    if (!query.trim()) return;
    setSearching(true);
    setError(null);
    try {
      const res = await fetch(`/api/properties?name=${encodeURIComponent(query.trim())}`);
      const data = await res.json();
      if (data.found === false || res.status === 404) {
        setError(data.message || "Compound not found.");
      } else if (data.name) {
        addCompound({
          name: data.name,
          formula: data.formula || "—",
          molecularWeight: data.molecularWeight || 0,
          deltaHf: data.deltaHf ?? undefined,
          cp: data.cp ?? undefined,
          boilingPoint: data.boilingPoint ?? undefined,
          source: data.source || "unknown",
        });
        setQuery("");
      }
    } catch {
      setError("Could not reach the property service.");
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="shrink-0 border-t border-zinc-800/80 bg-zinc-950">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-1.5">
        <FlaskConical className="h-3 w-3 text-cyan-400" />
        <span className="text-[10px] uppercase tracking-wider text-zinc-500">Chemistry</span>
        <span className="font-mono text-[10px] text-zinc-600">
          {chemistry.length} {chemistry.length === 1 ? "compound" : "compounds"}
        </span>
        {chemistry.length > 0 && (
          <button
            onClick={clearChemistry}
            className="ml-auto flex items-center gap-1 text-[9px] text-zinc-600 hover:text-zinc-400"
          >
            <X className="h-2.5 w-2.5" /> clear
          </button>
        )}
      </div>

      {/* Search bar */}
      <div className="flex items-center gap-1.5 px-4 pb-2">
        <div className="flex flex-1 items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900/60 px-2 py-1">
          <Search className="h-3 w-3 text-zinc-600" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search()}
            placeholder="Search a compound (e.g. methanol, ethanol, ammonia)…"
            className="flex-1 bg-transparent text-[11px] text-zinc-200 outline-none placeholder:text-zinc-600"
          />
        </div>
        <button
          onClick={search}
          disabled={!query.trim() || searching}
          className="flex items-center gap-1 rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-[10px] text-zinc-400 transition-colors hover:border-cyan-500/40 hover:text-cyan-200 disabled:opacity-40"
        >
          {searching ? "…" : <Plus className="h-2.5 w-2.5" />}
          {searching ? "" : "Add"}
        </button>
      </div>

      {error && (
        <div className="px-4 pb-2 text-[10px] text-amber-400/80">{error}</div>
      )}

      {/* Compound cards */}
      {chemistry.length > 0 && (
        <div className="eng-scroll flex gap-2 overflow-x-auto px-4 pb-2">
          {chemistry.map((c, i) => (
            <div
              key={i}
              className="flex w-[180px] shrink-0 flex-col gap-1 rounded-lg border border-zinc-800/60 bg-zinc-900/50 p-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-zinc-200">{c.name}</span>
                <span className="font-mono text-[9px] text-zinc-600">{c.source}</span>
              </div>
              <div className="font-mono text-[10px] text-zinc-500">{c.formula}</div>
              <div className="space-y-0.5 text-[10px] text-zinc-400">
                <div className="flex justify-between">
                  <span className="text-zinc-600">MW</span>
                  <span className="font-mono text-zinc-300">{c.molecularWeight.toFixed(2)}</span>
                </div>
                {c.deltaHf != null && (
                  <div className="flex justify-between">
                    <span className="text-zinc-600">ΔHf</span>
                    <span className={cn("font-mono", c.deltaHf < 0 ? "text-emerald-300/80" : "text-amber-300/80")}>
                      {c.deltaHf.toFixed(1)} <span className="text-zinc-600">kJ/mol</span>
                    </span>
                  </div>
                )}
                {c.cp != null && c.cp > 0 && (
                  <div className="flex justify-between">
                    <span className="text-zinc-600">Cp</span>
                    <span className="font-mono text-zinc-300">
                      {c.cp.toFixed(1)} <span className="text-zinc-600">J/mol·K</span>
                    </span>
                  </div>
                )}
                {c.boilingPoint != null && (
                  <div className="flex justify-between">
                    <span className="text-zinc-600">BP</span>
                    <span className="font-mono text-zinc-300">
                      {c.boilingPoint.toFixed(1)} <span className="text-zinc-600">K</span>
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {chemistry.length === 0 && (
        <div className="flex items-center gap-1.5 px-4 pb-2 text-[10px] text-zinc-700">
          <Database className="h-2.5 w-2.5" />
          Search to load real physical properties (ΔHf, Cp, MW) from the local database + PubChem.
        </div>
      )}
    </div>
  );
}
