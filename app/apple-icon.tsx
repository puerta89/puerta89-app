import { ImageResponse } from "next/og";

// iOS solo lee este archivo para "Agregar a pantalla de inicio" — ignora
// el manifest por completo. Mismo diseño que app/icon.tsx, a 180×180.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#781727",
        }}
      >
        <svg
          width={116}
          height={145}
          viewBox="-3 -3 106 132"
          fill="none"
          stroke="#f4b3b3"
          strokeWidth="2.6"
          strokeLinejoin="round"
        >
          <path d="M0 126 V50 A50 50 0 0 1 100 50 V126 Z" />
          <path d="M0 50 H100" />
          <path d="M34 50 A16 16 0 0 1 66 50" />
          <path d="M50 34 V0" />
          <path d="M38.7 38.7 L14.6 14.6" />
          <path d="M61.3 38.7 L85.4 14.6" />
          <path d="M33.3 50 V126 M66.7 50 V126" />
          <path d="M0 75.3 H100 M0 100.7 H100" />
        </svg>
      </div>
    ),
    { ...size },
  );
}
