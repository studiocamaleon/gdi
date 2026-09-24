"use client";

import { useId, useState } from "react";
import { ChoiceCards } from "@/components/design-system/choice-cards";
import { Field, FieldLabel, FieldSet, FieldLegend } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { type GrupoPapel, type OpcionPapel, varianteInicialPapel } from "@/lib/selector-papeles";
import { muestraColorMaterial } from "@/lib/selector-colores";
import { normalizarBusquedaMaterial } from "@/lib/selectores-materiales";
import { MaterialSelectorVisual } from "./material-selector-visual";
import { MaterialSelectorColor } from "./material-selector-color";
import styles from "./material-selector-visual.module.css";

/** Hojas esquemáticas: el dibujo no representa espesor ni rigidez físicos. */
function HojasPapel({ color = "" }: { color?: string }) {
  const muestra = muestraColorMaterial(color);
  return <svg width="47" height="29" viewBox="0 0 47 29" fill="none" aria-hidden="true" focusable="false"><path d="m7 18 16 8 18-9M7 13l16 8 18-9" stroke="currentColor" opacity=".45" /><path d="m6 9 18-7 18 7-18 9L6 9Z" stroke="currentColor" fill={muestra.tipo === "solido" ? muestra.hex : "var(--surface-secondary)"} /></svg>;
}

/** Cada tarjeta sigue siendo una variante real: no mezcla gramajes y formatos. */
function GramajesPapel({ papel, opciones = papel.opciones, selected, onSelect }: {
  papel: GrupoPapel;
  opciones?: readonly OpcionPapel[];
  selected: string;
  onSelect: (variantId: string) => void;
}) {
  const comunes = (opciones[0]?.detalles ?? []).filter((d) =>
    d.clave !== "formato" && opciones.every((o) => o.detalles.some((v) => v.clave === d.clave && v.valor === d.valor)),
  );
  return <MaterialSelectorVisual
    etiquetaSlot="Gramaje"
    grupos={[{
      id: papel.id, titulo: papel.material,
      detalleComun: comunes.map((d) => d.valor).join(" · "),
      opciones: opciones.map((o) => ({
        ...o,
        descripcion: [...o.detalles.filter((d) => !comunes.some((c) => c.clave === d.clave)).map((d) => d.valor), o.referencia].filter(Boolean).join(" · "),
        resumen: [papel.material, o.titulo, ...o.detalles.map((d) => d.valor), o.referencia].filter(Boolean).join(" · "),
        nombreAccesible: [papel.material, o.titulo, ...o.detalles.map((d) => d.valor), o.referencia].filter(Boolean).join(" · "),
        ilustracion: <HojasPapel color={o.color} />,
      })),
    }]}
    selected={selected} onSelect={onSelect} sinTarjeta mostrarTarjetaUnica
    eje="Gramaje" etiquetaBusqueda="Buscar gramaje, acabado o formato" ejemploBusqueda="Ej. 150, mate, SRA3…"
    pendiente="Elegí el gramaje y formato para cotizar con este papel."
  />;
}

export function MaterialSelectorPapel({ etiquetaSlot, grupos, selected, onSelect, sinTarjeta = false }: {
  etiquetaSlot: string;
  grupos: readonly GrupoPapel[];
  selected: string;
  onSelect: (variantId: string) => void;
  sinTarjeta?: boolean;
}) {
  const id = useId();
  const [papelPendiente, setPapelPendiente] = useState("");
  const [busqueda, setBusqueda] = useState("");
  // Restaurar/editar una variante siempre prevalece sobre la navegación local.
  const elegido = grupos.find((g) => g.opciones.some((o) => o.id === selected));
  const activo = elegido ?? (grupos.length === 1 ? grupos[0] : !selected ? grupos.find((g) => g.id === papelPendiente) : undefined);
  const consulta = normalizarBusquedaMaterial(busqueda);
  const visibles = grupos.filter((g) => !consulta || normalizarBusquedaMaterial(g.material).includes(consulta) || g.id === activo?.id);
  return (
    <section className={styles.root} data-bare={sinTarjeta || undefined} aria-labelledby={`${id}-titulo`}>
      <header className={styles.header}><span id={`${id}-titulo`}>{etiquetaSlot}</span><span className={styles.count}>{grupos.length} {grupos.length === 1 ? "papel" : "papeles"}</span></header>
      <div className={styles.body}>
        {grupos.length > 1 ? <FieldSet className={styles.group}>
          <FieldLegend className={styles.legend}>Tipo de papel</FieldLegend>
          {grupos.length > 7 ? <Field className={styles.search}><FieldLabel htmlFor={`${id}-buscar`}>Buscar papel</FieldLabel><Input id={`${id}-buscar`} value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Ej. ilustración, opalina…" /></Field> : null}
          {consulta && !grupos.some((g) => normalizarBusquedaMaterial(g.material).includes(consulta)) ? <p className={styles.message}>Sin coincidencias.{activo ? " Tu papel sigue visible." : " Probá con otro término."}</p> : null}
          <ChoiceCards label={`${etiquetaSlot}: Tipo de papel`} value={activo?.id ?? ""} onChange={(paperId) => {
            const papel = grupos.find((g) => g.id === paperId);
            if (!papel) return;
            setPapelPendiente(paperId);
            onSelect(varianteInicialPapel(papel));
          }} options={visibles.map((g) => ({
            value: g.id, label: g.material,
            accessibleLabel: grupos.filter((p) => p.material === g.material).length > 1 ? `${g.material} · ${g.id}` : g.material,
            illustration: <HojasPapel />,
            description: [g.opciones.length ? `${g.opciones.length} ${g.opciones.length === 1 ? "variante disponible" : "variantes disponibles"}` : "Sin variantes disponibles", grupos.filter((p) => p.material === g.material).length > 1 ? `Referencia: ${g.id}` : ""].filter(Boolean).join(" · "),
          }))} />
        </FieldSet> : null}
        {activo?.colores.length && activo.colores.length > 1 ? <MaterialSelectorColor
          key={activo.id} etiquetaSlot="Color del papel" grupos={activo.colores}
          selected={selected} onSelect={(variantId) => {
            setPapelPendiente(activo.id);
            onSelect(variantId);
          }} sinTarjeta renderVariantes={(color) => <GramajesPapel
            key={color.id} papel={activo}
            opciones={activo.opciones.filter((o) => color.opciones.some((v) => v.id === o.id))}
            selected={selected} onSelect={onSelect}
          />}
        /> : activo ? <GramajesPapel
          key={activo.id} papel={activo} selected={selected} onSelect={onSelect}
        /> : <p className={styles.message} role="status">{selected ? "La variante anterior no está disponible. Elegí el papel para continuar." : "Elegí el tipo de papel para ver sus gramajes y formatos."}</p>}
      </div>
    </section>
  );
}
