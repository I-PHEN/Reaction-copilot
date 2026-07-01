/**
 * Equipment illustrations (P&ID / process-simulator style).
 * ---------------------------------------------------------------
 * Rendered as detailed SVG apparatus — cylindrical vessels with
 * metallic shading, domed heads, real internals (impeller, baffles,
 * tube bundle, sieve trays), and flanged nozzles. Bodies stay neutral
 * metallic; status is expressed by the surrounding node card ring,
 * not by dyeing the equipment.
 *
 * Each glyph accepts an `id` (the node id) so SVG gradient ids stay
 * unique when multiple instances of the same unit render on the canvas.
 */

interface GlyphProps {
  id: string;
}

/* ---- shared metallic gradient stops (zinc) ---- */
const METAL_DARK = "#27272a"; // zinc-800
const METAL_MID = "#3f3f46"; // zinc-700
const METAL_LIGHT = "#52525b"; // zinc-600
const STROKE = "#71717a"; // zinc-500
const DETAIL = "#a1a1aa"; // zinc-400
const LIQUID = "#0e7490"; // cyan-700 (subtle liquid indicator)

function CstrGlyph({ id }: GlyphProps) {
  const gid = `cstr-${id}`;
  return (
    <svg viewBox="0 0 104 120" className="h-full w-full" aria-hidden>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={METAL_DARK} />
          <stop offset="50%" stopColor={METAL_LIGHT} />
          <stop offset="100%" stopColor={METAL_DARK} />
        </linearGradient>
      </defs>
      {/* motor */}
      <rect x="42" y="3" width="20" height="10" rx="2" fill={METAL_MID} stroke={STROKE} strokeWidth="1" />
      <line x1="46" y1="8" x2="58" y2="8" stroke={STROKE} strokeWidth="0.8" />
      {/* shaft */}
      <line x1="52" y1="13" x2="52" y2="70" stroke={DETAIL} strokeWidth="1.6" />
      {/* top head */}
      <path d="M30 32 Q52 18 74 32 Z" fill={`url(#${gid})`} stroke={STROKE} strokeWidth="1.2" />
      {/* body */}
      <rect x="30" y="32" width="44" height="54" fill={`url(#${gid})`} stroke={STROKE} strokeWidth="1.2" />
      {/* bottom head */}
      <path d="M30 86 Q52 100 74 86 Z" fill={`url(#${gid})`} stroke={STROKE} strokeWidth="1.2" />
      {/* baffles */}
      <rect x="33" y="36" width="2" height="46" fill={STROKE} opacity="0.45" />
      <rect x="69" y="36" width="2" height="46" fill={STROKE} opacity="0.45" />
      {/* liquid level */}
      <line x1="30" y1="56" x2="74" y2="56" stroke={LIQUID} strokeWidth="1" strokeDasharray="3 2" opacity="0.7" />
      <path d="M30 56 L74 56 L74 86 Q52 100 30 86 Z" fill={LIQUID} opacity="0.12" />
      {/* impeller (Rushton) */}
      <rect x="46" y="68" width="12" height="2.6" fill={DETAIL} />
      <rect x="40" y="66" width="3" height="6.5" fill={DETAIL} />
      <rect x="61" y="66" width="3" height="6.5" fill={DETAIL} />
      {/* inlet nozzle (left, center) */}
      <line x1="12" y1="59" x2="30" y2="59" stroke={STROKE} strokeWidth="2.4" />
      <rect x="7" y="55" width="5" height="8" fill={METAL_MID} stroke={STROKE} strokeWidth="0.9" />
      {/* outlet nozzle (right, center) */}
      <line x1="74" y1="59" x2="92" y2="59" stroke={STROKE} strokeWidth="2.4" />
      <rect x="92" y="55" width="5" height="8" fill={METAL_MID} stroke={STROKE} strokeWidth="0.9" />
    </svg>
  );
}

