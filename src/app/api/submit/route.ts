import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { analyzeLabel } from "@/lib/scoring";

// ── Validation ──────────────────────────────────────────────────────────────────

const SubmitRequest = z.object({
  product_name: z.string().min(1, "Product name is required"),
  barcode: z.string().optional(),
  label_image: z.string().min(100, "Label image data is too short to be valid"),
  extracted_ingredients: z.array(z.string().min(1)).optional(),
  user_id: z.string().optional(),
});

// ── Helpers ─────────────────────────────────────────────────────────────────────

function corsHeaders(): HeadersInit {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "X-RateLimit-Limit": "10",
    "X-RateLimit-Remaining": "9",
    "X-RateLimit-Reset": String(Math.floor(Date.now() / 1000) + 60),
  };
}

function errorResponse(message: string, status: number, details?: string): NextResponse {
  return NextResponse.json(
    { error: message, ...(details ? { details } : {}) },
    { status, headers: corsHeaders() }
  );
}

// ── Handler ─────────────────────────────────────────────────────────────────────

export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const parsed = SubmitRequest.safeParse(body);

    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      return errorResponse("Invalid request", 400, firstIssue?.message);
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
      return errorResponse("Failed to save submission", 500, error.message);
    }

    return NextResponse.json(
      {
        submission,
        extracted: { ingredients, label_data: labelData },
      },
      { status: 201, headers: corsHeaders() }
    );
  } catch (error) {
    console.error("Submit error:", error);
    const message = error instanceof Error ? error.message : "Submission failed";
    return errorResponse(message, 500);
  }
}
