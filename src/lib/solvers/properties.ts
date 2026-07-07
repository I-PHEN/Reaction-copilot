/**
 * Property Database — curated thermochemical data for common compounds.
 * ---------------------------------------------------------------
 * A local mini-database of the most common chemicals in reaction
 * engineering, with REAL physical properties (not estimated). This is
 * the fallback / primary source; the PubChem API adds compound
 * identification for compounds not in this database.
 *
 * Sources: NIST WebBook, Perry's Chemical Engineers' Handbook, Yaws.
 * Values are at 298 K unless noted.
 */

export interface CompoundProperties {
  name: string;
  formula: string;
  molecularWeight: number; // g/mol
  cas: string;
  // Thermochemical (298 K)
  deltaHf?: number; // kJ/mol (heat of formation, gas phase)
  cp?: number; // J/(mol·K) (heat capacity, gas phase, 298 K)
  boilingPoint?: number; // K
  meltingPoint?: number; // K
  // Kinetics hint (typical pre-exponential for common reactions)
  density?: number; // kg/m³ (liquid)
  source: string;
}

const DB: Record<string, CompoundProperties> = {
  methanol: {
    name: "Methanol",
    formula: "CH₃OH",
    molecularWeight: 32.04,
    cas: "67-56-1",
    deltaHf: -201.0,
    cp: 43.9,
    boilingPoint: 337.6,
    meltingPoint: 175.5,
    density: 791.8,
    source: "NIST WebBook",
  },
  ethanol: {
    name: "Ethanol",
    formula: "C₂H₅OH",
    molecularWeight: 46.07,
    cas: "64-17-5",
    deltaHf: -234.8,
    cp: 65.6,
    boilingPoint: 351.5,
    meltingPoint: 159.0,
    density: 789.0,
    source: "NIST WebBook",
  },
  water: {
    name: "Water",
    formula: "H₂O",
    molecularWeight: 18.015,
    cas: "7732-18-5",
    deltaHf: -241.8,
    cp: 33.6,
    boilingPoint: 373.15,
    meltingPoint: 273.15,
    density: 997.0,
    source: "NIST WebBook",
  },
  dme: {
    name: "Dimethyl Ether (DME)",
    formula: "CH₃OCH₃",
    molecularWeight: 46.07,
    cas: "115-10-6",
    deltaHf: -184.1,
    cp: 65.6,
    boilingPoint: 248.3,
    meltingPoint: 131.7,
    density: 668.0,
    source: "NIST WebBook",
  },
  ethylene: {
    name: "Ethylene",
    formula: "C₂H₄",
    molecularWeight: 28.05,
    cas: "74-85-1",
    deltaHf: 52.4,
    cp: 42.9,
    boilingPoint: 169.4,
    meltingPoint: 104.0,
    source: "NIST WebBook",
  },
  ethylene_oxide: {
    name: "Ethylene Oxide",
    formula: "C₂H₄O",
    molecularWeight: 44.05,
    cas: "75-21-8",
    deltaHf: -52.6,
    cp: 47.9,
    boilingPoint: 283.6,
    meltingPoint: 160.7,
    source: "NIST WebBook",
  },
  benzene: {
    name: "Benzene",
    formula: "C₆H₆",
    molecularWeight: 78.11,
    cas: "71-43-2",
    deltaHf: 82.9,
    cp: 82.4,
    boilingPoint: 353.2,
    meltingPoint: 278.7,
    density: 876.5,
    source: "NIST WebBook",
  },
  toluene: {
    name: "Toluene",
    formula: "C₇H₈",
    molecularWeight: 92.14,
    cas: "108-88-3",
    deltaHf: 50.0,
    cp: 103.6,
    boilingPoint: 383.8,
    meltingPoint: 178.2,
    density: 867.0,
    source: "NIST WebBook",
  },
  hydrogen: {
    name: "Hydrogen",
    formula: "H₂",
    molecularWeight: 2.016,
    cas: "1333-74-0",
    deltaHf: 0.0,
    cp: 28.8,
    boilingPoint: 20.3,
    meltingPoint: 13.8,
    source: "NIST WebBook",
  },
  oxygen: {
    name: "Oxygen",
    formula: "O₂",
    molecularWeight: 31.998,
    cas: "7782-44-7",
    deltaHf: 0.0,
    cp: 29.4,
    boilingPoint: 90.2,
    meltingPoint: 54.4,
    source: "NIST WebBook",
  },
  carbon_dioxide: {
    name: "Carbon Dioxide",
    formula: "CO₂",
    molecularWeight: 44.01,
    cas: "124-38-9",
    deltaHf: -393.5,
    cp: 37.1,
    boilingPoint: 194.7,
    meltingPoint: 216.6,
    source: "NIST WebBook",
  },
  carbon_monoxide: {
    name: "Carbon Monoxide",
    formula: "CO",
    molecularWeight: 28.01,
    cas: "630-08-0",
    deltaHf: -110.5,
    cp: 29.1,
    boilingPoint: 81.7,
    meltingPoint: 68.1,
    source: "NIST WebBook",
  },
  ammonia: {
    name: "Ammonia",
    formula: "NH₃",
    molecularWeight: 17.03,
    cas: "7664-41-7",
    deltaHf: -45.9,
    cp: 35.1,
    boilingPoint: 239.8,
    meltingPoint: 195.4,
    source: "NIST WebBook",
  },
  nitric_oxide: {
    name: "Nitric Oxide",
    formula: "NO",
    molecularWeight: 30.01,
    cas: "10102-43-9",
    deltaHf: 90.3,
    cp: 29.8,
    boilingPoint: 121.4,
    meltingPoint: 109.5,
    source: "NIST WebBook",
  },
  sulfur_dioxide: {
    name: "Sulfur Dioxide",
    formula: "SO₂",
    molecularWeight: 64.07,
    cas: "7446-09-5",
    deltaHf: -296.8,
    cp: 39.9,
    boilingPoint: 263.1,
    meltingPoint: 197.7,
    source: "NIST WebBook",
  },
  propylene: {
    name: "Propylene",
    formula: "C₃H₆",
    molecularWeight: 42.08,
    cas: "115-07-1",
    deltaHf: 20.0,
    cp: 63.9,
    boilingPoint: 225.5,
    meltingPoint: 87.9,
    source: "NIST WebBook",
  },
  acetone: {
    name: "Acetone",
    formula: "C₃H₆O",
    molecularWeight: 58.08,
    cas: "67-64-1",
    deltaHf: -217.3,
    cp: 74.5,
    boilingPoint: 329.4,
    meltingPoint: 178.5,
    density: 784.6,
    source: "NIST WebBook",
  },
  acetic_acid: {
    name: "Acetic Acid",
    formula: "CH₃COOH",
    molecularWeight: 60.05,
    cas: "64-19-7",
    deltaHf: -432.2,
    cp: 66.5,
    boilingPoint: 391.1,
    meltingPoint: 289.8,
    density: 1049.0,
    source: "NIST WebBook",
  },
  formaldehyde: {
    name: "Formaldehyde",
    formula: "CH₂O",
    molecularWeight: 30.03,
    cas: "50-00-0",
    deltaHf: -108.6,
    cp: 35.4,
    boilingPoint: 254.1,
    meltingPoint: 156.1,
    source: "NIST WebBook",
  },
  methanol_dme_reaction: {
    name: "Methanol → DME (dehydration)",
    formula: "2 CH₃OH → CH₃OCH₃ + H₂O",
    molecularWeight: 0,
    cas: "—",
    deltaHf: -23.6, // ΔHr = ΔHf(DME) + ΔHf(H₂O) - 2×ΔHf(MeOH) = -184.1 + (-241.8) - 2×(-201.0) = -23.6 kJ/mol
    cp: 0,
    source: "Calculated from NIST ΔHf values",
  },
};