function PfrGlyph({ id }: GlyphProps) {
  const gid = `pfr-${id}`;
  return (
    <svg viewBox="0 0 124 76" className="h-full w-full" aria-hidden>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={METAL_DARK} />
          <stop offset="50%" stopColor={METAL_LIGHT} />
          <stop offset="100%" stopColor={METAL_DARK} />
        </linearGradient>
      </defs>
      {/* shell body */}
      <rect x="18" y="18" width="88" height="40" fill={`url(#${gid})`} stroke={STROKE} strokeWidth="1.2" />
      {/* domed heads */}
      <path d="M18 18 Q8 38 18 58 Z" fill={`url(#${gid})`} stroke={STROKE} strokeWidth="1.2" />
      <path d="M106 18 Q116 38 106 58 Z" fill={`url(#${gid})`} stroke={STROKE} strokeWidth="1.2" />
      {/* tube sheets */}
      <line x1="24" y1="18" x2="24" y2="58" stroke={STROKE} strokeWidth="1" />
      <line x1="100" y1="18" x2="100" y2="58" stroke={STROKE} strokeWidth="1" />
      {/* tube bundle (4 tubes) */}
      <line x1="24" y1="26" x2="100" y2="26" stroke={DETAIL} strokeWidth="1.1" />
      <line x1="24" y1="34" x2="100" y2="34" stroke={DETAIL} strokeWidth="1.1" />
      <line x1="24" y1="42" x2="100" y2="42" stroke={DETAIL} strokeWidth="1.1" />
      <line x1="24" y1="50" x2="100" y2="50" stroke={DETAIL} strokeWidth="1.1" />
      {/* baffles (alternating vertical tabs) */}
      <rect x="42" y="19" width="2" height="14" fill={STROKE} opacity="0.5" />
      <rect x="62" y="43" width="2" height="14" fill={STROKE} opacity="0.5" />
      <rect x="82" y="19" width="2" height="14" fill={STROKE} opacity="0.5" />
      {/* flow arrow */}
      <path d="M58 38 l5 -3 l0 6 z" fill={DETAIL} opacity="0.8" />
      {/* inlet nozzle (left) */}
      <line x1="2" y1="38" x2="12" y2="38" stroke={STROKE} strokeWidth="2.4" />
      <rect x="-3" y="34" width="5" height="8" fill={METAL_MID} stroke={STROKE} strokeWidth="0.9" />
      {/* outlet nozzle (right) */}
      <line x1="112" y1="38" x2="122" y2="38" stroke={STROKE} strokeWidth="2.4" />
      <rect x="122" y="34" width="5" height="8" fill={METAL_MID} stroke={STROKE} strokeWidth="0.9" />
    </svg>
  );
}

function MixerGlyph({ id }: GlyphProps) {
  const gid = `mixer-${id}`;
  return (
    <svg viewBox="0 0 88 88" className="h-full w-full" aria-hidden>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={METAL_DARK} />
          <stop offset="50%" stopColor={METAL_LIGHT} />
          <stop offset="100%" stopColor={METAL_DARK} />
        </linearGradient>
      </defs>
      {/* top head */}
      <path d="M24 30 Q44 16 64 30 Z" fill={`url(#${gid})`} stroke={STROKE} strokeWidth="1.2" />
      {/* body */}
      <rect x="24" y="30" width="40" height="32" fill={`url(#${gid})`} stroke={STROKE} strokeWidth="1.2" />
      {/* bottom head (cone) */}
      <path d="M24 62 L44 78 L64 62 Z" fill={`url(#${gid})`} stroke={STROKE} strokeWidth="1.2" />
      {/* internal cross-blades */}
      <line x1="26" y1="46" x2="62" y2="46" stroke={DETAIL} strokeWidth="1" opacity="0.7" />
      <line x1="44" y1="32" x2="44" y2="60" stroke={DETAIL} strokeWidth="1" opacity="0.7" />
      {/* inlet nozzle 1 (upper-left) */}
      <line x1="6" y1="36" x2="24" y2="36" stroke={STROKE} strokeWidth="2.2" />
      <rect x="1" y="33" width="5" height="6" fill={METAL_MID} stroke={STROKE} strokeWidth="0.9" />
      {/* inlet nozzle 2 (lower-left) */}
      <line x1="6" y1="52" x2="24" y2="52" stroke={STROKE} strokeWidth="2.2" />
      <rect x="1" y="49" width="5" height="6" fill={METAL_MID} stroke={STROKE} strokeWidth="0.9" />
      {/* outlet nozzle (right, center) */}
      <line x1="64" y1="44" x2="82" y2="44" stroke={STROKE} strokeWidth="2.4" />
      <rect x="82" y="40" width="5" height="8" fill={METAL_MID} stroke={STROKE} strokeWidth="0.9" />
    </svg>
  );
}

