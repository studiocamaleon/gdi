"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeftIcon, PlusIcon } from "lucide-react";
import { toast } from "sonner";

import type { ProductoImpuestoCatalogo } from "@/lib/productos-servicios";
import {
  createProductoImpuesto,
  updateProductoImpuesto,
} from "@/lib/productos-servicios-api";
import { buttonVariants, Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

type Props = {
  initialImpuestos: ProductoImpuestoCatalogo[];
  embedded?: boolean;
  onImpuestosChange?: (items: ProductoImpuestoCatalogo[]) => void;
};

function buildCodigoFromNombre(nombre: string) {
  return nombre
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 24);
}

export function ProductosServiciosImpuestosManager({
  initialImpuestos,
  embedded = false,
  onImpuestosChange,
}: Props) {
  const [impuestos, setImpuestos] = React.useState(initialImpuestos);
  const [nuevoNombre, setNuevoNombre] = React.useState("");
  const [nuevoPorcentaje, setNuevoPorcentaje] = React.useState("0");
  const [draftById, setDraftById] = React.useState<Record<string, { nombre: string; porcentaje: string }>>({});
  const [isSaving, startSaving] = React.useTransition();

  const sorted = React.useMemo(
    () => [...impuestos].sort((a, b) => a.nombre.localeCompare(b.nombre)),
    [impuestos],
  );

  React.useEffect(() => {
    setImpuestos(initialImpuestos);
  }, [initialImpuestos]);

  const syncImpuestos = React.useCallback(
    (updater: (current: ProductoImpuestoCatalogo[]) => ProductoImpuestoCatalogo[]) => {
      setImpuestos((current) => {
        const next = updater(current);
        onImpuestosChange?.(next);
        return next;
      });
    },
    [onImpuestosChange],
  );

  const handleCreate = () => {
    const nombre = nuevoNombre.trim();
    const porcentaje = Number(nuevoPorcentaje || 0);
    if (!nombre) {
      toast.error("Ingresa un nombre de impuesto.");
      return;
    }
    startSaving(async () => {
      try {
        const created = await createProductoImpuesto({
          codigo: buildCodigoFromNombre(nombre) || "IMPUESTO",
          nombre,
          porcentaje,
          activo: true,
        });
        syncImpuestos((prev) => [...prev, created]);
        setNuevoNombre("");
        setNuevoPorcentaje("0");
        toast.success("Impuesto creado.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo crear el impuesto.");
      }
    });
  };

  const handleSave = (item: ProductoImpuestoCatalogo) => {
    const draft = draftById[item.id];
    const nombre = draft?.nombre?.trim() || item.nombre;
    const porcentaje = Number(draft?.porcentaje ?? item.porcentaje);
    startSaving(async () => {
      try {
        const updated = await updateProductoImpuesto(item.id, {
          codigo: item.codigo,
          nombre,
          porcentaje,
          activo: item.activo,
        });
        syncImpuestos((prev) => prev.map((current) => (current.id === updated.id ? updated : current)));
        toast.success("Impuesto guardado.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo guardar el impuesto.");
      }
    });
  };

  const handleToggle = (item: ProductoImpuestoCatalogo, activo: boolean) => {
    startSaving(async () => {
      try {
        const updated = await updateProductoImpuesto(item.id, {
          codigo: item.codigo,
          nombre: item.nombre,
          porcentaje: item.porcentaje,
          activo,
        });
        syncImpuestos((prev) => prev.map((current) => (current.id === updated.id ? updated : current)));
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo actualizar el impuesto.");
      }
    });
  };

  return (
    <div className="flex flex-col gap-6">
      {embedded ? null : (
        <div>
          <Link href="/costos/productos" className={cn(buttonVariants({ variant: "ghost" }), "-ml-3")}>
            <ArrowLeftIcon data-icon="inline-start" />
            Volver a catalogo de productos
          </Link>
          <h1 className="text-xl font-semibold">Catálogo de impuestos</h1>
          <p className="text-sm text-muted-foreground">
            Administra impuestos comerciales reutilizables para productos.
          </p>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Nuevo impuesto</CardTitle>
          <CardDescription>Define nombre y porcentaje para usarlo luego en el tab Precio.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_auto]">
          <Input value={nuevoNombre} onChange={(e) => setNuevoNombre(e.target.value)} placeholder="Ej: IVA" />
          <Input
            type="number"
            min="0"
            step="0.01"
            value={nuevoPorcentaje}
            onChange={(e) => setNuevoPorcentaje(e.target.value)}
            placeholder="Porcentaje"
          />
          <Button type="button" onClick={handleCreate} disabled={isSaving}>
            <PlusIcon className="size-4" />
            Agregar
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Impuestos</CardTitle>
          <CardDescription>Edita nombre, porcentaje y estado.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {sorted.map((item) => {
            const draft = draftById[item.id];
            return (
              <div key={item.id} className="grid gap-3 rounded-lg border p-4 md:grid-cols-[180px_minmax(0,1fr)_160px_100px_auto] md:items-center">
                <div>
                  <p className="text-xs text-muted-foreground">Código</p>
                  <p className="font-mono text-sm">{item.codigo}</p>
                </div>
                <Input
                  value={draft?.nombre ?? item.nombre}
                  onChange={(e) =>
                    setDraftById((prev) => ({
                      ...prev,
                      [item.id]: {
                        nombre: e.target.value,
                        porcentaje: prev[item.id]?.porcentaje ?? String(item.porcentaje),
                      },
                    }))
                  }
                />
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={draft?.porcentaje ?? String(item.porcentaje)}
                  onChange={(e) =>
                    setDraftById((prev) => ({
                      ...prev,
                      [item.id]: {
                        nombre: prev[item.id]?.nombre ?? item.nombre,
                        porcentaje: e.target.value,
                      },
                    }))
                  }
                />
                <div className="flex items-center gap-2">
                  <Switch checked={item.activo} onCheckedChange={(checked) => handleToggle(item, checked)} />
                  <span className="text-sm text-muted-foreground">{item.activo ? "Activo" : "Inactivo"}</span>
                </div>
                <Button type="button" variant="outline" onClick={() => handleSave(item)} disabled={isSaving}>
                  Guardar
                </Button>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
