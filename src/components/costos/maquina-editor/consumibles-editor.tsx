/**
 * Tintas y tóner de UN perfil operativo: el modal "Configurar" que abre la
 * tabla de perfiles, con la calculadora de consumo para las láser.
 *
 * Hasta 2026-07-28 este archivo tenía además un editor de consumibles a
 * nivel MÁQUINA, que era como se cargaba el tóner de la láser. Se retiró
 * cuando el tóner pasó a declararse por perfil, igual que las tintas del
 * resto de las impresoras: el consumo cambia con el papel.
 */

import * as React from "react";
import { CalculatorIcon, ChevronDownIcon, XIcon } from "lucide-react";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NIVELES_COBERTURA,
  NIVEL_COBERTURA_LABELS,
  type NivelCobertura,
} from "@/lib/cobertura-toner";
import type { MaquinaPayload, PlantillaMaquinaria } from "@/lib/maquinaria";
import type { MateriaPrima, MateriaPrimaVariante } from "@/lib/materias-primas";
import { getVarianteDisplayName } from "@/lib/materias-primas-variantes-display";

import {
  CANAL_META,
  canalFromConsumible,
  consumibleTipoFor,
  consumibleUnidadFor,
  defaultConsumoBase,
  normalizeCanal,
  requiredChannelsForPerfil,
  type ConsumibleCanal,
  type LocalPerfil,
} from "./helpers";

// ─── Sub-componente: editor de consumibles de impresión ────────────

// Área de una hoja A4 en m² (0,210 × 0,297).
const A4_AREA_M2 = 0.21 * 0.297;

/**
 * Calculadora de consumo de tóner: convierte el rendimiento del fabricante
 * (páginas ISO a cierta cobertura) al consumo real en g/m² a la cobertura que
 * elija el usuario (ISO o full-color ~40%). Ver docs de investigación de
 * cobertura. El resultado se aplica a los 4 canales CMYK.
 */
