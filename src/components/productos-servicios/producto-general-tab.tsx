"use client";

import * as React from "react";
import { toast } from "sonner";

import type { ProductTabProps } from "@/components/productos-servicios/product-detail-types";
import { GdiSpinner } from "@/components/brand/gdi-spinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  estadoProductoServicioItems,
  tipoProductoServicioItems,
  unidadComercialProductoItems,
  type EstadoProductoServicio,
  type UnidadComercialProducto,
} from "@/lib/productos-servicios";
import { updateProductoServicio } from "@/lib/productos-servicios-api";
import { cn } from "@/lib/utils";

type ProductoGeneralDraft = {
  nombre: string;
  descripcion: string;
  familiaProductoId: string;
  subfamiliaProductoId: string;
  unidadComercial: UnidadComercialProducto;
  modoMedidas: "ESTANDAR" | "LIBRE";
};

function buildDraft(props: ProductTabProps): ProductoGeneralDraft {
  const unidadComercial = unidadComercialProductoItems.some(
    (item) => item.value === props.producto.unidadComercial,
  )
    ? (props.producto.unidadComercial as UnidadComercialProducto)
    : "unidad";
  return {
    nombre: props.producto.nombre,
    descripcion: props.producto.descripcion ?? "",
    familiaProductoId: props.producto.familiaProductoId,
    subfamiliaProductoId: props.producto.subfamiliaProductoId ?? "",
    unidadComercial,
    modoMedidas: props.producto.modoMedidas ?? "ESTANDAR",
  };
}

function formatDate(iso: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function formatRelative(iso: string): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    if (sameDay) return `hoy · ${hh}:${mm}`;
    return `${formatDate(iso)} · ${hh}:${mm}`;
  } catch {
    return iso;
  }
}

