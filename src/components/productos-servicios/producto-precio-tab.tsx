"use client";

import * as React from "react";
import { PencilIcon, PlusIcon, SaveIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import type { ProductTabProps } from "@/components/productos-servicios/product-detail-types";
import {
  buildPrecioConfigDraft,
  buildPrecioConfigForMethod,
  buildPrecioEspecialClienteDraft,
  buildPrecioEspecialClienteFromDraft,
  formatNumber,
  getPrecioEspecialClienteResumen,
  getPrecioMethodDescription,
  getPrecioMethodLabel,
  getUnidadComercialProductoLabel,
  metodoCalculoPrecioItems,
  precioComisionTipoItems,
  type PrecioEspecialClienteDraft,
} from "@/components/productos-servicios/producto-comercial.helpers";
import { GdiSpinner } from "@/components/brand/gdi-spinner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  createProductoComision,
  updateProductoPrecio,
  updateProductoPrecioEspecialClientes,
  updateProductoComision,
  updateProductoImpuesto,
} from "@/lib/productos-servicios-api";
import type {
  MetodoCalculoPrecioProducto,
  ProductoComisionCatalogo,
  ProductoImpuestoCatalogo,
  ProductoPrecioConfig,
  ProductoPrecioEspecialCliente,
  ProductoPrecioFilaCantidadMargen,
  ProductoPrecioFilaCantidadPrecio,
  ProductoPrecioFilaRangoMargen,
  ProductoPrecioFilaRangoPrecio,
} from "@/lib/productos-servicios";

function slugifyNombre(value: string) {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return normalized || `esquema_${Date.now()}`;
}

