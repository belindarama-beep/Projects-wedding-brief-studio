import type { ReactNode } from "react";

export function Callout({
  eyebrow,
  children,
  tiltRight = false,
}: {
  eyebrow: string;
  children: ReactNode;
  tiltRight?: boolean;
}) {
  return (
    <div className={`wbs-callout${tiltRight ? " wbs-tilt-r" : ""}`}>
      <div className="wbs-callout-eyebrow">{eyebrow}</div>
      <div className="wbs-callout-body">{children}</div>
    </div>
  );
}

export function HandNote({ children }: { children: ReactNode }) {
  return <div className="wbs-hand-note">{children}</div>;
}
