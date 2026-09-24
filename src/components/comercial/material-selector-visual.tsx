"use client";

import { useId, useState, type ReactNode } from "react";
import { CircleAlert } from "lucide-react";
import { ChoiceCards } from "@/components/design-system/choice-cards";
import { Field, FieldLabel, FieldSet, FieldLegend } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { normalizarBusquedaMaterial } from "@/lib/selectores-materiales";
import styles from "./material-selector-visual.module.css";

export type OpcionMaterialVisual = {
  id: string;
  titulo: string;
  descripcion: string;
  resumen: string;
  nombreAccesible?: string;
  ilustracion: ReactNode;
  predeterminada: boolean;
  recomendada?: boolean;
  sinPrecio: boolean;
  busqueda: string;
  aviso?: string;
};

export type GrupoMaterialVisual = {
  id: string;
  titulo: string;
  subtitulo?: string;
  detalleComun: string;
  opciones: OpcionMaterialVisual[];
};

export type MaterialSelectorVisualProps = {
  etiquetaSlot: string;
  grupos: readonly GrupoMaterialVisual[];
  selected: string;
  onSelect: (variantId: string) => void;
  sinTarjeta?: boolean;
  /** Mantiene el selector visual aunque sólo haya una variante elegida. */
  mostrarTarjetaUnica?: boolean;
  eje: string;
  etiquetaBusqueda: string;
  ejemploBusqueda: string;
  pendiente: string;
};

/** Misma interacción, estados y densidad para cada familia de selectores. */
export function MaterialSelectorVisual({
  etiquetaSlot, grupos, selected, onSelect, sinTarjeta = false, mostrarTarjetaUnica = false,
  eje, etiquetaBusqueda, ejemploBusqueda, pendiente,
}: MaterialSelectorVisualProps) {
  const id = useId();
  const [busqueda, setBusqueda] = useState("");
  const opciones = grupos.flatMap((g) => g.opciones);
  const elegida = opciones.find((o) => o.id === selected);
  const consulta = normalizarBusquedaMaterial(busqueda);
  const visibles = grupos.map((g) => ({ ...g, opciones: g.opciones.filter((o) => !consulta || o.busqueda.includes(consulta) || o.id === selected) })).filter((g) => g.opciones.length);
  const sinCoincidencias = !!consulta && !opciones.some((o) => o.busqueda.includes(consulta));
  return (
    <section className={styles.root} data-bare={sinTarjeta || undefined} aria-labelledby={`${id}-titulo`}>
      <header className={styles.header}>
        <span id={`${id}-titulo`}>{etiquetaSlot}</span>
        <span className={styles.count}>{opciones.length} {opciones.length === 1 ? "opción" : "opciones"}</span>
      </header>
      <div className={styles.body}>
        {opciones.length > 7 ? (
          <Field className={styles.search}>
            <FieldLabel htmlFor={`${id}-buscar`}>{etiquetaBusqueda}</FieldLabel>
            <Input id={`${id}-buscar`} value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder={ejemploBusqueda} />
          </Field>
        ) : null}
        {!opciones.length ? <p className={styles.message}>No hay variantes disponibles para este material.</p> : null}
        {sinCoincidencias ? <p className={styles.message}>Sin coincidencias.{elegida ? " Tu selección sigue visible." : " Probá con otro término."}</p> : null}
        {opciones.length === 1 && elegida && !elegida.recomendada && !mostrarTarjetaUnica ? (
          <div className={styles.single}>{elegida.ilustracion}<strong>{elegida.nombreAccesible ?? elegida.resumen}</strong></div>
        ) : visibles.map((grupo) => (
          <FieldSet className={styles.group} key={grupo.id}>
            <FieldLegend className={styles.legend}>
              <span>{grupo.titulo}{grupo.subtitulo ? <span className={styles.color}> · {grupo.subtitulo}</span> : null}</span>
              {grupo.detalleComun ? <span className={styles.format}>{grupo.detalleComun}</span> : null}
            </FieldLegend>
            <ChoiceCards
              label={`${etiquetaSlot}: ${[grupo.titulo, grupo.subtitulo].filter(Boolean).join(" · ")}. ${eje}`}
              value={selected}
              onChange={onSelect}
              options={grupo.opciones.map((o) => ({
                value: o.id,
                label: o.titulo,
                accessibleLabel: [o.nombreAccesible ?? o.resumen, o.recomendada ? "Recomendado por el sistema" : o.predeterminada ? "Predeterminado" : "", o.sinPrecio ? "Sin precio" : "", o.aviso].filter(Boolean).join(" · "),
                illustration: o.ilustracion,
                description: o.descripcion,
                annotation: o.recomendada ? <><span className={styles.recommended}>Recomendado</span>{o.sinPrecio ? " · Sin precio" : ""}</>
                  : [o.predeterminada ? "Predeterminado" : "", o.sinPrecio ? "Sin precio" : ""].filter(Boolean).join(" · "),
              }))}
            />
          </FieldSet>
        ))}
        {opciones.length > 0 && (opciones.length > 1 || !elegida || elegida.sinPrecio || elegida.aviso) ? (
          <div className={styles.summary} aria-live="polite" aria-atomic="true">
            {opciones.length > 1 || !elegida ? (
              elegida ? <span>Elegido: <strong>{elegida.resumen}</strong></span>
                : <span>{selected ? "La variante anterior no está disponible. Elegí una opción para continuar." : pendiente}</span>
            ) : null}
            {elegida?.sinPrecio ? <span className={styles.warning}><CircleAlert size={14} /> Sin precio cargado para la variante elegida.</span> : null}
            {elegida?.aviso ? <span className={styles.warning}><CircleAlert size={14} />{elegida.aviso}</span> : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
