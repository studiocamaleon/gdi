"use client";

import { useState } from "react";
import { CircleAlert, Layers } from "lucide-react";
import { normalizarBusquedaMaterial, type CandidatoMaterialVisual } from "@/lib/selectores-materiales";
import { crearGruposRollos } from "@/lib/selector-rollos";
import { crearGruposRigidos } from "@/lib/selector-rigidos";
import type { DecisionMaterialStock } from "@/lib/seleccion-material-stock";
import { MaterialPlateIllustration } from "@/components/design-system/material-plate-illustration";
import { ActionButton } from "@/components/design-system/action-button";
import { MaterialSelectorRollo } from "./material-selector-rollo";
import { MaterialSelectorVisual } from "./material-selector-visual";
import styles from "./material-automatico-stock.module.css";

type Candidato = Omit<CandidatoMaterialVisual, "variantes"> & {
  variantes: (CandidatoMaterialVisual["variantes"][number] & { label: string; description?: string | null })[];
};

/** Una selección automática resuelta no ocupa espacio en el configurador. */
export function MaterialAutomaticoStock({ etiqueta, candidatos, decision: decisionRecibida, contextoDecision, selected, onSelect }: {
  etiqueta: string;
  candidatos: Candidato[];
  decision?: DecisionMaterialStock;
  /** Inputs del cálculo, excluyendo sólo la elección manual de este slot. */
  contextoDecision: string;
  selected: string;
  onSelect: (id: string) => void;
}) {
  const [confirmada, setConfirmada] = useState<{ contexto: string; decision: DecisionMaterialStock }>();
  const contexto = JSON.stringify([contextoDecision, candidatos]);
  // La cotización manual ya no emite el diagnóstico automático. Conservar
  // la recomendación real que vio el comercial, nunca deducirla de su elección.
  const decision = decisionRecibida ?? (selected && confirmada?.contexto === contexto ? confirmada.decision : undefined);
  const elegir = (id: string) => {
    setConfirmada(id && decision ? { contexto, decision } : undefined);
    onSelect(id);
  };
  if (!decision && !selected) return null;
  const ids = new Set(decision?.alternativas.map((a) => a.id));
  const visibles = candidatos.map((c) => ({
    ...c,
    // Predeterminado del catálogo no equivale a recomendación del motor.
    defaultVarianteId: null,
    variantes: c.variantes.filter((v) => !decision || ids.has(v.variantId) || v.variantId === selected),
  })).filter((c) => c.variantes.length);
  // Sólo contar variantes realmente omitidas; una incompatibilidad técnica
  // por sí sola no significa que falte el precio.
  const omitidasSinPrecio = decision ? new Set(candidatos.flatMap((c) =>
    c.variantes.filter((v) => v.missingPrice && !ids.has(v.variantId) && v.variantId !== selected)
      .map((v) => v.variantId),
  )).size : 0;
  const rollos = crearGruposRollos(visibles);
  const rigidos = crearGruposRigidos(visibles);
  return (
    <section className={styles.root} aria-label={`${etiqueta}: elección por falta de stock`}>
      <div className={styles.notice}>
        <CircleAlert size={17} aria-hidden="true" />
        <div>
          <strong>{selected ? "Material elegido manualmente" : "No hay stock suficiente para este trabajo"}</strong>
          <p>{selected
            ? "Se cotizará con tu elección. Los faltantes se contemplan en el abastecimiento."
            : "Ninguna de las opciones tiene stock suficiente. Elegí qué material querés usar para seguir cotizando; el faltante deberá reponerse antes de producir."}</p>
        </div>
      </div>
      <div className={styles.selector}>
        {omitidasSinPrecio > 0 ? (
          <p className={styles.omitted} role="status">
            <CircleAlert size={14} aria-hidden="true" />
            <span>
              <strong>{omitidasSinPrecio} {omitidasSinPrecio === 1 ? "variante omitida" : "variantes omitidas"} por falta de precio.</strong>{" "}
              {omitidasSinPrecio === 1
                ? "Cargá su precio en Materiales para que el sistema pueda evaluarla."
                : "Cargá sus precios en Materiales para que el sistema pueda evaluarlas."}
            </span>
          </p>
        ) : null}
        {rollos ? <MaterialSelectorRollo etiquetaSlot={etiqueta} grupos={rollos} selected={selected} onSelect={elegir} sinTarjeta recomendadoId={decision?.recomendadoVarianteId} />
          : <MaterialSelectorVisual
            etiquetaSlot={etiqueta} selected={selected} onSelect={elegir} sinTarjeta
            eje={rigidos ? "Espesor" : "Material"}
            etiquetaBusqueda="Buscar material o variante" ejemploBusqueda="Nombre, medida…"
            pendiente="Elegí una opción para cotizar con reposición."
            grupos={rigidos ? rigidos.map((g) => ({
              id: g.id, titulo: g.material, subtitulo: g.color, detalleComun: g.formatoComun ?? "",
              opciones: g.opciones.map((o) => ({
                ...o, descripcion: [!g.formatoComun ? o.formato : "", o.referencia].filter(Boolean).join(" · "),
                resumen: [g.material, g.color, o.titulo, o.formato, o.referencia].filter(Boolean).join(" · "),
                recomendada: o.id === decision?.recomendadoVarianteId,
                ilustracion: <MaterialPlateIllustration espesor={o.espesorMm} color={g.color} />,
              })),
            })) : visibles.map((c) => ({
              id: c.materiaPrimaId, titulo: c.label, detalleComun: "",
              opciones: c.variantes.map((v) => ({
                id: v.variantId, titulo: v.label, descripcion: v.description ?? "",
                resumen: `${c.label} · ${v.label}`, busqueda: normalizarBusquedaMaterial(`${c.label} ${v.label}`),
                predeterminada: false, recomendada: v.variantId === decision?.recomendadoVarianteId,
                sinPrecio: v.missingPrice, ilustracion: <Layers size={26} />,
              })),
            }))}
          />}
      </div>
      {selected ? <div className={styles.actions}><ActionButton variant="outline" onPress={() => elegir("")}>Volver a selección automática</ActionButton></div>
        : decision?.recomendadoVarianteId ? <p className={styles.hint}>Recomendado según la configuración del trabajo. Requiere reposición.</p> : null}
    </section>
  );
}
