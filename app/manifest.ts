import type { MetadataRoute } from "next";

// Para cuando se agrega la página como app (Android/PWA) — en iOS, la
// que manda es app/apple-icon.tsx; esto es lo que usan Android y Chrome.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Puerta 89",
    short_name: "Puerta 89",
    description: "Sistema de Puerta 89",
    start_url: "/",
    display: "standalone",
    background_color: "#781727",
    theme_color: "#781727",
    icons: [
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
