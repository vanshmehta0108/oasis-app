"use client";

import { Suspense, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, Plus, Loader2, Camera, Trash2 } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const CATEGORIES = [
  { label: "Food", value: "food" },
  { label: "Beverage", value: "beverage" },
  { label: "Snack", value: "snack" },
  { label: "Dairy", value: "dairy" },
  { label: "Skincare", value: "skincare" },
  { label: "Baby Food", value: "baby_food" },
  { label: "Household", value: "household" },
];

export default function AddProductPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh gradient-mesh flex items-center justify-center"><Loader2 size={24} className="text-oasis-green animate-spin" /></div>}>
      <AddProductForm />
    </Suspense>
  );
}

function AddProductForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefillBarcode = searchParams.get("barcode") || "";

  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [barcode, setBarcode] = useState(prefillBarcode);
  const [category, setCategory] = useState("food");
  const [ingredientInput, setIngredientInput] = useState("");
  const [ingredients, setIngredients] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [extracting, setExtracting] = useState(false);

  const addIngredient = () => {
    const trimmed = ingredientInput.trim();
    if (trimmed && !ingredients.includes(trimmed)) {
      setIngredients((prev) => [...prev, trimmed]);
      setIngredientInput("");
    }
  };

  const addBulkIngredients = (text: string) => {
    const items = text
      .split(/[,\n]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    setIngredients((prev) => {
      const combined = [...prev];
      for (const item of items) {
        if (!combined.includes(item)) combined.push(item);
      }
      return combined;
    });
    setIngredientInput("");
  };

  const removeIngredient = (index: number) => {
    setIngredients((prev) => prev.filter((_, i) => i !== index));
  };

  const handlePhotoExtract = useCallback(async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.capture = "environment";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      setExtracting(true);
      setError("");

      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64 = reader.result as string;
          const res = await fetch("/api/analyze", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ image: base64 }),
          });

          if (res.ok) {
            const data = await res.json();
            const extraction = data.label_extraction;
            if (extraction) {
              if (extraction.product_name && !name) setName(extraction.product_name);
              if (extraction.brand && !brand) setBrand(extraction.brand);
              if (extraction.category_guess) {
                const cat = extraction.category_guess.toLowerCase();
                if (CATEGORIES.some((c) => c.value === cat)) setCategory(cat);
              }
              if (extraction.ingredients?.length > 0) {
                addBulkIngredients(extraction.ingredients.join(", "));
              }
            } else if (data.analysis?.ingredients?.length > 0) {
              addBulkIngredients(
                data.analysis.ingredients.map((i: { name: string }) => i.name).join(", ")
              );
            }
          } else {
            setError("Could not extract from image. Add ingredients manually.");
          }
        } catch {
          setError("Image extraction failed. Try again or add manually.");
        } finally {
          setExtracting(false);
        }
      };
      reader.readAsDataURL(file);
    };
    input.click();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, brand]);

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError("Product name is required");
      return;
    }
    if (ingredients.length === 0) {
      setError("Add at least one ingredient");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/add-product", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          brand: brand.trim() || "Unknown",
          barcode: barcode.trim() || undefined,
          category,
          ingredients,
        }),
      });

      if (res.ok) {
        const { product } = await res.json();

        // Trigger analysis in the background
        fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            barcode: product.barcode,
            ingredients,
            category,
          }),
        }).catch(() => {});

        router.push(`/product/${product.id}`);
      } else {
        const data = await res.json();
        setError(data.error || "Failed to add product");
      }
    } catch {
      setError("Network error. Check your connection.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-dvh gradient-mesh pb-24">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-5 pb-4">
        <Link href="/scan" aria-label="Go back">
          <motion.div
            whileTap={{ scale: 0.9 }}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 rounded-full",
              "bg-black/60 border border-white/[0.06] backdrop-blur-xl"
            )}
          >
            <ArrowLeft size={14} className="text-white/80" />
            <span className="text-[11px] font-medium text-white/80">Back</span>
          </motion.div>
        </Link>
        <h1 className="font-semibold text-lg text-oasis-text">
          Add Product
        </h1>
      </div>

      <div className="max-w-md mx-auto px-5 space-y-5">
        {/* Photo extract button */}
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handlePhotoExtract}
          disabled={extracting}
          className={cn(
            "w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl",
            "bg-oasis-green/[0.08] border border-oasis-green/20",
            "text-oasis-green text-[13px] font-semibold",
            "hover:border-oasis-green/30 transition-colors",
            "disabled:opacity-50"
          )}
        >
          {extracting ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Extracting from photo...
            </>
          ) : (
            <>
              <Camera size={16} />
              Auto-fill from Label Photo
            </>
          )}
        </motion.button>

        {/* Product Name */}
        <div>
          <label className="block text-[12px] text-oasis-muted mb-1.5 font-medium">
            Product Name *
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Maggi 2-Minute Noodles"
            className={cn(
              "w-full px-4 py-3 rounded-xl text-[14px] text-oasis-text",
              "bg-[#1C1C1E]",
              "placeholder:text-[#8E8E93]",
              "focus:outline-none focus:border-oasis-green/30 transition-colors"
            )}
          />
        </div>

        {/* Brand */}
        <div>
          <label className="block text-[12px] text-oasis-muted mb-1.5 font-medium">
            Brand
          </label>
          <input
            type="text"
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            placeholder="e.g. Nestle"
            className={cn(
              "w-full px-4 py-3 rounded-xl text-[14px] text-oasis-text",
              "bg-[#1C1C1E]",
              "placeholder:text-[#8E8E93]",
              "focus:outline-none focus:border-oasis-green/30 transition-colors"
            )}
          />
        </div>

        {/* Barcode */}
        <div>
          <label className="block text-[12px] text-oasis-muted mb-1.5 font-medium">
            Barcode (optional)
          </label>
          <input
            type="text"
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            placeholder="e.g. 8901058851755"
            className={cn(
              "w-full px-4 py-3 rounded-xl text-[14px] text-oasis-text font-mono",
              "bg-[#1C1C1E]",
              "placeholder:text-[#8E8E93] placeholder:font-sans",
              "focus:outline-none focus:border-oasis-green/30 transition-colors"
            )}
          />
        </div>

        {/* Category */}
        <div>
          <label className="block text-[12px] text-oasis-muted mb-1.5 font-medium">
            Category
          </label>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.value}
                onClick={() => setCategory(cat.value)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors",
                  category === cat.value
                    ? "bg-oasis-green/20 text-oasis-green border border-oasis-green/30"
                    : "bg-[#1C1C1E] text-[#8E8E93]"
                )}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Ingredients */}
        <div>
          <label className="block text-[12px] text-oasis-muted mb-1.5 font-medium">
            Ingredients *
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={ingredientInput}
              onChange={(e) => setIngredientInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (ingredientInput.includes(",")) {
                    addBulkIngredients(ingredientInput);
                  } else {
                    addIngredient();
                  }
                }
              }}
              placeholder="Type ingredient(s), comma-separated"
              className={cn(
                "flex-1 px-4 py-3 rounded-xl text-[14px] text-oasis-text",
                "bg-[#1C1C1E]",
                "placeholder:text-[#8E8E93]",
                "focus:outline-none focus:border-oasis-green/30 transition-colors"
              )}
            />
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => {
                if (ingredientInput.includes(",")) {
                  addBulkIngredients(ingredientInput);
                } else {
                  addIngredient();
                }
              }}
              className="px-4 py-3 rounded-xl bg-oasis-green/10 border border-oasis-green/20 text-oasis-green"
            >
              <Plus size={18} />
            </motion.button>
          </div>
          <p className="text-[10px] text-oasis-muted/60 mt-1">
            Paste a full ingredients list (comma-separated) or add one at a time
          </p>

          {ingredients.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {ingredients.map((ing, i) => (
                <motion.span
                  key={i}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={cn(
                    "inline-flex items-center gap-1 px-2.5 py-1 rounded-lg",
                    "bg-[#1C1C1E]",
                    "text-[11px] text-oasis-text/80"
                  )}
                >
                  {ing}
                  <button
                    onClick={() => removeIngredient(i)}
                    className="text-oasis-muted/50 hover:text-red-400 transition-colors ml-0.5"
                  >
                    <Trash2 size={10} />
                  </button>
                </motion.span>
              ))}
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-[12px] text-red-400 text-center"
          >
            {error}
          </motion.p>
        )}

        {/* Submit */}
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handleSubmit}
          disabled={submitting}
          className={cn(
            "w-full py-3.5 rounded-xl text-[14px] font-semibold",
            "bg-oasis-green text-oasis-black",
            "shadow-[0_2px_16px_rgba(74,222,128,0.2)]",
            "disabled:opacity-50 transition-opacity"
          )}
        >
          {submitting ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 size={16} className="animate-spin" />
              Adding Product...
            </span>
          ) : (
            "Add Product & Analyze"
          )}
        </motion.button>
      </div>
    </div>
  );
}
