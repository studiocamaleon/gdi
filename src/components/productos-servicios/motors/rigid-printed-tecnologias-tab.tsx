"use client";

import * as React from "react";
import { toast } from "sonner";

import type { ProductTabProps } from "@/components/productos-servicios/product-detail-types";
import { ProductoTabSection } from "@/components/productos-servicios/producto-tab-section";
import { GdiSpinner } from "@/components/brand/gdi-spinner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getProductoMotorConfig,
  upsertProductoMotorConfig,
} from "@/lib/productos-servicios-api";
import type { Maquina, MaquinaPerfilOperativo } from "@/lib/maquinaria";
import type { MateriaPrima } from "@/lib/materias-primas";

// ── Tipos ─────────────────────────────────────────────────────────

type TipoImpresionRigido = "directa" | "flexible_montado";

type ImpresionTipoConfig = {
  maquinasCompatibles: string[];
  perfilesCompatibles: string[];
  maquinaDefaultId: string | null;
  perfilDefaultId: string | null;
  carasDisponibles?: string[];
  carasDefault?: string;
  duplicarSustratoFlexibleEnDobleFaz?: boolean;
};

type RigidPrintedConfig = {
  tipoPlantilla: string;
  tiposImpresion: TipoImpresionRigido[];
  impresionDirecta: ImpresionTipoConfig;
  flexibleMontado: ImpresionTipoConfig;
  rutaImpresionDirectaId: string | null;
  rutaFlexibleMontadoId: string | null;
  materialRigidoId: string | null;
  variantesCompatibles: string[];
  placaVarianteIdDefault: string | null;
  carasDisponibles: string[];
  carasDefault: string;
  modoMedidas: string;
  imposicion: Record<string, unknown>;
  [key: string]: unknown;
};

/** Máquinas que pueden imprimir directo sobre rigido */
const PLANTILLAS_DIRECTA = new Set([
  "impresora_uv_mesa_extensora",
  "impresora_uv_flatbed",
]);

/** Máquinas para imprimir/cortar sustrato flexible (incluye híbridas que hacen ambas) */
const PLANTILLAS_FLEXIBLE = new Set([
  "impresora_uv_mesa_extensora", // híbridas UV pueden imprimir en rollo también
  "impresora_uv_flatbed",
  "impresora_uv_rollo",
  "impresora_solvente",
  "impresora_latex",
  "impresora_inyeccion_tinta",
  "impresora_sublimacion_gran_formato",
  "plotter_de_corte",
  "mesa_de_corte",
]);

const MODO_MEDIDAS_OPTIONS = [
  { value: "estandar", label: "Medidas estándar (variantes)" },
  { value: "libres", label: "Medidas libres (vendedor define)" },
  { value: "ambas", label: "Ambas (estándar + personalizadas)" },
];

// ── Componente ────────────────────────────────────────────────────

