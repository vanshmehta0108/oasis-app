import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { upsertProduct } from "@/lib/db";
import type { ScoreGrade } from "@/lib/database.types";

const AddProductRequest = z.object({
  name: z.string().min(1, "Product name is required"),
  brand: z.string().default("Unknown"),
  category: z.string().default("food"),
  ingredients: z.array(z.string()).default([]),
  barcode: z.string().optional(),
  image_url: z.string().optional(),
  analysis: z
    .object({
      score: z.number(),
      grade: z.string(),
      summary: z.string(),
      ingredients: z.array(
        z.object({
          name: z.string(),
          risk_level: z.string(),
          explanation: z.string(),
        })
      ),
      warnings: z.array(z.string()),
      healthier_tip: z.string().optional(),
    })
    .optional(),
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
    const parsed = AddProductRequest.safeParse(body);

    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      return NextResponse.json(
        { error: "Invalid request", details: firstIssue?.message },
        { status: 400, headers: corsHeaders() }
      );
    }

    const { name, brand, category, ingredients, barcode, image_url, analysis } =
      parsed.data;

    // Generate a barcode if none provided (use timestamp + random)
    const finalBarcode =
      barcode || `manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const validCategories = [
      "food",
      "beverage",
      "snack",
      "dairy",
      "baby_food",
      "skincare",
      "haircare",
      "cosmetic",
      "household",
      "water",
    ];
    const mappedCategory = validCategories.includes(category) ? category : "food";

    const product = await upsertProduct({
      barcode: finalBarcode,
      name,
      brand,
      category: mappedCategory as "food",
      ingredients,
      image_url: image_url || null,
      ...(analysis
        ? {
            safety_score: analysis.score,
            score_grade: analysis.grade as ScoreGrade,
            analysis: {
              ...analysis,
              healthier_alternative: analysis.healthier_tip,
            },
          }
        : {}),
    });

    return NextResponse.json(
      { product },
      { status: 201, headers: corsHeaders() }
    );
  } catch (error) {
    console.error("Add product error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to add product";
    return NextResponse.json(
      { error: message },
      { status: 500, headers: corsHeaders() }
    );
  }
}
