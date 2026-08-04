/**
 * Weighted register. Geometry pushed to the page's right edge, contained to
 * a defined zone — for a narrative-heavy page that still needs real weight
 * (room for text and one hero image alongside it).
 */
export function EdgeComposition() {
  return (
    <div className="wbs-edge-composition" aria-hidden="true">
      <div className="wbs-edge-rule" />
      <div className="wbs-edge-panel" />
      <div className="wbs-edge-square" />
      <div className="wbs-edge-disc" />
    </div>
  );
}
