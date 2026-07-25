"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon, CogIcon, PlusIcon, StarIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { HumanSelect } from "@/components/ui/human-select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  actualizarProductoRutaAlt,
  crearProductoRutaAlt,
  eliminarProductoRutaAlt,
} from "@/lib/productos-servicios-api";
import { ConfirmacionDestructiva } from "@/components/ui/confirmacion-destructiva";
import type { ProductoDetalle, RutaListItem } from "@/lib/productos-servicios";

interface Props {
  producto: ProductoDetalle;
  rutasDisponibles: RutaListItem[];
  embedded?: boolean;
}

export function ProductoRutasEditorView({ producto, rutasDisponibles, embedded = false }: Props) {
  const router = useRouter();
  const [agregando, setAgregando] = React.useState(false);
  const [nuevaRutaId, setNuevaRutaId] = React.useState("");
  const [nuevoNombre, setNuevoNombre] = React.useState("");
  const [nuevaPreferida, setNuevaPreferida] = React.useState(false);
  const [openSheet, setOpenSheet] = React.useState(false);

  const yaUsadas = new Set(producto.rutasAlternativas.map((ra) => ra.ruta.id));
  const rutasParaAgregar = rutasDisponibles.filter((r) => !yaUsadas.has(r.id));

  const agregarRutaAlt = async () => {
    if (!nuevaRutaId || !nuevoNombre) {
      toast.error("Faltan datos");
      return;
    }
    setAgregando(true);
    try {
      const ruta = rutasDisponibles.find((r) => r.id === nuevaRutaId);
      await crearProductoRutaAlt(producto.id, {
        rutaId: nuevaRutaId,
        rutaVersion: ruta?.versionActual ?? 1,
        nombre: nuevoNombre,
        esPreferida: nuevaPreferida,
        orden: producto.rutasAlternativas.length,
      });
      toast.success(`Ruta "${nuevoNombre}" agregada al producto`);
      setOpenSheet(false);
      setNuevaRutaId("");
      setNuevoNombre("");
      setNuevaPreferida(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error agregando ruta");
    } finally {
      setAgregando(false);
    }
  };

  const cambiarPreferida = async (rutaAltId: string) => {
    try {
      await actualizarProductoRutaAlt(rutaAltId, { esPreferida: true });
      toast.success("Ruta marcada como preferida");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    }
  };

  const [aQuitar, setAQuitar] = React.useState<{ id: string; nombre: string } | null>(null);

  const ejecutarQuitar = async () => {
    if (!aQuitar) return;
    try {
      await eliminarProductoRutaAlt(aQuitar.id);
      toast.success("Ruta quitada del producto");
      setAQuitar(null);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    }
  };

  return (
    <div className={embedded ? "space-y-6" : "flex flex-1 flex-col gap-6 p-6"}>
      <div className="flex flex-col gap-2">
        {!embedded && (
          <Link
            href={`/productos-servicios/${producto.id}`}
            className="text-muted-foreground hover:text-foreground inline-flex items-center text-sm"
          >
            <ArrowLeftIcon className="mr-1 size-4" />
            Volver a {producto.nombre}
          </Link>
        )}
        <div className="flex items-start justify-between">
          <div>
            <h1 className={embedded ? "text-lg font-semibold tracking-tight" : "text-2xl font-semibold tracking-tight"}>
              Rutas alternativas
            </h1>
            <p className="text-muted-foreground text-sm">
              Asociar/quitar rutas reusables a este producto. La ruta preferida es la default
              al cotizar.
            </p>
          </div>
          <Sheet open={openSheet} onOpenChange={setOpenSheet}>
            <SheetTrigger
              render={(props) => (
                <Button {...props} disabled={rutasParaAgregar.length === 0}>
                  <PlusIcon className="mr-2 size-4" />
                  Agregar ruta
                </Button>
              )}
            />
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Agregar ruta alternativa</SheetTitle>
                <SheetDescription>
                  Elegí una ruta del catálogo y dale un nombre humano (ej: &quot;Vía láser&quot;,
                  &quot;Vía offset&quot;).
                </SheetDescription>
              </SheetHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="ruta">Ruta del catálogo</Label>
                  <HumanSelect
                    id="ruta"
                    value={nuevaRutaId}
                    onValueChange={(v) => setNuevaRutaId(v || "")}
                    options={rutasParaAgregar.map((r) => ({
                      value: r.id,
                      label: r.nombre,
                      code: r.codigo,
                      description: `v${r.versionActual} · ${r.pasos.length} pasos`,
                    }))}
                    placeholder="Elegí una ruta..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nombre">Nombre humano de la alternativa</Label>
                  <Input
                    id="nombre"
                    value={nuevoNombre}
                    onChange={(e) => setNuevoNombre(e.target.value)}
                    placeholder="Standard / Vía láser / Vía offset"
                  />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={nuevaPreferida}
                    onChange={(e) => setNuevaPreferida(e.target.checked)}
                  />
                  <span>Marcar como preferida (default al cotizar)</span>
                </label>
              </div>
              <SheetFooter>
                <Button variant="outline" onClick={() => setOpenSheet(false)}>
                  Cancelar
                </Button>
                <Button onClick={agregarRutaAlt} disabled={agregando}>
                  {agregando ? "Agregando..." : "Agregar"}
                </Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {producto.rutasAlternativas.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Sin rutas asociadas</CardTitle>
            <CardDescription>
              Este producto todavía no tiene ninguna ruta alternativa. Agregá al menos 1 para poder
              cotizarlo.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {producto.rutasAlternativas.map((ra) => (
            <Card key={ra.id} className={ra.esPreferida ? "border-primary" : ""}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{ra.nombre}</CardTitle>
                    <CardDescription className="font-mono text-xs">
                      {ra.ruta.codigo}
                    </CardDescription>
                  </div>
                  {ra.esPreferida && (
                    <Badge variant="default" className="gap-1">
                      <StarIcon className="size-3" />
                      Preferida
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-muted-foreground text-xs">
                  Ruta: <span className="font-medium text-foreground">{ra.ruta.nombre}</span>
                  {" · "}
                  v{ra.rutaVersion}
                </div>
                <div className="text-xs">
                  Pasos: {ra.ruta.pasos.length} {" · "}
                  Configurados: {ra.configPasos.length}/{ra.ruta.pasos.length}
                </div>
                <div className="flex items-center gap-2 pt-2">
                  <Link href={`/productos-servicios/${producto.id}?tab=pasos&rutaAltId=${ra.id}`}
                    className={buttonVariants({ variant: "default", size: "sm" })}
                  >
                    <CogIcon className="mr-1 size-3" />
                    Configurar pasos
                  </Link>
                  {!ra.esPreferida && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => cambiarPreferida(ra.id)}
                    >
                      <StarIcon className="mr-1 size-3" />
                      Preferida
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setAQuitar({ id: ra.id, nombre: ra.nombre })}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2Icon className="size-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {rutasParaAgregar.length === 0 && producto.rutasAlternativas.length > 0 && (
        <Card>
          <CardContent className="text-muted-foreground pt-6 text-center text-sm">
            Este producto ya está asociado a todas las rutas disponibles. Para agregar más,
            primero creá nuevas rutas en{" "}
            <Link href="/productos-servicios/rutas/nueva" className="text-primary underline">
              /productos-servicios/rutas/nueva
            </Link>
            .
          </CardContent>
        </Card>
      )}

      <ConfirmacionDestructiva
        open={!!aQuitar}
        onOpenChange={(open) => !open && setAQuitar(null)}
        titulo="Quitar ruta del producto"
        descripcion={
          aQuitar ? (
            <>
              Vas a quitar la ruta alternativa <strong>{aQuitar.nombre}</strong> de{" "}
              <strong>{producto.nombre}</strong>.
            </>
          ) : null
        }
        impacto={[
          "La configuración de pasos para esta ruta se elimina también.",
          "Si era la ruta preferida, hay que designar otra.",
        ]}
        nombreItem={aQuitar?.nombre}
        accionLabel="Quitar ruta"
        onConfirmar={ejecutarQuitar}
      />
    </div>
  );
}
