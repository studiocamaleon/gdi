"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon, CheckIcon, CogIcon, PackageIcon, SaveIcon } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
        multiplicadoresActivos: existente?.multiplicadoresActivos ?? [],
        maquinaM1Id: existente?.maquinaM1?.id ?? null,
        perfilM1Id: existente?.perfilM1?.id ?? null,
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

  const [guardando, setGuardando] = React.useState<string | null>(null);

  const updateConfig = (rutaPasoId: string, patch: Partial<UpsertConfigPasoPayload>) => {
    setConfigs((prev) => ({ ...prev, [rutaPasoId]: { ...prev[rutaPasoId], ...patch } }));
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
    setGuardando(rutaPasoId);
    try {
      await upsertConfigPaso(rutaAlternativa.id, configs[rutaPasoId]);
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
          const maquinasCompatibles = lookups.maquinas.filter((m) =>
            (familia?.plantillasCompatibles ?? []).includes(m.plantilla),
          );
          const maquinaSel = lookups.maquinas.find((m) => m.id === cfg.maquinaM1Id);

          return (
            <Card key={paso.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">
                      <span className="bg-muted mr-2 inline-flex size-6 items-center justify-center rounded-full text-xs font-semibold">
                        {idx + 1}
                      </span>
                      {familia?.nombre ?? paso.familiaCodigo}
                    </CardTitle>
                    {familia && (
                      <CardDescription className="font-mono text-xs">
                        {familia.codigo} · {familia.relacionMaquinaSoportada.join(", ")}
                      </CardDescription>
                    )}
                  </div>
                  <Button
                    onClick={() => guardarPaso(paso.id)}
                    disabled={guardando === paso.id}
                    size="sm"
                  >
                    <SaveIcon className="mr-2 size-3" />
                    {guardando === paso.id ? "Guardando..." : "Guardar paso"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Modos */}
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Modo activación</Label>
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
                        ).map((m) => (
                          <SelectItem key={m} value={m}>
                            {m}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Modo tiempo</Label>
                    <Select
                      value={cfg.modoTiempo ?? ""}
                      onValueChange={(v) => updateConfig(paso.id, { modoTiempo: v ?? null })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Elegir" />
                      </SelectTrigger>
                      <SelectContent>
                        {(familia?.modosTiempoSoportados ?? ["T-1", "T-2", "T-3", "T-4"]).map(
                          (m) => (
                            <SelectItem key={m} value={m}>
                              {m}
                            </SelectItem>
                          ),
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Mecanismo cantidad</Label>
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
                        ).map((m) => (
                          <SelectItem key={m} value={m}>
                            {m}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Máquina M-1 + Perfil */}
                {familia && familia.relacionMaquinaSoportada.includes("M-1") && (
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-xs">
                        <CogIcon className="mr-1 inline size-3" />
                        Máquina (M-1)
                      </Label>
                      <Select
                        value={cfg.maquinaM1Id ?? ""}
                        onValueChange={(v) =>
                          updateConfig(paso.id, {
                            maquinaM1Id: v || null,
                            perfilM1Id: null, // resetear al cambiar máquina
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Sin asignar" />
                        </SelectTrigger>
                        <SelectContent>
                          {maquinasCompatibles.map((m) => (
                            <SelectItem key={m.id} value={m.id}>
                              {m.nombre} ({m.plantilla})
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
                      <Label className="text-xs">Perfil operativo</Label>
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

                {/* Slots de materiales */}
                {familia && familia.slotsRequeridos.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">
                        <PackageIcon className="mr-1 inline size-3" />
                        Slots de materiales
                      </Label>
                      <div className="flex gap-1">
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
                              className="h-6 text-xs"
                            >
                              + {slot.nombre}
                              {slot.requerido && <span className="text-red-500">*</span>}
                            </Button>
                          );
                        })}
                      </div>
                    </div>
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
                        <div className="grid grid-cols-2 gap-2">
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
                              {MODOS_SELECCION.map((m) => (
                                <SelectItem key={m} value={m}>
                                  {m}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
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
                              {FORMULAS.map((f) => (
                                <SelectItem key={f} value={f}>
                                  {f}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
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
                          <Select
                            value={slot.criterioMotorAuto ?? ""}
                            onValueChange={(v) =>
                              updateSlot(paso.id, slotIdx, { criterioMotorAuto: v || null })
                            }
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Criterio motor" />
                            </SelectTrigger>
                            <SelectContent>
                              {CRITERIOS_AUTO.map((c) => (
                                <SelectItem key={c} value={c}>
                                  {c}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                        <label className="flex items-center gap-1 text-xs">
                          <input
                            type="checkbox"
                            checked={!!slot.aplicaMultiCaras}
                            onChange={(e) =>
                              updateSlot(paso.id, slotIdx, { aplicaMultiCaras: e.target.checked })
                            }
                          />
                          <span>aplica multi-caras</span>
                        </label>
                      </div>
                    ))}
                  </div>
                )}

                {/* Status */}
                {rutaAlternativa.configPasos.find((cp) => cp.rutaPasoId === paso.id) && (
                  <div className="text-muted-foreground flex items-center gap-1 text-xs">
                    <CheckIcon className="size-3 text-green-500" />
                    Configuración existente cargada · cambios pendientes hasta guardar
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
