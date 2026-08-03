// Token source of truth: design/wedding-brief-studio-brand-guidelines-v2.html
// Four approved presets. "Nocturnal + Botanical" and "Dusty Teal" were cut
// for lacking a genuine dark anchor — don't resurrect those slugs.
import type { CSSProperties } from "react";

export type StylePresetSlug =
  | "terracotta-architecture"
  | "ancient-rose"
  | "fig"
  | "lilac-sage";

export type StylePresetTokens = {
  name: string;
  panel1: string;
  panel2: string;
  soft: string;
  accent: string;
  deepest: string;
};

export const STYLE_PRESETS: Record<StylePresetSlug, StylePresetTokens> = {
  "terracotta-architecture": {
    name: "Terracotta & Architecture",
    panel1: "#432430",
    panel2: "#2A3548",
    soft: "#CEB3AB",
    accent: "#E8AC97",
    deepest: "#0F0807",
  },
  "ancient-rose": {
    name: "Ancient Rose",
    panel1: "#470020",
    panel2: "#8D3E7C",
    soft: "#FFF2C5",
    accent: "#24403A",
    deepest: "#470020",
  },
  fig: {
    name: "Fig",
    panel1: "#4f364b",
    panel2: "#0b0b09",
    soft: "#cabad7",
    accent: "#db3e1d",
    deepest: "#0b0b09",
  },
  "lilac-sage": {
    name: "Lilac & Sage",
    panel1: "#785768",
    panel2: "#1a0811",
    soft: "#DADBBC",
    accent: "#9E929E",
    deepest: "#1a0811",
  },
};

export const DEFAULT_STYLE_PRESET: StylePresetSlug = "terracotta-architecture";

export function isStylePresetSlug(value: string | null | undefined): value is StylePresetSlug {
  return !!value && value in STYLE_PRESETS;
}

export function resolveStylePreset(value: string | null | undefined): StylePresetTokens {
  return STYLE_PRESETS[isStylePresetSlug(value) ? value : DEFAULT_STYLE_PRESET];
}

export function presetCssVars(tokens: StylePresetTokens): CSSProperties {
  return {
    "--panel1": tokens.panel1,
    "--panel2": tokens.panel2,
    "--soft": tokens.soft,
    "--accent": tokens.accent,
    "--deepest": tokens.deepest,
  } as CSSProperties;
}
