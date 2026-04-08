"use client";

import * as React from "react";
import { PlusIcon, XIcon } from "lucide-react";

import type {
  ProductoServicio,
  ProductoChecklist,
  ChecklistCotizadorValue,
  RigidPrintedChecklistConfig,
} from "@/lib/productos-servicios";
import { type Maquina, getMaquinaTecnologia, tecnologiaMaquinaItems } from "@/lib/maquinaria";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { ProductoServicioChecklistCotizador } from "@/components/productos-servicios/producto-servicio-checklist";

// ── Types ────────────────────────────────────────────────────────

export type RigidPrintedMedida = {
  anchoMm: number | null;
  altoMm: number | null;
  cantidad: number;
};

type RigidPrintedConfig = {
  tiposImpresion: string[];
  impresionDirecta: Record<string, unknown>;
  flexibleMontado: Record<string, unknown>;
  materialRigidoId: string | null;
  variantesCompatibles: string[];
  placaVarianteIdDefault: string | null;
  [key: string]: unknown;
};

export type PlacaCompatible = {
  id: string;
  anchoMm: number;
  altoMm: number;
  precio: number;
  label: string;
  espesor: string | null;
  color: string | null;
};

export type RigidPrintedProposalConfigProps = {
  producto: ProductoServicio;
  config: RigidPrintedConfig;
  placasCompatibles: PlacaCompatible[];
  maquinas: Maquina[];
  checklistConfig: RigidPrintedChecklistConfig | null;
  medidas: RigidPrintedMedida[];
  onMedidasChange: (medidas: RigidPrintedMedida[]) => void;
  tipoImpresion: string;
  onTipoImpresionChange: (tipo: string) => void;
  placaVarianteId: string;
  onPlacaVarianteIdChange: (id: string) => void;
  caras: string;
  onCarasChange: (caras: string) => void;
  maquinaId: string;
  onMaquinaIdChange: (id: string) => void;
  perfilId: string;
  onPerfilIdChange: (id: string) => void;
  checklistRespuestas: ChecklistCotizadorValue;
  onChecklistRespuestasChange: (v: ChecklistCotizadorValue) => void;
};

// ── Labels ───────────────────────────────────────────────────────

const TIPO_LABELS: Record<string, string> = {
  directa: "Impresion directa",
  flexible_montado: "Sustrato flexible montado",
};

const CARAS_LABELS: Record<string, string> = {
  simple_faz: "Simple faz",
  doble_faz: "Doble faz",
};

// ── Helpers ──────────────────────────────────────────────────────

function getActiveChecklist(
  config: RigidPrintedChecklistConfig | null,
  tipoImpresion: string,
): ProductoChecklist | null {
  if (!config) return null;
  if (config.aplicaATodosLosTiposImpresion) {
    const cl = config.checklistComun;
    return cl?.activo && cl.preguntas?.length > 0 ? cl : null;
  }
  const perTipo = config.checklistsPorTipoImpresion.find(
    (c) => c.tipoImpresion === tipoImpresion,
  );
  const cl = perTipo?.checklist;
  return cl?.activo && cl?.preguntas?.length > 0 ? cl : null;
}

// ── Segmented toggle (same style as digital laser) ───────────────

