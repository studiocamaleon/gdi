"use client";

import * as React from "react";
import { SaveIcon } from "lucide-react";
import { toast } from "sonner";

import type { ProductTabProps } from "@/components/productos-servicios/product-detail-types";
import { GdiSpinner } from "@/components/brand/gdi-spinner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  estadoProductoServicioItems,
  tipoProductoServicioItems,
  unidadComercialProductoItems,
  type EstadoProductoServicio,
  type UnidadComercialProducto,
} from "@/lib/productos-servicios";
import { assignProductoMotor, updateProductoServicio } from "@/lib/productos-servicios-api";

type ProductoGeneralDraft = {
  nombre: string;
  descripcion: string;
  familiaProductoId: string;
  subfamiliaProductoId: string;
  unidadComercial: UnidadComercialProducto;
  motorCodigo: string;
  motorVersion: number;
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
    motorCodigo: props.producto.motorCodigo,
    motorVersion: props.producto.motorVersion,
  };
}

export function ProductoGeneralTab(props: ProductTabProps) {
  const [draft, setDraft] = React.useState<ProductoGeneralDraft>(() => buildDraft(props));
  const [isSaving, startSaving] = React.useTransition();

  React.useEffect(() => {
    setDraft(buildDraft(props));
  }, [
    props.producto.nombre,
    props.producto.descripcion,
    props.producto.familiaProductoId,
    props.producto.subfamiliaProductoId,
    props.producto.unidadComercial,
    props.producto.motorCodigo,
    props.producto.motorVersion,
  ]);

  const familySubfamilies = React.useMemo(
    () => props.subfamilias.filter((item) => item.familiaProductoId === draft.familiaProductoId),
    [draft.familiaProductoId, props.subfamilias],
  );

  const motorCostoValue = `${draft.motorCodigo}@${draft.motorVersion}`;
  const motorCostoLabel = React.useMemo(
    () =>
      props.motores.find((item) => `${item.code}@${item.version}` === motorCostoValue)?.label ??
      "Selecciona motor de costo",
    [props.motores, motorCostoValue],
  );
  const familiaGeneralLabel =
    props.familias.find((item) => item.id === draft.familiaProductoId)?.nombre ?? "Seleccionar familia";
  const subfamiliaGeneralLabel =
    familySubfamilies.find((item) => item.id === draft.subfamiliaProductoId)?.nombre ?? "Sin subfamilia";
  const tipoProductoLabel =
    tipoProductoServicioItems.find((item) => item.value === props.producto.tipo)?.label ?? "Producto";
  const estadoProductoLabel =
    estadoProductoServicioItems.find((item) => item.value === (props.producto.estado as EstadoProductoServicio))?.label ??
    props.producto.estado;
  const isGeneralDirty =
    draft.nombre !== props.producto.nombre ||
    draft.descripcion !== (props.producto.descripcion ?? "") ||
    draft.familiaProductoId !== props.producto.familiaProductoId ||
    draft.subfamiliaProductoId !== (props.producto.subfamiliaProductoId ?? "") ||
    draft.unidadComercial !== props.producto.unidadComercial ||
    draft.motorCodigo !== props.producto.motorCodigo ||
    draft.motorVersion !== props.producto.motorVersion;

  const save = () =>
    startSaving(async () => {
      try {
        const updated = await updateProductoServicio(props.producto.id, {
          nombre: draft.nombre.trim(),
          descripcion: draft.descripcion.trim() || undefined,
          familiaProductoId: draft.familiaProductoId,
          subfamiliaProductoId: draft.subfamiliaProductoId || undefined,
          unidadComercial: draft.unidadComercial,
          estado: props.producto.estado as EstadoProductoServicio,
          activo: props.producto.activo,
        });
        if (
          draft.motorCodigo !== props.producto.motorCodigo ||
          draft.motorVersion !== props.producto.motorVersion
        ) {
          await assignProductoMotor(updated.id, {
            motorCodigo: draft.motorCodigo,
            motorVersion: draft.motorVersion,
          });
        }
        await props.refreshProducto();
        toast.success("Producto actualizado.");
      } catch (error) {
        console.error(error);
        toast.error("No se pudo actualizar el producto.");
      }
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle>General</CardTitle>
        <CardDescription>Identidad comercial y motor de costo del producto.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">Nombre</p>
          <Input
            value={draft.nombre}
            onChange={(e) => setDraft((prev) => ({ ...prev, nombre: e.target.value }))}
            placeholder="Nombre del producto"
          />
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">Código</p>
          <p className="font-medium">{props.producto.codigo}</p>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">Clase</p>
          <p className="font-medium">{tipoProductoLabel}</p>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">Estado</p>
          <p className="font-medium">{estadoProductoLabel}</p>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">Familia</p>
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
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar familia">{familiaGeneralLabel}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {props.familias.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">Subfamilia</p>
          <Select
            value={draft.subfamiliaProductoId || "__none__"}
            onValueChange={(value) =>
              setDraft((prev) => ({
                ...prev,
                subfamiliaProductoId: !value || value === "__none__" ? "" : value,
              }))
            }
            disabled={familySubfamilies.length === 0}
          >
            <SelectTrigger>
              <SelectValue placeholder="Sin subfamilia">{subfamiliaGeneralLabel}</SelectValue>
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
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">Unidad comercial</p>
          <Select
            value={draft.unidadComercial}
            onValueChange={(value) =>
              setDraft((prev) => ({
                ...prev,
                unidadComercial: (value as UnidadComercialProducto) ?? "unidad",
              }))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar unidad comercial">
                {
                  unidadComercialProductoItems.find((item) => item.value === draft.unidadComercial)?.label ??
                  "Seleccionar unidad comercial"
                }
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
        </div>
        <div className="rounded-lg border p-3 md:col-span-2">
          <p className="text-xs text-muted-foreground">Descripción</p>
          <textarea
            value={draft.descripcion}
            onChange={(e) => setDraft((prev) => ({ ...prev, descripcion: e.target.value }))}
            placeholder="Descripción del producto"
            className="min-h-[96px] w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
        </div>
        <div className="rounded-lg border p-3 md:col-span-2">
          <p className="text-xs text-muted-foreground">Motor de costo</p>
          <Select
            value={motorCostoValue}
            onValueChange={(value) =>
              setDraft((prev) => {
                const [motorCodigo, motorVersionRaw] = String(value ?? "").split("@");
                const parsedVersion = Number(motorVersionRaw ?? "1");
                return {
                  ...prev,
                  motorCodigo: motorCodigo || prev.motorCodigo,
                  motorVersion: Number.isFinite(parsedVersion) ? parsedVersion : prev.motorVersion,
                };
              })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecciona motor de costo">{motorCostoLabel}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {props.motores.map((item) => (
                <SelectItem key={`${item.code}@${item.version}`} value={`${item.code}@${item.version}`}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="md:col-span-2">
        <Button onClick={save} disabled={isSaving || !isGeneralDirty || !draft.nombre.trim() || !draft.familiaProductoId}>
          {isSaving ? <GdiSpinner className="mr-2 size-4" /> : <SaveIcon className="mr-2 size-4" />}
          Guardar datos generales
        </Button>
        </div>
      </CardContent>
    </Card>
  );
}
