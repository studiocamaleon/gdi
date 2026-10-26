"use client";

import type { ReactNode } from "react";
import { PackageIcon } from "lucide-react";
import type { CandidatoMaterialVisual } from "@/lib/selectores-materiales";
import { normalizarBusquedaMaterial } from "@/lib/selectores-materiales";
import { crearGruposPapeles } from "@/lib/selector-papeles";
import { crearGruposRigidos } from "@/lib/selector-rigidos";
import { crearGruposColores } from "@/lib/selector-colores";
import { crearGruposLaminados } from "@/lib/selector-laminados";
import { crearGruposRollos } from "@/lib/selector-rollos";
import { MaterialSelectorPapel } from "./material-selector-papel";
import { MaterialSelectorRigido } from "./material-selector-rigido";
import { MaterialSelectorColor } from "./material-selector-color";
import { MaterialSelectorLaminado } from "./material-selector-laminado";
import { MaterialSelectorRollo } from "./material-selector-rollo";
import { MaterialSelectorVisual } from "./material-selector-visual";

/** El material conserva su presentación tanto en el producto como en sus componentes. */
export function MaterialSelectorCatalogo({
  candidatos,
  fallback,
  ...props
}: {
  candidatos: readonly CandidatoMaterialVisual[];
  etiquetaSlot: string;
  selected: string;
  onSelect: (variantId: string) => void;
  sinTarjeta?: boolean;
  fallback?: ReactNode;
}) {
  const papeles = crearGruposPapeles(candidatos);
  if (papeles !== null)
    return <MaterialSelectorPapel {...props} grupos={papeles} />;
  const rigidos = crearGruposRigidos(candidatos);
  const colores = crearGruposColores(candidatos);
  if (rigidos !== null && (colores?.length ?? 0) <= 1)
    return <MaterialSelectorRigido {...props} grupos={rigidos} />;
  if (colores !== null)
    return <MaterialSelectorColor {...props} grupos={colores} />;
  const laminados = crearGruposLaminados(candidatos);
  if (laminados !== null)
    return <MaterialSelectorLaminado {...props} grupos={laminados} />;
  const rollos = crearGruposRollos(candidatos);
  if (rollos !== null)
    return <MaterialSelectorRollo {...props} grupos={rollos} />;
  return fallback !== undefined ? (
    fallback
  ) : (
    <MaterialSelectorVisual
      {...props}
      eje="Variante"
      etiquetaBusqueda="Buscar material o variante"
      ejemploBusqueda="Nombre o referencia…"
      pendiente="Elegí el material para este trabajo."
      grupos={candidatos.map((candidato) => ({
        id: candidato.materiaPrimaId,
        titulo: candidato.label,
        detalleComun: "",
        opciones: candidato.variantes.map((variante) => ({
          id: variante.variantId,
          titulo: variante.nombreVariante || variante.sku,
          descripcion: variante.sku,
          resumen: `${candidato.label} · ${variante.nombreVariante || variante.sku}`,
          ilustracion: <PackageIcon aria-hidden="true" />,
          predeterminada: variante.variantId === candidato.defaultVarianteId,
          sinPrecio: variante.missingPrice,
          busqueda: normalizarBusquedaMaterial(
            `${candidato.label} ${variante.nombreVariante} ${variante.sku}`,
          ),
        })),
      }))}
    />
  );
}