export function RigidPrintedTecnologiasTab(props: ProductTabProps) {
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [config, setConfig] = React.useState<RigidPrintedConfig | null>(null);

  const maquinas = (props.maquinas ?? []) as Maquina[];
  const materiasPrimas = (props.materiasPrimas ?? []) as MateriaPrima[];

  const maquinasDirecta = React.useMemo(
    () => maquinas.filter((m) => PLANTILLAS_DIRECTA.has(m.plantilla)),
    [maquinas],
  );
  const maquinasFlexible = React.useMemo(
    () => maquinas.filter((m) => PLANTILLAS_FLEXIBLE.has(m.plantilla)),
    [maquinas],
  );
  const materialesRigidos = React.useMemo(
    () => materiasPrimas.filter((mp) => mp.subfamilia === "sustrato_rigido"),
    [materiasPrimas],
  );
  const materialesFlexibles = React.useMemo(
    () => materiasPrimas.filter((mp) => mp.subfamilia === "sustrato_rollo_flexible"),
    [materiasPrimas],
  );

  const loadConfig = React.useCallback(async () => {
    try {
      setLoading(true);
      const result = await getProductoMotorConfig(props.producto.id);
      setConfig((result?.parametros ?? {}) as RigidPrintedConfig);
    } catch (err) {
      console.error(err);
      toast.error("Error al cargar configuración.");
    } finally {
      setLoading(false);
    }
  }, [props.producto.id]);

  React.useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const handleSave = React.useCallback(async () => {
    if (!config) return;
    try {
      setSaving(true);
      await upsertProductoMotorConfig(props.producto.id, config);
      await loadConfig();
      await props.refreshMotorConfig();
      toast.success("Configuración guardada.");
    } catch (err) {
      console.error(err);
      toast.error("Error al guardar.");
    } finally {
      setSaving(false);
    }
  }, [config, props.producto.id, loadConfig]);

  const update = React.useCallback((updates: Partial<RigidPrintedConfig>) => {
    setConfig((prev) => (prev ? { ...prev, ...updates } : prev));
  }, []);

  const toggleTipoImpresion = React.useCallback((tipo: TipoImpresionRigido) => {
    setConfig((prev) => {
      if (!prev) return prev;
      const current = prev.tiposImpresion ?? [];
      const has = current.includes(tipo);
      return {
        ...prev,
        tiposImpresion: has ? current.filter((t) => t !== tipo) : [...current, tipo],
      };
    });
  }, []);

  const toggleMaquina = React.useCallback(
    (tipo: "impresionDirecta" | "flexibleMontado", maquinaId: string) => {
      setConfig((prev) => {
        if (!prev) return prev;
        const tipoConfig = prev[tipo];
        const current = tipoConfig.maquinasCompatibles ?? [];
        const has = current.includes(maquinaId);
        return {
          ...prev,
          [tipo]: {
            ...tipoConfig,
            maquinasCompatibles: has
              ? current.filter((id) => id !== maquinaId)
              : [...current, maquinaId],
          },
        };
      });
    },
    [],
  );

  const togglePerfil = React.useCallback(
    (tipo: "impresionDirecta" | "flexibleMontado", perfilId: string) => {
      setConfig((prev) => {
        if (!prev) return prev;
        const tipoConfig = prev[tipo];
        const current = tipoConfig.perfilesCompatibles ?? [];
        const has = current.includes(perfilId);
        return {
          ...prev,
          [tipo]: {
            ...tipoConfig,
            perfilesCompatibles: has
              ? current.filter((id) => id !== perfilId)
              : [...current, perfilId],
          },
        };
      });
    },
    [],
  );

  const setDefault = React.useCallback(
    (tipo: "impresionDirecta" | "flexibleMontado", maquinaId: string | null, perfilId: string | null) => {
      setConfig((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          [tipo]: {
            ...prev[tipo],
            maquinaDefaultId: maquinaId,
            perfilDefaultId: perfilId,
          },
        };
      });
    },
    [],
  );

  const toggleVariante = React.useCallback((varianteId: string) => {
    setConfig((prev) => {
      if (!prev) return prev;
      const current = prev.variantesCompatibles ?? [];
      const has = current.includes(varianteId);
      return {
        ...prev,
        variantesCompatibles: has
          ? current.filter((id) => id !== varianteId)
          : [...current, varianteId],
      };
    });
  }, []);

  const toggleVarianteFlexible = React.useCallback((varianteId: string) => {
    setConfig((prev) => {
      if (!prev) return prev;
      const current = (prev as any).variantesFlexiblesCompatibles ?? [];
      const has = current.includes(varianteId);
      return {
        ...prev,
        variantesFlexiblesCompatibles: has
          ? current.filter((id: string) => id !== varianteId)
          : [...current, varianteId],
      };
    });
  }, []);

  if (loading || !config) {
    return <GdiSpinner />;
  }

  const tiposActivos = config.tiposImpresion ?? [];
  const directaActiva = tiposActivos.includes("directa");
  const flexibleActiva = tiposActivos.includes("flexible_montado");
  const selectedMaterial = materialesRigidos.find((m) => m.id === config.materialRigidoId);
  const selectedMaterialFlexible = materialesFlexibles.find((m) => m.id === (config as any).materialFlexibleId);

  return (
    <div className="space-y-6">
      {/* ── Tipo de impresión ── */}
      <ProductoTabSection
        title="Tipo de impresión"
        description="Activá los tipos de impresión que acepta este producto."
      >
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Switch checked={directaActiva} onCheckedChange={() => toggleTipoImpresion("directa")} />
            <Label>Impresión directa</Label>
            <span className="text-xs text-muted-foreground">(UV cama plana, híbrida con cinta extensora)</span>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={flexibleActiva} onCheckedChange={() => toggleTipoImpresion("flexible_montado")} />
            <Label>Sustrato flexible montado</Label>
            <span className="text-xs text-muted-foreground">(se imprime en sustrato flexible y se aplica sobre el rígido)</span>
          </div>
        </div>
      </ProductoTabSection>

      {/* ── Máquinas: Impresión directa ── */}
      {directaActiva && (
        <ProductoTabSection
          title="Máquinas — Impresión directa"
          description="Máquinas que pueden imprimir directamente sobre el sustrato rígido."
        >
          <MaquinasPerfilesSection
            maquinas={maquinasDirecta}
            tipoConfig={config.impresionDirecta}
            tipoKey="impresionDirecta"
            onToggleMaquina={toggleMaquina}
            onTogglePerfil={togglePerfil}
            onSetDefault={setDefault}
          />
        </ProductoTabSection>
      )}

      {/* ── Máquinas: Sustrato flexible ── */}
      {flexibleActiva && (
        <ProductoTabSection
          title="Máquinas — Sustrato flexible montado"
          description="Máquinas para imprimir el sustrato flexible que se montará sobre el rígido."
        >
          <MaquinasPerfilesSection
            maquinas={maquinasFlexible}
            tipoConfig={config.flexibleMontado}
            tipoKey="flexibleMontado"
            onToggleMaquina={toggleMaquina}
            onTogglePerfil={togglePerfil}
            onSetDefault={setDefault}
          />
        </ProductoTabSection>
      )}

      {/* ── Material rígido ── */}
      <ProductoTabSection
        title="Material rígido"
        description="Sustrato rígido base de este producto."
      >
        <div className="space-y-3">
          <div>
            <Label>Material</Label>
            <Select
              value={config.materialRigidoId ?? ""}
              onValueChange={(v) =>
                update({
                  materialRigidoId: v || null,
                  variantesCompatibles: v
                    ? (materialesRigidos.find((m) => m.id === v)?.variantes ?? []).map((vr) => vr.id)
                    : [],
                  placaVarianteIdDefault: null,
                })
              }
            >
              <SelectTrigger className="mt-1 max-w-sm">
                <SelectValue placeholder="Seleccionar material">
                  {selectedMaterial?.nombre ?? "Seleccionar material"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {materialesRigidos.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Variantes del material */}
          {selectedMaterial && (selectedMaterial.variantes ?? []).length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                Variantes compatibles
              </p>
              <div className="space-y-1.5">
                {(selectedMaterial.variantes ?? []).map((v) => {
                  const attrs = (v.atributosVariante ?? {}) as Record<string, unknown>;
                  const anchoRaw = Number(attrs.ancho ?? 0);
                  const altoRaw = Number(attrs.alto ?? 0);
                  const espesor = attrs.espesor;
                  const anchoMm = anchoRaw < 10 ? Math.round(anchoRaw * 1000) : anchoRaw;
                  const altoMm = altoRaw < 10 ? Math.round(altoRaw * 1000) : altoRaw;
                  const isActive = (config.variantesCompatibles ?? []).includes(v.id);

                  return (
                    <div key={v.id} className="flex items-center gap-2">
                      <Checkbox checked={isActive} onCheckedChange={() => toggleVariante(v.id)} />
                      <span className="text-sm">
                        {anchoMm} × {altoMm} mm
                        {espesor != null && ` · ${espesor}mm`}
                      </span>
                      {v.precioReferencia != null && (
                        <span className="text-xs text-muted-foreground">
                          ${Number(v.precioReferencia).toLocaleString("es-AR")}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </ProductoTabSection>

      {/* ── Material flexible (solo si flexible montado activo) ── */}
      {flexibleActiva && (
        <ProductoTabSection
          title="Material flexible"
          description="Sustrato flexible que se imprime y monta sobre el rígido."
        >
          <div className="space-y-3">
            <div>
              <Label>Material</Label>
              <Select
                value={(config as any).materialFlexibleId ?? ""}
                onValueChange={(v) =>
                  update({
                    materialFlexibleId: v || null,
                    variantesFlexiblesCompatibles: v
                      ? (materialesFlexibles.find((m) => m.id === v)?.variantes ?? []).map((vr) => vr.id)
                      : [],
                    varianteFlexibleDefaultId: null,
                  } as any)
                }
              >
                <SelectTrigger className="mt-1 max-w-sm">
                  <SelectValue placeholder="Seleccionar material flexible">
                    {selectedMaterialFlexible?.nombre ?? "Seleccionar material flexible"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {materialesFlexibles.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedMaterialFlexible && (selectedMaterialFlexible.variantes ?? []).length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                  Variantes compatibles
                </p>
                <div className="space-y-1.5">
                  {(selectedMaterialFlexible.variantes ?? []).map((v) => {
                    const attrs = (v.atributosVariante ?? {}) as Record<string, unknown>;
                    const ancho = attrs.ancho;
                    const largo = attrs.largo;
                    const acabado = attrs.acabado;
                    const isActive = ((config as any).variantesFlexiblesCompatibles ?? []).includes(v.id);

                    return (
                      <div key={v.id} className="flex items-center gap-2">
                        <Checkbox checked={isActive} onCheckedChange={() => toggleVarianteFlexible(v.id)} />
                        <span className="text-sm">
                          {ancho != null && `Ancho: ${ancho} m`}
                          {largo != null && ` · Largo: ${largo} m`}
                          {acabado != null && ` · ${acabado}`}
                        </span>
                        {v.precioReferencia != null && (
                          <span className="text-xs text-muted-foreground">
                            ${Number(v.precioReferencia).toLocaleString("es-AR")}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </ProductoTabSection>
      )}

      {/* ── Caras por tipo de impresión ── */}
      <ProductoTabSection
        title="Caras"
        description="Configurá simple faz o doble faz por cada tipo de impresión. Doble faz aplica el multiplicador configurado en cada operación de la ruta."
      >
        <div className="space-y-4">
          {directaActiva && (
            <CarasPorTipoConfig
              label="Impresión directa"
              tipoKey="impresionDirecta"
              config={config}
              update={update}
            />
          )}
          {flexibleActiva && (
            <>
              <CarasPorTipoConfig
                label="Sustrato flexible montado"
                tipoKey="flexibleMontado"
                config={config}
                update={update}
              />
              {/* Toggle duplicar flexible en doble faz */}
              {((config.flexibleMontado as Record<string, unknown>)?.carasDisponibles as string[] ?? []).includes("doble_faz") && (
                <div className="flex items-center gap-2 pl-4 border-l-2 border-green-200">
                  <Switch
                    checked={!!(config.flexibleMontado as Record<string, unknown>)?.duplicarSustratoFlexibleEnDobleFaz}
                    onCheckedChange={(v) => update({
                      flexibleMontado: { ...(config.flexibleMontado ?? {}), duplicarSustratoFlexibleEnDobleFaz: v },
                    })}
                  />
                  <Label className="text-sm">Duplicar sustrato flexible en doble faz</Label>
                  <span className="text-xs text-muted-foreground">(se usa el doble de vinilo para cubrir ambas caras)</span>
                </div>
              )}
            </>
          )}
        </div>
      </ProductoTabSection>

      {/* ── Modo de medidas ── */}
      <ProductoTabSection
        title="Modo de medidas"
        description="Cómo se definen las medidas del producto."
      >
        <Select
          value={config.modoMedidas ?? "estandar"}
          onValueChange={(v) => update({ modoMedidas: v || "estandar" })}
        >
          <SelectTrigger className="w-full max-w-md">
            <SelectValue>
              {MODO_MEDIDAS_OPTIONS.find((o) => o.value === (config.modoMedidas ?? "estandar"))?.label ?? "Medidas estándar"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="min-w-[320px]">
            {MODO_MEDIDAS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </ProductoTabSection>

      {/* ── Guardar ── */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Guardando..." : "Guardar configuración"}
        </Button>
      </div>
    </div>
  );
}

// ── Sub-componente: Máquinas y Perfiles ───────────────────────────

function MaquinasPerfilesSection({
  maquinas,
  tipoConfig,
  tipoKey,
  onToggleMaquina,
  onTogglePerfil,
  onSetDefault,
}: {
  maquinas: Maquina[];
  tipoConfig: ImpresionTipoConfig;
  tipoKey: "impresionDirecta" | "flexibleMontado";
  onToggleMaquina: (tipo: "impresionDirecta" | "flexibleMontado", maquinaId: string) => void;
  onTogglePerfil: (tipo: "impresionDirecta" | "flexibleMontado", perfilId: string) => void;
  onSetDefault: (tipo: "impresionDirecta" | "flexibleMontado", maquinaId: string | null, perfilId: string | null) => void;
}) {
  const compatibles = new Set(tipoConfig.maquinasCompatibles ?? []);
  const perfilesActivos = new Set(tipoConfig.perfilesCompatibles ?? []);

  if (maquinas.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No hay máquinas cargadas con plantillas compatibles.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {maquinas.map((m) => {
        const isActive = compatibles.has(m.id);
        const perfiles = m.perfilesOperativos ?? [];

        return (
          <Card key={m.id} className={isActive ? "border-primary" : ""}>
            <CardHeader className="py-2 px-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={isActive}
                  onCheckedChange={() => onToggleMaquina(tipoKey, m.id)}
                />
                <CardTitle className="text-sm font-medium">{m.nombre}</CardTitle>
              </div>
            </CardHeader>
            {isActive && perfiles.length > 0 && (
              <CardContent className="pt-0 px-3 pb-2 space-y-2">
                <p className="text-xs text-muted-foreground mb-1">Perfiles operativos:</p>
                <div className="flex flex-wrap gap-2">
                  {perfiles.map((p) => (
                    <div key={p.id} className="flex items-center gap-1">
                      <Checkbox
                        checked={perfilesActivos.has(p.id)}
                        onCheckedChange={() => onTogglePerfil(tipoKey, p.id)}
                      />
                      <span className="text-xs">{p.nombre}</span>
                    </div>
                  ))}
                </div>
                {/* Perfil default */}
                {perfiles.filter((p) => perfilesActivos.has(p.id)).length > 0 && (
                  <div className="pt-1">
                    <Label className="text-[10px] text-muted-foreground">Perfil default</Label>
                    <Select
                      value={tipoConfig.perfilDefaultId ?? ""}
                      onValueChange={(v) => onSetDefault(tipoKey, m.id, v || null)}
                    >
                      <SelectTrigger className="mt-0.5 h-8 text-xs">
                        <SelectValue placeholder="Sin default">
                          {tipoConfig.perfilDefaultId
                            ? perfiles.find((p) => p.id === tipoConfig.perfilDefaultId)?.nombre ?? "Sin default"
                            : "Sin default"}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {perfiles.filter((p) => perfilesActivos.has(p.id)).map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}

// ── Caras por tipo de impresión ──────────────────────────────────

const CARAS_OPTIONS = [
  { value: "simple_faz", label: "Simple faz" },
  { value: "doble_faz", label: "Doble faz" },
];

function CarasPorTipoConfig({
  label,
  tipoKey,
  config,
  update,
}: {
  label: string;
  tipoKey: "impresionDirecta" | "flexibleMontado";
  config: Record<string, unknown>;
  update: (patch: Record<string, unknown>) => void;
}) {
  const tipoCfg = (config[tipoKey] ?? {}) as Record<string, unknown>;
  const carasDisp = Array.isArray(tipoCfg.carasDisponibles) ? tipoCfg.carasDisponibles as string[] : ["simple_faz"];
  const carasDefault = String(tipoCfg.carasDefault ?? "simple_faz");

  const updateTipo = (patch: Record<string, unknown>) => {
    update({ [tipoKey]: { ...tipoCfg, ...patch } });
  };

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>
      <div className="flex items-center gap-4 pl-4 border-l-2 border-muted">
        <div>
          <span className="text-xs text-muted-foreground">Opciones</span>
          <div className="flex gap-3 mt-1">
            {CARAS_OPTIONS.map((opt) => (
              <div key={opt.value} className="flex items-center gap-1.5">
                <Checkbox
                  checked={carasDisp.includes(opt.value)}
                  onCheckedChange={(checked) => {
                    updateTipo({
                      carasDisponibles: checked
                        ? [...carasDisp, opt.value]
                        : carasDisp.filter((c) => c !== opt.value),
                    });
                  }}
                />
                <span className="text-sm">{opt.label}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <span className="text-xs text-muted-foreground">Default</span>
          <Select value={carasDefault} onValueChange={(v) => updateTipo({ carasDefault: v || "simple_faz" })}>
            <SelectTrigger className="mt-1 w-36">
              <SelectValue>{CARAS_OPTIONS.find((o) => o.value === carasDefault)?.label ?? "Simple faz"}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {CARAS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
