/**
 * Gestural register. The brand mark as a line study, almost no ink — for a
 * quieter page that still needs to stay recognisably this studio without
 * carrying the arch stack's full weight.
 */
export function FineLineArch() {
  return (
    <svg
      className="wbs-fine-line-arch"
      viewBox="0 0 460 260"
      width="380"
      height="215"
      aria-hidden="true"
    >
      <path
        d="M 40 260 L 40 140 A 90 90 0 0 1 220 140 L 220 260"
        fill="none"
        stroke="var(--panel1)"
        strokeWidth="1.3"
        opacity="0.9"
      />
      <path
        d="M 90 260 L 90 155 A 65 65 0 0 1 220 155 L 220 260"
        fill="none"
        stroke="var(--panel2)"
        strokeWidth="1"
        opacity="0.7"
      />
      <path
        d="M 260 260 L 260 170 A 50 50 0 0 1 360 170 L 360 260"
        fill="none"
        stroke="var(--deepest)"
        strokeWidth="1.3"
        opacity="0.85"
      />
      <circle cx="300" cy="140" r="9" fill="none" stroke="var(--accent)" strokeWidth="1.4" />
      <circle cx="300" cy="140" r="9" fill="var(--accent)" opacity="0.9" />
    </svg>
  );
}
