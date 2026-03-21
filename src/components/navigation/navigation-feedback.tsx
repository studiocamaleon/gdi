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

export function NavigationFeedbackProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, setIsPending] = React.useState(false);

  React.useEffect(() => {
    if (!isPending) {
      return;
    }

    setIsPending(false);
  }, [isPending, pathname, searchParams]);

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
