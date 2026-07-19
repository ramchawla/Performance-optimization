import { ImageResponse } from "next/og";

// Maskable variant: content kept inside the ~80% safe zone so OS icon masks
// (circle, squircle, etc.) don't clip the "PH" glyph.
export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function MaskableIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#171717",
          color: "white",
          fontSize: 170,
          fontWeight: 700,
          fontFamily: "sans-serif",
        }}
      >
        PH
      </div>
    ),
    size
  );
}
