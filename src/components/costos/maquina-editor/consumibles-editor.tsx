/**
 * Editor de consumibles de impresión (tintas/tóner por canal) + calculadora
 * de tóner g/m². Extraído de maquinaria-panel.tsx en la Fase B (2026-07-28),
 * sin cambios de comportamiento.
 */

import * as React from "react";
import { CalculatorIcon, ChevronDownIcon } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import type { MaquinaPayload, PlantillaMaquinaria } from "@/lib/maquinaria";
import type { MateriaPrima, MateriaPrimaVariante } from "@/lib/materias-primas";
import { getVarianteDisplayName } from "@/lib/materias-primas-variantes-display";

import {
  CANAL_META,
  PRINTER_TEMPLATES_WITH_CONSUMIBLES,
  SelectDisplay,
  canalFromConsumible,
  consumibleTipoFor,
  consumibleUnidadFor,
  defaultConsumoBase,
  normalizeCanal,
  requiredChannelsForLaserMachine,
  requiredChannelsForPerfil,
  type ConsumibleCanal,
  type LocalPerfil,
} from "./helpers";

// ─── Sub-componente: editor de consumibles de impresión ────────────

interface ConsumiblesImpresionProps {
  form: MaquinaPayload;
  setForm: React.Dispatch<React.SetStateAction<MaquinaPayload>>;
  perfiles: LocalPerfil[];
  materiasPrimas: MateriaPrima[];
  loadingMaterias: boolean;
}

// Área de una hoja A4 en m² (0,210 × 0,297).
const A4_AREA_M2 = 0.21 * 0.297;

/**
 * Calculadora de consumo de tóner: convierte el rendimiento del fabricante
 * (páginas ISO a cierta cobertura) al consumo real en g/m² a la cobertura que
 * elija el usuario (ISO o full-color ~40%). Ver docs de investigación de
 * cobertura. El resultado se aplica a los 4 canales CMYK.
 */
