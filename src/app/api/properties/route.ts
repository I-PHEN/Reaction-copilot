import { NextResponse } from "next/server";
import { lookupCompound, fetchFromPubChem } from "@/lib/solvers/properties";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/properties?name=methanol
 * ---------------------------------------------------------------
 * Looks up a compound's physical properties. Primary source is the
 * curated local database (real thermochemical data). If not found
 * locally, tries PubChem REST API for identification (MW, formula).
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const name = url.searchParams.get("name")?.trim();

    if (!name) {
      return NextResponse.json(
        { error: "Missing 'name' query parameter." },
        { status: 400 },
      );
    }

    // 1. Try the local curated database first (has real ΔHf, Cp, etc.)
    const local = lookupCompound(name);
    if (local) {
      return NextResponse.json(
        { source: "local", ...local },
        { status: 200 },
      );
    }

    // 2. Fall back to PubChem for identification
    const pubchem = await fetchFromPubChem(name);
    if (pubchem) {
      return NextResponse.json(
        { source: "pubchem", ...pubchem, deltaHf: null, cp: null, note: "Basic identification only — thermochemical data not available. Use a compound in the local database for full properties." },
        { status: 200 },
      );
    }

    // 3. Not found anywhere
    return NextResponse.json(
      {
        found: false,
        name,
        message: `Compound "${name}" not found in local database or PubChem. Available compounds include: methanol, ethanol, water, DME, ethylene, benzene, ammonia, hydrogen, oxygen, CO2, etc.`,
      },
      { status: 404 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
