export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getPersonalizedWarnings } from "@/lib/scoring";
import { log } from "@/lib/log";
import { checkRateLimit } from "@/lib/rateLimit";

const PersonalizeRequest = z.object({
  ingredients: z.array(z.string().min(1)).min(1, "Ingredients required"),
  conditions: z.array(z.string()).default([]),
  allergies: z.array(z.string()).default([]),
});

function corsHeaders(): HeadersInit {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rl = checkRateLimit(`personalize:${ip}`, { capacity: 20, refillPerMin: 20 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Rate limit exceeded", retryAfter: rl.retryAfter },
      { status: 429, headers: { ...corsHeaders(), "Retry-After": String(rl.retryAfter) } },
    );
  }

  try {
    const body = await req.json();
    const parsed = PersonalizeRequest.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.issues[0]?.message },
        { status: 400, headers: corsHeaders() },
      );
    }

    const { ingredients, conditions, allergies } = parsed.data;

    // Nothing to personalize against — return empty cleanly.
    if (conditions.length === 0 && allergies.length === 0) {
      return NextResponse.json({ warnings: [] }, { headers: corsHeaders() });
    }

    const warnings = await getPersonalizedWarnings(ingredients, conditions, allergies);
    log.info("personalize.ok", { ingredientCount: ingredients.length, conditionCount: conditions.length, allergyCount: allergies.length, warningCount: warnings.length });
    return NextResponse.json({ warnings }, { headers: corsHeaders() });
  } catch (err) {
    log.error("personalize.fail", { err: err instanceof Error ? err.message : String(err) });
    const message = err instanceof Error ? err.message : "Personalization failed";
    const isRateLimit = /rate|quota|429|resource_exhausted/i.test(message);
    return NextResponse.json(
      { error: isRateLimit ? "AI temporarily unavailable" : "Personalization failed" },
      { status: isRateLimit ? 429 : 500, headers: corsHeaders() },
    );
  }
}
