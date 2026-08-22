import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Archivo } from "next/font/google";
import "./globals.css";

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["400", "600"],
  style: ["normal", "italic"],
});

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Puerta 89",
  description: "Sistema de Puerta 89",
};

export const viewport: Viewport = {
  themeColor: "#781727",
  // La tablet vive en horizontal detrás de la barra; que no haga zoom sola.
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${cormorant.variable} ${archivo.variable} h-full antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
