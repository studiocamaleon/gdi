"use client";

import * as React from "react";
import { CheckIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { RuleBuilder } from "@/components/productos-servicios/rule-builder";
import { ConfirmacionDestructiva } from "@/components/ui/confirmacion-destructiva";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HumanSelect } from "@/components/ui/human-select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Empty, EmptyDescription } from "@/components/ui/empty";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  actualizarCargoPaso,
  asociarCargoPaso,
  desasociarCargoPaso,
} from "@/lib/productos-servicios-api";
import type {
  CargoDirectoCatalogo,
  CargoPasoDetalle,
  ConfigPasoDetalle,
} from "@/lib/productos-servicios";
import {
  getRuleFields,
  jsonLogicToRuleGroup,
  validateRuleGroup,
  type RuleFieldDefinition,
} from "@/lib/rule-builder";
import {
  getLabel,
  modoActivacionLabels,
  modoCalculoCargoLabels,
} from "@/lib/labels-humanos";

type ModoActivacion = "OBLIGATORIO" | "OPCIONAL" | "CONDICIONAL";

interface Props {
  configPaso: ConfigPasoDetalle | null;
  catalogoCargos: CargoDirectoCatalogo[];
  includeMeasureFields: boolean;
  ruleExtraFields: RuleFieldDefinition[];
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function montoConfig(cargo: CargoDirectoCatalogo, override?: unknown) {
  return { ...asRecord(cargo.configJson), ...asRecord(override) };
}

function resumenCargo(cargo: CargoDirectoCatalogo, override?: unknown) {
  const config = montoConfig(cargo, override);
  if (cargo.modoCalculo === "MONTO_FIJO_PLANO") {
    const zonas = Array.isArray(config.zonas) ? config.zonas : [];
    if (zonas.length > 0) return `${zonas.length} importes configurados`;
    return `Monto ${Number(config.monto ?? 0).toLocaleString("es-AR")}`;
  }
  if (cargo.modoCalculo === "PORCENTAJE_SOBRE_BASE") {
    return `${Number(config.porcentaje ?? config.porcentajeDefault ?? 0).toLocaleString("es-AR")}% sobre este paso`;
  }
  const unidad = typeof config.unidad === "string" ? config.unidad : "unidad";
  return `${Number(config.precioPorUnidad ?? 0).toLocaleString("es-AR")} / ${unidad}`;
}

export function CostosDirectosPasoPanel({
  configPaso,
  catalogoCargos,
  includeMeasureFields,
  ruleExtraFields,
}: Props) {
  const router = useRouter();
  const asociaciones = configPaso?.cargosDirectosPaso ?? [];
  const [open, setOpen] = React.useState(false);
  const [editando, setEditando] = React.useState<CargoPasoDetalle | null>(null);
  const [cargoId, setCargoId] = React.useState("");
  const [modo, setModo] = React.useState<ModoActivacion>("OBLIGATORIO");
  const [condicion, setCondicion] = React.useState<Record<
    string,
    unknown
  > | null>(null);
  const [sobrescribir, setSobrescribir] = React.useState(false);
  const [valor, setValor] = React.useState("");
  const [guardando, setGuardando] = React.useState(false);
  const [aQuitar, setAQuitar] = React.useState<CargoPasoDetalle | null>(null);

  const cargoSeleccionado = React.useMemo(
    () =>
      editando?.cargoDirectoCatalogo ??
      catalogoCargos.find((cargo) => cargo.id === cargoId) ??
      null,
    [catalogoCargos, cargoId, editando],
  );
  const asociados = new Set(
    asociaciones.map((item) => item.cargoDirectoCatalogo.id),
  );
  const disponibles = catalogoCargos.filter(
    (cargo) => cargo.activo && !asociados.has(cargo.id),
  );

  const modosDisponibles = React.useMemo<ModoActivacion[]>(() => {
    const soportados = cargoSeleccionado?.modosActivacionSoportados ?? [];
    const todos: ModoActivacion[] = ["OBLIGATORIO", "OPCIONAL", "CONDICIONAL"];
    return soportados.length > 0
      ? todos.filter((item) => soportados.includes(item))
      : todos;
  }, [cargoSeleccionado]);

  React.useEffect(() => {
    if (modosDisponibles.length > 0 && !modosDisponibles.includes(modo)) {
      setModo(modosDisponibles[0]);
    }
  }, [modo, modosDisponibles]);

  const abrirNuevo = () => {
    setEditando(null);
    setCargoId("");
    setModo("OBLIGATORIO");
    setCondicion(null);
    setSobrescribir(false);
    setValor("");
    setOpen(true);
  };

  const abrirEditar = (asociacion: CargoPasoDetalle) => {
    const config = montoConfig(
      asociacion.cargoDirectoCatalogo,
      asociacion.configOverrideJson,
    );
    setEditando(asociacion);
    setCargoId(asociacion.cargoDirectoCatalogo.id);
    setModo(asociacion.modoActivacion as ModoActivacion);
    setCondicion(asociacion.condicionActivacionJson ?? null);
    setSobrescribir(Boolean(asociacion.configOverrideJson));
    const raw =
      asociacion.cargoDirectoCatalogo.modoCalculo === "MONTO_FIJO_PLANO"
        ? config.monto
        : asociacion.cargoDirectoCatalogo.modoCalculo ===
            "PORCENTAJE_SOBRE_BASE"
          ? (config.porcentaje ?? config.porcentajeDefault)
          : config.precioPorUnidad;
    setValor(raw === undefined ? "" : String(raw));
    setOpen(true);
  };

  const buildOverride = () => {
    if (!sobrescribir || !cargoSeleccionado) return undefined;
    const numero = Number(valor);
    if (!Number.isFinite(numero) || numero <= 0) return null;
    if (cargoSeleccionado.modoCalculo === "MONTO_FIJO_PLANO") {
      return { monto: numero, zonas: [] };
    }
    if (cargoSeleccionado.modoCalculo === "PORCENTAJE_SOBRE_BASE") {
      return { porcentaje: numero };
    }
    return { precioPorUnidad: numero };
  };

  const guardar = async () => {
    if (!configPaso || !cargoSeleccionado) return;
    const configOverrideJson = buildOverride();
    if (configOverrideJson === null) {
      toast.error("Ingresá un valor mayor a cero.");
      return;
    }
    if (modo === "CONDICIONAL") {
      const fields = getRuleFields({
        includeMeasureFields,
        extraFields: ruleExtraFields,
      });
      const parsed = jsonLogicToRuleGroup(condicion, fields);
      if (parsed.supported) {
        const validation = validateRuleGroup(parsed.group, fields);
        if (!validation.ok) {
          toast.error(validation.error ?? "Completá la regla de activación.");
          return;
        }
      }
    }
    setGuardando(true);
    try {
      const payload = {
        modoActivacion: modo,
        condicionActivacionJson:
          modo === "CONDICIONAL" ? (condicion ?? undefined) : undefined,
        ...(editando || configOverrideJson
          ? { configOverrideJson: configOverrideJson ?? null }
          : {}),
      };
      if (editando) {
        await actualizarCargoPaso(editando.id, payload);
      } else {
        await asociarCargoPaso(configPaso.id, {
          cargoDirectoCatalogoId: cargoSeleccionado.id,
          ...payload,
        });
      }
      toast.success(
        editando
          ? "Costo directo actualizado"
          : "Costo directo asociado al paso",
      );
      setOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo guardar el costo directo",
      );
    } finally {
      setGuardando(false);
    }
  };

