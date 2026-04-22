import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const name = searchParams.get("name") || "Product";
  const brand = searchParams.get("brand") || "";
  const score = parseInt(searchParams.get("score") || "50", 10);
  const grade = searchParams.get("grade") || "C";

  const scoreColor = score >= 80 ? "#4ade80" : score >= 60 ? "#a3e635" : score >= 40 ? "#fbbf24" : score >= 20 ? "#fb923c" : "#f87171";
  const label = score >= 80 ? "Safe" : score >= 60 ? "Mostly Safe" : score >= 40 ? "Concerning" : score >= 20 ? "Unsafe" : "Dangerous";

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200",
          height: "630",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0a0f0d 0%, #111916 50%, #0a0f0d 100%)",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {/* Top bar */}
        <div style={{ display: "flex", alignItems: "center", gap: "12", marginBottom: "40" }}>
          <div style={{ fontSize: "24", color: "#4ade80", fontWeight: "700" }}>Sift</div>
          <div style={{ fontSize: "16", color: "#6b7c72", marginLeft: "12" }}>India&apos;s AI Safety Scanner</div>
        </div>

        {/* Score circle */}
        <div
          style={{
            width: "180",
            height: "180",
            borderRadius: "50%",
            border: `8px solid ${scoreColor}`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: "30",
            boxShadow: `0 0 60px ${scoreColor}33`,
          }}
        >
          <div style={{ fontSize: "64", fontWeight: "800", color: scoreColor }}>{score}</div>
          <div style={{ fontSize: "20", fontWeight: "600", color: "#6b7c72" }}>{grade}</div>
        </div>

        {/* Product name */}
        <div style={{ fontSize: "36", fontWeight: "700", color: "#f0fdf4", marginBottom: "8", textAlign: "center", maxWidth: "800" }}>
          {name}
        </div>
        {brand && <div style={{ fontSize: "20", color: "#6b7c72", marginBottom: "24" }}>{brand}</div>}

        {/* Safety label */}
        <div
          style={{
            fontSize: "18",
            fontWeight: "600",
            color: scoreColor,
            padding: "8px 24px",
            borderRadius: "50px",
            background: `${scoreColor}15`,
            border: `1px solid ${scoreColor}30`,
          }}
        >
          {label}
        </div>

        {/* Footer */}
        <div style={{ position: "absolute", bottom: "30", fontSize: "14", color: "#6b7c72" }}>
          Scan any product → sift.app
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