function CalculadoraTonerGm2({
  onApply,
}: {
  onApply: (gm2: number, nivel: NivelCobertura) => void;
}) {
  const [abierta, setAbierta] = React.useState(false);
  const [gramos, setGramos] = React.useState("");
  const [rendimiento, setRendimiento] = React.useState("");
  const [coberturaIso, setCoberturaIso] = React.useState("5");
  const [modo, setModo] = React.useState<"iso" | "full">("full");
  const [coberturaFull, setCoberturaFull] = React.useState("40");
  // Columna destino del resultado (baja/ISO→Borrador/Normal, full-color→Alta).
  const [destino, setDestino] = React.useState<NivelCobertura>("alta");

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

          <div className="space-y-1">
            <Label className="text-xs">Aplicar a la columna</Label>
            <div className="inline-flex overflow-hidden rounded-md border">
              {NIVELES_COBERTURA.map((nivel) => (
                <button
                  key={nivel}
                  type="button"
                  onClick={() => setDestino(nivel)}
                  className={`px-3 py-1.5 text-xs ${destino === nivel ? "bg-primary text-primary-foreground" : "bg-background"}`}
                >
                  {NIVEL_COBERTURA_LABELS[nivel]}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            disabled={!valido}
            onClick={() => onApply(consumoRedondeado, destino)}
            className="btn btn-primary h-8 w-full text-xs disabled:opacity-50"
          >
            Usar {valido ? `${consumoRedondeado} g/m²` : "el valor"} en la columna{" "}
            {NIVEL_COBERTURA_LABELS[destino]} (4 canales CMYK)
          </button>
        </div>
      ) : null}
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

// ─── Modal "Configurar tintas" de UN perfil (estilo Holdprint) ──────
//
// Se abre desde la columna Tinta de la tabla de perfiles. Los canales
// salen del modo de color del perfil (o de la máquina si el perfil no
// declara); cada fila vincula la variante de materia prima y su consumo.
// El láser NO pasa por acá: su tóner es por máquina (acordeón Consumibles).

interface PerfilTintasModalProps {
  perfil: LocalPerfil;
  form: MaquinaPayload;
  setForm: React.Dispatch<React.SetStateAction<MaquinaPayload>>;
  materiasPrimas: MateriaPrima[];
  loadingMaterias: boolean;
  onClose: () => void;
}

export function PerfilTintasModal({
  perfil,
  form,
  setForm,
  materiasPrimas,
  loadingMaterias,
  onClose,
}: PerfilTintasModalProps) {
  const channels = requiredChannelsForPerfil(
    perfil,
    (form.parametrosTecnicos ?? {}) as Record<string, unknown>,
  );
  const variantesCompatibles = getVariantesConsumiblesCompatibles(
    materiasPrimas,
    form.plantilla,
  );
  const esLaser = form.plantilla === "impresora_laser";

  const upsert = (
    canal: ConsumibleCanal,
    patch: Partial<MaquinaPayload["consumibles"][number]>,
  ) => {
    if (!perfil.id) return;
    setForm((current) => {
      const idx = current.consumibles.findIndex(
        (item) =>
          item.perfilOperativoId === perfil.id &&
          canalFromConsumible(item) === canal,
      );
      const existing = idx >= 0 ? current.consumibles[idx] : null;
      const nextItem: MaquinaPayload["consumibles"][number] = {
        id: existing?.id,
        materiaPrimaVarianteId: existing?.materiaPrimaVarianteId ?? "",
        nombre: existing?.nombre ?? `${CANAL_META[canal].label} · ${perfil.nombre}`,
        tipo: existing?.tipo ?? consumibleTipoFor(current.plantilla, canal),
        unidad: existing?.unidad ?? consumibleUnidadFor(current.plantilla),
        rendimientoEstimado: existing?.rendimientoEstimado,
        consumoBase: existing?.consumoBase ?? defaultConsumoBase(current.plantilla, canal),
        consumoPorCobertura: existing?.consumoPorCobertura ?? null,
        perfilOperativoId: perfil.id,
        perfilOperativoNombre: perfil.nombre,
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

  // Setea el g/m² de un nivel de cobertura de un canal. Mantiene consumoBase =
  // Normal (compat + fallback del motor). Valor vacío → quita ese nivel.
  const setNivel = (
    canal: ConsumibleCanal,
    nivel: NivelCobertura,
    valor: number | undefined,
  ) => {
    const existing = form.consumibles.find(
      (item) =>
        item.perfilOperativoId === perfil.id &&
        canalFromConsumible(item) === canal,
    );
    const prev = { ...(existing?.consumoPorCobertura ?? {}) };
    if (valor === undefined) delete prev[nivel];
    else prev[nivel] = valor;
    upsert(canal, {
      consumoPorCobertura: prev,
      ...(nivel === "normal" ? { consumoBase: valor } : {}),
    });
  };

  const remove = (canal: ConsumibleCanal) => {
    setForm((current) => ({
      ...current,
      consumibles: current.consumibles.filter(
        (item) =>
          !(
            item.perfilOperativoId === perfil.id &&
            canalFromConsumible(item) === canal
          ),
      ),
    }));
  };

  return (
    <div className="maq-backdrop show" onClick={onClose}>
      <div
        className="maq-modal maq-modal-ancho"
        role="dialog"
        aria-modal="true"
        aria-label={`Configurar tintas de ${perfil.nombre}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="maq-modal-head">
          <div>
            <h2>Configurar {esLaser ? "tóner" : "tintas"}</h2>
            <div className="maq-modal-sub">{perfil.nombre}</div>
          </div>
          <button
            type="button"
            className="maq-modal-cerrar"
            aria-label="Cerrar"
            onClick={onClose}
          >
            <XIcon />
          </button>
        </div>

        <div className="maq-modal-body">
          {esLaser && channels.length > 0 ? (
            <CalculadoraTonerGm2
              onApply={(gm2, nivel) => {
                const cmyk: ConsumibleCanal[] = [
                  "cian",
                  "magenta",
                  "amarillo",
                  "negro",
                ];
                const objetivo = channels.filter((canal) =>
                  cmyk.includes(canal),
                );
                objetivo.forEach((canal) => setNivel(canal, nivel, gm2));
                toast.success(
                  `Consumo ${gm2} g/m² aplicado a la columna ${NIVEL_COBERTURA_LABELS[nivel]} en ${objetivo.length} canal${objetivo.length === 1 ? "" : "es"} CMYK`,
                );
              }}
            />
          ) : null}
          {channels.length === 0 ? (
            <p className="maq-tintas-vacio">
              Este perfil todavía no declara colores. Definí el campo
              “Colores” del perfil para generar los canales de tinta.
            </p>
          ) : (
            <>
              {loadingMaterias ? (
                <p className="maq-tintas-cargando">
                  Cargando materias primas compatibles…
                </p>
              ) : null}
              <table className="maq-tintas-tabla">
                <thead>
                  <tr>
                    <th>Color</th>
                    {/* Cobertura por nivel es exclusiva de láser (tóner). Gran
                        formato y demás usan un único consumo por m². */}
                    {esLaser ? (
                      NIVELES_COBERTURA.map((nivel) => (
                        <th key={nivel}>
                          {NIVEL_COBERTURA_LABELS[nivel]} (
                          {consumibleUnidadFor(form.plantilla)}/m²)
                        </th>
                      ))
                    ) : (
                      <th>Consumo ({consumibleUnidadFor(form.plantilla)}/m²)</th>
                    )}
                    <th>Material vinculado</th>
                    <th aria-label="Acciones" />
                  </tr>
                </thead>
                <tbody>
                  {channels.map((canal) => {
                    const existing = form.consumibles.find(
                      (item) =>
                        item.perfilOperativoId === perfil.id &&
                        canalFromConsumible(item) === canal,
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

                    return (
                      <tr key={canal}>
                        <td>
                          <span className="maq-tintas-color">
                            <span
                              className="sw"
                              style={{ backgroundColor: CANAL_META[canal].swatch }}
                            />
                            {CANAL_META[canal].label}
                          </span>
                        </td>
                        {esLaser ? (
                          NIVELES_COBERTURA.map((nivel) => {
                            const actual =
                              existing?.consumoPorCobertura?.[nivel];
                            // Compat: consumibles viejos sin JSON muestran consumoBase en Normal.
                            const valor =
                              actual ??
                              (nivel === "normal"
                                ? (existing?.consumoBase ?? undefined)
                                : undefined);
                            return (
                              <td key={nivel}>
                                <input
                                  type="number"
                                  min={0}
                                  step={0.01}
                                  disabled={!existing}
                                  value={valor ?? ""}
                                  placeholder={String(
                                    defaultConsumoBase(form.plantilla, canal),
                                  )}
                                  aria-label={`Consumo ${NIVEL_COBERTURA_LABELS[nivel]} de ${CANAL_META[canal].label}`}
                                  onChange={(event) =>
                                    setNivel(
                                      canal,
                                      nivel,
                                      event.target.value === ""
                                        ? undefined
                                        : Number(event.target.value),
                                    )
                                  }
                                />
                              </td>
                            );
                          })
                        ) : (
                          <td>
                            <input
                              type="number"
                              min={0}
                              step={0.01}
                              disabled={!existing}
                              value={existing?.consumoBase ?? ""}
                              placeholder={String(
                                defaultConsumoBase(form.plantilla, canal),
                              )}
                              aria-label={`Consumo de ${CANAL_META[canal].label}`}
                              onChange={(event) =>
                                upsert(canal, {
                                  consumoBase:
                                    event.target.value === ""
                                      ? undefined
                                      : Number(event.target.value),
                                })
                              }
                            />
                          </td>
                        )}
                        <td>
                          <select
                            value={selected}
                            aria-label={`Material vinculado a ${CANAL_META[canal].label}`}
                            onChange={(event) => {
                              const value = event.target.value;
                              if (!value) {
                                remove(canal);
                                return;
                              }
                              const variante = opciones.find(
                                (item) => item.variante.id === value,
                              );
                              upsert(canal, {
                                materiaPrimaVarianteId: value,
                                nombre: variante
                                  ? `${CANAL_META[canal].label} · ${variante.materiaPrima.nombre}`
                                  : `${CANAL_META[canal].label} · ${perfil.nombre}`,
                                tipo: consumibleTipoFor(form.plantilla, canal),
                                unidad: consumibleUnidadFor(form.plantilla),
                              });
                            }}
                          >
                            <option value="">Sin vincular</option>
                            {opciones.map((item) => (
                              <option key={item.variante.id} value={item.variante.id}>
                                {getConsumibleVariantOptionLabel(item)}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="maq-tintas-quitar"
                            title="Quitar tinta del perfil"
                            aria-label={`Quitar ${CANAL_META[canal].label}`}
                            disabled={!existing}
                            onClick={() => remove(canal)}
                          >
                            <XIcon />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="maq-tintas-nota">
                {esLaser
                  ? "El motor toma este tóner al cotizar con este perfil; en Productos no hace falta elegirlo por paso."
                  : "El motor toma estas tintas automáticamente al cotizar con este perfil; en Productos no hace falta elegirlas por paso."}
              </p>
            </>
          )}
        </div>

        <div className="maq-modal-foot">
          <button type="button" className="maq-btn maq-btn-primario" onClick={onClose}>
            Listo
          </button>
        </div>
      </div>
    </div>
  );
}
