"use client";

/**
 * R2 — Editor de nesting como sheet propio.
 *
 * El nesting es la combinación de 4 capas:
 *   1. Pieza      — viene de la variante del producto (ancho/alto/cantidad).
 *   2. Máquina    — viene de la máquina asignada al paso (ancho imprimible,
 *                   márgenes no-imprimibles).
 *   3. Sustrato   — viene del POM con `esSustratoNesting=true` y sus
 *                   variantes habilitadas.
 *   4. Paso       — es lo único que el usuario edita acá: criterio,
 *                   margen, separación, pliego de impresión (Fase A),
 *                   panelizado, rotación.
 *
 * Hasta R2 la configuración del paso vivía dentro del editor de paso, sin
 * mostrar las otras 3 capas. Acá la mostramos como contexto read-only para
 * que el usuario entienda con qué está trabajando.
 *
 * El sheet recibe el `config` actual y un `onChange` que actualiza el
 * draft del paso editor en memoria. Persistencia efectiva: cuando el
 * usuario guarda el paso editor (no acá).
 */

import * as React from "react";

import { Button } from "@/components/ui/button";
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import type { Maquina } from "@/lib/maquinaria";
import type { RutaCompletaOperacion } from "@/lib/productos-servicios-api";
import { getLongitudMm } from "@/lib/units";

// ──────────────── Tipos compartidos ────────────────

export type CriterioHoja =
  | "menor_cantidad_pliegos"
  | "mayor_aprovechamiento"
  | "mayor_piezas_por_pliego";

export type PliegoCandidato = {
  codigo?: string;
  nombre?: string;
  anchoMm: number;
  altoMm: number;
};

/**
 * Catálogo de pliegos de impresión (formatos útiles que la prensa acepta).
 * Mismo set que el motor (`apps/api/src/.../nesting/nesting-hoja.ts`
 * `CANONICAL_PLIEGOS_MM`). Mantener en sync.
 */
export const PLIEGOS_IMPRESION_CATALOGO: Array<{
  codigo: string;
  nombre: string;
  anchoMm: number;
  altoMm: number;
}> = [
  { codigo: "A6", nombre: "A6", anchoMm: 105, altoMm: 148 },
  { codigo: "A5", nombre: "A5", anchoMm: 148, altoMm: 210 },
  { codigo: "A4", nombre: "A4", anchoMm: 210, altoMm: 297 },
  { codigo: "A3", nombre: "A3", anchoMm: 297, altoMm: 420 },
  { codigo: "SRA3", nombre: "SRA3", anchoMm: 320, altoMm: 450 },
  { codigo: "CARTA", nombre: "Carta", anchoMm: 216, altoMm: 279 },
  { codigo: "OFICIO", nombre: "Oficio", anchoMm: 216, altoMm: 356 },
];

const PLIEGO_IMPRESION_NONE = "__none__";
const PLIEGO_IMPRESION_CUSTOM = "__custom__";

/**
 * Familias del modelo universal que producen layout de nesting. Las demás
 * o consumen el layout heredado o no participan.
 */
export const FAMILIAS_PRODUCEN_NESTING = new Set([
  "impresion_por_hoja",
  "impresion_por_area",
  "impresion_por_pieza",
]);

// ──────────────── Helpers de config ────────────────

export function mmToCmStr(mm: number | undefined | null): string {
  if (mm == null || !Number.isFinite(mm)) return "";
  return String(Number((mm / 10).toFixed(4)));
}

export function cmInputToMm(cmStr: string): number | undefined {
  if (cmStr.trim() === "") return undefined;
  const n = Number(cmStr);
  if (!Number.isFinite(n)) return undefined;
  return Number((n * 10).toFixed(4));
}

