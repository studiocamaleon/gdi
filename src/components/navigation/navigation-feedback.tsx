"use client";

import * as React from "react";
import { usePathname, useSearchParams } from "next/navigation";

import { NavigationLoading } from "./navigation-loading";

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
  const [mostrarAviso, setMostrarAviso] = React.useState(false);

  const detener = React.useCallback(() => setIsPending(false), []);

  React.useEffect(() => {
    // Evita que el aviso parpadee cuando la navegación termina enseguida.
    const timer = window.setTimeout(
      () => setMostrarAviso(isPending),
      isPending ? 180 : 0,
    );

    return () => window.clearTimeout(timer);
  }, [isPending]);

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
      {mostrarAviso ? <NavigationLoading /> : null}
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

/** Los fallbacks también pueden renderizarse fuera del shell del dashboard. */
export function useNavigationPending() {
  return React.useContext(NavigationFeedbackContext)?.isPending ?? false;
}