/** Alias map for common names → database keys. */
const ALIASES: Record<string, string> = {
  meoh: "methanol",
  methyl_alcohol: "methanol",
  etoh: "ethanol",
  ethyl_alcohol: "ethanol",
  h2o: "water",
  "dimethyl ether": "dme",
  "dimethyl_ether": "dme",
  ch3oh: "methanol",
  c2h5oh: "ethanol",
  c2h4: "ethylene",
  ethene: "ethylene",
  c6h6: "benzene",
  h2: "hydrogen",
  o2: "oxygen",
  co2: "carbon_dioxide",
  co: "carbon_monoxide",
  nh3: "ammonia",
  no: "nitric_oxide",
  so2: "sulfur_dioxide",
  c3h6: "propylene",
  propene: "propylene",
  ch3cooh: "acetic_acid",
  ch2o: "formaldehyde",
};

/** Look up a compound by name (case-insensitive, with aliases). */
export function lookupCompound(query: string): CompoundProperties | null {
  const key = query.toLowerCase().trim().replace(/\s+/g, "_");
  // Direct match
  if (DB[key]) return DB[key];
  // Alias match
  if (ALIASES[key]) return DB[ALIASES[key]];
  // Partial match
  for (const [k, v] of Object.entries(DB)) {
    if (k.includes(key) || v.name.toLowerCase().includes(key)) return v;
  }
  for (const [alias, target] of Object.entries(ALIASES)) {
    if (alias.includes(key)) return DB[target];
  }
  return null;
}

/** List all available compounds (for the UI). */
export function listCompounds(): CompoundProperties[] {
  return Object.values(DB);
}

/**
 * Try to fetch from PubChem REST API (server-side, no CORS).
 * Returns basic identification properties (MW, formula, SMILES).
 * Falls back gracefully if the network is unavailable.
 */
export async function fetchFromPubChem(name: string): Promise<{
  name: string;
  formula?: string;
  molecularWeight?: number;
  smiles?: string;
  cas?: string;
  found: boolean;
} | null> {
  try {
    const url = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(name)}/property/MolecularFormula,MolecularWeight,CanonicalSMILES/JSON`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const data = await res.json();
    const props = data?.PropertyTable?.Properties?.[0];
    if (!props) return null;
    return {
      name: name.charAt(0).toUpperCase() + name.slice(1),
      formula: props.MolecularFormula,
      molecularWeight: props.MolecularWeight,
      smiles: props.CanonicalSMILES,
      found: true,
    };
  } catch {
    return null;
  }
}
