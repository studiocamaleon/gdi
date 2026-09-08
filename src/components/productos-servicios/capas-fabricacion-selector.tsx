"use client";

import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  EntidadInspeccion,
  InspeccionVector,
  SeleccionVector,
} from "@/lib/geometrias-producto-api";
import styles from "./capas-fabricacion.module.css";

const usos = {
  SIN_OPERACION: "Sin operación",
  CORTE_INTERIOR: "Corte completo",
  CORTE_PARCIAL: "Corte parcial",
  HENDIDO: "Hendido",
  MIXTO: "Distintos usos",
};
type Uso = keyof typeof usos;

export function CapasFabricacionSelector({
  inspeccion,
  seleccion,
  onChange,
}: {
  inspeccion: InspeccionVector;
  seleccion: SeleccionVector;
  onChange: (seleccion: SeleccionVector) => void;
}) {
  const capas = new Map<string, EntidadInspeccion[]>();
  for (const e of inspeccion.entidades)
    capas.set(e.capa, [...(capas.get(e.capa) ?? []), e]);
  const excluidas = new Set(seleccion.excluidas ?? []);
  const conservada = (e: EntidadInspeccion) => !excluidas.has(e.id);
  const uso = (entidades: EntidadInspeccion[]): Uso => {
    const valores = new Set(
      entidades.map(
        (e) =>
          seleccion.operaciones.find((o) => o.entidadId === e.id)?.tipo ??
          "SIN_OPERACION",
      ),
    );
    return valores.size > 1 ? "MIXTO" : ([...valores][0] ?? "SIN_OPERACION");
  };
  const conservar = (entidades: EntidadInspeccion[], valor: boolean) => {
    const ids = new Set(
      entidades.filter((e) => e.id !== seleccion.exteriorId).map((e) => e.id),
    );
    onChange({
      ...seleccion,
      excluidas: inspeccion.entidades
        .filter((e) => (ids.has(e.id) ? !valor : excluidas.has(e.id)))
        .map((e) => e.id),
      operaciones: valor
        ? seleccion.operaciones
        : seleccion.operaciones.filter((o) => !ids.has(o.entidadId)),
    });
  };
  const asignar = (entidades: EntidadInspeccion[], valor: string | null) => {
    if (!valor || valor === "MIXTO") return;
    const ids = new Set(entidades.map((e) => e.id));
    onChange({
      ...seleccion,
      operaciones: [
        ...seleccion.operaciones.filter((o) => !ids.has(o.entidadId)),
        ...entidades
          .filter(
            (e) =>
              conservada(e) &&
              e.id !== seleccion.exteriorId &&
              e.puntos.length > 1 &&
              e.exportable !== false,
          )
          .flatMap((e) =>
            valor === "CORTE_INTERIOR" ||
            valor === "CORTE_PARCIAL" ||
            valor === "HENDIDO"
              ? [
                  {
                    entidadId: e.id,
                    tipo: valor as
                      | "CORTE_INTERIOR"
                      | "CORTE_PARCIAL"
                      | "HENDIDO",
                  },
                ]
              : [],
          ),
      ],
    });
  };
  const selector = (entidades: EntidadInspeccion[], nombre: string) => (
    <Select
      value={uso(entidades)}
      onValueChange={(v) => asignar(entidades, v)}
      disabled={
        !entidades.some(
          (e) => conservada(e) && e.puntos.length > 1 && e.exportable !== false,
        )
      }
    >
      <SelectTrigger
        aria-label={`Uso de ${nombre}`}
        className={styles.useSelect}
      >
        <SelectValue>{usos[uso(entidades)]}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectItem value="SIN_OPERACION">Sin operación</SelectItem>
          <SelectItem value="CORTE_INTERIOR">Corte completo</SelectItem>
          <SelectItem value="CORTE_PARCIAL">Corte parcial</SelectItem>
          <SelectItem value="HENDIDO">Hendido</SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  );
  return (
    <section className={styles.section} aria-label="Capas de fabricación">
      <div className={styles.header}>
        <h3>Capas de fabricación</h3>
        <p>
          Las capas visibles acompañan cada copia. Asigná su uso cuando
          corresponda.
        </p>
      </div>
      <div className={styles.columns} aria-hidden="true">
        <span>Capa y entidades</span>
        <span>Conservar</span>
        <span>Uso</span>
      </div>
      {[...capas].map(([nombre, entidades]) => {
        const adicionales = entidades.filter(
          (e) => e.id !== seleccion.exteriorId,
        );
        const contieneExterior = entidades.some(
          (e) => e.id === seleccion.exteriorId,
        );
        const cantidad = adicionales.filter(conservada).length;
        return (
          <details key={nombre} className={styles.layer}>
            <summary className={styles.layerName}>
              <span
                className={styles.swatch}
                style={{
                  backgroundColor: entidades[0].color ?? "var(--muted-text-2)",
                }}
              />
              <strong>{nombre}</strong>
              <span>
                {entidades.length}{" "}
                {entidades.length === 1 ? "entidad" : "entidades"}
                {contieneExterior ? " · Exterior de nesting" : ""}
              </span>
              <span
                className={styles.layerControls}
                onClick={(event) => event.stopPropagation()}
              >
                <Checkbox
                  aria-label={`Conservar capa ${nombre}`}
                  checked={
                    !adicionales.length || cantidad === adicionales.length
                  }
                  indeterminate={cantidad > 0 && cantidad < adicionales.length}
                  disabled={!adicionales.length}
                  onCheckedChange={(v) => conservar(adicionales, v === true)}
                />
                {adicionales.length ? (
                  selector(adicionales, nombre)
                ) : (
                  <span className={styles.exterior}>Corte exterior</span>
                )}
              </span>
            </summary>
            <div className={styles.entities}>
              {entidades.map((e) => (
                <div key={e.id} className={styles.entity}>
                  <div>
                    <strong>
                      {e.tipoEntidad ?? "Contorno"} · {e.id}
                    </strong>
                    <small>
                      {e.id === seleccion.exteriorId
                        ? "Exterior de nesting"
                        : (e.motivoNoCompatible ??
                          (e.cerrada
                            ? "Recorrido cerrado"
                            : e.puntos.length
                              ? "Recorrido abierto"
                              : "Referencia sin recorrido"))}
                    </small>
                  </div>
                  <Checkbox
                    aria-label={`Conservar entidad ${e.id}`}
                    checked={conservada(e)}
                    disabled={e.id === seleccion.exteriorId}
                    onCheckedChange={(v) => conservar([e], v === true)}
                  />
                  {e.id === seleccion.exteriorId ? (
                    <span className={styles.exterior}>Corte exterior</span>
                  ) : (
                    selector([e], `entidad ${e.id}`)
                  )}
                </div>
              ))}
            </div>
          </details>
        );
      })}
      <p className={styles.help}>
        «Sin operación» conserva el contenido sin agregar tiempo ni costo de
        corte. Excluí lo que no pertenece a esta pieza.
      </p>
    </section>
  );
}
