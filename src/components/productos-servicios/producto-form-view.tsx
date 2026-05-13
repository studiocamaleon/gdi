"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon, SaveIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { HumanSelect, optionFromLabel } from "@/components/ui/human-select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  actualizarProducto,
  crearProducto,
  eliminarProducto,
} from "@/lib/productos-servicios-api";
import type { ProductoDetalle } from "@/lib/productos-servicios";
import { unidadComercialProductoItems } from "@/lib/productos-servicios";
import { LabelConTooltip } from "@/components/ui/label-con-tooltip";
import {
  getLabel,
  modoMedidasLabels,
  unidadComercialLabels,
} from "@/lib/labels-humanos";
import {
  TabPrecioEditor,
  type TabPrecioConfig,
} from "@/components/productos-servicios/tab-precio-editor";

type Modo = "crear" | "editar";

interface Props {
  modo: Modo;
  productoExistente?: ProductoDetalle;
}

const MODOS_MEDIDAS = [
  { value: "FIJA", label: "Medidas fijas (default declarado)" },
  { value: "LIBRE", label: "Medidas libres (comercial las carga al cotizar)" },
  { value: "COMERCIAL_ELIGE", label: "Comercial elige (fija o libre al cotizar)" },
];

export function ProductoFormView({ modo, productoExistente }: Props) {
  const router = useRouter();
  const [guardando, setGuardando] = React.useState(false);
  const [eliminando, setEliminando] = React.useState(false);

  const [codigo, setCodigo] = React.useState(productoExistente?.codigo ?? "");
  const [nombre, setNombre] = React.useState(productoExistente?.nombre ?? "");
  const [descripcion, setDescripcion] = React.useState(productoExistente?.descripcion ?? "");
  const [unidadComercial, setUnidadComercial] = React.useState(
    productoExistente?.unidadComercial ?? "unidad",
  );
  const [modoMedidas, setModoMedidas] = React.useState(productoExistente?.modoMedidas ?? "FIJA");
  const [anchoDefault, setAnchoDefault] = React.useState(
    productoExistente?.medidaDefaultAnchoMm ?? "",
  );
  const [altoDefault, setAltoDefault] = React.useState(
    productoExistente?.medidaDefaultAltoMm ?? "",
  );
  const [activo, setActivo] = React.useState(productoExistente?.activo ?? true);

  // Tab Precio: editor completo con tramos (F.3.8)
  const precioConfigInicial: TabPrecioConfig = (productoExistente?.precioConfigJson as
    | TabPrecioConfig
    | null) ?? {
    metodoCalculo: "por_margen",
    detalle: { marginPct: 100, minimumMarginPct: 50 },
  };
  const [precioConfig, setPrecioConfig] = React.useState<TabPrecioConfig>(precioConfigInicial);

  const handleGuardar = async () => {
    setGuardando(true);
    try {
      const precioConfigJson = precioConfig as unknown as Record<string, unknown>;

      const payload = {
        nombre,
        descripcion: descripcion || undefined,
        unidadComercial: unidadComercial as "unidad" | "m2" | "metro_lineal",
        modoMedidas: modoMedidas as "FIJA" | "LIBRE" | "COMERCIAL_ELIGE",
        medidaDefaultAnchoMm: anchoDefault ? Number(anchoDefault) : undefined,
        medidaDefaultAltoMm: altoDefault ? Number(altoDefault) : undefined,
        precioConfigJson,
      };

      if (modo === "crear") {
        const creado = (await crearProducto({ ...payload, codigo })) as { id: string };
        toast.success(`Producto "${nombre}" creado`);
        router.push(`/productos-servicios/${creado.id}`);
      } else {
        await actualizarProducto(productoExistente!.id, { ...payload, activo });
        toast.success(`Producto "${nombre}" actualizado`);
        router.push(`/productos-servicios/${productoExistente!.id}`);
      }
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error guardando");
    } finally {
      setGuardando(false);
    }
  };

  const handleEliminar = async () => {
    if (!productoExistente) return;
    if (!confirm(`¿Eliminar "${productoExistente.nombre}"?\nSi tiene cotizaciones se marcará como inactivo en vez de borrar.`)) {
      return;
    }
    setEliminando(true);
    try {
      await eliminarProducto(productoExistente.id);
      toast.success("Producto eliminado");
      router.push("/productos-servicios");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error eliminando");
      setEliminando(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        <Link
          href={modo === "editar" ? `/productos-servicios/${productoExistente!.id}` : "/productos-servicios"}
          className="text-muted-foreground hover:text-foreground inline-flex items-center text-sm"
        >
          <ArrowLeftIcon className="mr-1 size-4" />
          Volver
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">
          {modo === "crear" ? "Nuevo producto" : `Editar producto: ${productoExistente?.nombre}`}
        </h1>
        <p className="text-muted-foreground text-sm">
          {modo === "crear"
            ? "Atributos comerciales del producto. La configuración de pasos / rutas se edita después."
            : "Editás los atributos comerciales. Las rutas y configuración por paso se manejan en otra pantalla."}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Identidad</CardTitle>
            <CardDescription>Código y nombre del producto en el catálogo.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="codigo">Código *</Label>
              <Input
                id="codigo"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                disabled={modo === "editar"}
                placeholder="TARJ-PREMIUM-300"
              />
              {modo === "editar" && (
                <p className="text-muted-foreground text-xs">El código no se puede modificar.</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre *</Label>
              <Input
                id="nombre"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Tarjetas de Visita Premium 300gr"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="descripcion">Descripción</Label>
              <Textarea
                id="descripcion"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                rows={3}
              />
            </div>
            {modo === "editar" && (
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="activo">Activo</Label>
                  <p className="text-muted-foreground text-xs">Si está inactivo no aparece en el cotizador.</p>
                </div>
                <Switch id="activo" checked={activo} onCheckedChange={setActivo} />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Comercial y medidas</CardTitle>
            <CardDescription>Cómo se cobra y cómo se manejan las medidas al cotizar.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <LabelConTooltip
                label="¿Cómo se cobra?"
                htmlFor="unidad"
                tooltip={getLabel(unidadComercialLabels, unidadComercial).descripcion}
              />
              <HumanSelect
                id="unidad"
                value={unidadComercial}
                onValueChange={(v) => setUnidadComercial(v || "unidad")}
                options={unidadComercialProductoItems.map((it) =>
                  optionFromLabel(it.value, unidadComercialLabels),
                )}
              />
            </div>
            <div className="space-y-2">
              <LabelConTooltip
                label="Manejo de medidas"
                htmlFor="modoMedidas"
                tooltip={getLabel(modoMedidasLabels, modoMedidas).descripcion}
                ejemplo={getLabel(modoMedidasLabels, modoMedidas).ejemplo}
              />
              <HumanSelect
                id="modoMedidas"
                value={modoMedidas}
                onValueChange={(v) => setModoMedidas(v || "FIJA")}
                options={MODOS_MEDIDAS.map((it) => optionFromLabel(it.value, modoMedidasLabels))}
              />
            </div>
            {modoMedidas !== "LIBRE" && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ancho">Ancho default (mm)</Label>
                  <Input
                    id="ancho"
                    type="number"
                    value={anchoDefault}
                    onChange={(e) => setAnchoDefault(e.target.value)}
                    placeholder="90"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="alto">Alto default (mm)</Label>
                  <Input
                    id="alto"
                    type="number"
                    value={altoDefault}
                    onChange={(e) => setAltoDefault(e.target.value)}
                    placeholder="50"
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Tab Precio</CardTitle>
            <CardDescription>
              Cómo se calcula el precio de venta a partir del costo del motor.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TabPrecioEditor value={precioConfig} onChange={setPrecioConfig} />
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center justify-between">
        {modo === "editar" ? (
          <Button
            variant="destructive"
            onClick={handleEliminar}
            disabled={guardando || eliminando}
          >
            <Trash2Icon className="mr-2 size-4" />
            {eliminando ? "Eliminando..." : "Eliminar"}
          </Button>
        ) : (
          <div />
        )}
        <Button onClick={handleGuardar} disabled={guardando || !codigo || !nombre} size="lg">
          <SaveIcon className="mr-2 size-4" />
          {guardando ? "Guardando..." : modo === "crear" ? "Crear producto" : "Guardar cambios"}
        </Button>
      </div>
    </div>
  );
}
