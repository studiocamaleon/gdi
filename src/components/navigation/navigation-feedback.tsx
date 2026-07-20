"use client";

import * as React from "react";
import { usePathname, useSearchParams } from "next/navigation";

import { GdiSpinner } from "@/components/brand/gdi-spinner";

type NavigationFeedbackContextValue = {
  isPending: boolean;
  startNavigation: (targetHref?: string | null) => void;
  stopNavigation: () => void;
};

const NavigationFeedbackContext =
  React.createContext<NavigationFeedbackContextValue | null>(null);

/**
 * Avisa cuando terminó una navegación. Vive acá abajo, aislado y detrás de su
 * propio Suspense, porque `useSearchParams` obliga a Next a envolver el árbol
 * en un boundary implícito, y los boundaries de Suspense entran en el cálculo
 * de `useId` de React: si el hook se llama arriba de todo, los ids generados
 * del lado del cliente se corren respecto de los del server y toda página del
 * dashboard tira hydration mismatch (lo veíamos en el menú de usuario).
 */
function AvisoDeNavegacion({ onNavegacion }: { onNavegacion: () => void }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  React.useEffect(() => {
    onNavegacion();
  }, [onNavegacion, pathname, searchParams]);

  return null;
}

export function NavigationFeedbackProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isPending, setIsPending] = React.useState(false);

  const detener = React.useCallback(() => setIsPending(false), []);

  React.useEffect(() => {
    if (!isPending) {
      return;
    }

    const timer = window.setTimeout(() => {
      setIsPending(false);
    }, 12000);

    return () => window.clearTimeout(timer);
  }, [isPending]);

  const value = React.useMemo<NavigationFeedbackContextValue>(
    () => ({
      isPending,
      startNavigation: () => setIsPending(true),
      stopNavigation: () => setIsPending(false),
    }),
    [isPending],
  );

  return (
    <NavigationFeedbackContext.Provider value={value}>
      {children}
      <React.Suspense fallback={null}>
        <AvisoDeNavegacion onNavegacion={detener} />
      </React.Suspense>
      <div className="pointer-events-none fixed right-4 top-4 z-[80]">
        {isPending ? (
          <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/92 px-3 py-2 shadow-lg backdrop-blur-sm">
            <GdiSpinner className="size-4" />
            <span className="text-xs font-medium text-foreground/80">Cargando...</span>
          </div>
        ) : null}
      </div>
    </NavigationFeedbackContext.Provider>
  );
}

export function useNavigationFeedback() {
  const context = React.useContext(NavigationFeedbackContext);

  if (!context) {
    throw new Error("useNavigationFeedback debe usarse dentro de NavigationFeedbackProvider.");
  }

  return context;
}
