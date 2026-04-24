import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// Entry point for the PWA Web Share Target. Mobile OSes POST here with
// the shared content (text, URL, image). We turn the image into a data
// URL, stash it in a single-use cookie the client reads on /share/inbox,
// and redirect there. Keeping the image in a cookie feels hacky but
// it's the only storage the browser makes available during a POST →
// GET redirect dance that survives across Safari's sandboxed contexts.
//
// For text-only shares (a web page URL), we just redirect to /scan with
// the text prefilled in a query param — not super useful yet, but at
// least we don't 404.
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const form = await req.formData();
    const image = form.get("image");
    const text = typeof form.get("text") === "string" ? (form.get("text") as string) : "";

    if (image instanceof File && image.size > 0 && image.size < 8 * 1024 * 1024) {
      const buf = Buffer.from(await image.arrayBuffer());
      const mime = image.type || "image/jpeg";
      const dataUrl = `data:${mime};base64,${buf.toString("base64")}`;

      // Short-lived cookie so the landing page can pick it up client-side
      // without exposing the image in a URL. `max-age=60` lets a slow
      // redirect chain still work but the payload is gone quickly.
      const res = NextResponse.redirect(new URL("/share/inbox", req.url));
      res.cookies.set("sift-share-image", dataUrl, {
        httpOnly: false,
        sameSite: "lax",
        maxAge: 60,
        path: "/",
      });
      return res;
    }

    // Fallback: no usable image — just send the user to the scanner.
    const to = new URL("/scan", req.url);
    if (text) to.searchParams.set("hint", text.slice(0, 80));
    return NextResponse.redirect(to);
  } catch {
    return NextResponse.redirect(new URL("/scan", req.url));
  }
}

// GET is useful when mobile OSes pre-flight the target. Just bounce to
// the scanner.
export async function GET(req: NextRequest): Promise<NextResponse> {
  return NextResponse.redirect(new URL("/scan", req.url));
}
