// The approved record's `what_to_avoid` list is one flat array, not tagged
// by category — there's no structured way to know which lines are a
// florist/stylist's concern versus a stationer's or lighting supplier's.
// This is a keyword heuristic, not a data-driven filter: it excludes whole
// lines that read as unambiguously lighting/electrical or stationery/paper,
// and keeps everything else (palette, floral, furniture/linen, general
// styling read) on the assumption that over-including is safer for a
// supplier than silently dropping something that was actually theirs.
const NON_FLORAL_STYLING_PATTERN =
  /fairy light|festoon|edison bulb|uplighting|spotlight|dance floor|\blighting\b|stationery|typeface|wax seal|deckled paper|invitation|place card|menu card/i;

export function floralStylingAvoidList(whatToAvoid: string[]): string[] {
  return whatToAvoid.filter((item) => !NON_FLORAL_STYLING_PATTERN.test(item));
}
