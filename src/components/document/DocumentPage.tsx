import type { ReactNode } from "react";

export function DocumentPage({
  eyebrow,
  pageNum,
  footerLeft,
  footerRight,
  mark,
  hideHeader = false,
  footerLeftOnDarkGround = false,
  children,
}: {
  eyebrow: string;
  pageNum: string;
  footerLeft: string;
  footerRight: string;
  mark?: ReactNode;
  /** Cover uses its own self-contained header (arch panel), never the shared eyebrow row. */
  hideHeader?: boolean;
  /** Cover: footerLeft sits over the dark arch panel, which the footer's
   * default (page-background-appropriate) dark text has no contrast against. */
  footerLeftOnDarkGround?: boolean;
  children: ReactNode;
}) {
  return (
    <section className="wbs-page">
      {!hideHeader && (
        <div className="wbs-eyebrow-row">
          <span className="wbs-eyebrow">{eyebrow}</span>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            {mark}
            <span className="wbs-page-num">{pageNum}</span>
          </div>
        </div>
      )}
      <div className="wbs-content">{children}</div>
      <div className="wbs-footer">
        <span style={footerLeftOnDarkGround ? { color: "rgba(255, 255, 255, 0.75)" } : undefined}>
          {footerLeft}
        </span>
        <span>{footerRight}</span>
      </div>
    </section>
  );
}
