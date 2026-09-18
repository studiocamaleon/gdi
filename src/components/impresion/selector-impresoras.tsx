"use client";

import { Input } from "@heroui/react";
import { Printer, Ruler, ChevronRight, Search } from "lucide-react";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import type { DestinoImpresion } from "@/lib/impresion-api";
import type { CategoriaImpresora } from "./tipos-impresora";
import s from "./perfiles-impresion.module.css";

export function SelectorImpresoras({
  destinos,
  seleccionado,
  categoria,
  busqueda,
  onBuscar,
  onSeleccionar,
  disabled,
}: {
  destinos: DestinoImpresion[];
  seleccionado?: string;
  categoria: CategoriaImpresora;
  busqueda: string;
  onBuscar: (v: string) => void;
  onSeleccionar: (id: string) => void;
  disabled: boolean;
}) {
  const Icon = categoria === "cad" ? Ruler : Printer;
  return (
    <aside className={s.selector} aria-label="Elegir impresora">
      <Field className={s.buscador}>
        <FieldLabel htmlFor="buscar-impresora">
          Tus equipos <span>{destinos.length}</span>
        </FieldLabel>
        <div className={s.searchInput}>
          <Search aria-hidden="true" />
          <Input
            id="buscar-impresora"
            aria-label="Buscar impresora"
            placeholder="Buscar por nombre…"
            value={busqueda}
            onChange={(e) => onBuscar(e.target.value)}
            disabled={disabled}
          />
        </div>
      </Field>
      <nav className={s.listaEquipos} aria-label="Impresoras disponibles">
        {destinos.map((d) => (
          <button
            type="button"
            key={d.id}
            className={s.equipo}
            aria-pressed={d.id === seleccionado}
            disabled={disabled}
            onClick={() => onSeleccionar(d.id)}
          >
            <span className={s.equipoIcon}>
              <Icon aria-hidden="true" />
            </span>
            <span className={s.equipoTexto}>
              <strong>{d.nombre}</strong>
              <small>
                {d.cad
                  ? `Rollo ${d.cad.anchoRolloMm} mm`
                  : categoria === "cad"
                    ? "Rollo sin configurar"
                    : `${d.bandejas.length} ${d.bandejas.length === 1 ? "bandeja" : "bandejas"}`}
                {!d.activo && " · Inactiva"}
              </small>
            </span>
            <ChevronRight aria-hidden="true" />
          </button>
        ))}
      </nav>
      {destinos.length === 0 && (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>Sin resultados</EmptyTitle>
            <EmptyDescription>Probá con otro nombre.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </aside>
  );
}
