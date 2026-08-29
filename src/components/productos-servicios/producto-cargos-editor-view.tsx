"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon, PlusIcon, Trash2Icon, WrenchIcon } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { HumanSelect, optionFromLabel } from "@/components/ui/human-select";
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
  asociarCargoCotizacion,
  desasociarCargoCotizacion,
} from "@/lib/productos-servicios-api";
import { ConfirmacionDestructiva } from "@/components/ui/confirmacion-destructiva";
import type {
  CargoDirectoCatalogo,
  ProductoDetalle,
} from "@/lib/productos-servicios";
import { LabelConTooltip } from "@/components/ui/label-con-tooltip";
import {
  getLabel,
  modoActivacionLabels,
  modoCalculoCargoLabels,
} from "@/lib/labels-humanos";

interface Props {
  producto: ProductoDetalle;
  catalogoCargos: CargoDirectoCatalogo[];
  embedded?: boolean;
}

const MODOS_ACTIVACION = ["OBLIGATORIO", "OPCIONAL", "CONDICIONAL"] as const;

export function ProductoCargosEditorView({
  producto,
  catalogoCargos,
  embedded = false,
}: Props) {
  const router = useRouter();
  const [openSheet, setOpenSheet] = React.useState(false);
  const [guardando, setGuardando] = React.useState(false);

  const [cargoSeleccionado, setCargoSeleccionado] = React.useState("");
  const [modoActivacion, setModoActivacion] = React.useState("OPCIONAL");

  const yaAsociados = new Set(
    producto.cargosDirectosCotizacion.map((c) => c.cargoDirectoCatalogo.codigo),
  );
  const disponibles = catalogoCargos.filter(
    (c) => c.activo && !yaAsociados.has(c.codigo),
  );

  const asociar = async () => {
    if (!cargoSeleccionado) return;
    setGuardando(true);
    try {
      await asociarCargoCotizacion(producto.id, {
        cargoDirectoCatalogoId: cargoSeleccionado,
        modoActivacion: modoActivacion as
          "OBLIGATORIO" | "OPCIONAL" | "CONDICIONAL",
      });
      toast.success("Cargo asociado al producto");
      setOpenSheet(false);
      setCargoSeleccionado("");
      setModoActivacion("OPCIONAL");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setGuardando(false);
    }
  };

  const [aDesasociar, setADesasociar] = React.useState<{
    id: string;
    nombre: string;
  } | null>(null);

  const ejecutarDesasociar = async () => {
    if (!aDesasociar) return;
    try {
      await desasociarCargoCotizacion(aDesasociar.id);
      toast.success("Cargo desasociado");
      setADesasociar(null);
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
            <h1
              className={
                embedded
                  ? "text-lg font-semibold tracking-tight"
                  : "text-2xl font-semibold tracking-tight"
              }
            >
              Cargos directos del producto
            </h1>
            <p className="text-muted-foreground text-sm">
              Cargos a nivel cotización (ej: viático, recargo urgencia). Se
              ofrecen al comercial al cotizar este producto.
            </p>
          </div>
          <Sheet open={openSheet} onOpenChange={setOpenSheet}>
            <SheetTrigger
              render={(props) => (
                <Button {...props} disabled={disponibles.length === 0}>
                  <PlusIcon className="mr-2 size-4" />
                  Asociar cargo
                </Button>
              )}
            />
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Asociar cargo directo al producto</SheetTitle>
                <SheetDescription>
                  Elegí del catálogo del tenant un cargo a nivel cotización. Si
                  no aparece el que necesitás, primero creá el cargo en{" "}
                  <Link
                    href="/productos-servicios/cargos-directos"
                    className="text-primary underline"
                  >
                    /cargos-directos
                  </Link>
                  .
                </SheetDescription>
              </SheetHeader>
              <div className="space-y-4 px-4">
                <div className="space-y-2">
                  <LabelConTooltip
                    label="Cargo del catálogo"
                    tooltip="Elegí un cargo de la lista que ya creaste en el catálogo (viático, recargo, tercerización, etc.)."
                  />
                  <HumanSelect
                    value={cargoSeleccionado}
                    onValueChange={(v) => setCargoSeleccionado(v ?? "")}
                    options={disponibles.map((c) => {
                      const lblCalc = getLabel(
                        modoCalculoCargoLabels,
                        c.modoCalculo,
                      );
                      return {
                        value: c.id,
                        label: c.nombre,
                        code: c.codigo,
                        description: lblCalc.label,
                      };
                    })}
                    placeholder="Elegí cargo..."
                  />
                </div>
                <div className="space-y-2">
                  <LabelConTooltip
                    label="¿Cuándo se aplica?"
                    tooltip={
                      getLabel(modoActivacionLabels, modoActivacion).descripcion
                    }
                  />
                  <HumanSelect
                    value={modoActivacion}
                    onValueChange={(v) => setModoActivacion(v ?? "OPCIONAL")}
                    options={MODOS_ACTIVACION.map((m) =>
                      optionFromLabel(m, modoActivacionLabels),
                    )}
                  />
                  <p className="text-muted-foreground text-xs">
                    {getLabel(modoActivacionLabels, modoActivacion).descripcion}
                  </p>
                </div>
              </div>
              <SheetFooter>
                <Button variant="outline" onClick={() => setOpenSheet(false)}>
                  Cancelar
                </Button>
                <Button
                  onClick={asociar}
                  disabled={guardando || !cargoSeleccionado}
                >
                  {guardando ? "Asociando..." : "Asociar"}
                </Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {producto.cargosDirectosCotizacion.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Sin cargos asociados</CardTitle>
            <CardDescription>
              Este producto no tiene cargos directos a nivel cotización.
              {disponibles.length === 0 && catalogoCargos.length === 0 && (
                <>
                  {" "}
                  Primero{" "}
                  <Link
                    href="/productos-servicios/cargos-directos"
                    className="text-primary underline"
                  >
                    creá cargos en el catálogo
                  </Link>
                  .
                </>
              )}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {producto.cargosDirectosCotizacion.map((cd) => (
            <Card key={cd.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <WrenchIcon className="size-4" />
                      {cd.cargoDirectoCatalogo.nombre}
                    </CardTitle>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setADesasociar({
                        id: cd.id,
                        nombre: cd.cargoDirectoCatalogo.nombre,
                      })
                    }
                    className="h-7 w-7 p-0 text-red-600"
                  >
                    <Trash2Icon className="size-3" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-1">
                  <Badge
                    variant="outline"
                    className="text-[10px]"
                    title={
                      getLabel(
                        modoCalculoCargoLabels,
                        cd.cargoDirectoCatalogo.modoCalculo,
                      ).descripcion
                    }
                  >
                    {
                      getLabel(
                        modoCalculoCargoLabels,
                        cd.cargoDirectoCatalogo.modoCalculo,
                      ).label
                    }
                  </Badge>
                  <Badge
                    variant={
                      cd.modoActivacion === "OBLIGATORIO"
                        ? "default"
                        : "secondary"
                    }
                    className="text-[10px]"
                    title={
                      getLabel(modoActivacionLabels, cd.modoActivacion)
                        .descripcion
                    }
                  >
                    {getLabel(modoActivacionLabels, cd.modoActivacion).label}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ConfirmacionDestructiva
        open={!!aDesasociar}
        onOpenChange={(open) => !open && setADesasociar(null)}
        titulo="Quitar cargo del producto"
        descripcion={
          aDesasociar ? (
            <>
              Vas a desasociar el cargo <strong>{aDesasociar.nombre}</strong> de
              este producto.
            </>
          ) : null
        }
        impacto={[
          "El cargo deja de ofrecerse al cotizar este producto.",
          "El cargo sigue existiendo en el catálogo del tenant.",
        ]}
        nombreItem={aDesasociar?.nombre}
        requiereTipear={false}
        accionLabel="Quitar cargo"
        onConfirmar={ejecutarDesasociar}
      />
    </div>
  );
}
