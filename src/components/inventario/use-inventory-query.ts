"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useSyncExternalStore } from "react";
import { inventoryContext } from "@/lib/inventario-navigation";

const FILTERS_CHANGED = "grafo:inventario-filtros";
const readSearch = () => window.location.search.slice(1);
function subscribeFilters(onChange: () => void) {
  window.addEventListener("popstate", onChange);
  window.addEventListener(FILTERS_CHANGED, onChange);
  return () => {
    window.removeEventListener("popstate", onChange);
    window.removeEventListener(FILTERS_CHANGED, onChange);
  };
}

/** Los filtros viajan en la URL; cambiar una vista no pierde el material de origen. */
export function useInventoryQuery() {
  const serverParams = useSearchParams();
  // El selector necesita su valor inmediatamente, antes de la transición del router.
  const search = useSyncExternalStore(subscribeFilters, readSearch, () =>
    serverParams.toString(),
  );
  const params = new URLSearchParams(search);
  const pathname = usePathname();
  const rawPage = Number(params.get("page"));
  const page = Number.isSafeInteger(rawPage) && rawPage > 0 ? rawPage : 1;
  const update = (
    patch: Record<string, string | undefined>,
    resetPage = true,
  ) => {
    // También conserva dos cambios realizados antes del siguiente render de Next.
    const next = new URLSearchParams(window.location.search);
    if (resetPage) next.delete("page");
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    window.history.replaceState(
      null,
      "",
      `${pathname}${next.size ? `?${next}` : ""}`,
    );
    window.dispatchEvent(new Event(FILTERS_CHANGED));
  };
  return {
    ...inventoryContext(params),
    page,
    search: (params.get("search") ?? "").slice(0, 120),
    soloConStock: params.get("soloConStock") === "true",
    update,
  };
}
