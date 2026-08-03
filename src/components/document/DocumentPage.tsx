import type { ReactNode } from "react";

export function DocumentPage({
  eyebrow,
  pageNum,
  footerLeft,
  footerRight,
  mark,
  children,
}: {
  eyebrow: string;
  pageNum: string;
  footerLeft: string;
  footerRight: string;
  mark?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="wbs-page">
      <div className="wbs-eyebrow-row">
        <span className="wbs-eyebrow">{eyebrow}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          {mark}
          <span className="wbs-page-num">{pageNum}</span>
        </div>
      </div>
      <div className="wbs-content">{children}</div>
      <div className="wbs-footer">
        <span>{footerLeft}</span>
        <span>{footerRight}</span>
      </div>
    </section>
  );
}