function SeparatorGlyph({ id }: GlyphProps) {
  const gid = `sep-${id}`;
  // tall trayed column
  const trays = [30, 40, 50, 60, 70, 80, 90, 100, 110];
  return (
    <svg viewBox="0 0 76 144" className="h-full w-full" aria-hidden>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={METAL_DARK} />
          <stop offset="50%" stopColor={METAL_LIGHT} />
          <stop offset="100%" stopColor={METAL_DARK} />
        </linearGradient>
      </defs>
      {/* top head */}
      <path d="M22 24 Q38 8 54 24 Z" fill={`url(#${gid})`} stroke={STROKE} strokeWidth="1.2" />
      {/* body */}
      <rect x="22" y="24" width="32" height="96" fill={`url(#${gid})`} stroke={STROKE} strokeWidth="1.2" />
      {/* bottom head */}
      <path d="M22 120 Q38 136 54 120 Z" fill={`url(#${gid})`} stroke={STROKE} strokeWidth="1.2" />
      {/* sieve trays */}
      {trays.map((y, i) => (
        <line key={y} x1="24" y1={y} x2="52" y2={y} stroke={STROKE} strokeWidth="0.9" opacity="0.85" />
      ))}
      {/* downcomers — alternating */}
      {trays.map((y, i) =>
        i % 2 === 0 ? (
          <rect key={`d-l-${y}`} x="24" y={y} width="3" height="4" fill={STROKE} opacity="0.55" />
        ) : (
          <rect key={`d-r-${y}`} x="49" y={y} width="3" height="4" fill={STROKE} opacity="0.55" />
        ),
      )}
      {/* feed nozzle (left, mid-height) */}
      <line x1="6" y1="72" x2="22" y2="72" stroke={STROKE} strokeWidth="2.4" />
      <rect x="1" y="68" width="5" height="8" fill={METAL_MID} stroke={STROKE} strokeWidth="0.9" />
      {/* vapor outlet (top) */}
      <line x1="38" y1="8" x2="38" y2="2" stroke={STROKE} strokeWidth="2.4" />
      <rect x="35" y="-3" width="6" height="5" fill={METAL_MID} stroke={STROKE} strokeWidth="0.9" />
      {/* bottoms outlet (bottom) */}
      <line x1="38" y1="136" x2="38" y2="142" stroke={STROKE} strokeWidth="2.4" />
      <rect x="35" y="142" width="6" height="5" fill={METAL_MID} stroke={STROKE} strokeWidth="0.9" />
    </svg>
  );
}

function FeedGlyph({ id }: GlyphProps) {
  const gid = `feed-${id}`;
  return (
    <svg viewBox="0 0 104 64" className="h-full w-full" aria-hidden>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={METAL_DARK} />
          <stop offset="50%" stopColor={METAL_LIGHT} />
          <stop offset="100%" stopColor={METAL_DARK} />
        </linearGradient>
      </defs>
      {/* body */}
      <rect x="16" y="14" width="72" height="36" fill={`url(#${gid})`} stroke={STROKE} strokeWidth="1.2" />
      {/* domed heads */}
      <path d="M16 14 Q6 32 16 50 Z" fill={`url(#${gid})`} stroke={STROKE} strokeWidth="1.2" />
      <path d="M88 14 Q98 32 88 50 Z" fill={`url(#${gid})`} stroke={STROKE} strokeWidth="1.2" />
      {/* liquid level */}
      <line x1="16" y1="40" x2="88" y2="40" stroke={LIQUID} strokeWidth="1" strokeDasharray="3 2" opacity="0.7" />
      <path d="M16 40 L88 40 L88 50 Q98 32 88 14 L16 14 Q6 32 16 50 Z" fill={LIQUID} opacity="0.12" />
      {/* outlet nozzle (right) */}
      <line x1="88" y1="32" x2="100" y2="32" stroke={STROKE} strokeWidth="2.4" />
      <rect x="100" y="28" width="5" height="8" fill={METAL_MID} stroke={STROKE} strokeWidth="0.9" />
    </svg>
  );
}

function ProductGlyph({ id }: GlyphProps) {
  const gid = `prod-${id}`;
  return (
    <svg viewBox="0 0 104 64" className="h-full w-full" aria-hidden>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={METAL_DARK} />
          <stop offset="50%" stopColor={METAL_LIGHT} />
          <stop offset="100%" stopColor={METAL_DARK} />
        </linearGradient>
      </defs>
      {/* body */}
      <rect x="16" y="14" width="72" height="36" fill={`url(#${gid})`} stroke={STROKE} strokeWidth="1.2" />
      {/* domed heads */}
      <path d="M16 14 Q6 32 16 50 Z" fill={`url(#${gid})`} stroke={STROKE} strokeWidth="1.2" />
      <path d="M88 14 Q98 32 88 50 Z" fill={`url(#${gid})`} stroke={STROKE} strokeWidth="1.2" />
      {/* inlet nozzle (left) */}
      <line x1="4" y1="32" x2="16" y2="32" stroke={STROKE} strokeWidth="2.4" />
      <rect x="-1" y="28" width="5" height="8" fill={METAL_MID} stroke={STROKE} strokeWidth="0.9" />
      {/* label */}
      <text x="52" y="36" textAnchor="middle" fontSize="11" fill={DETAIL} fontWeight="700">P</text>
    </svg>
  );
}

export const GLYPHS = {
  feed: FeedGlyph,
  cstr: CstrGlyph,
  pfr: PfrGlyph,
  mixer: MixerGlyph,
  separator: SeparatorGlyph,
  product: ProductGlyph,
} as const;
