import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { lookupFSSAIOnline } from "@/lib/scoring";
import { supabase } from "@/lib/supabase";

const SENTINEL = "FSSAI_NOT_FOUND";

const LookupRequest = z.object({
  name: z.string().min(1),
  brand: z.string().min(1),
  barcode: z.string().optional(),
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
  try {
    const body = await req.json();
    const parsed = LookupRequest.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400, headers: corsHeaders() });
    }

    const { name, brand, barcode } = parsed.data;

    // If barcode given, check DB first — may already be set (or sentinel)
    if (barcode) {
      // @ts-ignore — Supabase generic typing
      const { data: existing } = await supabase
        .from("products")
        .select("fssai_license")
        .eq("barcode", barcode)
        .single();

      // @ts-ignore
      if (existing && existing.fssai_license !== null) {
        // @ts-ignore
        const license = existing.fssai_license === SENTINEL ? null : existing.fssai_license as string;
        return NextResponse.json({ license, found: !!license }, { headers: corsHeaders() });
      }
    }

    // Use Gemini search grounding to find FSSAI license
    const license = await lookupFSSAIOnline(name, brand);

    // Persist result to DB to avoid re-querying
    if (barcode) {
      await supabase
        .from("products")
        // @ts-ignore — Supabase generic typing mismatch on partial update
        .update({ fssai_license: license ?? SENTINEL })
        .eq("barcode", barcode);
    }

    return NextResponse.json({ license, found: !!license }, { headers: corsHeaders() });
  } catch (error) {
    console.error("FSSAI lookup error:", error);
    return NextResponse.json({ error: "Lookup failed", license: null, found: false }, { status: 500, headers: corsHeaders() });
  }
}
