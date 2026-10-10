import { expandirVistas } from "./permisos-vistas";
import type { CatalogoPermisos } from "./usuarios-api";
export type NivelAcceso = "ninguno" | "ver" | "gestionar";
export function vistasDelModulo(m: CatalogoPermisos["modulos"][number]) {
  return m.vistas?.length
    ? m.vistas
    : [{ clave: m.clave, label: m.label, permiteGestion: m.clave !== "panel" }];
}
export function nivelesDesde(
  permisos: string[],
  catalogo: CatalogoPermisos,
): Record<string, NivelAcceso> {
  const efectivos = expandirVistas(permisos);
  return Object.fromEntries(
    catalogo.modulos.flatMap((m) =>
      vistasDelModulo(m).map((v) => [
        v.clave,
        v.permiteGestion && efectivos.has(`${v.clave}.gestionar`)
          ? "gestionar"
          : efectivos.has(`${v.clave}.ver`)
            ? "ver"
            : "ninguno",
      ]),
    ),
  );
}
export function permisosDesdeNiveles(
  niveles: Record<string, NivelAcceso>,
  extras: Iterable<string>,
): string[] {
  return [
    "acceso.por_vista",
    ...Object.entries(niveles).flatMap(([vista, nivel]) =>
      nivel === "ninguno" ? [] : [`${vista}.${nivel}`],
    ),
    ...extras,
  ];
}
