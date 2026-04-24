export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { translateAnalysis } from "@/lib/scoring";
import { checkRateLimit } from "@/lib/rateLimit";
import { log } from "@/lib/log";
import type { SafetyAnalysis } from "@/lib/scoring";

const TranslateRequest = z.object({
  analysis: z.object({
    score: z.number(),
    grade: z.enum(["A", "B", "C", "D", "E"]),
    summary: z.string(),
    ingredients: z.array(
      z.object({
        name: z.string(),
        risk_level: z.enum(["safe", "caution", "warning", "danger"]),
        explanation: z.string(),
      }),
    ),
    warnings: z.array(z.string()),
    healthier_tip: z.string().optional(),
    healthier_alternative: z.string().optional(),
  }),
  targetLang: z.enum(["hi"]),
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
  const rl = checkRateLimit(`translate:${ip}`, { capacity: 30, refillPerMin: 30 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Rate limit exceeded", retryAfter: rl.retryAfter },
      { status: 429, headers: { ...corsHeaders(), "Retry-After": String(rl.retryAfter) } },
    );
  }

  try {
    const body = await req.json();
    const parsed = TranslateRequest.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.issues[0]?.message },
        { status: 400, headers: corsHeaders() },
      );
    }

    // Normalize analysis shape: the app passes either the server
    // SafetyAnalysis (with healthier_tip) or the UI-facing form (with
    // healthier_alternative). translateAnalysis expects healthier_tip.
    const incoming = parsed.data.analysis as unknown as Record<string, unknown>;
    const normalized: SafetyAnalysis = {
      score: incoming.score as number,
      grade: incoming.grade as SafetyAnalysis["grade"],
      summary: (incoming.summary as string) || "",
      ingredients: (incoming.ingredients as SafetyAnalysis["ingredients"]) || [],
      warnings: (incoming.warnings as string[]) || [],
      healthier_tip: (incoming.healthier_tip as string) || (incoming.healthier_alternative as string) || "",
    };

    const translated = await translateAnalysis(normalized, parsed.data.targetLang);
    log.info("translate.ok", { ip, targetLang: parsed.data.targetLang, ingredients: translated.ingredients.length });
    return NextResponse.json({ analysis: translated }, { headers: corsHeaders() });
  } catch (err) {
    log.error("translate.fail", { ip, err: err instanceof Error ? err.message : String(err) });
    const message = err instanceof Error ? err.message : "Translation failed";
    const isRateLimit = /rate|quota|429|resource_exhausted/i.test(message);
    return NextResponse.json(
      { error: isRateLimit ? "AI temporarily unavailable" : "Translation failed" },
      { status: isRateLimit ? 429 : 500, headers: corsHeaders() },
    );
  }
}
