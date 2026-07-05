/**
 * Equipment illustrations (P&ID / process-simulator style) — Phase 2 refined.
 * ---------------------------------------------------------------
 * Detailed SVG apparatus with metallic cylindrical shading, domed heads,
 * real internals, and flanged nozzles. Nozzles extend to the viewBox
 * boundary so React Flow handles sit on the nozzle tips. Bodies stay
 * neutral metallic; status is expressed by the surrounding glow.
 *
 * Phase 2 refinements (all static SVG, zero runtime cost):
 *  - CSTR: cooling jacket, curved-blade impeller, sampling port, motor fins
 *  - PFR: tube-pass partition baffles, shell-side utility nozzles, 6 tubes
 *  - Separator: feed tray distinction, downcomer weirs, reboiler/condenser
 *  - Feed/Product: level gauge ticks, more realistic drum proportions
 *
 * SVGs have pointer-events:none so all interaction hits the node wrapper.
 */

interface GlyphProps {
  id: string;
}

const METAL_DARK = "#27272a";
const METAL_MID = "#3f3f46";
const METAL_LIGHT = "#52525b";
const STROKE = "#71717a";
const DETAIL = "#a1a1aa";
const LIQUID = "#0e7490";
const UTILITY = "#7c2d12"; // rust tone for utility (heating/cooling) ports

const SVG_PROPS = { className: "h-full w-full", "aria-hidden": true, style: { pointerEvents: "none" as const } };

