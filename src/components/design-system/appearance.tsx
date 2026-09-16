"use client";

import { createContext, useContext, type ReactNode } from "react";
import { I18nProvider } from "react-aria-components/I18nProvider";
import baseTheme from "./theme.module.css";
import brandTheme from "./brand-workspace-theme.module.css";

/** Por defecto hereda .dark del shell. Un catálogo puede aislar su apariencia.
 * El contexto atraviesa portales, a diferencia de los ancestros del DOM.
 */
const DesignAppearance = createContext<"light" | "dark" | undefined>(undefined);
const DesignTheme = createContext<"default" | "brand">("default");

export function DesignSystemProvider({
  appearance,
  theme,
  children,
}: {
  appearance?: "light" | "dark";
  theme?: "default" | "brand";
  children: ReactNode;
}) {
  const inheritedAppearance = useContext(DesignAppearance);
  const inheritedTheme = useContext(DesignTheme);
  return (
    <I18nProvider locale="es-AR">
      <DesignAppearance value={appearance ?? inheritedAppearance}>
        <DesignTheme value={theme ?? inheritedTheme}>{children}</DesignTheme>
      </DesignAppearance>
    </I18nProvider>
  );
}

/** La identidad sigue al formulario cuando un selector se monta en un portal. */
export function useDesignTheme() {
  return useContext(DesignTheme) === "brand" ? brandTheme.theme : baseTheme.theme;
}

/** Puente optativo para los controles anteriores que aún conviven con HeroUI. */
export function useLegacyDesignScope() {
  const theme = useContext(DesignTheme);
  const appearance = useContext(DesignAppearance);
  return theme === "brand"
    ? {
        className: `${brandTheme.theme} ${brandTheme.legacy}`,
        "data-appearance": appearance,
      }
    : {};
}

export function useDesignScope() {
  const appearance = useContext(DesignAppearance);
  return { "data-ui": "heroui", "data-appearance": appearance } as const;
}