function SegmentedToggle<T extends string>({
  label,
  options,
  value,
  onChange,
  labels,
}: {
  label: string;
  options: T[];
  value: T;
  onChange: (v: T) => void;
  labels: Record<string, string>;
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="inline-flex items-center rounded-lg border border-input bg-muted p-0.5">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
              value === opt
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
            }`}
          >
            {labels[opt] ?? opt}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Component ────────────────────────────────────────────────────

export function RigidPrintedProposalConfig({
  config,
  placasCompatibles,
  maquinas,
  checklistConfig,
  medidas,
  onMedidasChange,
  tipoImpresion,
  onTipoImpresionChange,
  placaVarianteId,
  onPlacaVarianteIdChange,
  caras,
  onCarasChange,
  maquinaId,
  onMaquinaIdChange,
  perfilId,
  onPerfilIdChange,
  checklistRespuestas,
  onChecklistRespuestasChange,
}: RigidPrintedProposalConfigProps) {
  const tipos = config.tiposImpresion ?? [];
  const anchoRefs = React.useRef<(HTMLInputElement | null)[]>([]);

  // Auto-select si hay un solo tipo
  React.useEffect(() => {
    if (!tipoImpresion && tipos.length === 1) onTipoImpresionChange(tipos[0]);
  }, [tipoImpresion, tipos, onTipoImpresionChange]);

  // ── Cascada: Tecnología → Máquina → Perfil ──
  const tipoCfg = (tipoImpresion === "flexible_montado" ? config.flexibleMontado : config.impresionDirecta) ?? {};
  const maquinasCompatibleIds = new Set(Array.isArray(tipoCfg.maquinasCompatibles) ? tipoCfg.maquinasCompatibles as string[] : []);
  const perfilesCompatibleIds = new Set(Array.isArray(tipoCfg.perfilesCompatibles) ? tipoCfg.perfilesCompatibles as string[] : []);

  // Máquinas del tipo seleccionado
  const maquinasDelTipo = React.useMemo(
    () => maquinas.filter((m) => maquinasCompatibleIds.has(m.id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [maquinas, tipoImpresion],
  );

  // Tecnologías disponibles (derivadas de las máquinas)
  const tecnologias = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const m of maquinasDelTipo) {
      const tec = getMaquinaTecnologia(m);
      if (tec) {
        const label = tecnologiaMaquinaItems.find((t) => t.value === tec)?.label ?? tec;
        map.set(tec, label);
      }
    }
    return Array.from(map.entries()).map(([value, label]) => ({ value, label }));
  }, [maquinasDelTipo]);

  const [tecnologia, setTecnologia] = React.useState("");

  // Auto-select tecnología
  React.useEffect(() => {
    if (tecnologias.length === 1 && tecnologia !== tecnologias[0].value) {
      setTecnologia(tecnologias[0].value);
    } else if (tecnologias.length > 0 && !tecnologias.some((t) => t.value === tecnologia)) {
      setTecnologia(tecnologias[0].value);
    }
  }, [tecnologias, tecnologia]);

  // Máquinas filtradas por tecnología
  const maquinasFiltradas = React.useMemo(
    () => maquinasDelTipo.filter((m) => getMaquinaTecnologia(m) === tecnologia),
    [maquinasDelTipo, tecnologia],
  );

  // Auto-select máquina
  React.useEffect(() => {
    if (maquinasFiltradas.length === 1 && maquinaId !== maquinasFiltradas[0].id) {
      onMaquinaIdChange(maquinasFiltradas[0].id);
    } else if (maquinasFiltradas.length > 0 && !maquinasFiltradas.some((m) => m.id === maquinaId)) {
      onMaquinaIdChange(maquinasFiltradas[0].id);
    }
  }, [maquinasFiltradas, maquinaId, onMaquinaIdChange]);

  // Perfiles de la máquina seleccionada, filtrados por compatibles
  const maquinaSeleccionada = maquinas.find((m) => m.id === maquinaId);
  const perfilesDisponibles = React.useMemo(() => {
    if (!maquinaSeleccionada) return [];
    return maquinaSeleccionada.perfilesOperativos.filter(
      (p) => p.activo && perfilesCompatibleIds.has(p.id),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maquinaSeleccionada, tipoImpresion]);

  // Auto-select perfil
  React.useEffect(() => {
    if (perfilesDisponibles.length === 1 && perfilId !== perfilesDisponibles[0].id) {
      onPerfilIdChange(perfilesDisponibles[0].id);
    } else if (perfilesDisponibles.length > 0 && !perfilesDisponibles.some((p) => p.id === perfilId)) {
      onPerfilIdChange(perfilesDisponibles[0].id);
    } else if (perfilesDisponibles.length === 0 && perfilId) {
      onPerfilIdChange("");
    }
  }, [perfilesDisponibles, perfilId, onPerfilIdChange]);

  // Caras disponibles del tipo seleccionado
  const carasDisponibles = React.useMemo(() => {
    const tc = (tipoImpresion === "flexible_montado" ? config.flexibleMontado : config.impresionDirecta) ?? {};
    const porTipo = Array.isArray(tc.carasDisponibles) ? tc.carasDisponibles as string[] : null;
    return porTipo ?? (Array.isArray(config.carasDisponibles) ? config.carasDisponibles as string[] : ["simple_faz"]);
  }, [config, tipoImpresion]);

  // Auto-select caras si solo hay una
  React.useEffect(() => {
    if (carasDisponibles.length === 1 && caras !== carasDisponibles[0]) {
      onCarasChange(carasDisponibles[0]);
    }
  }, [carasDisponibles, caras, onCarasChange]);

  // ── Placa: agrupar por espesor → colores ──
  const espesores = React.useMemo(() => {
    const map = new Map<string, PlacaCompatible[]>();
    for (const p of placasCompatibles) {
      const key = p.espesor ?? "sin espesor";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }
    return Array.from(map.entries()).map(([espesor, placas]) => ({ espesor, placas }));
  }, [placasCompatibles]);

  const selectedPlaca = placasCompatibles.find((p) => p.id === placaVarianteId);
  const selectedEspesor = selectedPlaca?.espesor ?? espesores[0]?.espesor ?? null;
  const coloresDelEspesor = espesores.find((e) => e.espesor === selectedEspesor)?.placas ?? [];

  // Auto-select placa cuando cambia espesor
  const handleSelectEspesor = React.useCallback((espesor: string) => {
    const placas = espesores.find((e) => e.espesor === espesor)?.placas ?? [];
    if (placas.length > 0) onPlacaVarianteIdChange(placas[0].id);
  }, [espesores, onPlacaVarianteIdChange]);

  // Auto-select first placa on mount
  React.useEffect(() => {
    if (!placaVarianteId && placasCompatibles.length > 0) {
      onPlacaVarianteIdChange(placasCompatibles[0].id);
    }
  }, [placaVarianteId, placasCompatibles, onPlacaVarianteIdChange]);

  const checklist = getActiveChecklist(checklistConfig, tipoImpresion);

  // Medidas handlers
  function updateMedida(index: number, field: keyof RigidPrintedMedida, value: number | null) {
    const next = [...medidas];
    next[index] = { ...next[index], [field]: value };
    onMedidasChange(next);
  }
  function addMedidaAndFocus() {
    onMedidasChange([...medidas, { anchoMm: null, altoMm: null, cantidad: 1 }]);
    // Focus the new row's "ancho" input after render
    setTimeout(() => {
      anchoRefs.current[medidas.length]?.focus();
    }, 50);
  }
  function removeMedida(index: number) {
    if (medidas.length <= 1) return;
    onMedidasChange(medidas.filter((_, i) => i !== index));
  }

  return (
    <div className="flex flex-col gap-6">
      {/* ── Medidas ── */}
      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Medidas</p>
        <div className="flex flex-col gap-2">
          {medidas.map((m, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <div className="grid flex-1 grid-cols-3 gap-2">
                <div className="flex flex-col gap-1">
                  {idx === 0 && <span className="text-[10px] text-muted-foreground">Ancho (cm)</span>}
                  <Input
                    ref={(el) => { anchoRefs.current[idx] = el; }}
                    type="number" min={0.1} step={0.1} placeholder="Ancho"
                    value={m.anchoMm != null ? m.anchoMm / 10 : ""}
                    onChange={(e) => updateMedida(idx, "anchoMm", e.target.value ? Math.round(Number(e.target.value) * 10) : null)}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  {idx === 0 && <span className="text-[10px] text-muted-foreground">Alto (cm)</span>}
                  <Input type="number" min={0.1} step={0.1} placeholder="Alto"
                    value={m.altoMm != null ? m.altoMm / 10 : ""}
                    onChange={(e) => updateMedida(idx, "altoMm", e.target.value ? Math.round(Number(e.target.value) * 10) : null)} />
                </div>
                <div className="flex flex-col gap-1">
                  {idx === 0 && <span className="text-[10px] text-muted-foreground">Cantidad</span>}
                  <Input type="number" min={1} value={m.cantidad || ""}
                    onChange={(e) => updateMedida(idx, "cantidad", Math.max(1, Number(e.target.value) || 1))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addMedidaAndFocus();
                      }
                    }}
                  />
                </div>
              </div>
              {medidas.length > 1 && (
                <Button variant="ghost" size="icon-xs" className="shrink-0" onClick={() => removeMedida(idx)}>
                  <XIcon className="size-3.5" />
                </Button>
              )}
            </div>
          ))}
        </div>
        <Button variant="outline" size="sm" className="w-fit" onClick={addMedidaAndFocus}>
          <PlusIcon /> Agregar medida
        </Button>
      </div>

      {/* ── Tipo de impresion ── */}
      {tipos.length > 1 ? (
        <SegmentedToggle
          label="Tipo de impresion"
          options={tipos}
          value={tipoImpresion}
          onChange={(t) => {
            onTipoImpresionChange(t);
            onChecklistRespuestasChange({});
            const tc = (t === "flexible_montado" ? config.flexibleMontado : config.impresionDirecta) ?? {};
            onCarasChange(String((tc as Record<string, unknown>).carasDefault ?? "simple_faz"));
          }}
          labels={TIPO_LABELS}
        />
      ) : tipos.length === 1 ? (
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Tipo de impresion</p>
          <p className="text-sm font-medium">{TIPO_LABELS[tipos[0]] ?? tipos[0]}</p>
        </div>
      ) : null}

      {/* ── Tecnología / Máquina / Perfil ── */}
      {(() => {
        const hasTecSelector = tecnologias.length > 1;
        const hasMaqSelector = maquinasFiltradas.length > 1;
        const hasPerfilSelector = perfilesDisponibles.length > 1;
        const anySelector = hasTecSelector || hasMaqSelector || hasPerfilSelector;
        const perfilLabel = perfilesDisponibles.length === 1
          ? (() => { const d = perfilesDisponibles[0].detalle as Record<string, unknown> | null; const c = typeof d?.configuracionTintas === "string" ? d.configuracionTintas : ""; return c ? `${perfilesDisponibles[0].nombre} — ${c}` : perfilesDisponibles[0].nombre; })()
          : "";

        // Si todos son texto fijo → una fila compacta
        if (!anySelector && (tecnologias.length > 0 || maquinasFiltradas.length > 0 || perfilesDisponibles.length > 0)) {
          return (
            <div className="grid grid-cols-3 gap-4 rounded-lg border bg-muted/20 px-3 py-2">
              {tecnologias.length === 1 && (
                <div><p className="text-[10px] text-muted-foreground">Tecnologia</p><p className="text-sm font-medium">{tecnologias[0].label}</p></div>
              )}
              {maquinasFiltradas.length === 1 && (
                <div><p className="text-[10px] text-muted-foreground">Maquina</p><p className="text-sm font-medium">{maquinasFiltradas[0].nombre}</p></div>
              )}
              {perfilesDisponibles.length === 1 && (
                <div><p className="text-[10px] text-muted-foreground">Perfil</p><p className="text-sm font-medium">{perfilLabel}</p></div>
              )}
            </div>
          );
        }

        // Si alguno tiene selector → layout vertical
        return (
          <>
            {hasTecSelector && (
              <SegmentedToggle label="Tecnologia" options={tecnologias.map((t) => t.value)} value={tecnologia}
                onChange={(v) => setTecnologia(v)} labels={Object.fromEntries(tecnologias.map((t) => [t.value, t.label]))} />
            )}
            {hasMaqSelector && (
              <SegmentedToggle label="Maquina" options={maquinasFiltradas.map((m) => m.id)} value={maquinaId}
                onChange={onMaquinaIdChange} labels={Object.fromEntries(maquinasFiltradas.map((m) => [m.id, m.nombre]))} />
            )}
            {hasPerfilSelector && (
              <SegmentedToggle label="Perfil" options={perfilesDisponibles.map((p) => p.id)} value={perfilId}
                onChange={onPerfilIdChange}
                labels={Object.fromEntries(perfilesDisponibles.map((p) => {
                  const det = p.detalle as Record<string, unknown> | null;
                  const confTintas = typeof det?.configuracionTintas === "string" ? det.configuracionTintas : "";
                  return [p.id, confTintas ? `${p.nombre} — ${confTintas}` : p.nombre];
                }))} />
            )}
          </>
        );
      })()}

      {/* ── Placa: Espesor (chips) → Color (chips si hay más de uno) ── */}
      {placasCompatibles.length > 0 && (
        <div className="flex flex-col gap-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Placa</p>

          {/* Espesor */}
          {espesores.length > 1 ? (
            <SegmentedToggle
              label="Espesor"
              options={espesores.map((e) => e.espesor)}
              value={selectedEspesor ?? ""}
              onChange={handleSelectEspesor}
              labels={Object.fromEntries(espesores.map((e) => [e.espesor, e.espesor]))}
            />
          ) : espesores.length === 1 && espesores[0].espesor !== "sin espesor" ? (
            <div className="flex flex-col gap-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Espesor</p>
              <p className="text-sm font-medium">{espesores[0].espesor}</p>
            </div>
          ) : null}

          {/* Color (solo si el espesor seleccionado tiene más de una placa) */}
          {coloresDelEspesor.length > 1 ? (
            <SegmentedToggle
              label="Color"
              options={coloresDelEspesor.map((p) => p.id)}
              value={placaVarianteId}
              onChange={onPlacaVarianteIdChange}
              labels={Object.fromEntries(coloresDelEspesor.map((p) => [p.id, p.color || "Sin color"]))}
            />
          ) : coloresDelEspesor.length === 1 && coloresDelEspesor[0].color ? (
            <div className="flex flex-col gap-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Color</p>
              <p className="text-sm font-medium">{coloresDelEspesor[0].color}</p>
            </div>
          ) : null}
        </div>
      )}

      {/* ── Caras ── */}
      {carasDisponibles.length > 1 ? (
        <SegmentedToggle
          label="Caras"
          options={carasDisponibles}
          value={caras}
          onChange={onCarasChange}
          labels={CARAS_LABELS}
        />
      ) : (
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Caras</p>
          <p className="text-sm font-medium">{CARAS_LABELS[carasDisponibles[0]] ?? carasDisponibles[0]}</p>
        </div>
      )}

      {/* ── Checklist opcionales ── */}
      {checklist && (
        <>
          <Separator />
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Opcionales</p>
            <ProductoServicioChecklistCotizador
              checklist={checklist}
              value={checklistRespuestas}
              onChange={onChecklistRespuestasChange}
            />
          </div>
        </>
      )}
    </div>
  );
}
