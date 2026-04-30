import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { checkRateLimit } from "@/lib/rateLimit";
import { log } from "@/lib/log";
import { corsHeadersFor, corsPreflight } from "@/lib/cors";
import { verifyCaptcha } from "@/lib/captcha";
import type { CommunitySubmissionInsert } from "@/lib/database.types";

const AddProductRequest = z.object({
  name: z.string().min(1, "Product name is required").max(200),
  brand: z.string().default("Unknown").transform((s) => s.slice(0, 100)),
  category: z.string().default("food").transform((s) => s.slice(0, 30)),
  ingredients: z.array(z.string().min(1).max(200)).default([]).transform((arr) => arr.slice(0, 100)),
  barcode: z.string().max(64).optional(),
  user_id: z.string().max(100).optional(),
  // hCaptcha token from the frontend widget. Optional in dev (HCAPTCHA_SECRET
  // unset) — verifier no-ops in that case.
  captcha_token: z.string().max(5000).optional(),
});

const corsOpts = { methods: ["POST", "OPTIONS"] as const };

export async function OPTIONS(req: NextRequest): Promise<Response> {
  return corsPreflight(req, corsOpts);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const cors = corsHeadersFor(req, corsOpts);
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
      { status: 429, headers: { ...cors, "Retry-After": String(rl.retryAfter) } },
    );
  }

  try {
    const body = await req.json();
    const parsed = AddProductRequest.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.issues[0]?.message },
        { status: 400, headers: cors },
      );
    }

    const { name, brand, category, ingredients, barcode, user_id, captcha_token } = parsed.data;

    // Captcha gate — no-ops in dev (HCAPTCHA_SECRET unset). Once activated,
    // bots without a valid token are blocked here.
    const captcha = await verifyCaptcha(captcha_token, { ip });
    if (!captcha.ok) {
      log.warn("add_product.captcha_failed", { ip, reason: captcha.reason });
      return NextResponse.json(
        { error: "captcha_failed", details: "Please complete the captcha and try again." },
        { status: 400, headers: cors },
      );
    }

    // Community submission → goes to the moderation queue, not live products.
    // Admins review via /admin's pending tab and approve into `products`.
    const submissionBarcode = barcode || `manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // The community_submissions table only has the columns listed below in
    // production (no `brand` / `category`). The user form still collects
    // those signals — we encode `brand` into product_name so the moderator
    // sees it on review (e.g. "Maggi Noodles (Maggi)"), and pass `category`
    // through to the moderation defaults via the override flow on /admin.
    // A follow-up migration (supabase/migrations/003_*) adds the columns
    // properly; once it's applied, swap this back to a structured insert.
    const productNameForReview =
      brand && brand !== "Unknown" ? `${name} (${brand})` : name;

    const insertRow: CommunitySubmissionInsert = {
      user_id: user_id || "anonymous",
      product_name: productNameForReview,
      barcode: submissionBarcode,
      // No photo for text-form submissions; empty string is stored.
      label_image_url: "",
      extracted_ingredients: ingredients,
      status: "pending",
    };

    const { data: submission, error } = await supabase
      .from("community_submissions")
      // @ts-expect-error supabase-js generic inference loses the table row type
      .insert(insertRow)
      .select()
      .single();

    if (error) {
      log.error("add_product.db_fail", { ip, err: error.message });
      return NextResponse.json(
        { error: "Failed to save submission", details: error.message },
        { status: 500, headers: cors },
      );
    }

    log.info("add_product.submitted", { ip, barcode: submissionBarcode, category });
    return NextResponse.json(
      {
        submission,
        pending: true,
        message: "Submitted for review. We'll add it to the catalog after a moderator verifies the ingredients.",
      },
      { status: 201, headers: cors },
    );
  } catch (error) {
    log.error("add_product.fail", { ip, err: error instanceof Error ? error.message : String(error) });
    const message = error instanceof Error ? error.message : "Failed to add product";
    return NextResponse.json(
      { error: message },
      { status: 500, headers: cors },
    );
  }
}
