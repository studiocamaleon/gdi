"use client";

import { createContext, useContext, type ReactNode } from "react";
import { I18nProvider } from "react-aria-components/I18nProvider";

/** Por defecto hereda .dark del shell. Un catálogo puede aislar su apariencia.
 * El contexto atraviesa portales, a diferencia de los ancestros del DOM.
 */
const DesignAppearance = createContext<"light" | "dark" | undefined>(undefined);

export function DesignSystemProvider({
  appearance,
  children,
}: {
  appearance?: "light" | "dark";
  children: ReactNode;
}) {
  const inheritedAppearance = useContext(DesignAppearance);
  return (
    <I18nProvider locale="es-AR">
      <DesignAppearance value={appearance ?? inheritedAppearance}>
        {children}
      </DesignAppearance>
    </I18nProvider>
  );
}

export function useDesignScope() {
  const appearance = useContext(DesignAppearance);
  return { "data-ui": "heroui", "data-appearance": appearance } as const;
}
