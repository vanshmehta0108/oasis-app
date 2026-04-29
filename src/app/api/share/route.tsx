// OG share image for product links — what a friend sees when a Sift link
// previews on WhatsApp / Twitter / Slack.
//
// Designed to match the verdict card on the product page so the brand
// language is consistent across surfaces. Bold opinionated headline
// ("We'd skip it"), product as supporting text, score + grade demoted
// to a footer pill. Warm tone-tinted background, never dark.

import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

type Tone = "clean" | "mostly" | "occasional" | "skip" | "avoid" | "unknown";

const TONE: Record<Tone, { headline: string; sub: string; accent: string; bg: string; footerText: string }> = {
  clean:      { headline: "We'd buy it.",       sub: "Clean ingredients. No real concerns.",            accent: "#00875A", bg: "#E8F7F0", footerText: "Clean" },
  mostly:     { headline: "Mostly fine.",       sub: "A couple of ingredients worth a closer look.",    accent: "#1E8040", bg: "#F0FBF4", footerText: "Mostly fine" },
  occasional: { headline: "Eat occasionally.",  sub: "Not your daily — fine for a treat.",              accent: "#B87800", bg: "#FFF8E6", footerText: "Eat occasionally" },
  skip:       { headline: "We'd skip it.",      sub: "Several ingredients we'd rather not eat.",        accent: "#CC5200", bg: "#FFF2E8", footerText: "We'd skip it" },
  avoid:      { headline: "Put it back.",       sub: "Loaded with stuff we don't recommend.",           accent: "#CC1010", bg: "#FFF0EE", footerText: "Avoid" },
  unknown:    { headline: "Scan it on Sift.",   sub: "An honest verdict on every Indian packet.",       accent: "#007AFF", bg: "#EBF3FF", footerText: "Sift" },
};

function toneFromScore(score: number | null): Tone {
  if (score == null || isNaN(score)) return "unknown";
  if (score >= 85) return "clean";
  if (score >= 70) return "mostly";
  if (score >= 50) return "occasional";
  if (score >= 30) return "skip";
  return "avoid";
}

function buildSub(tone: Tone, harmful: number, beneficial: number): string {
  if (tone === "clean" && beneficial >= 3) return `Clean ingredients — ${beneficial} we'd actively recommend.`;
  if (tone === "mostly" && harmful >= 1)   return `${harmful} ingredient${harmful === 1 ? "" : "s"} worth a closer look — otherwise fine.`;
  if (tone === "occasional" && harmful >= 3) return `${harmful} ingredients we'd watch. Fine occasionally, not daily.`;
  if (tone === "skip" && harmful >= 3)     return `${harmful} ingredients we'd rather not eat. Better picks below.`;
  if (tone === "avoid" && harmful >= 4)    return `${harmful} flagged ingredients. We'd put it back.`;
  return TONE[tone].sub;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const name = searchParams.get("name") || "Scan it on Sift";
  const brand = searchParams.get("brand") || "";
  const scoreParam = searchParams.get("score");
  const grade = searchParams.get("grade") || "";
  const harmful = parseInt(searchParams.get("harmful") || "0", 10);
  const beneficial = parseInt(searchParams.get("beneficial") || "0", 10);

  const score = scoreParam != null && scoreParam !== "" ? parseInt(scoreParam, 10) : null;
  const tone = toneFromScore(score);
  const palette = TONE[tone];
  const sub = buildSub(tone, harmful, beneficial);

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200",
          height: "630",
          display: "flex",
          flexDirection: "column",
          background: palette.bg,
          fontFamily: "system-ui, -apple-system, sans-serif",
          padding: "60px 72px",
          position: "relative",
        }}
      >
        {/* Accent left strip — ties to the verdict card on the product page */}
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: "10",
            background: palette.accent,
          }}
        />

        {/* Eyebrow */}
        <div
          style={{
            display: "flex",
            fontSize: "16",
            fontWeight: "800",
            color: palette.accent,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            marginBottom: "32",
          }}
        >
          Sift · Verdict
        </div>

        {/* Headline */}
        <div
          style={{
            display: "flex",
            fontSize: "120",
            fontWeight: "800",
            color: palette.accent,
            letterSpacing: "-0.025em",
            lineHeight: "1.02",
            marginBottom: "20",
          }}
        >
          {palette.headline}
        </div>

        {/* Subhead — the count-aware sentence */}
        <div
          style={{
            display: "flex",
            fontSize: "32",
            fontWeight: "500",
            color: "rgba(0,0,0,0.72)",
            lineHeight: "1.3",
            maxWidth: "1000",
            marginBottom: "32",
          }}
        >
          {sub}
        </div>

        {/* Spacer pushes footer down */}
        <div style={{ display: "flex", flex: "1" }} />

        {/* Footer — product + score */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            paddingTop: "32",
            borderTop: "1px solid rgba(0,0,0,0.10)",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", maxWidth: "780" }}>
            <div
              style={{
                display: "flex",
                fontSize: "32",
                fontWeight: "700",
                color: "rgba(0,0,0,0.92)",
                lineHeight: "1.2",
                marginBottom: "6",
              }}
            >
              {name.length > 70 ? name.slice(0, 67) + "…" : name}
            </div>
            {brand && (
              <div style={{ display: "flex", fontSize: "22", color: "rgba(0,0,0,0.5)" }}>{brand}</div>
            )}
          </div>

          {score != null && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                background: "#FFFFFF",
                borderRadius: "999px",
                padding: "18px 32px",
                border: `2px solid ${palette.accent}`,
              }}
            >
              <div
                style={{
                  display: "flex",
                  fontSize: "44",
                  fontWeight: "800",
                  color: palette.accent,
                  lineHeight: "1",
                }}
              >
                {score}
              </div>
              <div
                style={{
                  display: "flex",
                  fontSize: "13",
                  fontWeight: "600",
                  color: "rgba(0,0,0,0.55)",
                  marginTop: "4",
                  letterSpacing: "0.10em",
                }}
              >
                {grade ? `${grade} · /100` : "/100"}
              </div>
            </div>
          )}
        </div>

        {/* Brand footer — bottom-right */}
        <div
          style={{
            display: "flex",
            position: "absolute",
            right: "72",
            bottom: "20",
            fontSize: "14",
            color: "rgba(0,0,0,0.4)",
            letterSpacing: "0.08em",
          }}
        >
          sift-india.vercel.app
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
