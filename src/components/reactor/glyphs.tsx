/**
 * P&ID-style reactor glyphs.
 * ---------------------------------------------------------------
 * Clean vector line art rendered as SVG so nodes are crisp at any zoom.
 * Each glyph draws into a 64x64 viewBox; stroke width and color are
 * driven by the node's solver status (nominal=blue, warning=amber,
 * error=red).
 */
import type { SolverResult } from "@/lib/solvers";

const STATUS_STROKE: Record<SolverResult["status"], string> = {
  nominal: "#3b82f6",
  warning: "#f59e0b",
  error: "#ef4444",
};

const STATUS_FILL: Record<SolverResult["status"], string> = {
  nominal: "rgba(59,130,246,0.10)",
  warning: "rgba(245,158,11,0.10)",
  error: "rgba(239,68,68,0.12)",
};

interface GlyphProps {
  status: SolverResult["status"];
}

export function CstrGlyph({ status }: GlyphProps) {
  const stroke = STATUS_STROKE[status];
  const fill = STATUS_FILL[status];
  return (
    <svg viewBox="0 0 64 64" className="h-full w-full" aria-hidden>
      {/* vessel */}
      <rect x="12" y="8" width="40" height="48" rx="6" fill={fill} stroke={stroke} strokeWidth="2" />
      {/* agitator */}
      <line x1="32" y1="2" x2="32" y2="20" stroke={stroke} strokeWidth="2" />
      <circle cx="32" cy="2" r="2.5" fill={stroke} />
      <line x1="22" y1="20" x2="42" y2="20" stroke={stroke} strokeWidth="2" />
      {/* impeller blades */}
      <line x1="22" y1="20" x2="22" y2="30" stroke={stroke} strokeWidth="2" />
      <line x1="42" y1="20" x2="42" y2="30" stroke={stroke} strokeWidth="2" />
      <line x1="32" y1="20" x2="32" y2="34" stroke={stroke} strokeWidth="2" />
      {/* liquid level */}
      <path d="M16 36 Q32 32 48 36" fill="none" stroke={stroke} strokeWidth="1.4" opacity="0.7" />
      {/* ports */}
      <line x1="2" y1="44" x2="12" y2="44" stroke={stroke} strokeWidth="2" />
      <line x1="52" y1="44" x2="62" y2="44" stroke={stroke} strokeWidth="2" />
    </svg>
  );
}

export function PfrGlyph({ status }: GlyphProps) {
  const stroke = STATUS_STROKE[status];
  const fill = STATUS_FILL[status];
  return (
    <svg viewBox="0 0 64 64" className="h-full w-full" aria-hidden>
      {/* tube — coiled representation */}
      <path
        d="M6 16 H58 M6 32 H58 M6 48 H58"
        fill="none"
        stroke={stroke}
        strokeWidth="2"
      />
      {/* connect tubes into a serpentine */}
      <path d="M58 16 V32 M6 32 V48" fill="none" stroke={stroke} strokeWidth="2" />
      {/* inlet/outlet caps */}
      <circle cx="6" cy="16" r="2.5" fill={stroke} />
      <circle cx="6" cy="48" r="2.5" fill={stroke} />
      <rect x="2" y="8" width="8" height="8" fill={fill} stroke={stroke} strokeWidth="1.5" />
      <rect x="2" y="48" width="8" height="8" fill={fill} stroke={stroke} strokeWidth="1.5" />
      {/* flow tick */}
      <path d="M28 24 l4 -3 l0 6 z" fill={stroke} opacity="0.8" />
      <path d="M28 40 l4 -3 l0 6 z" fill={stroke} opacity="0.8" />
    </svg>
  );
}

export function MixerGlyph({ status }: GlyphProps) {
  const stroke = STATUS_STROKE[status];
  const fill = STATUS_FILL[status];
  return (
    <svg viewBox="0 0 64 64" className="h-full w-full" aria-hidden>
      {/* inverted-Y tee */}
      <circle cx="32" cy="32" r="13" fill={fill} stroke={stroke} strokeWidth="2" />
      <path d="M32 19 L20 6" stroke={stroke} strokeWidth="2" />
      <path d="M32 19 L44 6" stroke={stroke} strokeWidth="2" />
      <path d="M32 45 L32 60" stroke={stroke} strokeWidth="2" />
      <line x1="14" y1="6" x2="26" y2="6" stroke={stroke} strokeWidth="2" />
      <line x1="38" y1="6" x2="50" y2="6" stroke={stroke} strokeWidth="2" />
      {/* cross mixer blades */}
      <line x1="24" y1="32" x2="40" y2="32" stroke={stroke} strokeWidth="1.6" opacity="0.7" />
      <line x1="32" y1="24" x2="32" y2="40" stroke={stroke} strokeWidth="1.6" opacity="0.7" />
    </svg>
  );
}

export function SeparatorGlyph({ status }: GlyphProps) {
  const stroke = STATUS_STROKE[status];
  const fill = STATUS_FILL[status];
  return (
    <svg viewBox="0 0 64 64" className="h-full w-full" aria-hidden>
      {/* vertical vessel */}
      <path
        d="M22 6 L42 6 L46 20 L46 52 L42 60 L22 60 L18 52 L18 20 Z"
        fill={fill}
        stroke={stroke}
        strokeWidth="2"
      />
      {/* tray lines */}
      <line x1="20" y1="26" x2="44" y2="26" stroke={stroke} strokeWidth="1.4" opacity="0.7" />
      <line x1="20" y1="36" x2="44" y2="36" stroke={stroke} strokeWidth="1.4" opacity="0.7" />
      <line x1="20" y1="46" x2="44" y2="46" stroke={stroke} strokeWidth="1.4" opacity="0.7" />
      {/* top (lights) + bottom (heavies) ports */}
      <line x1="32" y1="2" x2="32" y2="6" stroke={stroke} strokeWidth="2" />
      <line x1="32" y1="60" x2="32" y2="64" stroke={stroke} strokeWidth="2" />
      <line x1="6" y1="40" x2="18" y2="40" stroke={stroke} strokeWidth="2" />
    </svg>
  );
}

export function FeedGlyph({ status }: GlyphProps) {
  const stroke = STATUS_STROKE[status];
  const fill = STATUS_FILL[status];
  return (
    <svg viewBox="0 0 64 64" className="h-full w-full" aria-hidden>
      <polygon points="6,10 50,10 50,54 6,54" fill={fill} stroke={stroke} strokeWidth="2" />
      {/* level */}
      <line x1="6" y1="40" x2="50" y2="40" stroke={stroke} strokeWidth="1.4" opacity="0.6" />
      <line x1="50" y1="32" x2="62" y2="32" stroke={stroke} strokeWidth="2" />
      <text x="28" y="36" textAnchor="middle" fontSize="13" fill={stroke} fontWeight="700">F</text>
    </svg>
  );
}

export function ProductGlyph({ status }: GlyphProps) {
  const stroke = STATUS_STROKE[status];
  const fill = STATUS_FILL[status];
  return (
    <svg viewBox="0 0 64 64" className="h-full w-full" aria-hidden>
      <polygon points="14,8 50,8 58,32 50,56 14,56 6,32" fill={fill} stroke={stroke} strokeWidth="2" />
      <line x1="0" y1="32" x2="6" y2="32" stroke={stroke} strokeWidth="2" />
      <text x="32" y="38" textAnchor="middle" fontSize="13" fill={stroke} fontWeight="700">P</text>
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
