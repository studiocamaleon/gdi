"use client";

import * as React from "react";
import { usePathname, useSearchParams } from "next/navigation";

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";

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
      {mostrarAviso ? (
        <div className="pointer-events-none fixed inset-0 z-[80] flex items-center justify-center bg-background/15 px-4 backdrop-blur-[2px] motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200">
          <Card
            role="status"
            aria-live="polite"
            aria-label="Cargando"
            className="w-full max-w-xs border border-border/70 bg-card/95 py-0 shadow-2xl backdrop-blur-xl motion-safe:animate-in motion-safe:slide-in-from-bottom-2 motion-safe:zoom-in-95 motion-safe:duration-300"
          >
            <CardHeader className="flex flex-row items-center gap-4 px-5 py-4">
              <div className="relative grid size-11 shrink-0 place-items-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/15">
                <span className="absolute inset-1 rounded-full bg-primary/10 motion-safe:animate-ping motion-reduce:hidden" />
                <Spinner className="relative size-5" aria-hidden="true" />
              </div>
              <div className="grid gap-0.5">
                <CardTitle>Cargando</CardTitle>
                <CardDescription>Preparando la siguiente vista…</CardDescription>
              </div>
            </CardHeader>
            <div className="h-1 overflow-hidden bg-muted">
              <div className="h-full w-2/3 rounded-r-full bg-primary motion-safe:animate-pulse" />
            </div>
          </Card>
        </div>
      ) : null}
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
