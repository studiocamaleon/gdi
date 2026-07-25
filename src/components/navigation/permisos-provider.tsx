"use client";

import * as React from "react";

import type { PermisoClave } from "@/lib/permisos";

/**
 * Los permisos del usuario, disponibles en cualquier componente de cliente.
 *
 * Existe para no cablear un boolean por cinco niveles de props hasta el bloque
 * que muestra un margen. Lo monta el layout del dashboard, que ya tiene la
 * sesión resuelta.
 *
 * `null` = no vinieron (sesión de una versión anterior del API): se asume que
 * puede todo, porque el API frena igual y una UI vacía por un campo que falta
 * es peor que una que ofrece de más.
 */
const Ctx = React.createContext<Set<string> | null>(null);

export function PermisosProvider({
  permisos,
  children,
}: {
  permisos: string[] | null | undefined;
  children: React.ReactNode;
}) {
  const valor = React.useMemo(
    () => (permisos ? new Set(permisos) : null),
    [permisos],
  );
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

/**
 * ¿Puede? Para esconder lo que el API no le va a mandar igual — es cortesía,
 * no seguridad.
 */
export function usePuede(permiso: PermisoClave): boolean {
  const permisos = React.useContext(Ctx);
  return permisos === null || permisos.has(permiso);
}
