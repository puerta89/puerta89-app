import type { Config } from "tailwindcss";

// Paleta oficial del manual de identidad de Puerta 89 — antes vivía en
// app/globals.css con la sintaxis @theme de Tailwind v4; se movió aquí
// porque v3 (que sí soporta Safari viejo, a diferencia de v4) registra
// los colores/fuentes de marca así, con tailwind.config en vez de CSS.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        "rosa-claro": "#f4b3b3",
        rosa: "#ac5b67",
        vino: "#781727",
        "vino-hondo": "#4e0714",
        crema: "#fbf6f6",
        tinta: "#2c0810",
        "tinta-2": "#6e4a50",
      },
      fontFamily: {
        display: ["var(--font-cormorant)", "Georgia", "serif"],
      },
    },
  },
  plugins: [],
};

export default config;
