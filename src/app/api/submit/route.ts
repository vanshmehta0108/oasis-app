import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { analyzeLabel } from "@/lib/scoring";
import { corsHeadersFor, corsPreflight } from "@/lib/cors";

// ── Validation ──────────────────────────────────────────────────────────────────

const SubmitRequest = z.object({
  product_name: z.string().min(1, "Product name is required").max(200),
  barcode: z.string().max(64).optional(),
  // Label image as base64 data URL — capped at ~7MB raw image (10MB base64).
  label_image: z.string().min(100, "Label image data is too short to be valid").max(10_000_000, "Image too large — keep under 7MB"),
  extracted_ingredients: z.array(z.string().min(1).max(200)).max(100).optional(),
  user_id: z.string().max(100).optional(),
});

// ── Helpers ─────────────────────────────────────────────────────────────────────

const corsOpts = { methods: ["POST", "OPTIONS"] as const };

function errorResponse(req: NextRequest, message: string, status: number, details?: string): NextResponse {
  return NextResponse.json(
    { error: message, ...(details ? { details } : {}) },
    { status, headers: corsHeadersFor(req, corsOpts) }
  );
}

// ── Handler ─────────────────────────────────────────────────────────────────────

export async function OPTIONS(req: NextRequest): Promise<Response> {
  return corsPreflight(req, corsOpts);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const cors = corsHeadersFor(req, corsOpts);
  try {
    const body = await req.json();
    const parsed = SubmitRequest.safeParse(body);

    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      return errorResponse(req, "Invalid request", 400, firstIssue?.message);
    }

    const { product_name, barcode, label_image, extracted_ingredients, user_id } = parsed.data;

    let ingredients = extracted_ingredients ?? [];
    let labelData = null;

    // Auto-extract ingredients from image if not provided
    if (ingredients.length === 0) {
      labelData = await analyzeLabel(label_image);
      ingredients = labelData.ingredients;
    }

    const { data: submission, error } = await supabase
      .from("community_submissions")
      // @ts-expect-error Supabase generic typing mismatch
      .insert({
        user_id: user_id ?? "anonymous",
        product_name: labelData?.product_name ?? product_name,
        barcode: barcode ?? "",
        label_image_url: label_image.substring(0, 200) + "...",
        extracted_ingredients: ingredients,
        status: "pending" as const,
      })
      .select()
      .single();

    if (error) {
      console.error("Submission error:", error);
      return errorResponse(req, "Failed to save submission", 500, error.message);
    }

    return NextResponse.json(
      {
        submission,
        extracted: { ingredients, label_data: labelData },
      },
      { status: 201, headers: cors }
    );
  } catch (error) {
    console.error("Submit error:", error);
    const message = error instanceof Error ? error.message : "Submission failed";
    return errorResponse(req, message, 500);
  }
}
