import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { getSiteConfig } from "../lib/site-config";
import "./globals.css";

const sans = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
  display: "swap",
});
const mono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});
const site = getSiteConfig();
const title = "Grafoprint · El sistema operativo de la industria gráfica";
const description =
  "Cotización, producción y gestión conectadas para impresión, cartelería y operaciones industriales. Descubrí una nueva forma de trabajar con Grafoprint.";
export const metadata: Metadata = {
  metadataBase: new URL(site.site),
  title,
  description,
  alternates: { canonical: "/" },
  openGraph: {
    title,
    description,
    url: site.site,
    siteName: "Grafoprint",
    locale: "es_AR",
    type: "website",
  },
  twitter: { card: "summary", title, description },
  icons: { icon: "/icon.svg" },
};
export const viewport: Viewport = { themeColor: "#101113" };
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es-AR" className={`${sans.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