  return (
    <section className="flex flex-col gap-2.5">
      <div className="px-0.5">
        <div className="flex items-center gap-2 text-[15px] font-semibold">
          <span
            aria-hidden
            className="flex size-4 shrink-0 items-center justify-center rounded-full text-white"
            style={{ background: "var(--ok, #22a06b)" }}
          >
            <CheckIcon className="size-2.5" strokeWidth={3.2} />
          </span>
          Costos directos del paso
        </div>
        <p className="text-muted-foreground mt-0.5 ml-6 max-w-2xl text-xs">
          Desembolsos adicionales que se generan cuando este paso se ejecuta.
        </p>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border bg-background p-4">
        <div className="flex justify-end">
          <Button
            type="button"
            size="sm"
            onClick={abrirNuevo}
            disabled={!configPaso || disponibles.length === 0}
          >
            <PlusIcon data-icon="inline-start" />
            Asociar costo
          </Button>
        </div>

        {!configPaso ? (
          <Empty className="min-h-0 items-start gap-0 border p-4 text-left">
            <EmptyDescription>
              Guardá primero la configuración del paso. Después vas a poder
              asociarle costos directos.
            </EmptyDescription>
          </Empty>
        ) : asociaciones.length === 0 ? (
          <Empty className="min-h-0 items-start gap-0 border p-4 text-left">
            <EmptyDescription>
              Este paso no tiene costos monetarios adicionales. El tiempo, los
              materiales y los proveedores se configuran en sus secciones
              específicas.
            </EmptyDescription>
          </Empty>
        ) : (
          <div className="grid gap-2 md:grid-cols-2">
          {asociaciones.map((asociacion) => (
            <div
              key={asociacion.id}
              className="flex items-center gap-3 rounded-lg border px-3 py-2.5"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">
                  {asociacion.cargoDirectoCatalogo.nombre}
                </div>
                <div className="text-muted-foreground text-xs">
                  {resumenCargo(
                    asociacion.cargoDirectoCatalogo,
                    asociacion.configOverrideJson,
                  )}
                </div>
                <div className="mt-1 flex gap-1">
                  <Badge variant="outline" className="text-[10px]">
                    {
                      getLabel(
                        modoCalculoCargoLabels,
                        asociacion.cargoDirectoCatalogo.modoCalculo,
                      ).label
                    }
                  </Badge>
                  <Badge variant="secondary" className="text-[10px]">
                    {
                      getLabel(modoActivacionLabels, asociacion.modoActivacion)
                        .label
                    }
                  </Badge>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => abrirEditar(asociacion)}
                aria-label={`Editar ${asociacion.cargoDirectoCatalogo.nombre}`}
              >
                <PencilIcon />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="text-red-600"
                onClick={() => setAQuitar(asociacion)}
                aria-label={`Quitar ${asociacion.cargoDirectoCatalogo.nombre}`}
              >
                <Trash2Icon />
              </Button>
            </div>
          ))}
          </div>
        )}
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>
              {editando ? "Editar costo directo" : "Asociar costo directo"}
            </SheetTitle>
            <SheetDescription>
              Se aplicará dentro de este paso y quedará identificado en el
              desglose de costos.
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-5 px-4">
            <div className="space-y-2">
              <Label>Costo del catálogo</Label>
              <HumanSelect
                value={cargoId}
                disabled={Boolean(editando)}
                onValueChange={(value) => setCargoId(value ?? "")}
                options={(editando
                  ? [editando.cargoDirectoCatalogo]
                  : disponibles
                ).map((cargo) => ({
                  value: cargo.id,
                  label: cargo.nombre,
                  code: cargo.codigo,
                  description: resumenCargo(cargo),
                }))}
                placeholder="Elegí un costo"
              />
            </div>