function CalculadoraTonerGm2({ onApply }: { onApply: (gm2: number) => void }) {
  const [abierta, setAbierta] = React.useState(false);
  const [gramos, setGramos] = React.useState("");
  const [rendimiento, setRendimiento] = React.useState("");
  const [coberturaIso, setCoberturaIso] = React.useState("5");
  const [modo, setModo] = React.useState<"iso" | "full">("full");
  const [coberturaFull, setCoberturaFull] = React.useState("40");

  const g = Number(gramos);
  const rend = Number(rendimiento);
  const covIso = Number(coberturaIso);
  const covTarget = modo === "iso" ? covIso : Number(coberturaFull);

  const valido =
    Number.isFinite(g) &&
    g > 0 &&
    Number.isFinite(rend) &&
    rend > 0 &&
    Number.isFinite(covIso) &&
    covIso > 0 &&
    Number.isFinite(covTarget) &&
    covTarget > 0;

  // Rendimiento y consumo son lineales con la cobertura (aprox. de industria).
  const rendEsperado = valido ? rend * (covIso / covTarget) : 0;
  const consumoGm2 = valido ? (g / rend) * (covTarget / covIso) / A4_AREA_M2 : 0;
  const consumoRedondeado = Number(consumoGm2.toFixed(2));

  return (
    <div className="rounded-md border bg-muted/20">
      <button
        type="button"
        onClick={() => setAbierta((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-medium">
          <CalculatorIcon size={15} className="text-muted-foreground" />
          Calculadora de consumo (g/m²)
        </span>
        <ChevronDownIcon
          size={15}
          className={`text-muted-foreground transition-transform ${abierta ? "rotate-180" : ""}`}
        />
      </button>

      {abierta ? (
        <div className="space-y-3 border-t px-3 pb-3 pt-3">
          <p className="text-xs text-muted-foreground">
            El fabricante mide el rendimiento a baja cobertura ISO (~5% por
            color). En full-color real (folletería, fotos) la cobertura ronda el
            40% por color y el consumo se dispara. Cargá los datos del tóner y
            aplicá el resultado a los 4 canales CMYK.
          </p>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label className="text-xs">Gramos netos de la botella</Label>
              <Input
                type="number"
                min={0}
                step={1}
                value={gramos}
                onChange={(e) => setGramos(e.target.value)}
                placeholder="ej: 600"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Rendimiento ISO (páginas A4)</Label>
              <Input
                type="number"
                min={0}
                step={1}
                value={rendimiento}
                onChange={(e) => setRendimiento(e.target.value)}
                placeholder="ej: 33000"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Cobertura ISO del fabricante (%)</Label>
              <Input
                type="number"
                min={0}
                step={0.25}
                value={coberturaIso}
                onChange={(e) => setCoberturaIso(e.target.value)}
                placeholder="5"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Cobertura a calcular</Label>
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex overflow-hidden rounded-md border">
                <button
                  type="button"
                  onClick={() => setModo("iso")}
                  className={`px-3 py-1.5 text-xs ${modo === "iso" ? "bg-primary text-primary-foreground" : "bg-background"}`}
                >
                  ISO ({covIso || 0}%)
                </button>
                <button
                  type="button"
                  onClick={() => setModo("full")}
                  className={`px-3 py-1.5 text-xs ${modo === "full" ? "bg-primary text-primary-foreground" : "bg-background"}`}
                >
                  Full-color
                </button>
              </div>
              {modo === "full" ? (
                <div className="inline-flex items-center gap-1">
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    value={coberturaFull}
                    onChange={(e) => setCoberturaFull(e.target.value)}
                    className="h-8 w-20"
                  />
                  <span className="text-xs text-muted-foreground">% por color</span>
                </div>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 rounded-md border bg-background p-3 sm:grid-cols-2">
            <div>
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Rendimiento esperado
              </div>
              <div className="text-lg font-semibold">
                {valido ? Math.round(rendEsperado).toLocaleString("es-AR") : "—"}
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  pág A4
                </span>
              </div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Consumo de tóner
              </div>
              <div className="text-lg font-semibold">
                {valido ? consumoRedondeado.toLocaleString("es-AR") : "—"}
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  g/m²
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            disabled={!valido}
            onClick={() => onApply(consumoRedondeado)}
            className="btn btn-primary h-8 w-full text-xs disabled:opacity-50"
          >
            Usar {valido ? `${consumoRedondeado} g/m²` : "el valor"} en los 4
            canales CMYK
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function ConsumiblesImpresionEditor({
  form,
  setForm,
  perfiles,
  materiasPrimas,
  loadingMaterias,
}: ConsumiblesImpresionProps) {
  if (!PRINTER_TEMPLATES_WITH_CONSUMIBLES.has(form.plantilla)) {
    return (
      <p className="text-muted-foreground text-xs italic">
        Este editor aplica a impresoras láser, gran formato y plotter CAD.
      </p>
    );
  }

  if (perfiles.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
        Primero agregá al menos un perfil operativo para derivar los canales
        requeridos de impresión.
      </div>
    );
  }

  const variantesCompatibles = getVariantesConsumiblesCompatibles(materiasPrimas, form.plantilla);
  const isLaser = form.plantilla === "impresora_laser";

  const upsertConsumible = (
    perfil: LocalPerfil | null,
    canal: ConsumibleCanal,
    patch: Partial<MaquinaPayload["consumibles"][number]>,
  ) => {
    if (perfil && !perfil.id) return;
    const perfilOperativoId = perfil?.id;
    setForm((current) => {
      const idx = current.consumibles.findIndex(
        (item) =>
          (item.perfilOperativoId ?? undefined) === perfilOperativoId &&
          canalFromConsumible(item) === canal,
      );
      const existing = idx >= 0 ? current.consumibles[idx] : null;
      const scopeLabel = perfil?.nombre ?? "máquina";
      const nextItem: MaquinaPayload["consumibles"][number] = {
        id: existing?.id,
        materiaPrimaVarianteId: existing?.materiaPrimaVarianteId ?? "",
        nombre: existing?.nombre ?? `${CANAL_META[canal].label} · ${scopeLabel}`,
        tipo: existing?.tipo ?? consumibleTipoFor(current.plantilla, canal),
        unidad: existing?.unidad ?? consumibleUnidadFor(current.plantilla),
        rendimientoEstimado: existing?.rendimientoEstimado,
        consumoBase: existing?.consumoBase ?? defaultConsumoBase(current.plantilla, canal),
        perfilOperativoId,
        perfilOperativoNombre: perfil?.nombre,
        detalle: { ...(existing?.detalle ?? {}), color: canal },
        observaciones: existing?.observaciones,
        ...patch,
        activo: true,
      };
      const next = [...current.consumibles];
      if (idx >= 0) next[idx] = nextItem;
      else next.push(nextItem);
      return { ...current, consumibles: next };
    });
  };

  const removeConsumible = (perfilId: string | undefined, canal: ConsumibleCanal) => {
    setForm((current) => ({
      ...current,
      consumibles: current.consumibles.filter(
        (item) =>
          !(
            (item.perfilOperativoId ?? undefined) === perfilId &&
            canalFromConsumible(item) === canal
          ),
      ),
    }));
  };

  return (
    <div className="space-y-4">
      <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
        {isLaser
          ? "El tóner láser se configura una sola vez por canal de la máquina. El modo de color de la cotización define qué canales se consumen."
          : "Las tintas de impresión se toman automáticamente en el motor desde la máquina y el perfil. En Productos ya no hace falta elegir tinta por paso."}
      </div>

      {loadingMaterias && (
        <p className="text-xs text-muted-foreground">Cargando materias primas compatibles...</p>
      )}

      {isLaser ? (
        <div className="space-y-2 rounded-md border p-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="font-medium">Tóner por canal de la máquina</div>
              <div className="text-xs text-muted-foreground">
                Una única configuración de tóner se aplica a todos los perfiles láser.
              </div>
            </div>
            <Badge variant="outline">
              {requiredChannelsForLaserMachine(form, perfiles).length} canal
              {requiredChannelsForLaserMachine(form, perfiles).length === 1 ? "" : "es"}
            </Badge>
          </div>

          <CalculadoraTonerGm2
            onApply={(gm2) => {
              const cmyk: ConsumibleCanal[] = [
                "cian",
                "magenta",
                "amarillo",
                "negro",
              ];
              const objetivo = requiredChannelsForLaserMachine(
                form,
                perfiles,
              ).filter((canal) => cmyk.includes(canal));
              objetivo.forEach((canal) =>
                upsertConsumible(null, canal, { consumoBase: gm2 }),
              );
              toast.success(
                `Consumo ${gm2} g/m² aplicado a ${objetivo.length} canal${objetivo.length === 1 ? "" : "es"} CMYK`,
              );
            }}
          />

          <div className="space-y-2">
            {requiredChannelsForLaserMachine(form, perfiles).map((canal) => {
              const existing = form.consumibles.find(
                (item) =>
                  !item.perfilOperativoId && canalFromConsumible(item) === canal,
              );
              const variantesCanal = variantesCompatibles.filter((item) =>
                varianteMatchesCanal(item.variante, canal),
              );
              const selected = existing?.materiaPrimaVarianteId ?? "";
              const selectedStillAvailable = variantesCanal.some(
                (item) => item.variante.id === selected,
              );
              const opciones =
                selected && !selectedStillAvailable
                  ? [
                      ...variantesCanal,
                      getSelectedConsumibleVariantFallback(materiasPrimas, selected),
                    ].filter((item): item is VarianteConsumibleOption => Boolean(item))
                  : variantesCanal;
              const selectedOption = opciones.find((item) => item.variante.id === selected);

              return (
                <div key={`laser-${canal}`} className="grid grid-cols-1 gap-2 rounded-md bg-background p-2 md:grid-cols-[120px_1fr_120px] md:items-end">
                  <div className="space-y-1">
                    <Label className="text-xs">Canal</Label>
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <span
                        className="size-4 rounded-full border"
                        style={{ backgroundColor: CANAL_META[canal].swatch }}
                      />
                      <span>{CANAL_META[canal].label}</span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Variante vinculada</Label>
                    <Select
                      value={selected}
                      onValueChange={(value) => {
                        if (!value) {
                          removeConsumible(undefined, canal);
                          return;
                        }
                        const variante = opciones.find((item) => item.variante.id === value);
                        upsertConsumible(null, canal, {
                          materiaPrimaVarianteId: value,
                          nombre: variante
                            ? `${CANAL_META[canal].label} · ${variante.materiaPrima.nombre}`
                            : `${CANAL_META[canal].label} · máquina`,
                          tipo: consumibleTipoFor(form.plantilla, canal),
                          unidad: consumibleUnidadFor(form.plantilla),
                        });
                      }}
                    >
                      <SelectTrigger className="h-9 w-full min-w-0">
                        <SelectDisplay
                          label={
                            selectedOption
                              ? getConsumibleVariantOptionLabel(selectedOption)
                              : ""
                          }
                          placeholder="Elegir tóner"
                        />
                      </SelectTrigger>
                      <SelectContent className="max-h-80">
                        {opciones.map((item) => (
                          <SelectItem key={item.variante.id} value={item.variante.id}>
                            {getConsumibleVariantOptionLabel(item)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">
                      Consumo ({consumibleUnidadFor(form.plantilla)}/m²)
                    </Label>
                    <Input
                      type="number"
                      min={0}
                      step={0.01}
                      disabled={!existing}
                      value={existing?.consumoBase ?? ""}
                      placeholder={String(defaultConsumoBase(form.plantilla, canal))}
                      onChange={(event) =>
                        upsertConsumible(null, canal, {
                          consumoBase: event.target.value === "" ? undefined : Number(event.target.value),
                        })
                      }
                    />
                  </div>

                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {isLaser
        ? null
        : perfiles.map((perfil) => {
        const channels = requiredChannelsForPerfil(
          perfil,
          (form.parametrosTecnicos ?? {}) as Record<string, unknown>,
        );
        if (channels.length === 0) {
          return (
            <div key={perfil.uiKey} className="rounded-md border p-3">
              <div className="font-medium">{perfil.nombre}</div>
              <p className="text-xs text-muted-foreground">
                Este perfil todavía no declara colores. Definí el campo “Colores” en el perfil
                para generar los canales requeridos.
              </p>
            </div>
          );
        }

        return (
          <div key={perfil.uiKey} className="space-y-2 rounded-md border p-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="font-medium">{perfil.nombre}</div>
                <div className="text-xs text-muted-foreground">
                  {channels.map((channel) => CANAL_META[channel].label).join(" · ")}
                </div>
              </div>
              <Badge variant="outline">{channels.length} canal{channels.length === 1 ? "" : "es"}</Badge>
            </div>

            <div className="space-y-2">
              {channels.map((canal) => {
                const existing = form.consumibles.find(
                  (item) => item.perfilOperativoId === perfil.id && canalFromConsumible(item) === canal,
                );
                const variantesCanal = variantesCompatibles.filter((item) =>
                  varianteMatchesCanal(item.variante, canal),
                );
                const selected = existing?.materiaPrimaVarianteId ?? "";
                const selectedStillAvailable = variantesCanal.some((item) => item.variante.id === selected);
                const opciones = selected && !selectedStillAvailable
                  ? [
                      ...variantesCanal,
                      getSelectedConsumibleVariantFallback(materiasPrimas, selected),
                    ].filter((item): item is VarianteConsumibleOption => Boolean(item))
                  : variantesCanal;
                const selectedOption = opciones.find((item) => item.variante.id === selected);

                return (
                  <div key={`${perfil.uiKey}-${canal}`} className="grid grid-cols-1 gap-2 rounded-md bg-background p-2 md:grid-cols-[120px_1fr_120px] md:items-end">
                    <div className="space-y-1">
                      <Label className="text-xs">Canal</Label>
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <span
                          className="size-4 rounded-full border"
                          style={{ backgroundColor: CANAL_META[canal].swatch }}
                        />
                        <span>{CANAL_META[canal].label}</span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">Variante vinculada</Label>
                      <Select
                        value={selected}
                        onValueChange={(value) => {
                          if (!value) {
                            removeConsumible(perfil.id, canal);
                            return;
                          }
                          const variante = opciones.find((item) => item.variante.id === value);
                          upsertConsumible(perfil, canal, {
                            materiaPrimaVarianteId: value,
                            nombre: variante
                              ? `${CANAL_META[canal].label} · ${variante.materiaPrima.nombre}`
                              : `${CANAL_META[canal].label} · ${perfil.nombre}`,
                            tipo: consumibleTipoFor(form.plantilla, canal),
                            unidad: consumibleUnidadFor(form.plantilla),
                          });
                        }}
                      >
                        <SelectTrigger className="h-9 w-full min-w-0">
                          <SelectDisplay
                            label={
                              selectedOption
                                ? getConsumibleVariantOptionLabel(selectedOption)
                                : ""
                            }
                            placeholder="Elegir consumible"
                          />
                        </SelectTrigger>
                        <SelectContent className="max-h-80">
                          {opciones.map((item) => (
                            <SelectItem key={item.variante.id} value={item.variante.id}>
                              {getConsumibleVariantOptionLabel(item)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">
                        Consumo ({consumibleUnidadFor(form.plantilla)}/m²)
                      </Label>
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        disabled={!existing}
                        value={existing?.consumoBase ?? ""}
                        placeholder={String(defaultConsumoBase(form.plantilla, canal))}
                        onChange={(event) =>
                          upsertConsumible(perfil, canal, {
                            consumoBase: event.target.value === "" ? undefined : Number(event.target.value),
                          })
                        }
                      />
                    </div>

                  </div>
                );
              })}
            </div>
          </div>
        );
          })}
    </div>
  );
}

type VarianteConsumibleOption = {
  materiaPrima: MateriaPrima;
  variante: MateriaPrimaVariante;
};

function getConsumibleVariantOptionLabel(item: VarianteConsumibleOption) {
  return `${item.materiaPrima.nombre} · ${getVarianteDisplayName(
    item.materiaPrima,
    item.variante,
  )}`;
}

function getVariantesConsumiblesCompatibles(
  materiasPrimas: MateriaPrima[],
  plantilla: PlantillaMaquinaria,
): VarianteConsumibleOption[] {
  const necesitaToner = plantilla === "impresora_laser";
  const opciones: VarianteConsumibleOption[] = [];
  for (const materiaPrima of materiasPrimas) {
    if (!materiaPrima.activo || !materiaPrima.esConsumible) continue;
    if (necesitaToner && materiaPrima.subfamilia !== "toner") continue;
    if (!necesitaToner && !["tinta_impresion", "toner"].includes(materiaPrima.subfamilia)) continue;
    for (const variante of materiaPrima.variantes) {
      if (!variante.activo) continue;
      opciones.push({ materiaPrima, variante });
    }
  }
  return opciones;
}

function varianteMatchesCanal(variante: MateriaPrimaVariante, canal: ConsumibleCanal) {
  const attrs = variante.atributosVariante ?? {};
  return normalizeCanal(attrs.canal ?? attrs.color) === canal;
}

function getSelectedConsumibleVariantFallback(
  materiasPrimas: MateriaPrima[],
  varianteId: string,
): VarianteConsumibleOption | null {
  for (const materiaPrima of materiasPrimas) {
    const variante = materiaPrima.variantes.find((item) => item.id === varianteId);
    if (variante) return { materiaPrima, variante };
  }
  return null;
}
