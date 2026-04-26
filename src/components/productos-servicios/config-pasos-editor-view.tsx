"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircleIcon,
  ArrowLeftIcon,
  CheckIcon,
  CogIcon,
  PackageIcon,
  SaveIcon,
  Settings2Icon,
  SlidersHorizontalIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { LabelConTooltip } from "@/components/ui/label-con-tooltip";
import {
  upsertConfigPaso,
  type LookupsConfigPaso,
  type UpsertConfigPasoPayload,
  type UpsertSlotMaterialPayload,
} from "@/lib/productos-servicios-api";
import type {
  CatalogoFamilias,
  ProductoDetalle,
  RutaAlternativaDetalle,
} from "@/lib/productos-servicios";
import {
  criterioMotorAutoLabels,
  formulaConsumoLabels,
  getLabel,
  mecanismoCantidadLabels,
  modoActivacionLabels,
  modoSeleccionMaterialLabels,
  modoTiempoLabels,
} from "@/lib/labels-humanos";

interface Props {
  producto: ProductoDetalle;
  rutaAlternativa: RutaAlternativaDetalle;
  catalogoFamilias: CatalogoFamilias;
  lookups: LookupsConfigPaso;
}

type ConfigState = Record<string, UpsertConfigPasoPayload>;

const MODOS_ACTIVACION = ["OBLIGATORIO", "OPCIONAL", "CONDICIONAL"];
const MODOS_SELECCION = ["HARDCODED", "COMERCIAL_ELIGE", "MOTOR_ELIGE_AUTO"];
const CRITERIOS_AUTO = ["MENOR_COSTO", "MAYOR_APROVECHAMIENTO", "MENOR_CAPACIDAD_QUE_CUMPLA"];
const FORMULAS = [
  "por_unidad_productiva",
  "por_pieza",
  "por_m2",
  "por_metro_lineal",
  "fijo",
];

// ─── Helpers de JSON ───────────────────────────────────────────────

function jsonToText(value: Record<string, unknown> | null | undefined): string {
  if (!value || Object.keys(value).length === 0) return "";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "";
  }
}

function textToJson(text: string): { ok: true; value: Record<string, unknown> | null } | { ok: false; error: string } {
  const trimmed = text.trim();
  if (!trimmed) return { ok: true, value: null };
  try {
    const parsed = JSON.parse(trimmed);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return { ok: false, error: "Debe ser un objeto JSON ({ ... })" };
    }
    return { ok: true, value: parsed as Record<string, unknown> };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "JSON inválido" };
  }
}

// ─── Validación por tab ────────────────────────────────────────────

interface TabValidacion {
  errores: string[];
  warnings: string[];
}

function validarBasico(
  cfg: UpsertConfigPasoPayload,
  familia: { relacionMaquinaSoportada: string[] } | undefined,
): TabValidacion {
  const errores: string[] = [];
  const warnings: string[] = [];
  if (familia?.relacionMaquinaSoportada.includes("M-1") && !cfg.maquinaM1Id) {
    errores.push("Falta máquina principal");
  }
  if (cfg.maquinaM1Id && !cfg.perfilM1Id) {
    warnings.push("Sin perfil de máquina");
  }
  if (!cfg.modoTiempo) warnings.push("Modo de tiempo sin definir");
  if (!cfg.mecanismoCantidad) warnings.push("Mecanismo de cantidad sin definir");
  return { errores, warnings };
}

function validarMateriales(
  cfg: UpsertConfigPasoPayload,
  familia: { slotsRequeridos: Array<{ codigo: string; requerido: boolean }> } | undefined,
): TabValidacion {
  const errores: string[] = [];
  const warnings: string[] = [];
  if (!familia) return { errores, warnings };
  const slots = cfg.slotsMateriales ?? [];
  const slotsConfigurados = new Set(slots.map((s) => s.slotCodigo));
  for (const sr of familia.slotsRequeridos) {
    if (sr.requerido && !slotsConfigurados.has(sr.codigo)) {
      errores.push(`Falta slot requerido: ${sr.codigo}`);
    }
  }
  for (const slot of slots) {
    if (slot.modoSeleccion === "HARDCODED" && !slot.materialVarianteId) {
      errores.push(`Slot ${slot.slotCodigo}: sin variante de material`);
    }
    if (slot.modoSeleccion === "MOTOR_ELIGE_AUTO" && !slot.criterioMotorAuto) {
      warnings.push(`Slot ${slot.slotCodigo}: sin criterio del sistema`);
    }
  }
  return { errores, warnings };
}

function validarAvanzado(
  paramsPasoText: string,
  mecanismoCantidadConfigText: string,
): TabValidacion {
  const errores: string[] = [];
  const warnings: string[] = [];
  if (paramsPasoText.trim()) {
    const r = textToJson(paramsPasoText);
    if (!r.ok) errores.push(`Params del paso: ${r.error}`);
  }
  if (mecanismoCantidadConfigText.trim()) {
    const r = textToJson(mecanismoCantidadConfigText);
    if (!r.ok) errores.push(`Config de cantidad: ${r.error}`);
  }
  return { errores, warnings };
}

