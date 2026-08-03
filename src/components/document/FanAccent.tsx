import type { CSSProperties } from "react";

/** Pleated fan motif — texture, subordinate to the arch. At most once per page. */
export function FanAccent({ style }: { style?: CSSProperties }) {
  return (
    <div className="wbs-fan-accent" style={style}>
      <svg viewBox="0 0 90 70" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
        <g stroke="var(--panel1)" strokeWidth="1.4" fill="none" opacity={0.55}>
          <path d="M4 68 Q45 4 86 68" />
          <path d="M16 68 Q45 16 74 68" />
          <path d="M28 68 Q45 28 62 68" />
          <path d="M40 68 Q45 40 50 68" />
        </g>
      </svg>
    </div>
  );
}
