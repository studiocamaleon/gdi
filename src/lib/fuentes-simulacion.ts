/**
 * Las tipografías del diseño de la Mesa de luz (Claude Design).
 *
 * Van por next/font en vez del <link> a Google Fonts del prototipo: se
 * auto-hospedan, así que no hay pedido a un tercero ni salto de layout.
 * Sólo se exponen como variables CSS y se aplican en el scope de la vista,
 * no al resto de la app (que usa Geist).
 */
import { IBM_Plex_Mono, Space_Grotesk } from "next/font/google";

export const simuSans = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-simu-sans",
  display: "swap",
});

export const simuMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-simu-mono",
  display: "swap",
});

/** Clase a poner en el contenedor de la vista para activar las variables. */
export const fuentesSimulacion = `${simuSans.variable} ${simuMono.variable}`;
