import { NextRequest } from "next/server";
import { json } from "@/lib/http";
import { getStore, withStore } from "@/lib/store";
import { DEFAULT_SETTINGS, type AppSettings } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return json({ settings: getStore().settings });
}

export async function PUT(req: NextRequest) {
  const body = (await req.json()) as AppSettings;
  const settings = withStore((store) => {
    store.settings = {
      weights: { ...DEFAULT_SETTINGS.weights, ...body.weights },
      rules: {
        ...DEFAULT_SETTINGS.rules,
        ...body.rules,
        mandatoryFields: body.rules?.mandatoryFields ?? store.settings.rules.mandatoryFields,
        expectedSections: body.rules?.expectedSections ?? store.settings.rules.expectedSections,
      },
      geminiApiKey: body.geminiApiKey,
    };
    const sum = Object.values(store.settings.weights).reduce((a, b) => a + b, 0);
    if (sum <= 0) store.settings.weights = { ...DEFAULT_SETTINGS.weights };
    return store.settings;
  });
  return json({ settings });
}
