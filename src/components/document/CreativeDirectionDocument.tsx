import "./document.css";
import { resolveStylePreset, presetCssVars } from "@/lib/document/presets";
import type { CreativeDirectionDocumentData } from "@/lib/document/types";
import { plexMono, plexSans, beauRivage } from "./fonts";
import { CoverPage } from "./pages/CoverPage";
import { WhatWeUnderstoodPage } from "./pages/WhatWeUnderstoodPage";
import { VisualDirectionImagesPage } from "./pages/VisualDirectionImagesPage";
import { VisualDirectionColourPage } from "./pages/VisualDirectionColourPage";
import { VisualDirectionMomentsPage } from "./pages/VisualDirectionMomentsPage";
import { DirectionSpelledOutPage } from "./pages/DirectionSpelledOutPage";
import { BudgetTiersPage } from "./pages/BudgetTiersPage";
import { OpenQuestionsPage } from "./pages/OpenQuestionsPage";
import { SignOffPage } from "./pages/SignOffPage";

export function CreativeDirectionDocument({ data }: { data: CreativeDirectionDocumentData }) {
  const tokens = resolveStylePreset(data.preset);

  return (
    <div
      className={`wbs-doc ${plexMono.variable} ${plexSans.variable} ${beauRivage.variable}`}
      style={presetCssVars(tokens)}
    >
      <CoverPage data={data} />
      <WhatWeUnderstoodPage data={data} />
      <VisualDirectionImagesPage data={data} />
      <VisualDirectionColourPage data={data} />
      <VisualDirectionMomentsPage data={data} />
      <DirectionSpelledOutPage data={data} />
      <BudgetTiersPage data={data} />
      <OpenQuestionsPage data={data} />
      <SignOffPage data={data} />
    </div>
  );
}