function CstrGlyph({ id }: GlyphProps) {
  const gid = `cstr-${id}`;
  return (
    <svg viewBox="0 0 104 132" {...SVG_PROPS}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={METAL_DARK} />
          <stop offset="50%" stopColor={METAL_LIGHT} />
          <stop offset="100%" stopColor={METAL_DARK} />
        </linearGradient>
        <linearGradient id={`${gid}-jacket`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#1c1917" />
          <stop offset="50%" stopColor="#44403c" />
          <stop offset="100%" stopColor="#1c1917" />
        </linearGradient>
      </defs>
      {/* cooling jacket — outer shell, slightly wider than the vessel */}
      <path
        d="M26 34 Q52 20 78 34 L78 92 Q52 106 26 92 Z"
        fill={`url(#${gid}-jacket)`}
        stroke={STROKE}
        strokeWidth="1"
        opacity="0.7"
      />
      {/* jacket utility nozzles (top-in, bottom-out) */}
      <line x1="20" y1="40" x2="0" y2="40" stroke={UTILITY} strokeWidth="1.6" opacity="0.7" />
      <circle cx="0" cy="40" r="1.8" fill={UTILITY} opacity="0.7" />
      <line x1="84" y1="86" x2="104" y2="86" stroke={UTILITY} strokeWidth="1.6" opacity="0.7" />
      <circle cx="104" cy="86" r="1.8" fill={UTILITY} opacity="0.7" />

      {/* motor with cooling fins */}
      <rect x="40" y="3" width="24" height="12" rx="2" fill={METAL_MID} stroke={STROKE} strokeWidth="1" />
      <line x1="44" y1="6" x2="44" y2="12" stroke={STROKE} strokeWidth="0.7" />
      <line x1="48" y1="6" x2="48" y2="12" stroke={STROKE} strokeWidth="0.7" />
      <line x1="56" y1="6" x2="56" y2="12" stroke={STROKE} strokeWidth="0.7" />
      <line x1="60" y1="6" x2="60" y2="12" stroke={STROKE} strokeWidth="0.7" />
      {/* shaft coupling */}
      <rect x="50" y="15" width="4" height="3" fill={DETAIL} />

      {/* shaft */}
      <line x1="52" y1="15" x2="52" y2="74" stroke={DETAIL} strokeWidth="1.8" />

      {/* top head */}
      <path d="M30 34 Q52 20 74 34 Z" fill={`url(#${gid})`} stroke={STROKE} strokeWidth="1.2" />
      {/* body */}
      <rect x="30" y="34" width="44" height="56" fill={`url(#${gid})`} stroke={STROKE} strokeWidth="1.2" />
      {/* bottom head */}
      <path d="M30 90 Q52 104 74 90 Z" fill={`url(#${gid})`} stroke={STROKE} strokeWidth="1.2" />

      {/* baffles */}
      <rect x="33" y="38" width="2" height="48" fill={STROKE} opacity="0.45" />
      <rect x="69" y="38" width="2" height="48" fill={STROKE} opacity="0.45" />

      {/* liquid level with gradient fill */}
      <line x1="30" y1="58" x2="74" y2="58" stroke={LIQUID} strokeWidth="1" strokeDasharray="3 2" opacity="0.7" />
      <path d="M30 58 L74 58 L74 90 Q52 104 30 90 Z" fill={LIQUID} opacity="0.14" />

      {/* curved-blade impeller (Rushton) */}
      <rect x="44" y="72" width="16" height="2.8" fill={DETAIL} />
      {/* curved blades */}
      <path d="M40 70 Q38 73 40 76" fill="none" stroke={DETAIL} strokeWidth="1.4" />
      <path d="M64 70 Q66 73 64 76" fill="none" stroke={DETAIL} strokeWidth="1.4" />
      <rect x="38" y="70" width="3" height="6.5" fill={DETAIL} />
      <rect x="63" y="70" width="3" height="6.5" fill={DETAIL} />
      {/* disc */}
      <ellipse cx="52" cy="71" rx="6" ry="1.2" fill={DETAIL} opacity="0.8" />

      {/* sampling port — small nozzle on the right side */}
      <line x1="74" y1="48" x2="80" y2="48" stroke={STROKE} strokeWidth="1.4" />
      <rect x="78" y="46" width="3" height="4" fill={METAL_MID} stroke={STROKE} strokeWidth="0.7" />

      {/* inlet nozzle — extends to viewBox edge (x=0) */}
      <line x1="0" y1="62" x2="30" y2="62" stroke={STROKE} strokeWidth="2.4" />
      <rect x="0" y="58" width="6" height="8" fill={METAL_MID} stroke={STROKE} strokeWidth="0.9" />
      {/* outlet nozzle — extends to viewBox edge (x=104) */}
      <line x1="74" y1="62" x2="104" y2="62" stroke={STROKE} strokeWidth="2.4" />
      <rect x="98" y="58" width="6" height="8" fill={METAL_MID} stroke={STROKE} strokeWidth="0.9" />
    </svg>
  );
}

function PfrGlyph({ id }: GlyphProps) {
  const gid = `pfr-${id}`;
  return (
    <svg viewBox="0 0 124 84" {...SVG_PROPS}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={METAL_DARK} />
          <stop offset="50%" stopColor={METAL_LIGHT} />
          <stop offset="100%" stopColor={METAL_DARK} />
        </linearGradient>
      </defs>
      {/* shell body */}
      <rect x="18" y="18" width="88" height="48" fill={`url(#${gid})`} stroke={STROKE} strokeWidth="1.2" />
      {/* domed heads */}
      <path d="M18 18 Q8 42 18 66 Z" fill={`url(#${gid})`} stroke={STROKE} strokeWidth="1.2" />
      <path d="M106 18 Q116 42 106 66 Z" fill={`url(#${gid})`} stroke={STROKE} strokeWidth="1.2" />

      {/* tube sheets (thicker) */}
      <rect x="23" y="18" width="3" height="48" fill={STROKE} opacity="0.6" />
      <rect x="98" y="18" width="3" height="48" fill={STROKE} opacity="0.6" />

      {/* 6-tube bundle */}
      {[26, 33, 40, 47, 54, 61].map((y) => (
        <line key={y} x1="26" y1={y} x2="98" y2={y} stroke={DETAIL} strokeWidth="1" opacity="0.85" />
      ))}

      {/* tube-pass partition baffles (vertical, alternating up/down) */}
      <rect x="44" y="19" width="2" height="18" fill={STROKE} opacity="0.5" />
      <rect x="64" y="47" width="2" height="18" fill={STROKE} opacity="0.5" />
      <rect x="82" y="19" width="2" height="18" fill={STROKE} opacity="0.5" />

      {/* shell-side utility nozzles (top + bottom) */}
      <line x1="50" y1="18" x2="50" y2="6" stroke={UTILITY} strokeWidth="1.6" opacity="0.7" />
      <circle cx="50" cy="6" r="1.8" fill={UTILITY} opacity="0.7" />
      <line x1="74" y1="66" x2="74" y2="78" stroke={UTILITY} strokeWidth="1.6" opacity="0.7" />
      <circle cx="74" cy="78" r="1.8" fill={UTILITY} opacity="0.7" />

      {/* flow arrow */}
      <path d="M58 42 l5 -3 l0 6 z" fill={DETAIL} opacity="0.8" />

      {/* inlet nozzle — extends to viewBox edge (x=0) */}
      <line x1="0" y1="42" x2="12" y2="42" stroke={STROKE} strokeWidth="2.4" />
      <rect x="0" y="38" width="6" height="8" fill={METAL_MID} stroke={STROKE} strokeWidth="0.9" />
      {/* outlet nozzle — extends to viewBox edge (x=124) */}
      <line x1="112" y1="42" x2="124" y2="42" stroke={STROKE} strokeWidth="2.4" />
      <rect x="118" y="38" width="6" height="8" fill={METAL_MID} stroke={STROKE} strokeWidth="0.9" />
    </svg>
  );
}

function MixerGlyph({ id }: GlyphProps) {
  const gid = `mixer-${id}`;
  return (
    <svg viewBox="0 0 88 88" {...SVG_PROPS}>
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
      {/* internal cross-blades (static mixer elements) */}
      <line x1="26" y1="46" x2="62" y2="46" stroke={DETAIL} strokeWidth="1" opacity="0.7" />
      <line x1="44" y1="32" x2="44" y2="60" stroke={DETAIL} strokeWidth="1" opacity="0.7" />
      <line x1="28" y1="36" x2="60" y2="56" stroke={DETAIL} strokeWidth="0.8" opacity="0.5" />
      <line x1="28" y1="56" x2="60" y2="36" stroke={DETAIL} strokeWidth="0.8" opacity="0.5" />
      {/* inlet nozzle 1 — extends to viewBox edge (x=0) */}
      <line x1="0" y1="36" x2="24" y2="36" stroke={STROKE} strokeWidth="2.2" />
      <rect x="0" y="33" width="6" height="6" fill={METAL_MID} stroke={STROKE} strokeWidth="0.9" />
      {/* inlet nozzle 2 — extends to viewBox edge (x=0) */}
      <line x1="0" y1="52" x2="24" y2="52" stroke={STROKE} strokeWidth="2.2" />
      <rect x="0" y="49" width="6" height="6" fill={METAL_MID} stroke={STROKE} strokeWidth="0.9" />
      {/* outlet nozzle — extends to viewBox edge (x=88) */}
      <line x1="64" y1="44" x2="88" y2="44" stroke={STROKE} strokeWidth="2.4" />
      <rect x="82" y="40" width="6" height="8" fill={METAL_MID} stroke={STROKE} strokeWidth="0.9" />
    </svg>
  );
}

function SeparatorGlyph({ id }: GlyphProps) {
  const gid = `sep-${id}`;
  // trays above and below the feed; feed tray is distinct.
  const upperTrays = [30, 40, 50, 60];
  const lowerTrays = [84, 94, 104, 114];
  const feedY = 72;
  return (
    <svg viewBox="0 0 76 148" {...SVG_PROPS}>
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
      <rect x="22" y="24" width="32" height="100" fill={`url(#${gid})`} stroke={STROKE} strokeWidth="1.2" />
      {/* bottom head */}
      <path d="M22 124 Q38 140 54 124 Z" fill={`url(#${gid})`} stroke={STROKE} strokeWidth="1.2" />

      {/* upper trays (rectifying section) */}
      {upperTrays.map((y) => (
        <line key={`u-${y}`} x1="24" y1={y} x2="52" y2={y} stroke={STROKE} strokeWidth="0.9" opacity="0.85" />
      ))}
      {/* lower trays (stripping section) */}
      {lowerTrays.map((y) => (
        <line key={`l-${y}`} x1="24" y1={y} x2="52" y2={y} stroke={STROKE} strokeWidth="0.9" opacity="0.85" />
      ))}

      {/* feed tray — thicker, distinct */}
      <line x1="24" y1={feedY} x2="52" y2={feedY} stroke={DETAIL} strokeWidth="1.6" />
      <rect x="24" y={feedY - 1} width="28" height="2" fill={DETAIL} opacity="0.4" />

      {/* downcomers with weirs — alternating, with small weir tabs */}
      {upperTrays.map((y, i) =>
        i % 2 === 0 ? (
          <g key={`du-l-${y}`}>
            <rect x="24" y={y} width="3" height="4" fill={STROKE} opacity="0.55" />
            <rect x="27" y={y} width="1.5" height="2" fill={STROKE} opacity="0.7" />
          </g>
        ) : (
          <g key={`du-r-${y}`}>
            <rect x="49" y={y} width="3" height="4" fill={STROKE} opacity="0.55" />
            <rect x="47.5" y={y} width="1.5" height="2" fill={STROKE} opacity="0.7" />
          </g>
        ),
      )}
      {lowerTrays.map((y, i) =>
        i % 2 === 0 ? (
          <g key={`dl-l-${y}`}>
            <rect x="24" y={y} width="3" height="4" fill={STROKE} opacity="0.55" />
            <rect x="27" y={y} width="1.5" height="2" fill={STROKE} opacity="0.7" />
          </g>
        ) : (
          <g key={`dl-r-${y}`}>
            <rect x="49" y={y} width="3" height="4" fill={STROKE} opacity="0.55" />
            <rect x="47.5" y={y} width="1.5" height="2" fill={STROKE} opacity="0.7" />
          </g>
        ),
      )}

      {/* condenser hint (top) — small coil */}
      <path d="M34 14 q4 -3 8 0 q4 3 8 0" fill="none" stroke={DETAIL} strokeWidth="0.8" opacity="0.6" />
      {/* reboiler hint (bottom) — small heating coil */}
      <path d="M34 134 q4 -3 8 0 q4 3 8 0" fill="none" stroke={UTILITY} strokeWidth="0.9" opacity="0.6" />

      {/* feed nozzle — extends to viewBox edge (x=0) */}
      <line x1="0" y1={feedY} x2="22" y2={feedY} stroke={STROKE} strokeWidth="2.4" />
      <rect x="0" y1={feedY - 4} width="6" height="8" fill={METAL_MID} stroke={STROKE} strokeWidth="0.9" />
      {/* vapor outlet — extends to viewBox edge (y=0) */}
      <line x1="38" y1="0" x2="38" y2="8" stroke={STROKE} strokeWidth="2.4" />
      <rect x="35" y="0" width="6" height="6" fill={METAL_MID} stroke={STROKE} strokeWidth="0.9" />
      {/* bottoms outlet — extends to viewBox edge (y=148) */}
      <line x1="38" y1="140" x2="38" y2="148" stroke={STROKE} strokeWidth="2.4" />
      <rect x="35" y="142" width="6" height="6" fill={METAL_MID} stroke={STROKE} strokeWidth="0.9" />
    </svg>
  );
}

function FeedGlyph({ id }: GlyphProps) {
  const gid = `feed-${id}`;
  return (
    <svg viewBox="0 0 104 68" {...SVG_PROPS}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={METAL_DARK} />
          <stop offset="50%" stopColor={METAL_LIGHT} />
          <stop offset="100%" stopColor={METAL_DARK} />
        </linearGradient>
      </defs>
      {/* body */}
      <rect x="16" y="16" width="72" height="36" fill={`url(#${gid})`} stroke={STROKE} strokeWidth="1.2" />
      {/* domed heads */}
      <path d="M16 16 Q6 34 16 52 Z" fill={`url(#${gid})`} stroke={STROKE} strokeWidth="1.2" />
      <path d="M88 16 Q98 34 88 52 Z" fill={`url(#${gid})`} stroke={STROKE} strokeWidth="1.2" />
      {/* liquid level */}
      <line x1="16" y1="42" x2="88" y2="42" stroke={LIQUID} strokeWidth="1" strokeDasharray="3 2" opacity="0.7" />
      <path d="M16 42 L88 42 L88 52 Q98 34 88 16 L16 16 Q6 34 16 52 Z" fill={LIQUID} opacity="0.14" />
      {/* level gauge — vertical glass tube with ticks on the right side */}
      <line x1="92" y1="22" x2="92" y2="46" stroke={DETAIL} strokeWidth="1.2" />
      <line x1="90" y1="26" x2="94" y2="26" stroke={DETAIL} strokeWidth="0.7" />
      <line x1="90" y1="32" x2="94" y2="32" stroke={DETAIL} strokeWidth="0.7" />
      <line x1="90" y1="38" x2="94" y2="38" stroke={DETAIL} strokeWidth="0.7" />
      <line x1="90" y1="44" x2="94" y2="44" stroke={DETAIL} strokeWidth="0.7" />
      {/* liquid in gauge */}
      <line x1="92" y1="40" x2="92" y2="46" stroke={LIQUID} strokeWidth="1.6" />
      {/* "F" label */}
      <text x="52" y="36" textAnchor="middle" fontSize="12" fill={DETAIL} fontWeight="700">F</text>
      {/* outlet nozzle — extends to viewBox edge (x=104) */}
      <line x1="88" y1="34" x2="104" y2="34" stroke={STROKE} strokeWidth="2.4" />
      <rect x="98" y="30" width="6" height="8" fill={METAL_MID} stroke={STROKE} strokeWidth="0.9" />
    </svg>
  );
}

function ProductGlyph({ id }: GlyphProps) {
  const gid = `prod-${id}`;
  return (
    <svg viewBox="0 0 104 68" {...SVG_PROPS}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={METAL_DARK} />
          <stop offset="50%" stopColor={METAL_LIGHT} />
          <stop offset="100%" stopColor={METAL_DARK} />
        </linearGradient>
      </defs>
      {/* body */}
      <rect x="16" y="16" width="72" height="36" fill={`url(#${gid})`} stroke={STROKE} strokeWidth="1.2" />
      {/* domed heads */}
      <path d="M16 16 Q6 34 16 52 Z" fill={`url(#${gid})`} stroke={STROKE} strokeWidth="1.2" />
      <path d="M88 16 Q98 34 88 52 Z" fill={`url(#${gid})`} stroke={STROKE} strokeWidth="1.2" />
      {/* level gauge */}
      <line x1="12" y1="22" x2="12" y2="46" stroke={DETAIL} strokeWidth="1.2" />
      <line x1="10" y1="26" x2="14" y2="26" stroke={DETAIL} strokeWidth="0.7" />
      <line x1="10" y1="32" x2="14" y2="32" stroke={DETAIL} strokeWidth="0.7" />
      <line x1="10" y1="38" x2="14" y2="38" stroke={DETAIL} strokeWidth="0.7" />
      <line x1="10" y1="44" x2="14" y2="44" stroke={DETAIL} strokeWidth="0.7" />
      <line x1="12" y1="30" x2="12" y2="46" stroke={LIQUID} strokeWidth="1.6" />
      {/* "P" label */}
      <text x="52" y="36" textAnchor="middle" fontSize="12" fill={DETAIL} fontWeight="700">P</text>
      {/* inlet nozzle — extends to viewBox edge (x=0) */}
      <line x1="0" y1="34" x2="16" y2="34" stroke={STROKE} strokeWidth="2.4" />
      <rect x="0" y="30" width="6" height="8" fill={METAL_MID} stroke={STROKE} strokeWidth="0.9" />
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