            {cargoSeleccionado ? (
              <>
                <div className="space-y-2">
                  <Label>Cuándo se aplica</Label>
                  <HumanSelect
                    value={modo}
                    onValueChange={(value) =>
                      setModo((value ?? "OBLIGATORIO") as ModoActivacion)
                    }
                    options={modosDisponibles.map((item) => ({
                      value: item,
                      label: getLabel(modoActivacionLabels, item).label,
                      description: getLabel(modoActivacionLabels, item)
                        .descripcion,
                    }))}
                  />
                </div>
                {modo === "CONDICIONAL" ? (
                  <div className="space-y-2">
                    <Label>Regla de activación</Label>
                    <RuleBuilder
                      value={condicion}
                      includeMeasureFields={includeMeasureFields}
                      extraFields={ruleExtraFields}
                      onChange={setCondicion}
                    />
                  </div>
                ) : null}

                <div className="rounded-lg border p-3">
                  <label className="flex cursor-pointer items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={sobrescribir}
                      onChange={(event) =>
                        setSobrescribir(event.target.checked)
                      }
                      className="mt-0.5"
                    />
                    <span>
                      <span className="block font-medium">
                        Usar un valor particular en este paso
                      </span>
                      <span className="text-muted-foreground block text-xs">
                        Si no, se usará el valor vigente del catálogo:{" "}
                        {resumenCargo(cargoSeleccionado)}.
                      </span>
                    </span>
                  </label>
                  {sobrescribir ? (
                    <div className="mt-3 space-y-2">
                      <Label htmlFor="cargo-paso-valor">
                        {cargoSeleccionado.modoCalculo ===
                        "PORCENTAJE_SOBRE_BASE"
                          ? "Porcentaje sobre el costo del paso"
                          : cargoSeleccionado.modoCalculo === "POR_UNIDAD_INPUT"
                            ? "Precio por unidad"
                            : "Monto fijo"}
                      </Label>
                      <Input
                        id="cargo-paso-valor"
                        type="number"
                        min={0}
                        step="any"
                        value={valor}
                        onChange={(event) => setValor(event.target.value)}
                      />
                    </div>
                  ) : null}
                </div>
              </>
            ) : null}
          </div>
          <SheetFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={guardar}
              disabled={guardando || !cargoSeleccionado}
            >
              {guardando ? "Guardando..." : "Guardar costo"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <ConfirmacionDestructiva
        open={Boolean(aQuitar)}
        onOpenChange={(next) => !next && setAQuitar(null)}
        titulo="Quitar costo del paso"
        descripcion="Las cotizaciones nuevas dejarán de incluirlo. Los snapshots históricos no cambian."
        nombreItem={aQuitar?.cargoDirectoCatalogo.nombre}
        requiereTipear={false}
        accionLabel="Quitar costo"
        onConfirmar={async () => {
          if (!aQuitar) return;
          try {
            await desasociarCargoPaso(aQuitar.id);
            toast.success("Costo directo quitado del paso");
            setAQuitar(null);
            router.refresh();
          } catch (error) {
            toast.error(
              error instanceof Error
                ? error.message
                : "No se pudo quitar el costo",
            );
          }
        }}
      />
    </section>
  );
}
