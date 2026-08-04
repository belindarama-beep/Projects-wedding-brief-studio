/**
 * Functional register. Colour shown as atmosphere doing content work, not
 * decorative swatches — for any page naming several distinct colour or
 * material decisions at once. Role labels are generic across all four
 * presets: panel1/panel2 are each preset's dark anchors, soft/accent are
 * their light counterparts, per the brand guidelines' colour system.
 */
export function ColourRail() {
  return (
    <div className="wbs-colour-rail">
      <div
        className="wbs-rail"
        style={{
          background:
            "linear-gradient(to bottom, var(--accent) 0 25%, var(--panel1) 25% 54%, var(--panel2) 54% 78%, var(--soft) 78%)",
        }}
      />
      <div className="wbs-rail-cards">
        <div className="wbs-rail-card" style={{ background: "var(--panel1)", color: "#fff" }}>
          Primary depth
        </div>
        <div className="wbs-rail-card" style={{ background: "var(--soft)", color: "#302A22" }}>
          Warm neutral ground
        </div>
        <div className="wbs-rail-card" style={{ background: "var(--panel2)", color: "#fff" }}>
          Structural cool
        </div>
        <div className="wbs-rail-card" style={{ background: "var(--accent)", color: "#302A22" }}>
          Held warmth
        </div>
      </div>
    </div>
  );
}
