/**
 * Gestural register. One elongated plane that changes direction once, like a
 * fold in paper or draped fabric, with a small tucked plane where it turns.
 * One more beat of variety on a light page; never carries content the way
 * the colour rail does.
 */
export function ContourFold({ compact = false }: { compact?: boolean }) {
  const size = compact ? { width: 260, height: 150 } : { width: 380, height: 220 };
  return (
    <svg
      className="wbs-contour-fold"
      viewBox="0 0 380 220"
      width={size.width}
      height={size.height}
      aria-hidden="true"
    >
      <path
        d="M 38 175
           C 85 155 150 60 200 32
           C 255 15 300 70 322 128
           C 328 138 320 148 306 152
           C 268 148 220 110 185 85
           C 130 100 70 160 38 175
           Z"
        fill="var(--panel1)"
      />
      <path
        d="M 218 108
           L 252 60
           L 292 100
           Q 255 118 218 108
           Z"
        fill="var(--accent)"
      />
    </svg>
  );
}
