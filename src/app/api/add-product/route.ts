import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { checkRateLimit } from "@/lib/rateLimit";
import { log } from "@/lib/log";

const AddProductRequest = z.object({
  name: z.string().min(1, "Product name is required"),
  brand: z.string().default("Unknown"),
  category: z.string().default("food"),
  ingredients: z.array(z.string()).default([]),
  barcode: z.string().optional(),
  user_id: z.string().optional(),
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
  const rl = checkRateLimit(`add-product:${ip}`, { capacity: 5, refillPerMin: 5 / 60 });
  if (!rl.ok) {
    log.warn("add_product.rate_limited", { ip, retryAfter: rl.retryAfter });
    return NextResponse.json(
      {
        error: "Too many submissions",
        details: `Try again in ${Math.ceil(rl.retryAfter / 60)} minutes.`,
        retryAfter: rl.retryAfter,
      },
      { status: 429, headers: { ...corsHeaders(), "Retry-After": String(rl.retryAfter) } },
    );
  }

  try {
    const body = await req.json();
    const parsed = AddProductRequest.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.issues[0]?.message },
        { status: 400, headers: corsHeaders() },
      );
    }

    const { name, brand, category, ingredients, barcode, user_id } = parsed.data;

    // Community submission → goes to the moderation queue, not live products.
    // Admins review via /admin's pending tab and approve into `products`.
    const submissionBarcode = barcode || `manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const { data: submission, error } = await supabase
      .from("community_submissions")
      // @ts-expect-error generated types don't include the extra product fields
      .insert({
        user_id: user_id || "anonymous",
        product_name: name,
        barcode: submissionBarcode,
        // No photo for text-form submissions; empty string is stored.
        label_image_url: "",
        extracted_ingredients: ingredients,
        status: "pending" as const,
        // Extra context the moderator will want on review
        brand,
        category,
      })
      .select()
      .single();

    if (error) {
      log.error("add_product.db_fail", { ip, err: error.message });
      return NextResponse.json(
        { error: "Failed to save submission", details: error.message },
        { status: 500, headers: corsHeaders() },
      );
    }

    log.info("add_product.submitted", { ip, barcode: submissionBarcode, category });
    return NextResponse.json(
      {
        submission,
        pending: true,
        message: "Submitted for review. We'll add it to the catalog after a moderator verifies the ingredients.",
      },
      { status: 201, headers: corsHeaders() },
    );
  } catch (error) {
    log.error("add_product.fail", { ip, err: error instanceof Error ? error.message : String(error) });
    const message = error instanceof Error ? error.message : "Failed to add product";
    return NextResponse.json(
      { error: message },
      { status: 500, headers: corsHeaders() },
    );
  }
}
