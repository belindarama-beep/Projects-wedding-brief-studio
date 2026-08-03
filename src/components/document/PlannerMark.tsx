export function PlannerMark({
  logoUrl,
  businessName,
}: {
  logoUrl: string | null;
  businessName: string | null;
}) {
  if (logoUrl) {
    return (
      <span className="wbs-mark">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoUrl} alt={businessName ?? "Planner logo"} />
      </span>
    );
  }
  return (
    <span className="wbs-mark">
      <span className="wbs-mark-wordmark">{businessName ?? "Your Studio"}</span>
    </span>
  );
}
