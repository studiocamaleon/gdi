"use client";

import * as React from "react";
import { usePathname, useSearchParams } from "next/navigation";

import { NavigationLoading } from "./navigation-loading";
import {
  initialNavigationLoadingState,
  isNavigationLoading,
  navigationLoadingReducer,
} from "./navigation-loading-state";

type NavigationFeedbackContextValue = {
  isPending: boolean;
  startNavigation: (targetHref?: string | null) => void;
  stopNavigation: () => void;
  registerModuleLoading: () => () => void;
};

const NavigationFeedbackContext =
  React.createContext<NavigationFeedbackContextValue | null>(null);

/**
 * Avisa cuando cambió la URL; los fallbacks pueden seguir pendientes. Vive
 * aislado y detrás de su propio Suspense, porque `useSearchParams` obliga a Next a envolver el árbol
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
  const [loading, dispatch] = React.useReducer(
    navigationLoadingReducer,
    initialNavigationLoadingState,
  );
  const isPending = isNavigationLoading(loading);
  const [mostrarAviso, setMostrarAviso] = React.useState(false);

  const iniciar = React.useCallback(
    () => dispatch({ type: "route-start" }),
    [],
  );
  const detener = React.useCallback(() => dispatch({ type: "route-end" }), []);
  const registerModuleLoading = React.useCallback(() => {
    const id = Symbol("module-loading");
    dispatch({ type: "module-start", id });
    return () => dispatch({ type: "module-end", id });
  }, []);

  React.useEffect(() => {
    // Evita que el aviso parpadee cuando la navegación termina enseguida.
    const timer = window.setTimeout(
      () => setMostrarAviso(isPending),
      isPending ? 180 : 0,
    );

    return () => window.clearTimeout(timer);
  }, [isPending]);

  React.useEffect(() => {
    if (!loading.routePending) {
      return;
    }

    const timer = window.setTimeout(() => {
      detener();
    }, 12000);

    return () => window.clearTimeout(timer);
  }, [loading.routePending, detener]);

  const value = React.useMemo<NavigationFeedbackContextValue>(
    () => ({
      isPending,
      startNavigation: iniciar,
      stopNavigation: detener,
      registerModuleLoading,
    }),
    [isPending, iniciar, detener, registerModuleLoading],
  );

  return (
    <NavigationFeedbackContext.Provider value={value}>
      {children}
      <React.Suspense fallback={null}>
        <AvisoDeNavegacion onNavegacion={detener} />
      </React.Suspense>
      {isPending && mostrarAviso ? <NavigationLoading /> : null}
    </NavigationFeedbackContext.Provider>
  );
}

export function useNavigationFeedback() {
  const context = React.useContext(NavigationFeedbackContext);

  if (!context) {
    throw new Error(
      "useNavigationFeedback debe usarse dentro de NavigationFeedbackProvider.",
    );
  }

  return context;
}

/** Registra el fallback antes de pintar; dentro del dashboard sólo dibuja el global. */
export function useModuleLoading() {
  const register = React.useContext(
    NavigationFeedbackContext,
  )?.registerModuleLoading;
  React.useLayoutEffect(() => register?.(), [register]);
  return register != null;
}
