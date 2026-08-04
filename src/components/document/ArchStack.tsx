import type { CSSProperties } from "react";

/**
 * Weighted register — the primary device. Reserved for the page carrying
 * the central idea (the cover has its own distinct full-bleed treatment).
 * 2-3 layered, shadowed arch shapes contained to a defined zone, plus one
 * small accent circle — never a full-bleed dark background. Mirrors
 * design/wedding-brief-studio-composition-devices.html.
 */
export function ArchStack({ compact = false }: { compact?: boolean }) {
  const stackStyle: CSSProperties | undefined = compact ? { height: 190 } : undefined;
  const backStyle: CSSProperties | undefined = compact ? { height: 160 } : undefined;
  const midStyle: CSSProperties | undefined = compact ? { height: 130 } : undefined;
  const frontStyle: CSSProperties | undefined = compact ? { height: 96 } : undefined;
  const accentStyle: CSSProperties | undefined = compact ? { bottom: 96 } : undefined;

  return (
    <div className="wbs-depth-stack" style={stackStyle}>
      <div className="wbs-depth-arch wbs-arch-back" style={backStyle} />
      <div className="wbs-depth-arch wbs-arch-mid" style={midStyle} />
      <div className="wbs-depth-arch wbs-arch-front" style={frontStyle} />
      <div className="wbs-arch-accent" style={accentStyle} />
    </div>
  );
}
