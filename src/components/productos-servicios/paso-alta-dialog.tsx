"use client";

import * as React from "react";
import { BoxesIcon, CheckIcon, WorkflowIcon } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { categoriaFamiliaLabels, getLabel } from "@/lib/labels-humanos";
import type { PasoTenant, PlantillaPaso } from "@/lib/productos-servicios";
import { crearPasoTenant } from "@/lib/productos-servicios-api";
import { cn } from "@/lib/utils";
import { descripcionPasoParaUsuario } from "@/lib/pasos-presentacion";

type Props = {
  open: boolean;
  plantillas: PlantillaPaso[];
  onClose: () => void;
  onCreado: (paso: PasoTenant) => void;
};

export function PasoAltaDialog({ open, plantillas, onClose, onCreado }: Props) {
  const [nombre, setNombre] = React.useState("");
  const [plantilla, setPlantilla] = React.useState<string | null>(null);
  const [tipoPaso, setTipoPaso] = React.useState<"SIMPLE" | "COMPUESTO">(
    "SIMPLE",
  );
  const [busqueda, setBusqueda] = React.useState("");
  const [creando, setCreando] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setNombre("");
    setPlantilla(null);
    setTipoPaso("SIMPLE");
    setBusqueda("");
    setCreando(false);
  }, [open]);

  const filtradas = React.useMemo(() => {
    const q = busqueda.trim().toLocaleLowerCase("es");
    if (!q) return plantillas;
    return plantillas.filter((item) => {
      const categoria = getLabel(categoriaFamiliaLabels, item.categoria).label;
      return [
        item.nombre,
        descripcionPasoParaUsuario(item.descripcion),
        categoria,
      ].some((texto) => texto.toLocaleLowerCase("es").includes(q));
    });
  }, [busqueda, plantillas]);

  const plantillaEfectiva =
    tipoPaso === "COMPUESTO" ? "trabajo_manual" : plantilla;
  const puedeGuardar = Boolean(nombre.trim() && plantillaEfectiva && !creando);
  const crear = async () => {
    if (!puedeGuardar || !plantillaEfectiva) return;
    setCreando(true);
    try {
      const creado = await crearPasoTenant({
        nombre: nombre.trim(),
        plantillaCodigo: plantillaEfectiva,
        tipoPaso,
        operacionesCompuestas: [],
      });
      toast.success(`"${creado.nombre}" creado`);
      onCreado(creado);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo crear el paso.",
      );
      setCreando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[min(760px,calc(100dvh-2rem))] sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Nuevo paso propio</DialogTitle>
          <DialogDescription>
            Elegí una plantilla del sistema. El paso heredará su comportamiento
            completo y luego podrás configurar cómo trabaja tu empresa.
          </DialogDescription>
        </DialogHeader>

        <FieldGroup className="min-h-0">
          <Field>
            <FieldLabel htmlFor="paso-alta-nombre">Nombre del paso</FieldLabel>
            <Input
              id="paso-alta-nombre"
              value={nombre}
              autoFocus
              maxLength={80}
              onChange={(event) => setNombre(event.target.value)}
              placeholder="Ej.: Bordado"
            />
            <FieldDescription>
              El nombre operativo que verá tu equipo.
            </FieldDescription>
          </Field>

          <Field>
            <FieldLabel>Tipo de paso</FieldLabel>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                aria-pressed={tipoPaso === "SIMPLE"}
                className={cn(
                  "flex min-h-20 items-start gap-3 rounded-lg border p-3 text-left transition-colors",
                  tipoPaso === "SIMPLE" && "border-foreground bg-muted",
                )}
                onClick={() => setTipoPaso("SIMPLE")}
              >
                <WorkflowIcon className="mt-0.5 size-4 shrink-0" />
                <span>
                  <strong className="block text-sm">Paso simple</strong>
                  <small className="text-muted-foreground">
                    Una operación productiva.
                  </small>
                </span>
              </button>
              <button
                type="button"
                aria-pressed={tipoPaso === "COMPUESTO"}
                className={cn(
                  "flex min-h-20 items-start gap-3 rounded-lg border p-3 text-left transition-colors",
                  tipoPaso === "COMPUESTO" && "border-foreground bg-muted",
                )}
                onClick={() => setTipoPaso("COMPUESTO")}
              >
                <BoxesIcon className="mt-0.5 size-4 shrink-0" />
                <span>
                  <strong className="block text-sm">Paso compuesto</strong>
                  <small className="text-muted-foreground">
                    Agrupa operaciones configurables por producto.
                  </small>
                </span>
              </button>
            </div>
          </Field>

          {tipoPaso === "SIMPLE" ? (
            <Field>
              <FieldLabel htmlFor="paso-alta-busqueda">
                Plantilla del sistema
              </FieldLabel>
              <Input
                id="paso-alta-busqueda"
                type="search"
                placeholder="Buscar por nombre, categoría o descripción"
                value={busqueda}
                onChange={(event) => setBusqueda(event.target.value)}
              />
              <div
                className="flex max-h-80 flex-col gap-2 overflow-y-auto rounded-lg border p-2"
                role="group"
                aria-label="Plantillas disponibles"
              >
                {filtradas.length === 0 ? (
                  <p className="p-4 text-center text-sm text-muted-foreground">
                    Ninguna plantilla coincide con la búsqueda.
                  </p>
                ) : null}
                {filtradas.map((item) => {
                  const seleccionada = plantilla === item.codigo;
                  return (
                    <button
                      key={item.codigo}
                      type="button"
                      aria-pressed={seleccionada}
                      className={cn(
                        "flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                        seleccionada && "border-foreground bg-muted",
                      )}
                      onClick={() => setPlantilla(item.codigo)}
                    >
                      <span className="flex min-w-0 flex-1 flex-col gap-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{item.nombre}</span>
                          <Badge variant="secondary">
                            {
                              getLabel(categoriaFamiliaLabels, item.categoria)
                                .label
                            }
                          </Badge>
                        </span>
                        {item.descripcion ? (
                          <span className="line-clamp-2 text-sm text-muted-foreground">
                            {descripcionPasoParaUsuario(item.descripcion)}
                          </span>
                        ) : null}
                      </span>
                      {seleccionada ? <CheckIcon aria-hidden /> : null}
                    </button>
                  );
                })}
              </div>
            </Field>
          ) : (
            <div className="rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm text-orange-950">
              Después de crearlo definirás sus operaciones posibles. Las
              cantidades, outputs y reglas se configurarán al usarlo en la BOM
              de cada producto.
            </div>
          )}
        </FieldGroup>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={creando}>
            Cancelar
          </Button>
          <Button onClick={crear} disabled={!puedeGuardar}>
            {creando ? "Creando…" : "Crear y configurar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
