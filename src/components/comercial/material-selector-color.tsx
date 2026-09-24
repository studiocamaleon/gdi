"use client";

import { useId, useState, type ReactNode } from "react";
import { ChoiceCards } from "@/components/design-system/choice-cards";
import { MaterialColorSwatch } from "@/components/design-system/material-color-swatch";
import { Field, FieldLabel, FieldSet, FieldLegend } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { type GrupoColor, varianteInicialColor, muestraColorMaterial } from "@/lib/selector-colores";
import { normalizarBusquedaMaterial } from "@/lib/selectores-materiales";
import { MaterialSelectorVisual } from "./material-selector-visual";
import { MaterialSelectorRigido } from "./material-selector-rigido";
import styles from "./material-selector-visual.module.css";

export function MaterialSelectorColor({ etiquetaSlot, grupos, selected, onSelect, sinTarjeta = false, renderVariantes }: {
  etiquetaSlot: string;
  grupos: readonly GrupoColor[];
  selected: string;
  onSelect: (variantId: string) => void;
  sinTarjeta?: boolean;
  /** El color filtra; la familia conserva su selector de gramaje, espesor, etc. */
  renderVariantes?: (grupo: GrupoColor) => ReactNode;
}) {
  const id = useId();
  const [grupoPendiente, setGrupoPendiente] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const elegido = grupos.find((g) => g.opciones.some((o) => o.id === selected));
  const activo = elegido ?? (grupos.length === 1 ? grupos[0] : !selected ? grupos.find((g) => g.id === grupoPendiente) : undefined);
  const consulta = normalizarBusquedaMaterial(busqueda);
  const coincide = (g: GrupoColor) => normalizarBusquedaMaterial(`${g.material} ${g.color}`).includes(consulta);
  const visibles = grupos.filter((g) => !consulta || coincide(g) || g.id === activo?.id);
  const etiqueta = new Set(grupos.map((g) => g.etiqueta)).size === 1 ? grupos[0]?.etiqueta : "Color";
  const variosMateriales = new Set(grupos.map((g) => g.materialId)).size > 1;
  return (
    <section className={styles.root} data-bare={sinTarjeta || undefined} aria-labelledby={`${id}-titulo`}>
      <header className={styles.header}><span id={`${id}-titulo`}>{etiquetaSlot}</span><span className={styles.count}>{grupos.length} {grupos.length === 1 ? "opción de color" : "opciones de color"}</span></header>
      <div className={styles.body}>
        {grupos.length > 1 ? <FieldSet className={styles.group}>
          <FieldLegend className={styles.legend}>{etiqueta}</FieldLegend>
          {grupos.length > 7 ? <Field className={styles.search}><FieldLabel htmlFor={`${id}-buscar`}>Buscar color o material</FieldLabel><Input id={`${id}-buscar`} value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Ej. blanco, transparente…" /></Field> : null}
          {consulta && !grupos.some(coincide) ? <p className={styles.message}>Sin coincidencias.{activo ? " Tu selección sigue visible." : " Probá con otro término."}</p> : null}
          <ChoiceCards label={`${etiquetaSlot}: ${etiqueta}`} value={activo?.id ?? ""} onChange={(key) => {
            const grupo = grupos.find((g) => g.id === key);
            if (!grupo) return;
            setGrupoPendiente(key);
            onSelect(varianteInicialColor(grupo));
          }} options={visibles.map((g) => ({
            value: g.id, label: g.color,
            accessibleLabel: [`${g.material} · ${g.etiqueta}: ${g.color}`, grupos.some((otro) => otro.id !== g.id && otro.material === g.material && otro.color === g.color) ? g.materialId : ""].filter(Boolean).join(" · "),
            illustration: <MaterialColorSwatch color={g.color} />,
            description: [variosMateriales ? g.material : "", `${g.opciones.length} ${g.opciones.length === 1 ? "variante" : "variantes"}`, grupos.some((otro) => otro.id !== g.id && otro.material === g.material && otro.color === g.color) ? `Referencia: ${g.materialId}` : ""].filter(Boolean).join(" · "),
            annotation: g.opciones.some((o) => o.predeterminada) ? "Predeterminado" : "",
          }))} />
          <p className={styles.message}>Muestras orientativas. El nombre identifica el color del catálogo.</p>
        </FieldSet> : null}
        {activo && renderVariantes ? renderVariantes(activo) : activo?.rigido ? <MaterialSelectorRigido
          key={activo.id} etiquetaSlot="Espesor" grupos={[activo.rigido]}
          selected={selected} onSelect={onSelect} sinTarjeta
        /> : activo ? <MaterialSelectorVisual
          key={activo.id}
          etiquetaSlot={activo.opciones.length > 1 ? "Variante del material" : "Material elegido"}
          grupos={[{
            id: activo.id, titulo: activo.material, subtitulo: activo.color, detalleComun: activo.detalleComun,
            opciones: activo.opciones.map((o) => ({
              ...o,
              resumen: [activo.material, activo.color, o.titulo !== activo.color ? o.titulo : "", o.descripcion].filter(Boolean).join(" · "),
              nombreAccesible: [activo.material, activo.color, ...o.detalles.map((d) => d.valor), o.referencia].filter(Boolean).join(" · "),
              ilustracion: <MaterialColorSwatch color={activo.color} />,
              aviso: muestraColorMaterial(activo.color).tipo === "desconocido" ? "Color identificado por el nombre del catálogo; sin muestra de tono." : "",
            })),
          }]}
          selected={selected} onSelect={onSelect} sinTarjeta
          eje="Variante" etiquetaBusqueda="Buscar espesor, tamaño o presentación" ejemploBusqueda="Ej. 3 mm, A4, XL…"
          pendiente="Elegí una variante de este color para cotizar."
        /> : <p className={styles.message} role="status">{selected ? "La variante anterior no está disponible. Elegí un color para continuar." : grupos.length ? "Elegí el color para ver sus variantes disponibles." : "No hay variantes disponibles para este material."}</p>}
      </div>
    </section>
  );
}
