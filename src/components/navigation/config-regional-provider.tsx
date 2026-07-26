"use client";

import * as React from "react";

import { crearFormateadoresDeFecha } from "@/lib/fecha";
import { monedaDe, type Moneda } from "@/lib/monedas";

/**
 * La config regional del tenant —moneda, zona horaria, redondeo— disponible
 * en cualquier componente de cliente.
 *
 * Mismo criterio que `PermisosProvider`: la monta el layout del dashboard,
 * que ya tiene la sesión resuelta, para no cablear la moneda por cinco
 * niveles de props hasta el `<span>` que muestra un total.
 *
 * Sin provider (vistas públicas, tests) el hook devuelve Argentina, que es lo
 * que el sistema asumía siempre — nunca null: ningún consumidor tiene que
 * contemplar "no sé en qué moneda estoy".
 */

export type ConfigRegional = {
  moneda: Moneda;
  zonaHoraria: string;
  redondeoPrecio: "moneda" | "entero";
  /** ISO alfa-2; AR si no está cargado. Gatea lo fiscal argentino (D14). */
  paisCodigo: string;
};

const DEFAULT_REGIONAL: ConfigRegional = {
  moneda: monedaDe(null),
  zonaHoraria: "America/Argentina/Buenos_Aires",
  redondeoPrecio: "moneda",
  paisCodigo: "AR",
};

const Ctx = React.createContext<ConfigRegional>(DEFAULT_REGIONAL);

export function ConfigRegionalProvider({
  regional,
  children,
}: {
  /** Lo que vino en `tenantActual.regional`; undefined = API viejo → AR. */
  regional?: {
    monedaCodigo: string;
    zonaHoraria: string;
    redondeoPrecio: string;
    paisCodigo?: string;
  };
  children: React.ReactNode;
}) {
  const valor = React.useMemo<ConfigRegional>(() => {
    if (!regional) return DEFAULT_REGIONAL;
    return {
      moneda: monedaDe(regional.monedaCodigo),
      zonaHoraria: regional.zonaHoraria || DEFAULT_REGIONAL.zonaHoraria,
      redondeoPrecio: regional.redondeoPrecio === "entero" ? "entero" : "moneda",
      paisCodigo: regional.paisCodigo || "AR",
    };
  }, [regional]);
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

/** Moneda, zona y redondeo del tenant. Nunca null. */
export function useConfigRegional(): ConfigRegional {
  return React.useContext(Ctx);
}

/**
 * Los formateadores de `fecha.ts` ya ligados a la zona del tenant, para que
 * el componente llame `fechaHora(iso)` sin acordarse de la zona en cada uso.
 */
export function useFecha() {
  const { zonaHoraria } = useConfigRegional();
  return React.useMemo(() => crearFormateadoresDeFecha(zonaHoraria), [zonaHoraria]);
}