function ContadorBadge({ tab }: { tab: TabValidacion }) {
  if (tab.errores.length > 0) {
    return (
      <Badge variant="destructive" className="ml-1.5 h-4 px-1 text-[10px]">
        {tab.errores.length}
      </Badge>
    );
  }
  if (tab.warnings.length > 0) {
    return (
      <Badge
        variant="outline"
        className="ml-1.5 h-4 border-amber-300 bg-amber-50 px-1 text-[10px] text-amber-700"
      >
        {tab.warnings.length}
      </Badge>
    );
  }
  return null;
}

export function ConfigPasosEditorView({
  producto,
  rutaAlternativa,
  catalogoFamilias,
  lookups,
}: Props) {
  const router = useRouter();
  const familiasMap = React.useMemo(
    () => new Map(catalogoFamilias.familias.map((f) => [f.codigo, f])),
    [catalogoFamilias],
  );

  // Estado: por cada paso de la ruta, su configuración (existente o nueva)
  const [configs, setConfigs] = React.useState<ConfigState>(() => {
    const initial: ConfigState = {};
    for (const paso of rutaAlternativa.ruta.pasos) {
      const existente = rutaAlternativa.configPasos.find((cp) => cp.rutaPasoId === paso.id);
      initial[paso.id] = {
        rutaPasoId: paso.id,
        modoActivacion: existente?.modoActivacion ?? "OBLIGATORIO",
        modoTiempo: existente?.modoTiempo ?? null,
        mecanismoCantidad: existente?.mecanismoCantidad ?? null,
        mecanismoCantidadConfigJson: (existente?.mecanismoCantidadConfigJson as Record<string, unknown> | null | undefined) ?? null,
        multiplicadoresActivos: existente?.multiplicadoresActivos ?? [],
        paramsPasoJson: (existente?.paramsPasoJson as Record<string, unknown> | null | undefined) ?? null,
        maquinaM1Id: existente?.maquinaM1?.id ?? null,
        perfilM1Id: existente?.perfilM1?.id ?? null,
        setupOverrideMin: existente?.setupOverrideMin ?? null,
        cleanupOverrideMin: existente?.cleanupOverrideMin ?? null,
        tiempoFijoOverrideMin: existente?.tiempoFijoOverrideMin ?? null,
        slotsMateriales: existente?.slotsMateriales.map<UpsertSlotMaterialPayload>((s) => ({
          slotCodigo: s.slotCodigo,
          modoSeleccion: s.modoSeleccion as "HARDCODED" | "COMERCIAL_ELIGE" | "MOTOR_ELIGE_AUTO",
          criterioMotorAuto: s.criterioMotorAuto ?? null,
          materialVarianteId: s.materialVariante?.id ?? null,
          materialesCandidatosJson: (s.materialesCandidatosJson as Array<Record<string, unknown>>) ?? [],
          estrategiaCosto: s.estrategiaCosto,
          formula: s.formula,
          aplicaMultiCaras: s.aplicaMultiCaras,
        })) ?? [],
      };
    }
    return initial;
  });

  // JSON text por paso (sólo UI; al guardar se parsea de vuelta a objeto)
  const [jsonTexts, setJsonTexts] = React.useState<Record<string, { params: string; mecanismo: string }>>(
    () => {
      const map: Record<string, { params: string; mecanismo: string }> = {};
      for (const paso of rutaAlternativa.ruta.pasos) {
        const existente = rutaAlternativa.configPasos.find((cp) => cp.rutaPasoId === paso.id);
        map[paso.id] = {
          params: jsonToText(existente?.paramsPasoJson as Record<string, unknown> | null | undefined),
          mecanismo: jsonToText(existente?.mecanismoCantidadConfigJson as Record<string, unknown> | null | undefined),
        };
      }
      return map;
    },
  );

  const [guardando, setGuardando] = React.useState<string | null>(null);

  const updateConfig = (rutaPasoId: string, patch: Partial<UpsertConfigPasoPayload>) => {
    setConfigs((prev) => ({ ...prev, [rutaPasoId]: { ...prev[rutaPasoId], ...patch } }));
  };

  const updateJsonText = (rutaPasoId: string, key: "params" | "mecanismo", text: string) => {
    setJsonTexts((prev) => ({
      ...prev,
      [rutaPasoId]: { ...prev[rutaPasoId], [key]: text },
    }));
  };

  const updateSlot = (
    rutaPasoId: string,
    slotIdx: number,
    patch: Partial<UpsertSlotMaterialPayload>,
  ) => {
    setConfigs((prev) => {
      const cfg = prev[rutaPasoId];
      const slots = [...(cfg.slotsMateriales ?? [])];
      slots[slotIdx] = { ...slots[slotIdx], ...patch };
      return { ...prev, [rutaPasoId]: { ...cfg, slotsMateriales: slots } };
    });
  };

  const addSlotFromFamilia = (rutaPasoId: string, slotCodigo: string) => {
    setConfigs((prev) => {
      const cfg = prev[rutaPasoId];
      const existente = cfg.slotsMateriales?.find((s) => s.slotCodigo === slotCodigo);
      if (existente) return prev; // ya existe
      const nuevoSlot: UpsertSlotMaterialPayload = {
        slotCodigo,
        modoSeleccion: "HARDCODED",
        materialVarianteId: null,
        estrategiaCosto: "simple",
        formula: "por_unidad_productiva",
        aplicaMultiCaras: false,
      };
      return {
        ...prev,
        [rutaPasoId]: {
          ...cfg,
          slotsMateriales: [...(cfg.slotsMateriales ?? []), nuevoSlot],
        },
      };
    });
  };

  const removeSlot = (rutaPasoId: string, slotIdx: number) => {
    setConfigs((prev) => {
      const cfg = prev[rutaPasoId];
      const slots = (cfg.slotsMateriales ?? []).filter((_, i) => i !== slotIdx);
      return { ...prev, [rutaPasoId]: { ...cfg, slotsMateriales: slots } };
    });
  };

  const guardarPaso = async (rutaPasoId: string) => {
    // Parsear JSONs antes de guardar
    const jsonText = jsonTexts[rutaPasoId];
    const paramsRes = textToJson(jsonText.params);
    const mecanismoRes = textToJson(jsonText.mecanismo);
    if (!paramsRes.ok) {
      toast.error(`JSON inválido en "Params del paso": ${paramsRes.error}`);
      return;
    }
    if (!mecanismoRes.ok) {
      toast.error(`JSON inválido en "Config de cantidad": ${mecanismoRes.error}`);
      return;
    }

    setGuardando(rutaPasoId);
    try {
      await upsertConfigPaso(rutaAlternativa.id, {
        ...configs[rutaPasoId],
        paramsPasoJson: paramsRes.value,
        mecanismoCantidadConfigJson: mecanismoRes.value,
      });
      toast.success("Configuración guardada");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error guardando");
    } finally {
      setGuardando(null);
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        <Link
          href={`/productos-servicios/${producto.id}/rutas`}
          className="text-muted-foreground hover:text-foreground inline-flex items-center text-sm"
        >
          <ArrowLeftIcon className="mr-1 size-4" />
          Volver a rutas del producto
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">
          Configurar pasos: {producto.nombre} → {rutaAlternativa.nombre}
        </h1>
        <p className="text-muted-foreground text-sm">
          Para cada paso de la ruta, configurá la máquina M-1, perfil, modos y slots de materiales.
          Los pasos OPCIONALES no se ejecutan a menos que el comercial los active.
        </p>
      </div>

      <div className="space-y-4">
        {rutaAlternativa.ruta.pasos.map((paso, idx) => {
          const familia = familiasMap.get(paso.familiaCodigo);
          const cfg = configs[paso.id];
          const jsonText = jsonTexts[paso.id];
          const maquinasCompatibles = lookups.maquinas.filter((m) =>
            (familia?.plantillasCompatibles ?? []).includes(m.plantilla),
          );
          const maquinaSel = lookups.maquinas.find((m) => m.id === cfg.maquinaM1Id);

          // Validaciones por tab
          const valBasico = validarBasico(cfg, familia);
          const valMateriales = validarMateriales(cfg, familia);
          const valAvanzado = validarAvanzado(jsonText.params, jsonText.mecanismo);
          const totalErrores =
            valBasico.errores.length + valMateriales.errores.length + valAvanzado.errores.length;
          const totalWarnings =
            valBasico.warnings.length + valMateriales.warnings.length + valAvanzado.warnings.length;
          const requiereMateriales = (familia?.slotsRequeridos.length ?? 0) > 0;

          const configExistente = rutaAlternativa.configPasos.find(
            (cp) => cp.rutaPasoId === paso.id,
          );

          return (
            <div key={paso.id} className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <Card className="lg:col-span-2">
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-base">
                      <span className="bg-muted mr-2 inline-flex size-6 items-center justify-center rounded-full text-xs font-semibold">
                        {idx + 1}
                      </span>
                      {familia?.nombre ?? paso.familiaCodigo}
                    </CardTitle>
                    {familia && (
                      <>
                        <CardDescription className="font-mono text-xs">
                          {familia.codigo} · {familia.relacionMaquinaSoportada.join(", ")}
                        </CardDescription>
                        {familia.descripcion && (
                          <p className="text-muted-foreground mt-1 max-w-prose text-xs">
                            {familia.descripcion}
                          </p>
                        )}
                        {familia.productosTipicos && familia.productosTipicos.length > 0 && (
                          <p className="text-muted-foreground mt-1 max-w-prose text-xs italic">
                            Ejemplos: {familia.productosTipicos.join(" · ")}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {totalErrores > 0 ? (
                      <Badge variant="destructive" className="gap-1">
                        <AlertCircleIcon className="size-3" />
                        {totalErrores} error{totalErrores === 1 ? "" : "es"}
                      </Badge>
                    ) : totalWarnings > 0 ? (
                      <Badge
                        variant="outline"
                        className="gap-1 border-amber-300 bg-amber-50 text-amber-700"
                      >
                        <AlertCircleIcon className="size-3" />
                        {totalWarnings} pendiente{totalWarnings === 1 ? "" : "s"}
                      </Badge>
                    ) : configExistente ? (
                      <Badge variant="outline" className="gap-1 border-green-300 bg-green-50 text-green-700">
                        <CheckIcon className="size-3" />
                        Configurado
                      </Badge>
                    ) : null}
                    <Button
                      onClick={() => guardarPaso(paso.id)}
                      disabled={guardando === paso.id || totalErrores > 0}
                      size="sm"
                    >
                      <SaveIcon className="mr-2 size-3" />
                      {guardando === paso.id ? "Guardando..." : "Guardar paso"}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="basico" className="w-full">
                  <TabsList className="h-9 w-full justify-start gap-1">
                    <TabsTrigger value="basico" className="data-[state=active]:bg-background">
                      <Settings2Icon className="size-3" />
                      Básico
                      <ContadorBadge tab={valBasico} />
                    </TabsTrigger>
                    {requiereMateriales && (
                      <TabsTrigger value="materiales" className="data-[state=active]:bg-background">
                        <PackageIcon className="size-3" />
                        Materiales
                        <ContadorBadge tab={valMateriales} />
                      </TabsTrigger>
                    )}
                    <TabsTrigger value="avanzado" className="data-[state=active]:bg-background">
                      <SlidersHorizontalIcon className="size-3" />
                      Avanzado
                      <ContadorBadge tab={valAvanzado} />
                    </TabsTrigger>
                  </TabsList>

                  {/* ── TAB BÁSICO ───────────────────────────────────────── */}
                  <TabsContent value="basico" className="mt-4 space-y-4">
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                      <div className="space-y-1">
                        <LabelConTooltip
                          label="¿Cuándo se ejecuta?"
                          tooltip="Decide si el paso siempre va, si el comercial lo activa, o si depende de una regla."
                        />
                        <Select
                          value={cfg.modoActivacion ?? ""}
                          onValueChange={(v) => updateConfig(paso.id, { modoActivacion: v ?? null })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {MODOS_ACTIVACION.filter((m) =>
                              (familia?.modosActivacionSoportados ?? MODOS_ACTIVACION).includes(m as never),
                            ).map((m) => {
                              const lbl = getLabel(modoActivacionLabels, m);
                              return (
                                <SelectItem key={m} value={m}>
                                  {lbl.label}
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <LabelConTooltip
                          label="¿Cómo se calcula el tiempo?"
                          tooltip="Define la base del cálculo: tiempo fijo, productividad propia, productividad de máquina, o input manual del comercial."
                        />
                        <Select
                          value={cfg.modoTiempo ?? ""}
                          onValueChange={(v) => updateConfig(paso.id, { modoTiempo: v ?? null })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Elegir" />
                          </SelectTrigger>
                          <SelectContent>
                            {(familia?.modosTiempoSoportados ?? ["T-1", "T-2", "T-3", "T-4"]).map(
                              (m) => {
                                const lbl = getLabel(modoTiempoLabels, m);
                                return (
                                  <SelectItem key={m} value={m}>
                                    {lbl.label}
                                  </SelectItem>
                                );
                              },
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <LabelConTooltip
                          label="¿De dónde sale la cantidad?"
                          tooltip="Cómo el motor decide cuántas unidades produce este paso (cantidad pedida, hereda de paso anterior, calcula por nesting, o conversión)."
                        />
                        <Select
                          value={cfg.mecanismoCantidad ?? ""}
                          onValueChange={(v) => updateConfig(paso.id, { mecanismoCantidad: v ?? null })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Elegir" />
                          </SelectTrigger>
                          <SelectContent>
                            {(
                              familia?.mecanismosCantidadSoportados ?? [
                                "DIRECT_FROM_JOBCONTEXT",
                                "HEREDAR_DEL_OUTPUT_CANONICO",
                                "CALCULADO_POR_PASO",
                                "CONVERSION",
                              ]
                            ).map((m) => {
                              const lbl = getLabel(mecanismoCantidadLabels, m);
                              return (
                                <SelectItem key={m} value={m}>
                                  {lbl.label}
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Máquina M-1 + Perfil */}
                    {familia && familia.relacionMaquinaSoportada.includes("M-1") && (
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <div className="space-y-1">
                          <LabelConTooltip
                            label={
                              <>
                                <CogIcon className="mr-1 inline size-3" />
                                Máquina principal
                              </>
                            }
                            tooltip="Máquina del taller que ejecuta este paso. La lista filtra por compatibilidad con la familia."
                            required
                          />
                          <Select
                            value={cfg.maquinaM1Id ?? ""}
                            onValueChange={(v) =>
                              updateConfig(paso.id, {
                                maquinaM1Id: v || null,
                                perfilM1Id: null,
                              })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Sin asignar" />
                            </SelectTrigger>
                            <SelectContent>
                              {maquinasCompatibles.map((m) => (
                                <SelectItem key={m.id} value={m.id}>
                                  {m.nombre}
                                </SelectItem>
                              ))}
                              {maquinasCompatibles.length === 0 && (
                                <div className="text-muted-foreground p-2 text-xs">
                                  No hay máquinas compatibles con esta familia.
                                </div>
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <LabelConTooltip
                            label="Perfil de la máquina"
                            tooltip="Configuración operativa específica (ej: simple/doble faz, tipo de corte, modo de calidad). Define la productividad."
                          />
                          <Select
                            value={cfg.perfilM1Id ?? ""}
                            onValueChange={(v) => updateConfig(paso.id, { perfilM1Id: v || null })}
                            disabled={!maquinaSel}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={maquinaSel ? "Elegir" : "Elegí máquina primero"} />
                            </SelectTrigger>
                            <SelectContent>
                              {(maquinaSel?.perfilesOperativos ?? []).map((p) => (
                                <SelectItem key={p.id} value={p.id}>
                                  {p.nombre}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}

                    {(valBasico.errores.length > 0 || valBasico.warnings.length > 0) && (
                      <ListaValidacion validacion={valBasico} />
                    )}
                  </TabsContent>

                  {/* ── TAB MATERIALES ───────────────────────────────────── */}
                  {requiereMateriales && familia && (
                    <TabsContent value="materiales" className="mt-4 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <LabelConTooltip
                          label={
                            <>
                              <PackageIcon className="mr-1 inline size-3" />
                              Materiales que consume el paso
                            </>
                          }
                          tooltip="Cada slot es un tipo de material que el paso necesita (papel, tinta, film, etc.). Podés definir si el material es fijo, lo elige el comercial, o lo elige el sistema automáticamente."
                        />
                        <div className="flex flex-wrap gap-1">
                          {familia.slotsRequeridos.map((slot) => {
                            const yaExiste = cfg.slotsMateriales?.some(
                              (s) => s.slotCodigo === slot.codigo,
                            );
                            if (yaExiste) return null;
                            return (
                              <Button
                                key={slot.codigo}
                                variant="outline"
                                size="sm"
                                onClick={() => addSlotFromFamilia(paso.id, slot.codigo)}
                                className="h-7 text-xs"
                              >
                                + {slot.nombre}
                                {slot.requerido && <span className="text-red-500">*</span>}
                              </Button>
                            );
                          })}
                        </div>
                      </div>

                      {(cfg.slotsMateriales ?? []).length === 0 && (
                        <p className="text-muted-foreground py-4 text-center text-xs italic">
                          Sin slots configurados. Agregá uno con los botones de arriba.
                        </p>
                      )}

                      {(cfg.slotsMateriales ?? []).map((slot, slotIdx) => (
                        <div key={slotIdx} className="bg-muted/30 space-y-2 rounded border p-2">
                          <div className="flex items-center justify-between">
                            <Badge variant="outline">{slot.slotCodigo}</Badge>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-red-600"
                              onClick={() => removeSlot(paso.id, slotIdx)}
                            >
                              ×
                            </Button>
                          </div>
                          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                            <div className="space-y-1">
                              <LabelConTooltip
                                label="¿Quién elige el material?"
                                tooltip="Material fijo (modelador), el comercial elige al cotizar, o el sistema elige automáticamente con un criterio."
                              />
                              <Select
                                value={slot.modoSeleccion}
                                onValueChange={(v) =>
                                  updateSlot(paso.id, slotIdx, {
                                    modoSeleccion: (v ?? "HARDCODED") as
                                      | "HARDCODED"
                                      | "COMERCIAL_ELIGE"
                                      | "MOTOR_ELIGE_AUTO",
                                  })
                                }
                              >
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {MODOS_SELECCION.map((m) => {
                                    const lbl = getLabel(modoSeleccionMaterialLabels, m);
                                    return (
                                      <SelectItem key={m} value={m}>
                                        {lbl.label}
                                      </SelectItem>
                                    );
                                  })}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1">
                              <LabelConTooltip
                                label="¿Cómo se calcula el consumo?"
                                tooltip="Fórmula que el motor usa para calcular cuánto material se consume (por pieza, por m², por metro lineal, etc.)."
                              />
                              <Select
                                value={slot.formula ?? "por_unidad_productiva"}
                                onValueChange={(v) =>
                                  updateSlot(paso.id, slotIdx, { formula: v ?? "por_unidad_productiva" })
                                }
                              >
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {FORMULAS.map((f) => {
                                    const lbl = getLabel(formulaConsumoLabels, f);
                                    return (
                                      <SelectItem key={f} value={f}>
                                        {lbl.label}
                                      </SelectItem>
                                    );
                                  })}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          {slot.modoSeleccion === "HARDCODED" && (
                            <Select
                              value={slot.materialVarianteId ?? ""}
                              onValueChange={(v) =>
                                updateSlot(paso.id, slotIdx, { materialVarianteId: v || null })
                              }
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder="Elegir variante de material" />
                              </SelectTrigger>
                              <SelectContent>
                                {lookups.materiasPrimas.map((mp) => (
                                  <React.Fragment key={mp.id}>
                                    {mp.variantes.map((v) => (
                                      <SelectItem key={v.id} value={v.id}>
                                        {mp.nombre} → {v.nombreVariante ?? v.sku}
                                      </SelectItem>
                                    ))}
                                  </React.Fragment>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                          {slot.modoSeleccion === "MOTOR_ELIGE_AUTO" && (
                            <div className="space-y-1">
                              <LabelConTooltip
                                label="Criterio del sistema"
                                tooltip="Cómo elige el sistema entre los candidatos: el más barato, el de mejor aprovechamiento, o el de capacidad mínima que cumpla."
                              />
                              <Select
                                value={slot.criterioMotorAuto ?? ""}
                                onValueChange={(v) =>
                                  updateSlot(paso.id, slotIdx, { criterioMotorAuto: v || null })
                                }
                              >
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue placeholder="Elegí criterio" />
                                </SelectTrigger>
                                <SelectContent>
                                  {CRITERIOS_AUTO.map((c) => {
                                    const lbl = getLabel(criterioMotorAutoLabels, c);
                                    return (
                                      <SelectItem key={c} value={c}>
                                        {lbl.label}
                                      </SelectItem>
                                    );
                                  })}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                          <label className="flex items-center gap-2 text-xs">
                            <input
                              type="checkbox"
                              checked={!!slot.aplicaMultiCaras}
                              onChange={(e) =>
                                updateSlot(paso.id, slotIdx, { aplicaMultiCaras: e.target.checked })
                              }
                            />
                            <span>
                              Multiplicar consumo por caras
                              <span className="text-muted-foreground ml-1">
                                (si doble faz, consume el doble)
                              </span>
                            </span>
                          </label>
                        </div>
                      ))}

                      {(valMateriales.errores.length > 0 || valMateriales.warnings.length > 0) && (
                        <ListaValidacion validacion={valMateriales} />
                      )}
                    </TabsContent>
                  )}

                  {/* ── TAB AVANZADO ─────────────────────────────────────── */}
                  <TabsContent value="avanzado" className="mt-4 space-y-4">
                    <p className="text-muted-foreground text-xs">
                      Estos campos se usan en casos puntuales (overrides de tiempo, multiplicadores, JSON declarativo).
                      Si no sabés qué poner, dejá vacío y usá los defaults.
                    </p>

                    {/* Overrides de tiempo */}
                    <div className="space-y-2">
                      <div className="text-sm font-medium">Overrides de tiempo (minutos)</div>
                      <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                        <div className="space-y-1">
                          <LabelConTooltip
                            label="Setup override"
                            tooltip="Sobrescribe el tiempo de setup del perfil (en minutos). Vacío = usar el del perfil."
                            iconSize="sm"
                          />
                          <Input
                            type="number"
                            min={0}
                            step={0.5}
                            value={cfg.setupOverrideMin ?? ""}
                            onChange={(e) =>
                              updateConfig(paso.id, {
                                setupOverrideMin: e.target.value === "" ? null : Number(e.target.value),
                              })
                            }
                            placeholder="—"
                            className="h-8 text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <LabelConTooltip
                            label="Cleanup override"
                            tooltip="Sobrescribe el tiempo de cleanup/post-proceso del perfil. Vacío = usar el del perfil."
                            iconSize="sm"
                          />
                          <Input
                            type="number"
                            min={0}
                            step={0.5}
                            value={cfg.cleanupOverrideMin ?? ""}
                            onChange={(e) =>
                              updateConfig(paso.id, {
                                cleanupOverrideMin: e.target.value === "" ? null : Number(e.target.value),
                              })
                            }
                            placeholder="—"
                            className="h-8 text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <LabelConTooltip
                            label="Tiempo fijo override"
                            tooltip="Sólo aplica si modo de tiempo = T-1 (fijo). Sobrescribe el valor declarado."
                            iconSize="sm"
                          />
                          <Input
                            type="number"
                            min={0}
                            step={0.5}
                            value={cfg.tiempoFijoOverrideMin ?? ""}
                            onChange={(e) =>
                              updateConfig(paso.id, {
                                tiempoFijoOverrideMin: e.target.value === "" ? null : Number(e.target.value),
                              })
                            }
                            placeholder="—"
                            className="h-8 text-xs"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Multiplicadores activos */}
                    <div className="space-y-1">
                      <LabelConTooltip
                        label="Multiplicadores activos"
                        tooltip="Lista de multiplicadores que se aplican al tiempo del paso (ej: factor de complejidad). Separá por coma."
                        ejemplo="complejidad, urgencia"
                      />
                      <Input
                        value={(cfg.multiplicadoresActivos ?? []).join(", ")}
                        onChange={(e) => {
                          const arr = e.target.value
                            .split(",")
                            .map((s) => s.trim())
                            .filter(Boolean);
                          updateConfig(paso.id, { multiplicadoresActivos: arr });
                        }}
                        placeholder="complejidad, urgencia"
                        className="h-8 text-xs"
                      />
                    </div>

                    {/* paramsPasoJson */}
                    <div className="space-y-1">
                      <LabelConTooltip
                        label="Params del paso (JSON)"
                        tooltip="Parámetros declarativos específicos del paso (margenes, factores, zonas, etc.). Schema definido por la familia."
                        ejemplo={`{ "margenesNoImprimiblesMm": { "sup": 5, "inf": 5, "izq": 10, "der": 10 } }`}
                      />
                      <Textarea
                        value={jsonText.params}
                        onChange={(e) => updateJsonText(paso.id, "params", e.target.value)}
                        placeholder="{}"
                        className="font-mono text-xs"
                        rows={5}
                      />
                    </div>

                    {/* mecanismoCantidadConfigJson */}
                    <div className="space-y-1">
                      <LabelConTooltip
                        label="Config del mecanismo de cantidad (JSON)"
                        tooltip="Configuración adicional cuando el mecanismo necesita parámetros (CONVERSION, CALCULADO_POR_PASO con regla, etc.)."
                        ejemplo={`{ "factorConversion": 2 }`}
                      />
                      <Textarea
                        value={jsonText.mecanismo}
                        onChange={(e) => updateJsonText(paso.id, "mecanismo", e.target.value)}
                        placeholder="{}"
                        className="font-mono text-xs"
                        rows={4}
                      />
                    </div>

                    {valAvanzado.errores.length > 0 && (
                      <ListaValidacion validacion={valAvanzado} />
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
              </Card>

              {/* ── Preview lateral ──────────────────────────────────── */}
              <ResumenPaso
                cfg={cfg}
                jsonText={jsonText}
                familia={familia}
                maquinaSel={maquinaSel}
                materiasPrimas={lookups.materiasPrimas}
                totalErrores={totalErrores}
                totalWarnings={totalWarnings}
                yaConfigurado={!!configExistente}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Sub-componente: lista de validaciones ─────────────────────────

function ListaValidacion({ validacion }: { validacion: TabValidacion }) {
  if (validacion.errores.length === 0 && validacion.warnings.length === 0) return null;
  return (
    <div className="space-y-1 rounded border border-amber-200 bg-amber-50 p-2 text-xs">
      {validacion.errores.map((e, idx) => (
        <div key={`e-${idx}`} className="flex items-start gap-1 text-red-700">
          <AlertCircleIcon className="mt-0.5 size-3 shrink-0" />
          <span>{e}</span>
        </div>
      ))}
      {validacion.warnings.map((w, idx) => (
        <div key={`w-${idx}`} className="flex items-start gap-1 text-amber-700">
          <AlertCircleIcon className="mt-0.5 size-3 shrink-0" />
          <span>{w}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Sub-componente: resumen lateral del paso ──────────────────────

interface ResumenPasoProps {
  cfg: UpsertConfigPasoPayload;
  jsonText: { params: string; mecanismo: string };
  familia:
    | {
        nombre: string;
        slotsRequeridos: Array<{ codigo: string; nombre: string; requerido: boolean }>;
        relacionMaquinaSoportada: string[];
      }
    | undefined;
  maquinaSel: { nombre: string; perfilesOperativos: Array<{ id: string; nombre: string }> } | undefined;
  materiasPrimas: LookupsConfigPaso["materiasPrimas"];
  totalErrores: number;
  totalWarnings: number;
  yaConfigurado: boolean;
}

function ResumenPaso({
  cfg,
  jsonText,
  familia,
  maquinaSel,
  materiasPrimas,
  totalErrores,
  totalWarnings,
  yaConfigurado,
}: ResumenPasoProps) {
  const perfilSel = maquinaSel?.perfilesOperativos.find((p) => p.id === cfg.perfilM1Id);
  const slots = cfg.slotsMateriales ?? [];
  const variantesPorId = React.useMemo(() => {
    const map = new Map<string, { mp: string; variante: string }>();
    for (const mp of materiasPrimas) {
      for (const v of mp.variantes) {
        map.set(v.id, { mp: mp.nombre, variante: v.nombreVariante ?? v.sku });
      }
    }
    return map;
  }, [materiasPrimas]);

  const tieneOverrides =
    cfg.setupOverrideMin != null ||
    cfg.cleanupOverrideMin != null ||
    cfg.tiempoFijoOverrideMin != null;
  const tieneMultiplicadores = (cfg.multiplicadoresActivos?.length ?? 0) > 0;
  const tieneJsonParams = jsonText.params.trim().length > 0;
  const tieneJsonMecanismo = jsonText.mecanismo.trim().length > 0;

  const slotsRequeridosCubiertos = familia
    ? familia.slotsRequeridos.filter(
        (sr) => !sr.requerido || slots.some((s) => s.slotCodigo === sr.codigo),
      ).length
    : 0;
  const slotsRequeridosTotal = familia?.slotsRequeridos.filter((s) => s.requerido).length ?? 0;

  return (
    <Card className="bg-muted/30 lg:sticky lg:top-4 lg:h-fit">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Resumen del paso</CardTitle>
        <CardDescription className="text-xs">
          Cómo va a quedar guardado.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-xs">
        {/* Estado */}
        <div>
          {totalErrores > 0 ? (
            <Badge variant="destructive" className="gap-1">
              <AlertCircleIcon className="size-3" />
              No se puede guardar ({totalErrores} error{totalErrores === 1 ? "" : "es"})
            </Badge>
          ) : totalWarnings > 0 ? (
            <Badge variant="outline" className="gap-1 border-amber-300 bg-amber-50 text-amber-700">
              <AlertCircleIcon className="size-3" />
              Se guarda con {totalWarnings} pendiente{totalWarnings === 1 ? "" : "s"}
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1 border-green-300 bg-green-50 text-green-700">
              <CheckIcon className="size-3" />
              {yaConfigurado ? "Listo (cambios pendientes hasta guardar)" : "Listo para guardar"}
            </Badge>
          )}
        </div>

        {/* Modos */}
        <div className="space-y-1">
          <div className="text-muted-foreground font-medium uppercase text-[10px]">Modos</div>
          <RowResumen label="Activación" value={cfg.modoActivacion ? getLabel(modoActivacionLabels, cfg.modoActivacion).label : "—"} />
          <RowResumen label="Tiempo" value={cfg.modoTiempo ? getLabel(modoTiempoLabels, cfg.modoTiempo).label : "—"} />
          <RowResumen
            label="Cantidad"
            value={cfg.mecanismoCantidad ? getLabel(mecanismoCantidadLabels, cfg.mecanismoCantidad).label : "—"}
          />
        </div>

        {/* Máquina */}
        {familia?.relacionMaquinaSoportada.includes("M-1") && (
          <div className="space-y-1">
            <div className="text-muted-foreground font-medium uppercase text-[10px]">Máquina</div>
            <RowResumen label="M-1" value={maquinaSel?.nombre ?? "— sin asignar"} />
            <RowResumen label="Perfil" value={perfilSel?.nombre ?? "—"} />
          </div>
        )}

        {/* Materiales */}
        {familia && familia.slotsRequeridos.length > 0 && (
          <div className="space-y-1">
            <div className="text-muted-foreground font-medium uppercase text-[10px]">
              Materiales ({slotsRequeridosCubiertos}/{slotsRequeridosTotal} requeridos)
            </div>
            {slots.length === 0 ? (
              <div className="text-muted-foreground italic">Sin slots configurados</div>
            ) : (
              slots.map((slot, i) => {
                const variante = slot.materialVarianteId ? variantesPorId.get(slot.materialVarianteId) : null;
                const valor =
                  slot.modoSeleccion === "HARDCODED"
                    ? variante
                      ? `${variante.mp} → ${variante.variante}`
                      : "(sin variante)"
                    : slot.modoSeleccion === "COMERCIAL_ELIGE"
                      ? "elige el comercial"
                      : `auto · ${slot.criterioMotorAuto ? getLabel(criterioMotorAutoLabels, slot.criterioMotorAuto).label : "(sin criterio)"}`;
                return <RowResumen key={i} label={slot.slotCodigo} value={valor} />;
              })
            )}
          </div>
        )}

        {/* Avanzado (solo si hay algo) */}
        {(tieneOverrides || tieneMultiplicadores || tieneJsonParams || tieneJsonMecanismo) && (
          <div className="space-y-1">
            <div className="text-muted-foreground font-medium uppercase text-[10px]">Avanzado</div>
            {cfg.setupOverrideMin != null && (
              <RowResumen label="Setup" value={`${cfg.setupOverrideMin} min (override)`} />
            )}
            {cfg.cleanupOverrideMin != null && (
              <RowResumen label="Cleanup" value={`${cfg.cleanupOverrideMin} min (override)`} />
            )}
            {cfg.tiempoFijoOverrideMin != null && (
              <RowResumen label="Tiempo fijo" value={`${cfg.tiempoFijoOverrideMin} min (override)`} />
            )}
            {tieneMultiplicadores && (
              <div className="flex flex-wrap items-center gap-1">
                <span className="text-muted-foreground">Multiplicadores:</span>
                {cfg.multiplicadoresActivos?.map((m) => (
                  <Badge key={m} variant="secondary" className="text-[10px]">
                    {m}
                  </Badge>
                ))}
              </div>
            )}
            {tieneJsonParams && (
              <div className="text-muted-foreground italic">+ Params JSON definidos</div>
            )}
            {tieneJsonMecanismo && (
              <div className="text-muted-foreground italic">+ Config de cantidad JSON definida</div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RowResumen({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-muted-foreground shrink-0">{label}:</span>
      <span className="text-right font-medium break-words">{value}</span>
    </div>
  );
}