function PrecioMetodoDetalleEditor({
  value,
  onChange,
}: {
  value: ProductoPrecioConfig;
  onChange: (next: ProductoPrecioConfig) => void;
}) {
  const updateDetalle = (detalle: ProductoPrecioConfig["detalle"]) => onChange({ ...value, detalle } as ProductoPrecioConfig);

  if (value.metodoCalculo === "por_margen") {
    const detalle = value.detalle as Extract<ProductoPrecioConfig, { metodoCalculo: "por_margen" }>["detalle"];
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <Field>
          <FieldLabel>Margen objetivo (%)</FieldLabel>
          <Input
            type="number"
            value={detalle.marginPct}
            onChange={(e) => updateDetalle({ ...detalle, marginPct: Number(e.target.value || 0) })}
          />
        </Field>
        <Field>
          <FieldLabel>Margen mínimo (%)</FieldLabel>
          <Input
            type="number"
            value={detalle.minimumMarginPct}
            onChange={(e) => updateDetalle({ ...detalle, minimumMarginPct: Number(e.target.value || 0) })}
          />
        </Field>
      </div>
    );
  }

  if (value.metodoCalculo === "precio_fijo") {
    const detalle = value.detalle as Extract<ProductoPrecioConfig, { metodoCalculo: "precio_fijo" }>["detalle"];
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <Field>
          <FieldLabel>Precio fijo</FieldLabel>
          <Input type="number" value={detalle.price} onChange={(e) => updateDetalle({ ...detalle, price: Number(e.target.value || 0) })} />
        </Field>
        <Field>
          <FieldLabel>Precio mínimo</FieldLabel>
          <Input
            type="number"
            value={detalle.minimumPrice}
            onChange={(e) => updateDetalle({ ...detalle, minimumPrice: Number(e.target.value || 0) })}
          />
        </Field>
      </div>
    );
  }

  if (value.metodoCalculo === "precio_fijo_para_margen_minimo") {
    const detalle = value.detalle as Extract<ProductoPrecioConfig, { metodoCalculo: "precio_fijo_para_margen_minimo" }>["detalle"];
    return (
      <div className="grid gap-4 md:grid-cols-3">
        <Field>
          <FieldLabel>Precio fijo</FieldLabel>
          <Input type="number" value={detalle.price} onChange={(e) => updateDetalle({ ...detalle, price: Number(e.target.value || 0) })} />
        </Field>
        <Field>
          <FieldLabel>Precio mínimo</FieldLabel>
          <Input
            type="number"
            value={detalle.minimumPrice}
            onChange={(e) => updateDetalle({ ...detalle, minimumPrice: Number(e.target.value || 0) })}
          />
        </Field>
        <Field>
          <FieldLabel>Margen mínimo (%)</FieldLabel>
          <Input
            type="number"
            value={detalle.minimumMarginPct}
            onChange={(e) => updateDetalle({ ...detalle, minimumMarginPct: Number(e.target.value || 0) })}
          />
        </Field>
      </div>
    );
  }

  const addTier = () => {
    if (value.metodoCalculo === "fijado_por_cantidad") {
      const detalle = value.detalle as Extract<ProductoPrecioConfig, { metodoCalculo: "fijado_por_cantidad" }>["detalle"];
      updateDetalle({ tiers: [...detalle.tiers, { quantity: 1, price: 0 }] });
      return;
    }
    if (value.metodoCalculo === "fijo_con_margen_variable") {
      const detalle = value.detalle as Extract<ProductoPrecioConfig, { metodoCalculo: "fijo_con_margen_variable" }>["detalle"];
      updateDetalle({ tiers: [...detalle.tiers, { quantity: 1, marginPct: 0 }] });
      return;
    }
    if (value.metodoCalculo === "variable_por_cantidad") {
      const detalle = value.detalle as Extract<ProductoPrecioConfig, { metodoCalculo: "variable_por_cantidad" }>["detalle"];
      updateDetalle({ tiers: [...detalle.tiers, { quantityUntil: 1, price: 0 }] });
      return;
    }
    const detalle = value.detalle as Extract<ProductoPrecioConfig, { metodoCalculo: "margen_variable" }>["detalle"];
    updateDetalle({ tiers: [...detalle.tiers, { quantityUntil: 1, marginPct: 0 }] });
  };

  const removeTier = (index: number) => {
    if (value.metodoCalculo === "fijado_por_cantidad") {
      const detalle = value.detalle as Extract<ProductoPrecioConfig, { metodoCalculo: "fijado_por_cantidad" }>["detalle"];
      updateDetalle({ tiers: detalle.tiers.filter((_, tierIndex) => tierIndex !== index) });
      return;
    }
    if (value.metodoCalculo === "fijo_con_margen_variable") {
      const detalle = value.detalle as Extract<ProductoPrecioConfig, { metodoCalculo: "fijo_con_margen_variable" }>["detalle"];
      updateDetalle({ tiers: detalle.tiers.filter((_, tierIndex) => tierIndex !== index) });
      return;
    }
    if (value.metodoCalculo === "variable_por_cantidad") {
      const detalle = value.detalle as Extract<ProductoPrecioConfig, { metodoCalculo: "variable_por_cantidad" }>["detalle"];
      updateDetalle({ tiers: detalle.tiers.filter((_, tierIndex) => tierIndex !== index) });
      return;
    }
    const detalle = value.detalle as Extract<ProductoPrecioConfig, { metodoCalculo: "margen_variable" }>["detalle"];
    updateDetalle({ tiers: detalle.tiers.filter((_, tierIndex) => tierIndex !== index) });
  };

  const updateTier = (index: number, patch: Record<string, number>) => {
    if (value.metodoCalculo === "fijado_por_cantidad") {
      const detalle = value.detalle as Extract<ProductoPrecioConfig, { metodoCalculo: "fijado_por_cantidad" }>["detalle"];
      updateDetalle({
        tiers: detalle.tiers.map((tier, tierIndex) => (tierIndex === index ? { ...tier, ...patch } : tier)),
      });
      return;
    }
    if (value.metodoCalculo === "fijo_con_margen_variable") {
      const detalle = value.detalle as Extract<ProductoPrecioConfig, { metodoCalculo: "fijo_con_margen_variable" }>["detalle"];
      updateDetalle({
        tiers: detalle.tiers.map((tier, tierIndex) => (tierIndex === index ? { ...tier, ...patch } : tier)),
      });
      return;
    }
    if (value.metodoCalculo === "variable_por_cantidad") {
      const detalle = value.detalle as Extract<ProductoPrecioConfig, { metodoCalculo: "variable_por_cantidad" }>["detalle"];
      updateDetalle({
        tiers: detalle.tiers.map((tier, tierIndex) => (tierIndex === index ? { ...tier, ...patch } : tier)),
      });
      return;
    }
    const detalle = value.detalle as Extract<ProductoPrecioConfig, { metodoCalculo: "margen_variable" }>["detalle"];
    updateDetalle({
      tiers: detalle.tiers.map((tier, tierIndex) => (tierIndex === index ? { ...tier, ...patch } : tier)),
    });
  };

  const rows =
    value.metodoCalculo === "fijado_por_cantidad"
      ? (value.detalle as Extract<ProductoPrecioConfig, { metodoCalculo: "fijado_por_cantidad" }>["detalle"]).tiers
      : value.metodoCalculo === "fijo_con_margen_variable"
        ? (value.detalle as Extract<ProductoPrecioConfig, { metodoCalculo: "fijo_con_margen_variable" }>["detalle"]).tiers
        : value.metodoCalculo === "variable_por_cantidad"
          ? (value.detalle as Extract<ProductoPrecioConfig, { metodoCalculo: "variable_por_cantidad" }>["detalle"]).tiers
          : (value.detalle as Extract<ProductoPrecioConfig, { metodoCalculo: "margen_variable" }>["detalle"]).tiers;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium">Tramos</p>
        <Button type="button" variant="outline" size="sm" onClick={addTier}>
          <PlusIcon className="size-4" />
          Agregar fila
        </Button>
      </div>
      <div className="space-y-3">
        {rows.map((tier, index) => {
          const quantityLabel =
            value.metodoCalculo === "fijado_por_cantidad" || value.metodoCalculo === "fijo_con_margen_variable"
              ? "Cantidad"
              : "Hasta cantidad";
          const priceLabel =
            value.metodoCalculo === "fijado_por_cantidad" || value.metodoCalculo === "variable_por_cantidad"
              ? "Precio"
              : "Margen (%)";
          return (
            <div key={index} className="grid gap-3 rounded-lg border p-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
              <Field>
                <FieldLabel>{quantityLabel}</FieldLabel>
                <Input
                  type="number"
                  value={
                    "quantity" in tier
                      ? (tier as ProductoPrecioFilaCantidadPrecio | ProductoPrecioFilaCantidadMargen).quantity
                      : (tier as ProductoPrecioFilaRangoPrecio | ProductoPrecioFilaRangoMargen).quantityUntil
                  }
                  onChange={(e) =>
                    updateTier(index, {
                      ["quantity" in tier ? "quantity" : "quantityUntil"]: Number(e.target.value || 0),
                    })
                  }
                />
              </Field>
              <Field>
                <FieldLabel>{priceLabel}</FieldLabel>
                <Input
                  type="number"
                  value={"price" in tier ? Number(tier.price) : Number((tier as ProductoPrecioFilaCantidadMargen | ProductoPrecioFilaRangoMargen).marginPct)}
                  onChange={(e) =>
                    updateTier(index, {
                      ["price" in tier ? "price" : "marginPct"]: Number(e.target.value || 0),
                    })
                  }
                />
              </Field>
              <div className="flex items-end">
                <Button type="button" variant="ghost" size="icon" onClick={() => removeTier(index)} disabled={rows.length <= 1}>
                  <Trash2Icon className="size-4" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ProductoPrecioTab(props: ProductTabProps) {
  const measurementUnitFallback = props.producto.unidadComercial?.trim() || "unidad";
  const [impuestosCatalogo, setImpuestosCatalogo] = React.useState(props.initialImpuestosCatalogo);
  const [comisionesCatalogo, setComisionesCatalogo] = React.useState(props.initialComisionesCatalogo);
  const impuestosCatalogoActivos = React.useMemo(
    () => impuestosCatalogo.filter((item) => item.activo).sort((a, b) => a.nombre.localeCompare(b.nombre)),
    [impuestosCatalogo],
  );
  const comisionesCatalogoActivos = React.useMemo(
    () => comisionesCatalogo.filter((item) => item.activo).sort((a, b) => a.nombre.localeCompare(b.nombre)),
    [comisionesCatalogo],
  );
  const clientesOptions = React.useMemo(
    () => [...props.initialClientes].sort((a, b) => a.nombre.localeCompare(b.nombre)),
    [props.initialClientes],
  );
  const [precioForm, setPrecioForm] = React.useState<ProductoPrecioConfig>(() =>
    buildPrecioConfigDraft(props.producto.precio, measurementUnitFallback),
  );
  const [precioEspecialClientesForm, setPrecioEspecialClientesForm] = React.useState<ProductoPrecioEspecialCliente[]>(
    () => props.producto.precioEspecialClientes ?? [],
  );
  const [isSavingPrecio, startSavingPrecio] = React.useTransition();
  const [isSavingEspeciales, startSavingEspeciales] = React.useTransition();
  const [clienteDraft, setClienteDraft] = React.useState<PrecioEspecialClienteDraft | null>(null);
  const [precioEspecialClienteToDelete, setPrecioEspecialClienteToDelete] = React.useState<{ id: string; clienteNombre: string } | null>(null);
  const [isMetodoDetalleOpen, setIsMetodoDetalleOpen] = React.useState(false);
  const [isImpuestosManagerOpen, setIsImpuestosManagerOpen] = React.useState(false);
  const [impuestosEditorDraft, setImpuestosEditorDraft] = React.useState<ProductoImpuestoCatalogo | null>(null);
  const [isSavingImpuestosCatalogo, startSavingImpuestosCatalogo] = React.useTransition();
  const [isComisionesManagerOpen, setIsComisionesManagerOpen] = React.useState(false);
  const [comisionesEditorDraft, setComisionesEditorDraft] = React.useState<ProductoComisionCatalogo | null>(null);
  const [isSavingComisionesCatalogo, startSavingComisionesCatalogo] = React.useTransition();

  React.useEffect(() => {
    setPrecioForm(buildPrecioConfigDraft(props.producto.precio, measurementUnitFallback));
    setPrecioEspecialClientesForm(props.producto.precioEspecialClientes ?? []);
  }, [props.producto.precio, props.producto.precioEspecialClientes, measurementUnitFallback]);

  React.useEffect(() => {
    setImpuestosCatalogo(props.initialImpuestosCatalogo);
  }, [props.initialImpuestosCatalogo]);

  React.useEffect(() => {
    setComisionesCatalogo(props.initialComisionesCatalogo);
  }, [props.initialComisionesCatalogo]);

  const persistedPrecio = React.useMemo(
    () => buildPrecioConfigDraft(props.producto.precio, measurementUnitFallback),
    [props.producto.precio, measurementUnitFallback],
  );
  const isPrecioDirty = JSON.stringify(precioForm) !== JSON.stringify(persistedPrecio);

  React.useEffect(() => {
    if (!precioForm.impuestos.esquemaId) return;
    const esquema = impuestosCatalogo.find((item) => item.id === precioForm.impuestos.esquemaId);
    if (!esquema) return;
    setPrecioForm((current) => ({
      ...current,
      impuestos: {
        esquemaId: esquema.id,
        esquemaNombre: esquema.nombre,
        items: esquema.detalle.items.map((item) => ({ ...item })),
        porcentajeTotal: esquema.porcentaje,
      },
    }));
  }, [impuestosCatalogo, precioForm.impuestos.esquemaId]);

  React.useEffect(() => {
    if (!precioForm.comisiones.esquemaId) return;
    const esquema = comisionesCatalogo.find((item) => item.id === precioForm.comisiones.esquemaId);
    if (!esquema) return;
    setPrecioForm((current) => ({
      ...current,
      comisiones: {
        esquemaId: esquema.id,
        esquemaNombre: esquema.nombre,
        items: esquema.detalle.items.map((item, index) => ({
          id: `${esquema.id}-${index + 1}`,
          nombre: item.nombre,
          tipo: item.tipo,
          porcentaje: item.porcentaje,
          activo: item.activo,
        })),
        porcentajeTotal: esquema.porcentaje,
      },
    }));
  }, [comisionesCatalogo, precioForm.comisiones.esquemaId]);

  const handleChangeMetodoCalculoPrecio = (metodoCalculo: MetodoCalculoPrecioProducto) => {
    const nextMeasurementUnit = precioForm.measurementUnit ?? measurementUnitFallback;
    setPrecioForm((current) => ({
      ...buildPrecioConfigForMethod(metodoCalculo, nextMeasurementUnit),
      impuestos: current.impuestos,
      comisiones: current.comisiones,
    }) as ProductoPrecioConfig);
  };

  const handleSavePrecio = () =>
    startSavingPrecio(async () => {
      try {
        await updateProductoPrecio(props.producto.id, {
          metodoCalculo: precioForm.metodoCalculo,
          measurementUnit: precioForm.measurementUnit,
          impuestos: precioForm.impuestos,
          comisiones: precioForm.comisiones,
          detalle: precioForm.detalle as Record<string, unknown>,
        });
        await props.refreshProducto();
        toast.success("Configuración de precio actualizada.");
      } catch (error) {
        console.error(error);
        toast.error(error instanceof Error ? error.message : "No se pudo guardar la configuración de precio.");
      }
    });

  const persistPrecioEspecialClientes = (
    nextItems: ProductoPrecioEspecialCliente[],
    successMessage: string,
    onSuccess?: () => void,
  ) =>
    startSavingEspeciales(async () => {
      try {
        await updateProductoPrecioEspecialClientes(props.producto.id, {
          items: nextItems.map((item) => ({
            id: item.id,
            clienteId: item.clienteId,
            clienteNombre: item.clienteNombre,
            descripcion: item.descripcion,
            activo: item.activo,
            metodoCalculo: item.metodoCalculo,
            measurementUnit: item.measurementUnit,
            detalle: item.detalle as Record<string, unknown>,
          })),
        });
        await props.refreshProducto();
        onSuccess?.();
        toast.success(successMessage);
      } catch (error) {
        console.error(error);
        toast.error(error instanceof Error ? error.message : "No se pudieron guardar los precios especiales.");
      }
    });

  const handleSelectImpuesto = (esquemaId: string | null) => {
    const esquema = impuestosCatalogoActivos.find((item) => item.id === esquemaId) ?? null;
    setPrecioForm((current) => ({
      ...current,
      impuestos: esquema
        ? {
            esquemaId: esquema.id,
            esquemaNombre: esquema.nombre,
            items: esquema.detalle.items.map((item) => ({ ...item })),
            porcentajeTotal: esquema.porcentaje,
          }
        : {
            esquemaId: null,
            esquemaNombre: "",
            items: [],
            porcentajeTotal: 0,
          },
    }));
  };

  const handleOpenImpuestosEditor = () => {
    const current =
      impuestosCatalogo.find((item) => item.id === precioForm.impuestos.esquemaId) ??
      impuestosCatalogoActivos[0] ??
      null;
    setImpuestosEditorDraft(
      current ? { ...current, detalle: { items: current.detalle.items.map((item) => ({ ...item })) } } : null,
    );
    setIsImpuestosManagerOpen(true);
  };

  const handleSaveImpuestosEditor = () => {
    if (!impuestosEditorDraft) {
      toast.error("Seleccioná un esquema impositivo.");
      return;
    }
    const porcentaje = Number(
      impuestosEditorDraft.detalle.items.reduce((sum, item) => sum + Number(item.porcentaje || 0), 0).toFixed(2),
    );
    startSavingImpuestosCatalogo(async () => {
      try {
        const updated = await updateProductoImpuesto(impuestosEditorDraft.id, {
          codigo: impuestosEditorDraft.codigo,
          nombre: impuestosEditorDraft.nombre,
          porcentaje,
          detalle: {
            items: impuestosEditorDraft.detalle.items.map((item) => ({
              nombre: item.nombre,
              porcentaje: Number(item.porcentaje || 0),
            })),
          },
          activo: impuestosEditorDraft.activo,
        });
        setImpuestosCatalogo((current) => current.map((item) => (item.id === updated.id ? updated : item)));
        setImpuestosEditorDraft(
          updated ? { ...updated, detalle: { items: updated.detalle.items.map((item) => ({ ...item })) } } : null,
        );
        setIsImpuestosManagerOpen(false);
        toast.success("Esquema impositivo actualizado.");
      } catch (error) {
        console.error(error);
        toast.error(error instanceof Error ? error.message : "No se pudo guardar el esquema impositivo.");
      }
    });
  };

  const handleSelectComision = (esquemaId: string | null) => {
    const esquema = comisionesCatalogoActivos.find((item) => item.id === esquemaId) ?? null;
    setPrecioForm((current) => ({
      ...current,
      comisiones: esquema
        ? {
            esquemaId: esquema.id,
            esquemaNombre: esquema.nombre,
            items: esquema.detalle.items.map((item, index) => ({
              id: `${esquema.id}-${index + 1}`,
              nombre: item.nombre,
              tipo: item.tipo,
              porcentaje: item.porcentaje,
              activo: item.activo,
            })),
            porcentajeTotal: esquema.porcentaje,
          }
        : {
            esquemaId: null,
            esquemaNombre: "",
            items: [],
            porcentajeTotal: 0,
          },
    }));
  };

  const handleOpenComisionesEditor = () => {
    const current =
      comisionesCatalogo.find((item) => item.id === precioForm.comisiones.esquemaId) ??
      comisionesCatalogoActivos[0] ??
      null;
    setComisionesEditorDraft(
      current
        ? {
            ...current,
            detalle: {
              items: current.detalle.items.map((item) => ({ ...item })),
            },
          }
        : {
            id: "",
            codigo: "",
            nombre: "",
            porcentaje: 0,
            activo: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            detalle: { items: [] },
          },
    );
    setIsComisionesManagerOpen(true);
  };

  const handleSaveComisionesEditor = () => {
    if (!comisionesEditorDraft?.nombre.trim()) {
      toast.error("El nombre del esquema es obligatorio.");
      return;
    }
    const detalleItems = comisionesEditorDraft.detalle.items.map((item) => ({
      nombre: item.nombre.trim(),
      tipo: item.tipo,
      porcentaje: Number(item.porcentaje || 0),
      activo: Boolean(item.activo),
    }));
    if (!detalleItems.length) {
      toast.error("Agregá al menos una comisión al esquema.");
      return;
    }
    if (detalleItems.some((item) => !item.nombre)) {
      toast.error("Todas las comisiones del esquema deben tener nombre.");
      return;
    }
    const porcentaje = Number(
      detalleItems
        .filter((item) => item.activo)
        .reduce((sum, item) => sum + Number(item.porcentaje || 0), 0)
        .toFixed(2),
    );
    startSavingComisionesCatalogo(async () => {
      try {
        const payload = {
          codigo: comisionesEditorDraft.codigo.trim() || slugifyNombre(comisionesEditorDraft.nombre),
          nombre: comisionesEditorDraft.nombre.trim(),
          porcentaje,
          detalle: { items: detalleItems },
          activo: comisionesEditorDraft.activo,
        };
        const saved = comisionesEditorDraft.id
          ? await updateProductoComision(comisionesEditorDraft.id, payload)
          : await createProductoComision(payload);
        setComisionesCatalogo((current) => {
          const exists = current.some((item) => item.id === saved.id);
          return exists ? current.map((item) => (item.id === saved.id ? saved : item)) : [...current, saved];
        });
        setPrecioForm((current) => ({
          ...current,
          comisiones: {
            esquemaId: saved.id,
            esquemaNombre: saved.nombre,
            items: saved.detalle.items.map((item, index) => ({
              id: `${saved.id}-${index + 1}`,
              nombre: item.nombre,
              tipo: item.tipo,
              porcentaje: item.porcentaje,
              activo: item.activo,
            })),
            porcentajeTotal: saved.porcentaje,
          },
        }));
        setComisionesEditorDraft({
          ...saved,
          detalle: { items: saved.detalle.items.map((item) => ({ ...item })) },
        });
        setIsComisionesManagerOpen(false);
        toast.success(comisionesEditorDraft.id ? "Esquema de comisiones actualizado." : "Esquema de comisiones creado.");
      } catch (error) {
        console.error(error);
        toast.error(error instanceof Error ? error.message : "No se pudo guardar el esquema de comisiones.");
      }
    });
  };

  const handleChangeMetodoCalculoPrecioEspecialCliente = (metodoCalculo: MetodoCalculoPrecioProducto) => {
    if (!clienteDraft) return;
    const next = buildPrecioConfigForMethod(metodoCalculo, clienteDraft.measurementUnit ?? measurementUnitFallback);
    setClienteDraft({
      ...clienteDraft,
      metodoCalculo,
      measurementUnit: next.measurementUnit,
      detalle: next.detalle as Record<string, unknown>,
    });
  };

  const handleSaveClienteDraft = () => {
    if (!clienteDraft?.clienteId) {
      toast.error("Seleccioná un cliente.");
      return;
    }
    const cliente = clientesOptions.find((item) => item.id === clienteDraft.clienteId);
    if (!cliente) {
      toast.error("El cliente seleccionado no existe.");
      return;
    }
    const nextItem = buildPrecioEspecialClienteFromDraft(clienteDraft, cliente.nombre, new Date().toISOString());
    const nextItems = precioEspecialClientesForm.some((item) => item.id === nextItem.id)
      ? precioEspecialClientesForm.map((item) => (item.id === nextItem.id ? nextItem : item))
      : [...precioEspecialClientesForm, nextItem];
    setPrecioEspecialClientesForm(nextItems);
    persistPrecioEspecialClientes(nextItems, "Precio especial guardado.", () => setClienteDraft(null));
  };

  const handleTogglePrecioEspecialCliente = (itemId: string, activo: boolean) => {
    const nextItems = precioEspecialClientesForm.map((item) =>
      item.id === itemId ? { ...item, activo, updatedAt: new Date().toISOString() } : item,
    );
    setPrecioEspecialClientesForm(nextItems);
    persistPrecioEspecialClientes(nextItems, "Estado del precio especial actualizado.");
  };

  const handleDeletePrecioEspecialCliente = () => {
    if (!precioEspecialClienteToDelete) return;
    const nextItems = precioEspecialClientesForm.filter((item) => item.id !== precioEspecialClienteToDelete.id);
    setPrecioEspecialClientesForm(nextItems);
    persistPrecioEspecialClientes(nextItems, "Precio especial eliminado.", () => setPrecioEspecialClienteToDelete(null));
  };

  const updateClienteDetalle = (detalle: Record<string, unknown>) => {
    if (!clienteDraft) return;
    setClienteDraft({ ...clienteDraft, detalle });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Precio</CardTitle>
        <CardDescription>Configura la lógica comercial del producto con una UI única del ERP.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border p-4">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
            <Field>
              <FieldLabel>Método de cálculo</FieldLabel>
              <div className="flex gap-2">
                <Select value={precioForm.metodoCalculo} onValueChange={(value) => handleChangeMetodoCalculoPrecio(value as MetodoCalculoPrecioProducto)}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Selecciona método" />
                  </SelectTrigger>
                  <SelectContent>
                    {metodoCalculoPrecioItems.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="button" variant="outline" onClick={() => setIsMetodoDetalleOpen(true)}>
                  Configurar
                </Button>
              </div>
              <FieldDescription>{getPrecioMethodDescription(precioForm.metodoCalculo)}</FieldDescription>
            </Field>
            <Field>
              <FieldLabel>Unidad comercial</FieldLabel>
              <Input value={getUnidadComercialProductoLabel(precioForm.measurementUnit ?? props.producto.unidadComercial)} disabled />
            </Field>
          </div>
        </div>

        <div className="rounded-lg border p-4">
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
            <Field>
              <FieldLabel>Esquema impositivo</FieldLabel>
              <div className="flex gap-2">
                <Select value={precioForm.impuestos.esquemaId ?? "__none__"} onValueChange={(value) => handleSelectImpuesto(value === "__none__" ? null : value)}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Seleccioná un esquema" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sin impuestos</SelectItem>
                    {impuestosCatalogoActivos.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="button" variant="outline" className="shrink-0" onClick={handleOpenImpuestosEditor}>
                  Administrar impuestos
                </Button>
              </div>
            </Field>
            <Field>
              <FieldLabel>Impuestos totales</FieldLabel>
              <Input value={`${formatNumber(precioForm.impuestos.porcentajeTotal)}%`} disabled />
            </Field>
          </div>
        </div>

        <div className="rounded-lg border p-4">
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
            <Field>
              <FieldLabel>Esquema de comisiones</FieldLabel>
              <div className="flex gap-2">
                <Select
                  value={precioForm.comisiones.esquemaId ?? "__none__"}
                  onValueChange={(value) => handleSelectComision(value === "__none__" ? null : value)}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Seleccioná un esquema" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sin comisiones</SelectItem>
                    {comisionesCatalogoActivos.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="button" variant="outline" className="shrink-0" onClick={handleOpenComisionesEditor}>
                  Administrar comisiones
                </Button>
              </div>
              <FieldDescription>Aplicá esquemas reutilizables para pasarelas, vendedores u otros cargos comerciales.</FieldDescription>
            </Field>
            <Field>
              <FieldLabel>Comisiones totales</FieldLabel>
              <Input value={`${formatNumber(precioForm.comisiones.porcentajeTotal)}%`} disabled />
            </Field>
          </div>
        </div>

        <div className="rounded-lg border p-4 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Precio especial para clientes</p>
              <p className="text-xs text-muted-foreground">Definí reglas comerciales particulares por cliente.</p>
            </div>
            <Button type="button" variant="outline" onClick={() => setClienteDraft(buildPrecioEspecialClienteDraft(null, measurementUnitFallback))}>
              <PlusIcon className="size-4" />
              Agregar
            </Button>
          </div>
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Método</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="w-[140px] text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {precioEspecialClientesForm.length ? (
                  precioEspecialClientesForm.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.clienteNombre}</TableCell>
                      <TableCell>{getPrecioMethodLabel(item.metodoCalculo)}</TableCell>
                      <TableCell>{item.descripcion || getPrecioEspecialClienteResumen(item) || "-"}</TableCell>
                      <TableCell>{item.activo ? "Activa" : "Inactiva"}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            disabled={isSavingEspeciales}
                            onClick={() => setClienteDraft(buildPrecioEspecialClienteDraft(item, measurementUnitFallback))}
                          >
                            <PencilIcon className="size-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            disabled={isSavingEspeciales}
                            onClick={() => setPrecioEspecialClienteToDelete({ id: item.id, clienteNombre: item.clienteNombre })}
                          >
                            <Trash2Icon className="size-4" />
                          </Button>
                          <Switch checked={item.activo} disabled={isSavingEspeciales} onCheckedChange={(checked) => handleTogglePrecioEspecialCliente(item.id, Boolean(checked))} />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                      No hay precios especiales configurados.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          {clienteDraft ? (
            <div className="rounded-lg border p-4">
              {(() => {
                const currentDraft = clienteDraft!;
                return (
                  <>
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-sm font-medium">{precioEspecialClientesForm.some((item) => item.id === currentDraft.id) ? "Editar precio especial" : "Nuevo precio especial"}</p>
                <Button type="button" variant="ghost" size="sm" onClick={() => setClienteDraft(null)}>
                  Cancelar
                </Button>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Field>
                  <FieldLabel>Cliente</FieldLabel>
                  <Select
                    value={currentDraft.clienteId || "__none__"}
                    onValueChange={(value) =>
                      setClienteDraft({
                        ...currentDraft,
                        clienteId: !value || value === "__none__" ? "" : value,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccioná un cliente" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Seleccioná un cliente</SelectItem>
                      {clientesOptions.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel>Método de cálculo</FieldLabel>
                  <Select value={currentDraft.metodoCalculo} onValueChange={(value) => handleChangeMetodoCalculoPrecioEspecialCliente(value as MetodoCalculoPrecioProducto)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {metodoCalculoPrecioItems.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field className="md:col-span-2">
                  <FieldLabel>Descripción</FieldLabel>
                  <Textarea value={currentDraft.descripcion} onChange={(e) => setClienteDraft({ ...currentDraft, descripcion: e.target.value })} rows={3} />
                </Field>
              </div>
              <div className="mt-4">
                <PrecioMetodoDetalleEditor
                  value={
                    {
                      metodoCalculo: currentDraft.metodoCalculo,
                      measurementUnit: currentDraft.measurementUnit,
                      impuestos: precioForm.impuestos,
                      comisiones: precioForm.comisiones,
                      detalle: currentDraft.detalle as ProductoPrecioConfig["detalle"],
                    } as ProductoPrecioConfig
                  }
                  onChange={(next) => updateClienteDetalle(next.detalle as Record<string, unknown>)}
                />
              </div>
              <div className="mt-4 flex justify-end">
                <Button type="button" onClick={handleSaveClienteDraft} disabled={isSavingEspeciales}>
                  {isSavingEspeciales ? <GdiSpinner className="size-4" data-icon="inline-start" /> : null}
                  Guardar precio especial
                </Button>
              </div>
                  </>
                );
              })()}
            </div>
          ) : null}
        </div>

        <Button type="button" onClick={handleSavePrecio} disabled={isSavingPrecio || !isPrecioDirty}>
          {isSavingPrecio ? <GdiSpinner className="size-4" data-icon="inline-start" /> : <SaveIcon className="size-4" data-icon="inline-start" />}
          Guardar configuración de precio
        </Button>
      </CardContent>

      <AlertDialog open={Boolean(precioEspecialClienteToDelete)} onOpenChange={(open) => (!open ? setPrecioEspecialClienteToDelete(null) : null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar precio especial</AlertDialogTitle>
            <AlertDialogDescription>
              {precioEspecialClienteToDelete
                ? `Vas a eliminar el precio especial de "${precioEspecialClienteToDelete.clienteNombre}".`
                : "Esta acción no se puede deshacer."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSavingEspeciales}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePrecioEspecialCliente} disabled={isSavingEspeciales}>
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Sheet open={isMetodoDetalleOpen} onOpenChange={setIsMetodoDetalleOpen}>
        <SheetContent side="right" className="!w-[52vw] !max-w-none md:!w-[48vw] xl:!w-[42vw] sm:!max-w-none">
          <SheetHeader>
            <SheetTitle>Detalle del método</SheetTitle>
            <SheetDescription>
              {getPrecioMethodLabel(precioForm.metodoCalculo)}. Configurá acá los valores específicos del método seleccionado.
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-4 px-4 pb-4">
            <PrecioMetodoDetalleEditor value={precioForm} onChange={setPrecioForm} />
            <div className="flex justify-end">
              <Button type="button" variant="outline" onClick={() => setIsMetodoDetalleOpen(false)}>
                Cerrar
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={isImpuestosManagerOpen} onOpenChange={setIsImpuestosManagerOpen}>
        <SheetContent side="right" className="!w-[96vw] !max-w-none sm:!w-[52vw] lg:!w-[30vw] lg:!min-w-[440px] sm:!max-w-none">
          <SheetHeader>
            <SheetTitle>Administrar impuestos</SheetTitle>
            <SheetDescription>
              Editá el detalle del esquema impositivo seleccionado.
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-5 px-4 pb-4">
            <Field>
              <FieldLabel>Esquema</FieldLabel>
              <Select
                value={impuestosEditorDraft?.id ?? "__none__"}
                onValueChange={(value) =>
                  setImpuestosEditorDraft(
                    value === "__none__"
                      ? null
                      : (() => {
                          const selected = impuestosCatalogoActivos.find((item) => item.id === value) ?? null;
                          return selected
                            ? { ...selected, detalle: { items: selected.detalle.items.map((item) => ({ ...item })) } }
                            : null;
                        })(),
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccioná un esquema" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Seleccioná un esquema</SelectItem>
                  {impuestosCatalogoActivos.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            {impuestosEditorDraft ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium">Impuestos del esquema</p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setImpuestosEditorDraft((current) =>
                        current
                          ? {
                              ...current,
                              detalle: {
                                items: [...current.detalle.items, { nombre: `Impuesto ${current.detalle.items.length + 1}`, porcentaje: 0 }],
                              },
                            }
                          : current,
                      )
                    }
                  >
                    <PlusIcon className="size-4" data-icon="inline-start" />
                    Agregar impuesto
                  </Button>
                </div>
                {impuestosEditorDraft.detalle.items.map((item, index) => (
                  <div key={`${impuestosEditorDraft.id}-${item.nombre}-${index}`} className="grid gap-3 rounded-lg border p-3 md:grid-cols-[minmax(0,1fr)_160px_auto]">
                    <Field>
                      <FieldLabel>Nombre</FieldLabel>
                      <Input
                        value={item.nombre}
                        onChange={(e) =>
                          setImpuestosEditorDraft((current) =>
                            current
                              ? {
                                  ...current,
                                  detalle: {
                                    items: current.detalle.items.map((entry, itemIndex) =>
                                      itemIndex === index ? { ...entry, nombre: e.target.value } : entry,
                                    ),
                                  },
                                }
                              : current,
                          )
                        }
                      />
                    </Field>
                    <Field>
                      <FieldLabel>Porcentaje</FieldLabel>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.porcentaje}
                        onChange={(e) =>
                          setImpuestosEditorDraft((current) =>
                            current
                              ? {
                                  ...current,
                                  detalle: {
                                    items: current.detalle.items.map((entry, itemIndex) =>
                                      itemIndex === index
                                        ? { ...entry, porcentaje: Number(e.target.value || 0) }
                                        : entry,
                                    ),
                                  },
                                }
                              : current,
                          )
                        }
                      />
                    </Field>
                    <div className="flex items-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={impuestosEditorDraft.detalle.items.length <= 1}
                        onClick={() =>
                          setImpuestosEditorDraft((current) =>
                            current
                              ? {
                                  ...current,
                                  detalle: {
                                    items:
                                      current.detalle.items.length <= 1
                                        ? current.detalle.items
                                        : current.detalle.items.filter((_, itemIndex) => itemIndex !== index),
                                  },
                                }
                              : current,
                          )
                        }
                      >
                        <Trash2Icon className="size-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                <div className="rounded-lg border bg-muted/20 px-3 py-2 text-sm">
                  <span className="font-medium">Total:</span>{" "}
                  {formatNumber(
                    impuestosEditorDraft.detalle.items.reduce((sum, item) => sum + Number(item.porcentaje || 0), 0),
                  )}
                  %
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No hay un esquema impositivo disponible para editar.</p>
            )}

            <div className="flex items-center justify-end gap-2 border-t pt-4">
              <Button type="button" variant="outline" onClick={() => setIsImpuestosManagerOpen(false)}>
                Cancelar
              </Button>
              <Button type="button" onClick={handleSaveImpuestosEditor} disabled={isSavingImpuestosCatalogo || !impuestosEditorDraft}>
                {isSavingImpuestosCatalogo ? <GdiSpinner className="size-4" data-icon="inline-start" /> : null}
                Aplicar
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={isComisionesManagerOpen} onOpenChange={setIsComisionesManagerOpen}>
        <SheetContent side="right" className="!w-[96vw] !max-w-none sm:!w-[52vw] lg:!w-[30vw] lg:!min-w-[440px] sm:!max-w-none">
          <SheetHeader>
            <SheetTitle>Administrar comisiones</SheetTitle>
            <SheetDescription>
              Editá el esquema de comisiones seleccionado y reutilizalo en otros productos.
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-5 px-4 pb-4">
            <div className="flex items-center gap-2">
              <Field className="flex-1">
                <FieldLabel>Esquema</FieldLabel>
                <Select
                  value={comisionesEditorDraft?.id || "__new__"}
                  onValueChange={(value) => {
                    if (value === "__new__") {
                      setComisionesEditorDraft({
                        id: "",
                        codigo: "",
                        nombre: "",
                        porcentaje: 0,
                        activo: true,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                        detalle: { items: [] },
                      });
                      return;
                    }
                    const selected = comisionesCatalogoActivos.find((item) => item.id === value) ?? null;
                    setComisionesEditorDraft(
                      selected
                        ? {
                            ...selected,
                            detalle: { items: selected.detalle.items.map((item) => ({ ...item })) },
                          }
                        : null,
                    );
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccioná un esquema" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__new__">Nuevo esquema</SelectItem>
                    {comisionesCatalogoActivos.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            {comisionesEditorDraft ? (
              <>
                <div className="grid gap-3 md:grid-cols-2">
                  <Field>
                    <FieldLabel>Nombre del esquema</FieldLabel>
                    <Input
                      value={comisionesEditorDraft.nombre}
                      onChange={(e) =>
                        setComisionesEditorDraft((current) =>
                          current
                            ? {
                                ...current,
                                nombre: e.target.value,
                                codigo: current.id ? current.codigo : slugifyNombre(e.target.value),
                              }
                            : current,
                        )
                      }
                    />
                  </Field>
                  <Field>
                    <FieldLabel>Activo</FieldLabel>
                    <div className="flex h-10 items-center rounded-md border px-3">
                      <Switch
                        checked={comisionesEditorDraft.activo}
                        onCheckedChange={(checked) =>
                          setComisionesEditorDraft((current) =>
                            current ? { ...current, activo: Boolean(checked) } : current,
                          )
                        }
                      />
                    </div>
                  </Field>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium">Comisiones del esquema</p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setComisionesEditorDraft((current) =>
                          current
                            ? {
                                ...current,
                                detalle: {
                                  items: [
                                    ...current.detalle.items,
                                    {
                                      nombre: `Comisión ${current.detalle.items.length + 1}`,
                                      tipo: "financiera",
                                      porcentaje: 0,
                                      activo: true,
                                    },
                                  ],
                                },
                              }
                            : current,
                        )
                      }
                    >
                      <PlusIcon className="size-4" data-icon="inline-start" />
                      Agregar comisión
                    </Button>
                  </div>

                  {comisionesEditorDraft.detalle.items.length ? (
                    comisionesEditorDraft.detalle.items.map((item, index) => (
                      <div
                        key={`${comisionesEditorDraft.id || "new"}-${index}`}
                        className="grid gap-3 rounded-lg border p-3"
                      >
                        <div className="grid gap-3 md:grid-cols-2">
                          <Field>
                            <FieldLabel>Nombre</FieldLabel>
                            <Input
                              value={item.nombre}
                              onChange={(e) =>
                                setComisionesEditorDraft((current) =>
                                  current
                                    ? {
                                        ...current,
                                        detalle: {
                                          items: current.detalle.items.map((entry, itemIndex) =>
                                            itemIndex === index ? { ...entry, nombre: e.target.value } : entry,
                                          ),
                                        },
                                      }
                                    : current,
                                )
                              }
                            />
                          </Field>
                          <Field>
                            <FieldLabel>Tipo</FieldLabel>
                            <Select
                              value={item.tipo}
                              onValueChange={(value) =>
                                setComisionesEditorDraft((current) =>
                                  current
                                    ? {
                                        ...current,
                                        detalle: {
                                          items: current.detalle.items.map((entry, itemIndex) =>
                                            itemIndex === index
                                              ? { ...entry, tipo: value as (typeof item)["tipo"] }
                                              : entry,
                                          ),
                                        },
                                      }
                                    : current,
                                )
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {precioComisionTipoItems.map((tipo) => (
                                  <SelectItem key={tipo.value} value={tipo.value}>
                                    {tipo.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </Field>
                        </div>
                        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_140px_auto]">
                          <Field>
                            <FieldLabel>Porcentaje</FieldLabel>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.porcentaje}
                              onChange={(e) =>
                                setComisionesEditorDraft((current) =>
                                  current
                                    ? {
                                        ...current,
                                        detalle: {
                                          items: current.detalle.items.map((entry, itemIndex) =>
                                            itemIndex === index
                                              ? { ...entry, porcentaje: Number(e.target.value || 0) }
                                              : entry,
                                          ),
                                        },
                                      }
                                    : current,
                                )
                              }
                            />
                          </Field>
                          <Field>
                            <FieldLabel>Activa</FieldLabel>
                            <div className="flex h-10 items-center rounded-md border px-3">
                              <Switch
                                checked={item.activo}
                                onCheckedChange={(checked) =>
                                  setComisionesEditorDraft((current) =>
                                    current
                                      ? {
                                          ...current,
                                          detalle: {
                                            items: current.detalle.items.map((entry, itemIndex) =>
                                              itemIndex === index ? { ...entry, activo: Boolean(checked) } : entry,
                                            ),
                                          },
                                        }
                                      : current,
                                  )
                                }
                              />
                            </div>
                          </Field>
                          <div className="flex items-end">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              disabled={comisionesEditorDraft.detalle.items.length <= 1}
                              onClick={() =>
                                setComisionesEditorDraft((current) =>
                                  current
                                    ? {
                                        ...current,
                                        detalle: {
                                          items:
                                            current.detalle.items.length <= 1
                                              ? current.detalle.items
                                              : current.detalle.items.filter((_, itemIndex) => itemIndex !== index),
                                        },
                                      }
                                    : current,
                                )
                              }
                            >
                              <Trash2Icon className="size-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground">
                      Este esquema todavía no tiene comisiones.
                    </div>
                  )}

                  <div className="rounded-lg border bg-muted/20 px-3 py-2 text-sm">
                    <span className="font-medium">Total activo:</span>{" "}
                    {formatNumber(
                      comisionesEditorDraft.detalle.items
                        .filter((item) => item.activo)
                        .reduce((sum, item) => sum + Number(item.porcentaje || 0), 0),
                    )}
                    %
                  </div>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No hay un esquema de comisiones disponible para editar.</p>
            )}

            <div className="flex items-center justify-end gap-2 border-t pt-4">
              <Button type="button" variant="outline" onClick={() => setIsComisionesManagerOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handleSaveComisionesEditor}
                disabled={isSavingComisionesCatalogo || !comisionesEditorDraft}
              >
                {isSavingComisionesCatalogo ? <GdiSpinner className="size-4" data-icon="inline-start" /> : null}
                Aplicar
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </Card>
  );
}