export function ProductoGeneralTab(props: ProductTabProps) {
  const [draft, setDraft] = React.useState<ProductoGeneralDraft>(() =>
    buildDraft(props),
  );
  const [isSaving, startSaving] = React.useTransition();

  React.useEffect(() => {
    setDraft(buildDraft(props));
  }, [
    props.producto.nombre,
    props.producto.descripcion,
    props.producto.familiaProductoId,
    props.producto.subfamiliaProductoId,
    props.producto.unidadComercial,
    props.producto.modoMedidas,
  ]);

  const familySubfamilies = React.useMemo(
    () =>
      props.subfamilias.filter(
        (item) => item.familiaProductoId === draft.familiaProductoId,
      ),
    [draft.familiaProductoId, props.subfamilias],
  );

  const familiaGeneralLabel =
    props.familias.find((item) => item.id === draft.familiaProductoId)
      ?.nombre ?? "Seleccionar familia";
  const subfamiliaGeneralLabel =
    familySubfamilies.find(
      (item) => item.id === draft.subfamiliaProductoId,
    )?.nombre ?? "Sin subfamilia";
  const tipoProductoLabel =
    tipoProductoServicioItems.find((item) => item.value === props.producto.tipo)
      ?.label ?? "Producto";
  const estadoProductoLabel =
    estadoProductoServicioItems.find(
      (item) => item.value === (props.producto.estado as EstadoProductoServicio),
    )?.label ?? props.producto.estado;
  const isGeneralDirty =
    draft.nombre !== props.producto.nombre ||
    draft.descripcion !== (props.producto.descripcion ?? "") ||
    draft.familiaProductoId !== props.producto.familiaProductoId ||
    draft.subfamiliaProductoId !==
      (props.producto.subfamiliaProductoId ?? "") ||
    draft.unidadComercial !== props.producto.unidadComercial ||
    draft.modoMedidas !== (props.producto.modoMedidas ?? "ESTANDAR");

  const save = () =>
    startSaving(async () => {
      try {
        await updateProductoServicio(props.producto.id, {
          nombre: draft.nombre.trim(),
          descripcion: draft.descripcion.trim() || undefined,
          familiaProductoId: draft.familiaProductoId,
          subfamiliaProductoId: draft.subfamiliaProductoId || undefined,
          unidadComercial: draft.unidadComercial,
          modoMedidas: draft.modoMedidas,
          estado: props.producto.estado as EstadoProductoServicio,
          activo: props.producto.activo,
        });
        await props.refreshProducto();
        toast.success("Producto actualizado.");
      } catch (error) {
        console.error(error);
        toast.error("No se pudo actualizar el producto.");
      }
    });

  const fichaRows: { k: string; v: string; tone?: "lime" }[] = [
    { k: "Creado", v: formatDate(props.producto.createdAt) },
    { k: "Última edición", v: formatRelative(props.producto.updatedAt) },
    { k: "Familia", v: props.producto.familiaProductoNombre },
    {
      k: "Subfamilia",
      v: props.producto.subfamiliaProductoNombre ?? "—",
    },
    {
      k: "Ruta default",
      v: props.producto.procesoDefinicionDefaultNombre || "—",
    },
    {
      k: "Variantes",
      v: String(props.variantes.length),
      tone: props.variantes.length > 0 ? "lime" : undefined,
    },
  ];

  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1fr_300px]">
      {/* MAIN FORM */}
      <section className="overflow-hidden rounded-[10px] border border-line bg-bg-1 px-7 py-6">
        <header className="-mt-1 mb-5 flex flex-wrap items-baseline justify-between gap-3 border-b border-line pb-4">
          <div>
            <h2 className="m-0 font-serif text-[28px] font-normal leading-tight tracking-[-0.01em] text-ink-0">
              General
            </h2>
            <div className="mt-1 text-[13px] text-ink-2">
              Identidad comercial y configuración básica del producto.
            </div>
          </div>
          <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-3">
            Datos generales
          </div>
        </header>

        <div className="grid gap-3.5 md:grid-cols-2">
          <FormField label="Nombre" required>
            <Input
              value={draft.nombre}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, nombre: e.target.value }))
              }
              placeholder="Nombre del producto"
              className="border-0 bg-transparent p-0 text-sm text-ink-0 shadow-none focus-visible:ring-0"
            />
          </FormField>

          <FormField label="Código" hint="interno · no editable">
            <div className="text-sm text-ink-2">{props.producto.codigo}</div>
          </FormField>

          <FormField label="Clase">
            <div className="text-sm text-ink-1">{tipoProductoLabel}</div>
          </FormField>

          <FormField label="Estado">
            <div className="text-sm text-ink-1">{estadoProductoLabel}</div>
          </FormField>

          <FormField label="Familia">
            <Select
              value={draft.familiaProductoId}
              onValueChange={(value) =>
                setDraft((prev) => ({
                  ...prev,
                  familiaProductoId: value ?? "",
                  subfamiliaProductoId: "",
                }))
              }
            >
              <SelectTrigger className="h-auto border-0 bg-transparent p-0 text-sm text-ink-0 shadow-none focus-visible:ring-0">
                <SelectValue placeholder="Seleccionar familia">
                  {familiaGeneralLabel}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {props.familias.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <FormField label="Subfamilia">
            <Select
              value={draft.subfamiliaProductoId || "__none__"}
              onValueChange={(value) =>
                setDraft((prev) => ({
                  ...prev,
                  subfamiliaProductoId:
                    !value || value === "__none__" ? "" : value,
                }))
              }
              disabled={familySubfamilies.length === 0}
            >
              <SelectTrigger className="h-auto border-0 bg-transparent p-0 text-sm text-ink-0 shadow-none focus-visible:ring-0">
                <SelectValue placeholder="Sin subfamilia">
                  {subfamiliaGeneralLabel}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Sin subfamilia</SelectItem>
                {familySubfamilies.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <FormField label="Unidad comercial">
            <Select
              value={draft.unidadComercial}
              onValueChange={(value) =>
                setDraft((prev) => ({
                  ...prev,
                  unidadComercial:
                    (value as UnidadComercialProducto) ?? "unidad",
                }))
              }
            >
              <SelectTrigger className="h-auto border-0 bg-transparent p-0 text-sm text-ink-0 shadow-none focus-visible:ring-0">
                <SelectValue placeholder="Seleccionar unidad comercial">
                  {unidadComercialProductoItems.find(
                    (item) => item.value === draft.unidadComercial,
                  )?.label ?? "Seleccionar unidad comercial"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {unidadComercialProductoItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <FormField label="Modo de medidas">
            <Select
              value={draft.modoMedidas}
              onValueChange={(value) =>
                setDraft((prev) => ({
                  ...prev,
                  modoMedidas: (value as "ESTANDAR" | "LIBRE") ?? "ESTANDAR",
                }))
              }
            >
              <SelectTrigger className="h-auto border-0 bg-transparent p-0 text-sm text-ink-0 shadow-none focus-visible:ring-0">
                <SelectValue>
                  {draft.modoMedidas === "LIBRE"
                    ? "Libre (medidas del cliente)"
                    : "Estándar (variantes con medidas fijas)"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ESTANDAR">
                  Estándar (variantes con medidas fijas)
                </SelectItem>
                <SelectItem value="LIBRE">
                  Libre (medidas del cliente)
                </SelectItem>
              </SelectContent>
            </Select>
          </FormField>

          {/* Field-help inline */}
          <div className="-mt-1 flex items-baseline gap-2 px-1 text-xs text-ink-3 md:col-span-2">
            <span className="font-mono text-ink-4">↳</span>
            <span>
              En modo{" "}
              <em className="font-serif text-[13px] italic text-ink-1">libre</em>{" "}
              el tab "Variantes" se oculta y las cotizaciones se calculan a
              medida del cliente.
            </span>
          </div>

          <FormField label="Descripción" hint="opcional · aparece en la cotización" colSpan>
            <textarea
              value={draft.descripcion}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, descripcion: e.target.value }))
              }
              placeholder="Ej: tarjeta standard 90×55mm, papel ilustración 300g, laminado brillante una cara…"
              className="min-h-[72px] w-full resize-none border-0 bg-transparent p-0 font-sans text-sm leading-[1.55] text-ink-0 outline-none placeholder:text-ink-3"
            />
          </FormField>
        </div>

        {/* Footer */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3.5 border-t border-dashed border-line pt-4">
          <div className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.06em] text-ink-3">
            <span
              className={cn(
                "size-1.5 rounded-full",
                isGeneralDirty
                  ? "bg-warn"
                  : "bg-ok shadow-[0_0_8px_var(--ok)]",
              )}
            />
            {isGeneralDirty ? "Cambios sin guardar" : "Sin cambios pendientes"}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDraft(buildDraft(props))}
              disabled={!isGeneralDirty || isSaving}
            >
              Descartar cambios
            </Button>
            <Button
              size="sm"
              onClick={save}
              disabled={
                isSaving ||
                !isGeneralDirty ||
                !draft.nombre.trim() ||
                !draft.familiaProductoId
              }
            >
              {isSaving ? (
                <GdiSpinner className="size-3.5" data-icon="inline-start" />
              ) : null}
              Guardar datos generales
            </Button>
          </div>
        </div>
      </section>

      {/* ASIDE — Ficha técnica */}
      <aside className="sticky top-20 overflow-hidden rounded-[10px] border border-line bg-bg-1 p-5">
        <h3 className="m-0 mb-3.5 font-serif text-[22px] font-normal italic leading-tight tracking-[-0.01em] text-ink-0">
          Ficha técnica
        </h3>
        <div className="flex flex-col">
          {fichaRows.map((row, idx) => (
            <div
              key={row.k}
              className={cn(
                "flex items-baseline justify-between border-b border-dashed border-line py-2 text-xs",
                idx === fichaRows.length - 1 && "border-b-0",
              )}
            >
              <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-3">
                {row.k}
              </span>
              <span
                className={cn(
                  "font-mono text-[11px]",
                  row.tone === "lime" ? "text-lime" : "text-ink-1",
                )}
              >
                {row.v}
              </span>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}

// ──────────────── Subcomponentes locales ────────────────

function FormField({
  label,
  required,
  hint,
  colSpan,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  colSpan?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-md border border-line-hi bg-bg px-3.5 py-2.5 transition-colors hover:border-ink-4 focus-within:border-lime focus-within:ring-[3px] focus-within:ring-lime/10",
        colSpan && "md:col-span-2",
      )}
    >
      <div className="mb-1 flex items-baseline justify-between font-mono text-[9px] uppercase tracking-[0.14em] text-ink-3">
        <span>
          {label}
          {required && <span className="ml-1 text-lime">*</span>}
        </span>
        {hint && (
          <span className="font-sans text-[11px] tracking-normal normal-case text-ink-4">
            {hint}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}
