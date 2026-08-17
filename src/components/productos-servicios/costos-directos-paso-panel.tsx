"use client";

import * as React from "react";
import {
  CheckIcon,
  CircleDollarSignIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import {
  actualizarCargoPaso,
  actualizarPasoExtra,
  asociarCargoPaso,
  desasociarCargoPaso,
  distribuirCargoPasoPorNiveles,
} from "@/lib/productos-servicios-api";
import type {
  CargoDirectoCatalogo,
  CargoPasoDetalle,
  ConfigPasoDetalle,
  PasoExtra,
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
import { nombreNivel, type NivelesPasoConfig } from "@/lib/niveles-paso";

type ModoActivacion = "OBLIGATORIO" | "OPCIONAL" | "CONDICIONAL";

interface Props {
  configPaso: ConfigPasoDetalle | null;
  pasoExtra?: PasoExtra | null;
  catalogoCargos: CargoDirectoCatalogo[];
  includeMeasureFields: boolean;
  ruleExtraFields: RuleFieldDefinition[];
  niveles?: NivelesPasoConfig | null;
  /** Persiste cambios locales del paso antes de mutar cargos por nivel. */
  onBeforeMutate?: () => Promise<boolean>;
}

interface CargoExtraConfig {
  cargoDirectoCatalogoId: string;
  nivelCodigo?: string | null;
  modoActivacion: string;
  condicionActivacionJson?: Record<string, unknown> | null;
  configOverrideJson?: Record<string, unknown> | null;
}

function leerCargosExtra(value: unknown): CargoExtraConfig[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is CargoExtraConfig =>
    Boolean(
      item &&
      typeof item === "object" &&
      typeof (item as CargoExtraConfig).cargoDirectoCatalogoId === "string",
    ),
  );
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
  pasoExtra = null,
  catalogoCargos,
  includeMeasureFields,
  ruleExtraFields,
  niveles = null,
  onBeforeMutate,
}: Props) {
  const router = useRouter();
  const cargosExtra = React.useMemo(
    () => leerCargosExtra(pasoExtra?.configCargosDirectosJson),
    [pasoExtra?.configCargosDirectosJson],
  );
  const asociaciones = React.useMemo<CargoPasoDetalle[]>(() => {
    if (!pasoExtra) return configPaso?.cargosDirectosPaso ?? [];
    return cargosExtra.flatMap((cargo, index) => {
      const catalogo = catalogoCargos.find(
        (item) => item.id === cargo.cargoDirectoCatalogoId,
      );
      if (!catalogo) return [];
      return [
        {
          id: `extra:${index}`,
          nivelCodigo: cargo.nivelCodigo ?? null,
          modoActivacion: cargo.modoActivacion,
          condicionActivacionJson: cargo.condicionActivacionJson ?? null,
          configOverrideJson: cargo.configOverrideJson ?? null,
          cargoDirectoCatalogo: catalogo,
        },
      ];
    });
  }, [cargosExtra, catalogoCargos, configPaso?.cargosDirectosPaso, pasoExtra]);
  const destinoListo = Boolean(configPaso || pasoExtra);
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
  const [nivelCodigo, setNivelCodigo] = React.useState<string | null>(null);
  const [distribuyendo, setDistribuyendo] = React.useState<string | null>(null);

  const cargoSeleccionado = React.useMemo(
    () =>
      editando?.cargoDirectoCatalogo ??
      catalogoCargos.find((cargo) => cargo.id === cargoId) ??
      null,
    [catalogoCargos, cargoId, editando],
  );
  const disponiblesPara = (codigoNivel: string | null) =>
    catalogoCargos.filter(
      (cargo) =>
        cargo.activo &&
        !asociaciones.some(
          (item) =>
            item.cargoDirectoCatalogo.id === cargo.id &&
            (item.nivelCodigo === codigoNivel || item.nivelCodigo == null),
        ),
    );
  const disponibles = disponiblesPara(nivelCodigo);

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

  const abrirNuevo = (codigoNivel: string | null = null) => {
    setEditando(null);
    setCargoId("");
    setModo("OBLIGATORIO");
    setCondicion(null);
    setSobrescribir(false);
    setValor("");
    setNivelCodigo(codigoNivel);
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
    setNivelCodigo(asociacion.nivelCodigo ?? null);
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
    if (!destinoListo || !cargoSeleccionado) return;
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
      if (onBeforeMutate && !(await onBeforeMutate())) return;
      const payload = {
        modoActivacion: modo,
        condicionActivacionJson:
          modo === "CONDICIONAL" ? (condicion ?? undefined) : undefined,
        ...(editando || configOverrideJson
          ? { configOverrideJson: configOverrideJson ?? null }
          : {}),
      };
      if (pasoExtra) {
        const siguiente = [...cargosExtra];
        const cargo: CargoExtraConfig = {
          cargoDirectoCatalogoId: cargoSeleccionado.id,
          nivelCodigo,
          ...payload,
        };
        if (editando) {
          const index = Number(editando.id.split(":")[1]);
          siguiente[index] = cargo;
        } else {
          siguiente.push(cargo);
        }
        await actualizarPasoExtra(pasoExtra.id, {
          configCargosDirectosJson: siguiente,
        });
      } else if (editando) {
        await actualizarCargoPaso(editando.id, payload);
      } else {
        if (!configPaso) return;
        await asociarCargoPaso(configPaso.id, {
          cargoDirectoCatalogoId: cargoSeleccionado.id,
          ...(nivelCodigo ? { nivelCodigo } : {}),
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

  const distribuirPorNiveles = async (asociacion: CargoPasoDetalle) => {
    setDistribuyendo(asociacion.id);
    try {
      if (onBeforeMutate && !(await onBeforeMutate())) return;
      if (pasoExtra && niveles) {
        const index = Number(asociacion.id.split(":")[1]);
        const original = cargosExtra[index];
        const siguiente = cargosExtra.flatMap((cargo, cargoIndex) =>
          cargoIndex === index
            ? niveles.opciones.map((nivel) => ({
                ...original,
                nivelCodigo: nivel.codigo,
              }))
            : [cargo],
        );
        await actualizarPasoExtra(pasoExtra.id, {
          configCargosDirectosJson: siguiente,
        });
      } else {
        await distribuirCargoPasoPorNiveles(asociacion.id);
      }
      toast.success("Costo separado por nivel");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo separar el costo por nivel",
      );
    } finally {
      setDistribuyendo(null);
    }
  };

  const renderAsociacion = (asociacion: CargoPasoDetalle) => (
    <TableRow key={asociacion.id}>
      <TableCell className="w-full min-w-64 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-lg">
            <CircleDollarSignIcon className="size-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <div className="truncate font-medium">
              {asociacion.cargoDirectoCatalogo.nombre}
            </div>
            <div className="text-muted-foreground text-xs">
              {resumenCargo(
                asociacion.cargoDirectoCatalogo,
                asociacion.configOverrideJson,
              )}
            </div>
          </div>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          <Badge variant="outline">
            {
              getLabel(
                modoCalculoCargoLabels,
                asociacion.cargoDirectoCatalogo.modoCalculo,
              ).label
            }
          </Badge>
          <Badge variant="secondary">
            {getLabel(modoActivacionLabels, asociacion.modoActivacion).label}
          </Badge>
        </div>
      </TableCell>
      <TableCell className="w-20 pr-3 text-right">
        <div className="flex items-center justify-end gap-1">
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
            className="text-destructive"
            onClick={() => setAQuitar(asociacion)}
            aria-label={`Quitar ${asociacion.cargoDirectoCatalogo.nombre}`}
          >
            <Trash2Icon />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );

  const generalesLegados = niveles
    ? asociaciones.filter((asociacion) => !asociacion.nivelCodigo)
    : [];

  return (
    <section className="mt-6 flex flex-col gap-2.5">
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
        {!destinoListo ? (
          <Empty className="min-h-0 items-start gap-0 border p-4 text-left">
            <EmptyDescription>
              Guardá primero la configuración del paso. Después vas a poder
              asociarle costos directos.
            </EmptyDescription>
          </Empty>
        ) : niveles ? (
          <>
            {generalesLegados.map((asociacion) => (
              <Alert key={asociacion.id}>
                <AlertTitle>
                  {asociacion.cargoDirectoCatalogo.nombre} todavía aplica a
                  todos los niveles
                </AlertTitle>
                <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
                  <span>
                    Es una configuración anterior. Separala para poder ajustar
                    su importe y activación en cada nivel.
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={distribuyendo === asociacion.id}
                    onClick={() => distribuirPorNiveles(asociacion)}
                  >
                    {distribuyendo === asociacion.id
                      ? "Separando..."
                      : "Separar por nivel"}
                  </Button>
                </AlertDescription>
              </Alert>
            ))}

            <div className="flex flex-col gap-3">
              {niveles.opciones.map((nivel) => {
                const cargosNivel = asociaciones.filter(
                  (asociacion) => asociacion.nivelCodigo === nivel.codigo,
                );
                const disponiblesNivel = disponiblesPara(nivel.codigo);
                return (
                  <div
                    key={nivel.codigo}
                    className="overflow-hidden rounded-lg border"
                  >
                    <div className="bg-muted/30 flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">
                          {nombreNivel(nivel)}
                        </span>
                        {nivel.esDefault ? (
                          <Badge variant="secondary">Predeterminado</Badge>
                        ) : null}
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => abrirNuevo(nivel.codigo)}
                        disabled={disponiblesNivel.length === 0}
                      >
                        <PlusIcon data-icon="inline-start" />
                        Agregar costo
                      </Button>
                    </div>
                    {cargosNivel.length > 0 ? (
                      <Table>
                        <TableBody>
                          {cargosNivel.map(renderAsociacion)}
                        </TableBody>
                      </Table>
                    ) : (
                      <p className="text-muted-foreground px-3 py-3 text-xs">
                        Sin costos adicionales para este nivel.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="overflow-hidden rounded-lg border">
            <div className="bg-muted/30 flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2.5">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Aplicación general</span>
                <Badge variant="secondary">Todo el paso</Badge>
                {asociaciones.length > 0 ? (
                  <span className="text-muted-foreground text-xs">
                    {asociaciones.length} costo
                    {asociaciones.length === 1 ? "" : "s"}
                  </span>
                ) : null}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => abrirNuevo(null)}
                disabled={disponiblesPara(null).length === 0}
              >
                <PlusIcon data-icon="inline-start" />
                Asociar costo
              </Button>
            </div>
            {asociaciones.length > 0 ? (
              <Table>
                <TableBody>{asociaciones.map(renderAsociacion)}</TableBody>
              </Table>
            ) : (
              <p className="text-muted-foreground px-3 py-3 text-xs">
                Sin costos monetarios adicionales para este paso.
              </p>
            )}
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
              {nivelCodigo
                ? `Se aplicará únicamente cuando el comercial elija “${nombreNivel(
                    niveles?.opciones.find(
                      (nivel) => nivel.codigo === nivelCodigo,
                    ) ?? {
                      codigo: nivelCodigo,
                      nombre: nivelCodigo,
                      esDefault: false,
                      overrides: {},
                    },
                  )}”.`
                : `Se aplicará dentro de este ${pasoExtra ? "paso extra" : "paso"} y quedará identificado en el desglose de costos.`}
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
                        Usar un valor particular en este{" "}
                        {nivelCodigo ? "nivel" : "paso"}
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
            if (onBeforeMutate && !(await onBeforeMutate())) return;
            if (pasoExtra) {
              const index = Number(aQuitar.id.split(":")[1]);
              await actualizarPasoExtra(pasoExtra.id, {
                configCargosDirectosJson: cargosExtra.filter(
                  (_, cargoIndex) => cargoIndex !== index,
                ),
              });
            } else {
              await desasociarCargoPaso(aQuitar.id);
            }
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