function parseOptionalNumber(s: string): number | undefined {
  if (s.trim() === "") return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

function getCfgNumber(
  cfg: Record<string, unknown> | null,
  key: string,
): string {
  if (!cfg) return "";
  const v = cfg[key];
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return "";
}

function getCfgBool(
  cfg: Record<string, unknown> | null,
  key: string,
  fallback: boolean,
): boolean {
  if (!cfg) return fallback;
  const v = cfg[key];
  if (typeof v === "boolean") return v;
  return fallback;
}

function getCfgString(
  cfg: Record<string, unknown> | null,
  key: string,
): string {
  if (!cfg) return "";
  const v = cfg[key];
  return typeof v === "string" ? v : "";
}

function getCfgArray<T = unknown>(
  cfg: Record<string, unknown> | null,
  key: string,
): T[] {
  if (!cfg) return [];
  const v = cfg[key];
  return Array.isArray(v) ? (v as T[]) : [];
}

function getCfgObject(
  cfg: Record<string, unknown> | null,
  key: string,
): Record<string, unknown> {
  if (!cfg) return {};
  const v = cfg[key];
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}

/** Setea una key del config en un nuevo objeto. `undefined` la elimina. */
function setCfgKey(
  cfg: Record<string, unknown> | null,
  key: string,
  value: unknown,
): Record<string, unknown> | null {
  const next = { ...(cfg ?? {}) };
  if (value === undefined) {
    delete next[key];
  } else {
    next[key] = value;
  }
  return Object.keys(next).length === 0 ? null : next;
}

/** Setea panelizado.{key} preservando el resto del sub-objeto. */
function setPanelizadoKey(
  cfg: Record<string, unknown> | null,
  key: string,
  value: unknown,
): Record<string, unknown> | null {
  const panelizado = { ...getCfgObject(cfg, "panelizado") };
  if (value === undefined) {
    delete panelizado[key];
  } else {
    panelizado[key] = value;
  }
  if (Object.keys(panelizado).length === 0) {
    return setCfgKey(cfg, "panelizado", undefined);
  }
  return setCfgKey(cfg, "panelizado", panelizado);
}

// ──────────────── Resumen visible en el editor de paso ────────────────

/**
 * Devuelve un resumen corto del estado actual de la config de nesting,
 * para mostrar en el editor de paso al lado del botón "Configurar nesting".
 * Sirve para que el usuario sepa qué hay sin abrir el sheet.
 */
export function describeNestingConfig(
  config: Record<string, unknown> | null,
): string[] {
  if (!config) return ["sin configuración"];
  const chips: string[] = [];

  const margenMm = parseOptionalNumber(getCfgNumber(config, "margenMm"));
  if (margenMm != null && margenMm > 0) {
    chips.push(`margen ${(margenMm / 10).toFixed(1)} cm`);
  }
  const criterio = getCfgString(config, "criterio");
  if (criterio === "menor_cantidad_pliegos")
    chips.push("min. pliegos");
  else if (criterio === "mayor_aprovechamiento")
    chips.push("máx. aprovechamiento");
  else if (criterio === "mayor_piezas_por_pliego")
    chips.push("máx. piezas/pliego");
  const pliegos = getCfgArray<PliegoCandidato>(config, "pliegos");
  if (pliegos.length > 0) chips.push(`${pliegos.length} pliego(s) candidato(s)`);
  const pi = config.pliegoImpresion as PliegoCandidato | null | undefined;
  if (pi && pi.anchoMm && pi.altoMm) {
    chips.push(
      `pliego impresión ${pi.codigo ?? `${pi.anchoMm}×${pi.altoMm}mm`}`,
    );
  }
  const printableWidthMm = parseOptionalNumber(
    getCfgNumber(config, "printableWidthMm"),
  );
  if (printableWidthMm != null && printableWidthMm > 0) {
    chips.push(`ancho imprimible ${(printableWidthMm / 10).toFixed(1)} cm`);
  }
  const placaA = parseOptionalNumber(getCfgNumber(config, "placaAnchoMm"));
  const placaH = parseOptionalNumber(getCfgNumber(config, "placaAltoMm"));
  if (placaA && placaH) {
    chips.push(`placa ${(placaA / 10).toFixed(1)}×${(placaH / 10).toFixed(1)} cm`);
  }
  return chips.length > 0 ? chips : ["sin configuración"];
}

// ──────────────── Sheet principal ────────────────

export function NestingEditorSheet({
  open,
  onOpenChange,
  operacion,
  familia,
  maquina,
  config,
  onChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  operacion: RutaCompletaOperacion;
  familia: string;
  maquina: Maquina | null;
  config: Record<string, unknown> | null;
  onChange: (next: Record<string, unknown> | null) => void;
}) {
  const algoritmo = (() => {
    switch (familia) {
      case "impresion_por_hoja":
        return { code: "nesting-hoja", label: "Nesting por hoja (pliegos)" };
      case "impresion_por_area":
        return { code: "nesting-rollo", label: "Nesting por área (rollo)" };
      case "impresion_por_pieza":
        return {
          code: "nesting-placa-rigida",
          label: "Nesting por pieza (placa rígida)",
        };
      default:
        return null;
    }
  })();

  // Capa 2 — máquina: leemos los anchos/márgenes para mostrarlos read-only.
  const params = (maquina?.parametrosTecnicos ?? null) as Record<
    string,
    unknown
  > | null;
  const cmRaw = (v: unknown): number | null => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  const anchoTotalCm =
    cmRaw(params?.anchoImprimibleMaximo) ??
    cmRaw(params?.anchoBoca) ??
    cmRaw(params?.anchoCama) ??
    cmRaw(params?.anchoMaxHoja);
  const margenIzqCm =
    cmRaw(params?.margenLateralIzquierdoNoImprimible) ??
    cmRaw(params?.margenIzquierdo);
  const margenDerCm =
    cmRaw(params?.margenLateralDerechoNoImprimible) ??
    cmRaw(params?.margenDerecho);
  const margenSupCm =
    cmRaw(params?.margenInicioNoImprimible) ?? cmRaw(params?.margenSuperior);
  const margenInfCm =
    cmRaw(params?.margenFinalNoImprimible) ?? cmRaw(params?.margenInferior);

  // Capa 3 — sustrato: leemos los POM con esSustratoNesting=true.
  // (En R2 mostramos solo el conteo; el flujo de edición sigue siendo el
  //  sheet de materiales.)
  const materialesConSustrato = (operacion as { materialesConsumidos?: Array<unknown> })
    .materialesConsumidos
    ? (
        (operacion as {
          materialesConsumidos: Array<{
            esSustratoNesting?: boolean;
            variantesHabilitadas?: Array<unknown>;
          }>;
        }).materialesConsumidos
      ).filter((m) => m?.esSustratoNesting)
    : [];
  const variantesHabilitadasCount = materialesConSustrato.reduce(
    (acc, m) => acc + (m.variantesHabilitadas?.length ?? 0),
    0,
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-screen max-w-none overflow-y-auto data-[side=right]:w-[94vw] data-[side=right]:sm:max-w-[94vw] xl:data-[side=right]:w-[1080px] xl:data-[side=right]:sm:max-w-[1080px]"
      >
        <SheetHeader className="px-6 pt-6">
          <SheetTitle>Configuración del nesting · {operacion.nombre}</SheetTitle>
          <SheetDescription>
            El nesting combina 4 capas: pieza (del producto), máquina,
            sustrato y configuración del paso. Solo la última se edita acá.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4 px-6 pb-6">
          {!algoritmo ? (
            <div className="rounded border border-dashed border-input bg-background px-4 py-3 text-sm text-muted-foreground">
              {familia ? (
                <>
                  La familia <code className="font-mono">{familia}</code> no
                  produce nesting. Solo las familias{" "}
                  <code className="font-mono">impresion_por_*</code> ejecutan
                  algoritmo. Cerrá este sheet y cambiá la familia del paso
                  para configurar nesting.
                </>
              ) : (
                <>
                  Asigná una familia al paso para configurar el nesting.
                </>
              )}
            </div>
          ) : (
            <>
              {/* Capa 1 — Pieza */}
              <CapaCard
                tono="pieza"
                titulo="Pieza"
                origen="del producto"
                resumen={
                  // operacion.nombre + cantidad? Lo vemos cuando se cotiza.
                  // En R2 mostramos solo lo que sabemos (familia/algoritmo).
                  `${algoritmo.label}`
                }
              >
                <p className="text-[12px] text-ink-3">
                  Las dimensiones de la pieza vienen del producto (variante
                  seleccionada) y la cantidad se ingresa al cotizar. No se
                  configuran acá.
                </p>
              </CapaCard>

              {/* Capa 2 — Máquina */}
              <CapaCard
                tono="maquina"
                titulo="Máquina"
                origen={maquina ? maquina.nombre : "no asignada"}
                resumen={
                  maquina
                    ? anchoTotalCm
                      ? `ancho útil ${anchoTotalCm} cm`
                      : "sin parámetros técnicos"
                    : "—"
                }
              >
                {maquina ? (
                  <div className="grid gap-2 text-[12px] text-ink-2 sm:grid-cols-2">
                    <Row label="Ancho total" value={anchoTotalCm ? `${anchoTotalCm} cm` : "—"} />
                    <Row label="Margen izq. no imprimible" value={margenIzqCm ? `${margenIzqCm} cm` : "0"} />
                    <Row label="Margen der. no imprimible" value={margenDerCm ? `${margenDerCm} cm` : "0"} />
                    <Row label="Margen sup. no imprimible" value={margenSupCm ? `${margenSupCm} cm` : "0"} />
                    <Row label="Margen inf. no imprimible" value={margenInfCm ? `${margenInfCm} cm` : "0"} />
                  </div>
                ) : (
                  <p className="text-[12px] text-ink-3">
                    Asigná una máquina al paso para que sus parámetros
                    técnicos se usen como defaults del nesting.
                  </p>
                )}
              </CapaCard>

              {/* Capa 3 — Sustrato */}
              <CapaCard
                tono="sustrato"
                titulo="Sustrato"
                origen={
                  materialesConSustrato.length > 0
                    ? `${materialesConSustrato.length} POM con sustrato nesting`
                    : "no declarado"
                }
                resumen={
                  variantesHabilitadasCount > 0
                    ? `${variantesHabilitadasCount} variante(s) habilitada(s)`
                    : "—"
                }
              >
                <p className="text-[12px] text-ink-3">
                  El sustrato se declara como material del paso con la marca
                  "es sustrato del nesting". Editá las variantes habilitadas
                  desde el botón "Gestionar" en la lista de pasos del tab
                  Ruta de producción.
                </p>
              </CapaCard>

              {/* Capa 4 — Configuración del paso (lo único editable) */}
              <CapaCard
                tono="paso"
                titulo="Configuración del paso"
                origen="editable"
                resumen={algoritmo.code}
              >
                {familia === "impresion_por_hoja" ? (
                  <NestingHojaForm config={config} onChange={onChange} />
                ) : familia === "impresion_por_area" ? (
                  <NestingRolloForm
                    config={config}
                    onChange={onChange}
                    maquina={maquina}
                  />
                ) : (
                  <NestingPlacaForm config={config} onChange={onChange} />
                )}
              </CapaCard>
            </>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Cerrar
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Los cambios quedan en memoria. Para persistirlos, guardá el paso
            en el editor que abriste detrás de este sheet.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ──────────────── Card de capa ────────────────

function CapaCard({
  tono,
  titulo,
  origen,
  resumen,
  children,
}: {
  tono: "pieza" | "maquina" | "sustrato" | "paso";
  titulo: string;
  origen: string;
  resumen: string;
  children: React.ReactNode;
}) {
  const chipClass = {
    pieza: "bg-bg-3 text-ink-2",
    maquina: "bg-bg-3 text-ink-2",
    sustrato: "bg-[color-mix(in_oklch,#7AC74F_22%,var(--bg))] text-ink-0",
    paso: "bg-[color-mix(in_oklch,var(--lime)_18%,var(--bg))] text-ink-0",
  }[tono];

  return (
    <section className="overflow-hidden rounded-[8px] border border-line bg-bg-1">
      <header className="flex items-baseline justify-between gap-3 border-b border-line bg-bg-2 px-4 py-2.5">
        <div className="flex items-baseline gap-2.5">
          <span
            className={`inline-block rounded-[3px] px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.16em] ${chipClass}`}
          >
            {tono === "paso" ? "Editable" : "Read-only"}
          </span>
          <span className="text-[13px] text-ink-0">{titulo}</span>
          <span className="font-mono text-[10px] text-ink-3">· {origen}</span>
        </div>
        <span className="font-mono text-[10px] text-ink-3">{resumen}</span>
      </header>
      <div className="px-4 py-4">{children}</div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 border-b border-dashed border-line/60 py-1 last:border-0">
      <span className="text-ink-3">{label}</span>
      <span className="font-mono text-ink-1">{value}</span>
    </div>
  );
}

// ──────────────── NumberField ────────────────

function NumberField({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (s: string) => void;
}) {
  return (
    <div className="grid gap-2">
      <Label className="text-xs">{label}</Label>
      <Input
        type="number"
        min={0}
        step="0.1"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

// ──────────────── Sub-formulario: Hoja ────────────────

function NestingHojaForm({
  config,
  onChange,
}: {
  config: Record<string, unknown> | null;
  onChange: (next: Record<string, unknown> | null) => void;
}) {
  const pliegos = getCfgArray<PliegoCandidato>(config, "pliegos");
  const criterio = (getCfgString(config, "criterio") || "menor_cantidad_pliegos") as CriterioHoja;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <NumberField
          label="Margen (cm)"
          value={mmToCmStr(parseOptionalNumber(getCfgNumber(config, "margenMm")))}
          placeholder="0"
          onChange={(s) =>
            onChange(setCfgKey(config, "margenMm", cmInputToMm(s)))
          }
        />
        <NumberField
          label="Sep. horizontal (cm)"
          value={mmToCmStr(parseOptionalNumber(getCfgNumber(config, "separacionHMm")))}
          placeholder="0"
          onChange={(s) =>
            onChange(setCfgKey(config, "separacionHMm", cmInputToMm(s)))
          }
        />
        <NumberField
          label="Sep. vertical (cm)"
          value={mmToCmStr(parseOptionalNumber(getCfgNumber(config, "separacionVMm")))}
          placeholder="0"
          onChange={(s) =>
            onChange(setCfgKey(config, "separacionVMm", cmInputToMm(s)))
          }
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label className="text-xs">Criterio de selección</Label>
          <Select
            value={criterio}
            onValueChange={(v) => {
              if (!v) return;
              onChange(setCfgKey(config, "criterio", v));
            }}
          >
            <SelectTrigger>
              <SelectValue>
                {criterio === "menor_cantidad_pliegos" && "Menor cantidad de pliegos"}
                {criterio === "mayor_aprovechamiento" && "Mayor aprovechamiento"}
                {criterio === "mayor_piezas_por_pliego" && "Más piezas por pliego"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="menor_cantidad_pliegos">
                Menor cantidad de pliegos
              </SelectItem>
              <SelectItem value="mayor_aprovechamiento">
                Mayor aprovechamiento
              </SelectItem>
              <SelectItem value="mayor_piezas_por_pliego">
                Más piezas por pliego
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center justify-between gap-2 pt-6">
          <Label htmlFor="hoja-rotacion" className="text-xs">
            Permitir rotación 90° de piezas
          </Label>
          <Switch
            id="hoja-rotacion"
            checked={getCfgBool(config, "permitirRotacion", true)}
            onCheckedChange={(v) =>
              onChange(setCfgKey(config, "permitirRotacion", v))
            }
          />
        </div>
      </div>

      <PliegoImpresionEditor config={config} onChange={onChange} />

      <PliegosListEditor
        pliegos={pliegos}
        onChange={(next) =>
          onChange(setCfgKey(config, "pliegos", next.length === 0 ? undefined : next))
        }
      />
    </div>
  );
}

// ──────────────── Sub-formulario: Pliego de impresión ────────────────

function PliegoImpresionEditor({
  config,
  onChange,
}: {
  config: Record<string, unknown> | null;
  onChange: (next: Record<string, unknown> | null) => void;
}) {
  const pliego = (config?.pliegoImpresion ?? null) as PliegoCandidato | null;
  const matchCatalogo = pliego
    ? PLIEGOS_IMPRESION_CATALOGO.find(
        (p) =>
          Math.abs(p.anchoMm - pliego.anchoMm) < 0.1 &&
          Math.abs(p.altoMm - pliego.altoMm) < 0.1,
      )
    : null;
  const selectValue = !pliego
    ? PLIEGO_IMPRESION_NONE
    : matchCatalogo
      ? matchCatalogo.codigo
      : PLIEGO_IMPRESION_CUSTOM;

  return (
    <div className="rounded border border-input bg-background p-3">
      <div className="mb-2">
        <Label className="text-xs">Pliego de impresión</Label>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Formato útil de la prensa. Vacío = el sustrato se usa tal cual para
          el nesting. Cuando se setea, el costeo deriva el precio del
          sustrato comprado (p.ej. compro SRA3 a $90, imprimo en A4 = $45).
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="grid gap-2 sm:col-span-1">
          <Label className="text-xs">Formato</Label>
          <Select
            value={selectValue}
            onValueChange={(v) => {
              if (v === PLIEGO_IMPRESION_NONE) {
                onChange(setCfgKey(config, "pliegoImpresion", undefined));
                return;
              }
              if (v === PLIEGO_IMPRESION_CUSTOM) {
                if (!pliego || matchCatalogo) {
                  onChange(
                    setCfgKey(config, "pliegoImpresion", {
                      codigo: "CUSTOM",
                      nombre: "Custom",
                      anchoMm: pliego?.anchoMm ?? 0,
                      altoMm: pliego?.altoMm ?? 0,
                    }),
                  );
                }
                return;
              }
              const item = PLIEGOS_IMPRESION_CATALOGO.find((p) => p.codigo === v);
              if (item) {
                onChange(setCfgKey(config, "pliegoImpresion", { ...item }));
              }
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={PLIEGO_IMPRESION_NONE}>
                — Sin pliego de impresión —
              </SelectItem>
              {PLIEGOS_IMPRESION_CATALOGO.map((p) => (
                <SelectItem key={p.codigo} value={p.codigo}>
                  {p.nombre} ({p.anchoMm}×{p.altoMm} mm)
                </SelectItem>
              ))}
              <SelectItem value={PLIEGO_IMPRESION_CUSTOM}>Custom…</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {selectValue === PLIEGO_IMPRESION_CUSTOM && pliego && (
          <>
            <NumberField
              label="Ancho (cm)"
              value={mmToCmStr(pliego.anchoMm)}
              placeholder="0"
              onChange={(s) => {
                const mm = cmInputToMm(s) ?? 0;
                onChange(
                  setCfgKey(config, "pliegoImpresion", { ...pliego, anchoMm: mm }),
                );
              }}
            />
            <NumberField
              label="Alto (cm)"
              value={mmToCmStr(pliego.altoMm)}
              placeholder="0"
              onChange={(s) => {
                const mm = cmInputToMm(s) ?? 0;
                onChange(
                  setCfgKey(config, "pliegoImpresion", { ...pliego, altoMm: mm }),
                );
              }}
            />
          </>
        )}
        {pliego && selectValue !== PLIEGO_IMPRESION_CUSTOM && (
          <div className="sm:col-span-2 self-end pb-1.5 font-mono text-[11px] text-muted-foreground">
            {pliego.anchoMm} × {pliego.altoMm} mm
          </div>
        )}
      </div>
    </div>
  );
}

// ──────────────── Sub-formulario: Rollo ────────────────

function NestingRolloForm({
  config,
  onChange,
  maquina,
}: {
  config: Record<string, unknown> | null;
  onChange: (next: Record<string, unknown> | null) => void;
  maquina: Maquina | null;
}) {
  const params = (maquina?.parametrosTecnicos ?? null) as Record<
    string,
    unknown
  > | null;
  const cmRaw = (v: unknown): number | null => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  const anchoTotalCm =
    cmRaw(params?.anchoImprimibleMaximo) ??
    cmRaw(params?.anchoBoca) ??
    cmRaw(params?.anchoCama) ??
    cmRaw(params?.anchoMaxHoja);
  const margenIzqCm =
    cmRaw(params?.margenLateralIzquierdoNoImprimible) ??
    cmRaw(params?.margenIzquierdo);
  const margenDerCm =
    cmRaw(params?.margenLateralDerechoNoImprimible) ??
    cmRaw(params?.margenDerecho);
  const margenSupCm =
    cmRaw(params?.margenInicioNoImprimible) ?? cmRaw(params?.margenSuperior);
  const margenInfCm =
    cmRaw(params?.margenFinalNoImprimible) ?? cmRaw(params?.margenInferior);
  const printableDefaultCm =
    anchoTotalCm != null
      ? Number(
          Math.max(
            anchoTotalCm - (margenIzqCm ?? 0) - (margenDerCm ?? 0),
            0,
          ).toFixed(4),
        )
      : null;

  const panelizado = getCfgObject(config, "panelizado");
  const panelizadoActivo = getCfgBool(panelizado, "activo", false);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <NumberField
          label="Ancho imprimible (cm)"
          value={mmToCmStr(parseOptionalNumber(getCfgNumber(config, "printableWidthMm")))}
          placeholder={printableDefaultCm != null ? `${printableDefaultCm}` : "0"}
          onChange={(s) =>
            onChange(setCfgKey(config, "printableWidthMm", cmInputToMm(s)))
          }
        />
        <NumberField
          label="Margen izq. (cm)"
          value={mmToCmStr(parseOptionalNumber(getCfgNumber(config, "marginLeftMm")))}
          placeholder={margenIzqCm != null ? `${margenIzqCm}` : "0"}
          onChange={(s) =>
            onChange(setCfgKey(config, "marginLeftMm", cmInputToMm(s)))
          }
        />
        <NumberField
          label="Margen der. (cm)"
          value={mmToCmStr(parseOptionalNumber(getCfgNumber(config, "marginRightMm")))}
          placeholder={margenDerCm != null ? `${margenDerCm}` : "0"}
          onChange={(s) =>
            onChange(setCfgKey(config, "marginRightMm", cmInputToMm(s)))
          }
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <NumberField
          label="Margen inicio (cm)"
          value={mmToCmStr(parseOptionalNumber(getCfgNumber(config, "marginStartMm")))}
          placeholder={margenSupCm != null ? `${margenSupCm}` : "0"}
          onChange={(s) =>
            onChange(setCfgKey(config, "marginStartMm", cmInputToMm(s)))
          }
        />
        <NumberField
          label="Margen final (cm)"
          value={mmToCmStr(parseOptionalNumber(getCfgNumber(config, "marginEndMm")))}
          placeholder={margenInfCm != null ? `${margenInfCm}` : "0"}
          onChange={(s) =>
            onChange(setCfgKey(config, "marginEndMm", cmInputToMm(s)))
          }
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <NumberField
          label="Sep. horizontal (cm)"
          value={mmToCmStr(parseOptionalNumber(getCfgNumber(config, "separacionHorizontalMm")))}
          placeholder="0"
          onChange={(s) =>
            onChange(setCfgKey(config, "separacionHorizontalMm", cmInputToMm(s)))
          }
        />
        <NumberField
          label="Sep. vertical (cm)"
          value={mmToCmStr(parseOptionalNumber(getCfgNumber(config, "separacionVerticalMm")))}
          placeholder="0"
          onChange={(s) =>
            onChange(setCfgKey(config, "separacionVerticalMm", cmInputToMm(s)))
          }
        />
        <div className="flex items-center justify-between gap-2 pt-6">
          <Label htmlFor="rollo-rotacion" className="text-xs">
            Permitir rotación 90°
          </Label>
          <Switch
            id="rollo-rotacion"
            checked={getCfgBool(config, "permitirRotacion", true)}
            onCheckedChange={(v) =>
              onChange(setCfgKey(config, "permitirRotacion", v))
            }
          />
        </div>
      </div>

      <div className="rounded border border-input bg-background p-3">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-xs">Panelizado lógico</Label>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Subdivide cada pieza en sub-paneles para optimizar layout
              (avanzado).
            </p>
          </div>
          <Switch
            checked={panelizadoActivo}
            onCheckedChange={(v) =>
              onChange(setPanelizadoKey(config, "activo", v || undefined))
            }
          />
        </div>
        {panelizadoActivo && (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <NumberField
              label="Sub-panel ancho (cm)"
              value={mmToCmStr(
                parseOptionalNumber(getCfgNumber(panelizado, "subPanelAnchoMm")),
              )}
              placeholder="0"
              onChange={(s) =>
                onChange(
                  setPanelizadoKey(config, "subPanelAnchoMm", cmInputToMm(s)),
                )
              }
            />
            <NumberField
              label="Sub-panel alto (cm)"
              value={mmToCmStr(
                parseOptionalNumber(getCfgNumber(panelizado, "subPanelAltoMm")),
              )}
              placeholder="0"
              onChange={(s) =>
                onChange(
                  setPanelizadoKey(config, "subPanelAltoMm", cmInputToMm(s)),
                )
              }
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ──────────────── Sub-formulario: Placa rígida ────────────────

function NestingPlacaForm({
  config,
  onChange,
}: {
  config: Record<string, unknown> | null;
  onChange: (next: Record<string, unknown> | null) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <NumberField
          label="Placa ancho (cm)"
          value={mmToCmStr(parseOptionalNumber(getCfgNumber(config, "placaAnchoMm")))}
          placeholder="0"
          onChange={(s) =>
            onChange(setCfgKey(config, "placaAnchoMm", cmInputToMm(s)))
          }
        />
        <NumberField
          label="Placa alto (cm)"
          value={mmToCmStr(parseOptionalNumber(getCfgNumber(config, "placaAltoMm")))}
          placeholder="0"
          onChange={(s) =>
            onChange(setCfgKey(config, "placaAltoMm", cmInputToMm(s)))
          }
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <NumberField
          label="Margen (cm)"
          value={mmToCmStr(parseOptionalNumber(getCfgNumber(config, "margenMm")))}
          placeholder="0"
          onChange={(s) =>
            onChange(setCfgKey(config, "margenMm", cmInputToMm(s)))
          }
        />
        <NumberField
          label="Sep. horizontal (cm)"
          value={mmToCmStr(parseOptionalNumber(getCfgNumber(config, "separacionHMm")))}
          placeholder="0"
          onChange={(s) =>
            onChange(setCfgKey(config, "separacionHMm", cmInputToMm(s)))
          }
        />
        <NumberField
          label="Sep. vertical (cm)"
          value={mmToCmStr(parseOptionalNumber(getCfgNumber(config, "separacionVMm")))}
          placeholder="0"
          onChange={(s) =>
            onChange(setCfgKey(config, "separacionVMm", cmInputToMm(s)))
          }
        />
      </div>
      <div className="flex items-center justify-between gap-2 rounded border border-input bg-background p-3">
        <Label htmlFor="placa-rotacion" className="text-xs">
          Permitir rotación 90° de piezas
        </Label>
        <Switch
          id="placa-rotacion"
          checked={getCfgBool(config, "permitirRotacion", true)}
          onCheckedChange={(v) =>
            onChange(setCfgKey(config, "permitirRotacion", v))
          }
        />
      </div>
    </div>
  );
}

// ──────────────── Editor de pliegos candidatos ────────────────

function PliegosListEditor({
  pliegos,
  onChange,
}: {
  pliegos: PliegoCandidato[];
  onChange: (next: PliegoCandidato[]) => void;
}) {
  const updateAt = (idx: number, patch: Partial<PliegoCandidato>) => {
    const next = pliegos.slice();
    next[idx] = { ...next[idx], ...patch } as PliegoCandidato;
    onChange(next);
  };
  const removeAt = (idx: number) => {
    onChange(pliegos.filter((_, i) => i !== idx));
  };
  const addRow = () => {
    onChange([...pliegos, { anchoMm: 0, altoMm: 0 }]);
  };

  return (
    <div className="rounded border border-input bg-background p-3">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <Label className="text-xs">Pliegos candidatos (sustratos)</Label>
          <p className="mt-1 text-[11px] text-muted-foreground">
            El motor evalúa cada pliego (sustrato comprado) y elige el mejor
            según el criterio. Vacío = usa catálogo default del motor.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={addRow}>
          + Agregar pliego
        </Button>
      </div>
      {pliegos.length === 0 ? (
        <p className="py-2 text-center text-xs text-muted-foreground">
          Sin pliegos candidatos.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {pliegos.map((p, idx) => (
            <div
              key={idx}
              className="grid grid-cols-[1fr_1.4fr_0.7fr_0.7fr_28px] items-center gap-2"
            >
              <Input
                value={p.codigo ?? ""}
                placeholder="código"
                onChange={(e) =>
                  updateAt(idx, { codigo: e.target.value || undefined })
                }
                className="text-xs"
              />
              <Input
                value={p.nombre ?? ""}
                placeholder="nombre"
                onChange={(e) =>
                  updateAt(idx, { nombre: e.target.value || undefined })
                }
                className="text-xs"
              />
              <Input
                type="number"
                value={p.anchoMm ? String(Number((p.anchoMm / 10).toFixed(4))) : ""}
                placeholder="ancho cm"
                step="0.1"
                onChange={(e) =>
                  updateAt(idx, {
                    anchoMm: Number((Number(e.target.value) * 10).toFixed(4)) || 0,
                  })
                }
                className="text-xs"
              />
              <Input
                type="number"
                value={p.altoMm ? String(Number((p.altoMm / 10).toFixed(4))) : ""}
                placeholder="alto cm"
                step="0.1"
                onChange={(e) =>
                  updateAt(idx, {
                    altoMm: Number((Number(e.target.value) * 10).toFixed(4)) || 0,
                  })
                }
                className="text-xs"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="size-7 p-0"
                onClick={() => removeAt(idx)}
                title="Quitar"
              >
                ×
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Avoid TS unused-import warnings if helpers remain unused in some branches.
// Marker: getLongitudMm is here in case future capa cards consume it directly.
void getLongitudMm;
