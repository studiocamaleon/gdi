"use client";

/**
 * Panel de gestión de máquinas — modelo v3.0 (2026-04-26).
 *
 * Diseño template-driven: cada plantilla del catálogo
 * (`maquinaria-templates.ts`) declara qué secciones y campos pide. Este
 * componente renderiza dinámicamente esos campos sin hardcodear plantillas
 * específicas. Funcional pero minimalista — la UX rica se trabaja en
 * iteraciones siguientes.
 *
 * Reemplaza el componente legacy de 6266 LOC que hardcodeaba campos como
 * printMode, printSides, dobleFaz, sheetThicknessMm, etc. Esos campos
 * ahora viven en `perfil.detalle` JSON con los discriminantes que la
 * plantilla declara (caras, colores, tipoCorte, gramajeMinGr, etc.).
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2Icon,
  ChevronDownIcon,
  ChevronRightIcon,
  CircleIcon,
  CopyIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import {
  createMaquina,
  toggleMaquina,
  updateMaquina,
} from "@/lib/maquinaria-api";
import type { CentroCosto, Planta } from "@/lib/costos";
import {
  estadoMaquinaItems,
  geometriaTrabajoMaquinaItems,
  getEstadoMaquinaLabel,
  getGeometriaTrabajoMaquinaLabel,
  tipoPerfilOperativoMaquinaItems,
  type Maquina,
  type MaquinaConsumible,
  type MaquinaPayload,
  type MaquinariaTemplateDefinition,
  type MaquinariaTemplateField,
  type MaquinariaTemplateOption,
  type PlantillaMaquinaria,
  type TipoConsumibleMaquina,
  type UnidadConsumoMaquina,
} from "@/lib/maquinaria";
import {
  getMaquinariaTemplate,
  getPlantillaMaquinariaLabel,
  maquinariaTemplates,
} from "@/lib/maquinaria-templates";
import { getMateriasPrimas } from "@/lib/materias-primas-api";
import type { MateriaPrima, MateriaPrimaVariante } from "@/lib/materias-primas";
import { LabelConTooltip } from "@/components/ui/label-con-tooltip";

// ─── Props ──────────────────────────────────────────────────────────

type MaquinariaPanelProps = {
  initialMaquinas: Maquina[];
  plantas: Planta[];
  centrosCosto: CentroCosto[];
  initialEditingId?: string;
  initialCreate?: boolean;
};

// ─── Helpers de form ───────────────────────────────────────────────

type LocalPerfil = NonNullable<MaquinaPayload["perfilesOperativos"]>[number] & {
  uiKey: string;
};

type ConsumibleCanal = "cian" | "magenta" | "amarillo" | "negro" | "blanco" | "barniz";

const PRINTER_TEMPLATES_WITH_CONSUMIBLES = new Set<PlantillaMaquinaria>([
  "impresora_laser",
  "impresora_gran_formato_por_area",
  "plotter_cad",
]);

const CANAL_META: Record<
  ConsumibleCanal,
  { label: string; short: string; swatch: string }
> = {
  cian: { label: "Cian", short: "C", swatch: "#00a3d7" },
  magenta: { label: "Magenta", short: "M", swatch: "#d1007f" },
  amarillo: { label: "Amarillo", short: "Y", swatch: "#f3c900" },
  negro: { label: "Negro", short: "K", swatch: "#111827" },
  blanco: { label: "Blanco", short: "W", swatch: "#ffffff" },
  barniz: { label: "Barniz", short: "V", swatch: "#c7b58a" },
};

function normalizeCanal(value: unknown): ConsumibleCanal | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  const aliases: Record<string, ConsumibleCanal> = {
    c: "cian",
    cyan: "cian",
    cian: "cian",
    m: "magenta",
    magenta: "magenta",
    y: "amarillo",
    yellow: "amarillo",
    amarillo: "amarillo",
    k: "negro",
    black: "negro",
    negro: "negro",
    w: "blanco",
    white: "blanco",
    blanco: "blanco",
    v: "barniz",
    varnish: "barniz",
    barniz: "barniz",
  };
  return aliases[normalized] ?? null;
}

function requiredChannelsFromColorMode(rawMode: unknown): ConsumibleCanal[] {
  if (Array.isArray(rawMode)) {
    return Array.from(
      new Set(
        rawMode.flatMap((item) => {
          const fromMode = requiredChannelsFromColorMode(item);
          if (fromMode.length > 0) return fromMode;
          const channel = normalizeCanal(item);
          return channel ? [channel] : [];
        }),
      ),
    );
  }
  if (typeof rawMode !== "string") return [];
  const normalized = rawMode
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/W/g, "BLANCO");
  if (!normalized) return [];
  if (["BN", "B/N", "NEGRO", "K"].includes(normalized)) return ["negro"];
  const channels: ConsumibleCanal[] = [];
  if (normalized.includes("CMYK")) channels.push("cian", "magenta", "amarillo", "negro");
  if (normalized.includes("BLANCO")) channels.push("blanco");
  if (normalized.includes("BARNIZ") || normalized.includes("VARNISH")) channels.push("barniz");
  return Array.from(new Set(channels));
}

function requiredChannelsForPerfil(
  perfil: LocalPerfil,
  parametrosTecnicos: Record<string, unknown> | undefined,
): ConsumibleCanal[] {
  const detalle = (perfil.detalle ?? {}) as Record<string, unknown>;
  const byPerfil = requiredChannelsFromColorMode(detalle.colores ?? detalle.modoColor);
  if (byPerfil.length > 0) return byPerfil;
  const byMachine = requiredChannelsFromColorMode(
    parametrosTecnicos?.coloresSoportados ??
      parametrosTecnicos?.configuracionColor ??
      parametrosTecnicos?.configuracionCanales,
  );
  return byMachine.length > 0 ? byMachine : [];
}

function requiredChannelsForLaserMachine(
  form: MaquinaPayload,
  perfiles: LocalPerfil[],
): ConsumibleCanal[] {
  const parametrosTecnicos = (form.parametrosTecnicos ?? {}) as Record<
    string,
    unknown
  >;
  const byMachine = requiredChannelsFromColorMode(
    parametrosTecnicos.coloresSoportados ??
      parametrosTecnicos.configuracionColor ??
      parametrosTecnicos.configuracionCanales,
  );
  if (byMachine.length > 0) return byMachine;
  return Array.from(
    new Set(
      perfiles.flatMap((perfil) =>
        requiredChannelsForPerfil(perfil, parametrosTecnicos),
      ),
    ),
  );
}

function canalFromConsumible(consumible: Pick<MaquinaConsumible, "detalle"> | MaquinaPayload["consumibles"][number]) {
  const detalle = (consumible.detalle ?? {}) as Record<string, unknown>;
  return normalizeCanal(detalle.color ?? detalle.canal);
}

function consumibleTipoFor(plantilla: PlantillaMaquinaria, canal: ConsumibleCanal): TipoConsumibleMaquina {
  if (canal === "barniz") return "barniz";
  return plantilla === "impresora_laser" ? "toner" : "tinta";
}

function consumibleUnidadFor(plantilla: PlantillaMaquinaria): UnidadConsumoMaquina {
  return plantilla === "impresora_laser" ? "gramo" : "ml";
}

function cloneRecord(value: Record<string, unknown> | undefined | null) {
  return value ? (structuredClone(value) as Record<string, unknown>) : undefined;
}

function defaultConsumoBase(plantilla: PlantillaMaquinaria, canal: ConsumibleCanal) {
  if (plantilla === "impresora_laser") return 1.73;
  if (canal === "blanco") return 5;
  if (canal === "barniz") return 3;
  return 8;
}

function emptyMaquina(plantaId: string): MaquinaPayload {
  return {
    nombre: "",
    plantilla: "impresora_laser",
    plantaId,
    estado: "activa",
    geometriaTrabajo: "pliego",
    unidadProduccionPrincipal: "ppm",
    activo: true,
    perfilesOperativos: [],
    consumibles: [],
    componentesDesgaste: [],
    parametrosTecnicos: {},
  };
}

function maquinaToPayload(maquina: Maquina): MaquinaPayload {
  return {
    codigo: maquina.codigo,
    nombre: maquina.nombre,
    plantilla: maquina.plantilla,
    plantillaVersion: maquina.plantillaVersion,
    fabricante: maquina.fabricante || undefined,
    modelo: maquina.modelo || undefined,
    numeroSerie: maquina.numeroSerie || undefined,
    plantaId: maquina.plantaId,
    centroCostoPrincipalId: maquina.centroCostoPrincipalId || undefined,
    estado: maquina.estado,
    estadoConfiguracion: maquina.estadoConfiguracion,
    geometriaTrabajo: maquina.geometriaTrabajo,
    unidadProduccionPrincipal: maquina.unidadProduccionPrincipal,
    anchoUtil: maquina.anchoUtil ?? undefined,
    largoUtil: maquina.largoUtil ?? undefined,
    altoUtil: maquina.altoUtil ?? undefined,
    espesorMaximo: maquina.espesorMaximo ?? undefined,
    pesoMaximo: maquina.pesoMaximo ?? undefined,
    activo: maquina.activo,
    observaciones: maquina.observaciones || undefined,
    parametrosTecnicos: (maquina.parametrosTecnicos as Record<string, unknown> | null) ?? {},
    perfilesOperativos: maquina.perfilesOperativos.map((p) => ({
      id: p.id,
      nombre: p.nombre,
      tipoPerfil: p.tipoPerfil,
      activo: p.activo,
      productivityValue: p.productivityValue ?? undefined,
      productivityUnit: p.productivityUnit || undefined,
      setupMin: p.setupMin ?? undefined,
      cleanupMin: p.cleanupMin ?? undefined,
      feedReloadMin: p.feedReloadMin ?? undefined,
      detalle: p.detalle ?? undefined,
      reglaSeleccionJson: p.reglaSeleccionJson ?? undefined,
    })),
    consumibles: maquina.consumibles.map((c) => ({
      id: c.id,
      materiaPrimaVarianteId: c.materiaPrimaVarianteId,
      nombre: c.nombre,
      tipo: c.tipo,
      unidad: c.unidad,
      rendimientoEstimado: c.rendimientoEstimado ?? undefined,
      consumoBase: c.consumoBase ?? undefined,
      perfilOperativoId: c.perfilOperativoId ?? undefined,
      perfilOperativoNombre: c.perfilOperativoNombre || undefined,
      activo: c.activo,
      detalle: c.detalle ?? undefined,
      observaciones: c.observaciones || undefined,
    })),
    componentesDesgaste: maquina.componentesDesgaste.map((d) => ({
      id: d.id,
      materiaPrimaVarianteId: d.materiaPrimaVarianteId,
      nombre: d.nombre,
      tipo: d.tipo,
      vidaUtilEstimada: d.vidaUtilEstimada ?? undefined,
      unidadDesgaste: d.unidadDesgaste,
      activo: d.activo,
      detalle: d.detalle ?? undefined,
      observaciones: d.observaciones || undefined,
    })),
  };
}

// ─── Helpers para campos genéricos ──────────────────────────────────

const MAQUINA_DIRECT_FIELDS = new Set([
  "anchoUtil",
  "largoUtil",
  "altoUtil",
  "espesorMaximo",
  "pesoMaximo",
  "gramajeMaxGr",
]);

function getMaquinaFieldValue(form: MaquinaPayload, key: string): unknown {
  if (MAQUINA_DIRECT_FIELDS.has(key)) {
    return (form as unknown as Record<string, unknown>)[key];
  }
  return (form.parametrosTecnicos ?? {})[key];
}

function setMaquinaFieldValue(form: MaquinaPayload, key: string, value: unknown): MaquinaPayload {
  if (MAQUINA_DIRECT_FIELDS.has(key)) {
    return { ...form, [key]: value } as MaquinaPayload;
  }
  return {
    ...form,
    parametrosTecnicos: { ...(form.parametrosTecnicos ?? {}), [key]: value },
  };
}

const PERFIL_DIRECT_FIELDS = new Set([
  "nombre",
  "tipoPerfil",
  "activo",
  "productivityValue",
  "productivityUnit",
  "setupMin",
  "cleanupMin",
  "feedReloadMin",
]);

function getPerfilFieldValue(perfil: LocalPerfil, key: string): unknown {
  if (PERFIL_DIRECT_FIELDS.has(key)) {
    return (perfil as unknown as Record<string, unknown>)[key];
  }
  return (perfil.detalle ?? {})[key];
}

function setPerfilFieldValue(perfil: LocalPerfil, key: string, value: unknown): LocalPerfil {
  if (PERFIL_DIRECT_FIELDS.has(key)) {
    return { ...perfil, [key]: value } as LocalPerfil;
  }
  return { ...perfil, detalle: { ...(perfil.detalle ?? {}), [key]: value } };
}

function SelectDisplay({
  label,
  placeholder = "Elegí",
}: {
  label?: string | null;
  placeholder?: string;
}) {
  return (
    <span className={label ? "flex flex-1 truncate text-left" : "flex flex-1 truncate text-left text-muted-foreground"}>
      {label || placeholder}
    </span>
  );
}

function getOptionLabel(options: MaquinariaTemplateOption[] | undefined, value: unknown) {
  if (typeof value !== "string") return "";
  return options?.find((optionItem) => optionItem.value === value)?.label ?? value;
}

function getSelectedLabels(options: MaquinariaTemplateOption[] | undefined, value: unknown) {
  if (!Array.isArray(value)) return "";
  return value
    .map((item) => getOptionLabel(options, item))
    .filter(Boolean)
    .join(", ");
}

function getGranFormatoGeometria(form: MaquinaPayload) {
  const value = (form.parametrosTecnicos ?? {}).geometria;
  return typeof value === "string" ? value : "";
}

function shouldShowMaquinaField(field: MaquinariaTemplateField, form: MaquinaPayload) {
  if (form.plantilla !== "impresora_gran_formato_por_area") return true;
  const geometria = getGranFormatoGeometria(form);
  const mesaOnly = new Set(["largoUtil", "anchoMesaMm", "largoMesaMm", "alturaMaxCabezalMm"]);
  const rolloOnly = new Set(["anchoMinRolloMm", "anchoMaxRolloMm"]);
  if (mesaOnly.has(field.key)) return geometria === "MESA_EXTENSORA";
  if (rolloOnly.has(field.key)) return geometria === "" || geometria === "ROLLO";
  return true;
}

function shouldShowPerfilField(
  field: MaquinariaTemplateField,
  form: MaquinaPayload,
  perfil?: MaquinaPayload["perfilesOperativos"][number],
) {
  if (form.plantilla !== "impresora_gran_formato_por_area") return true;
  const corteFieldKeys = new Set(["tipoCorte", "factorComplejidad"]);
  const impresionFieldKeys = new Set(["numeroPasadas", "colores", "modoCalidad"]);
  const isCorte = perfil?.tipoPerfil === "corte";
  const isMixto = perfil?.tipoPerfil === "mixto";

  if (corteFieldKeys.has(field.key)) return isCorte || isMixto;
  if (impresionFieldKeys.has(field.key)) return !isCorte || isMixto;
  if (field.key !== "modoOperacion") return true;
  if (isCorte || isMixto) return true;
  return getGranFormatoGeometria(form) === "MESA_EXTENSORA";
}

function cleanGranFormatoGeometryFields(form: MaquinaPayload, nextGeometria: unknown): MaquinaPayload {
  if (form.plantilla !== "impresora_gran_formato_por_area") return form;
  if (nextGeometria !== "ROLLO" && nextGeometria !== "MESA_EXTENSORA") return form;
  const parametrosTecnicos = { ...(form.parametrosTecnicos ?? {}) };
  if (nextGeometria === "ROLLO") {
    delete parametrosTecnicos.anchoMesaMm;
    delete parametrosTecnicos.largoMesaMm;
    delete parametrosTecnicos.alturaMaxCabezalMm;
    return {
      ...form,
      geometriaTrabajo: "rollo",
      largoUtil: undefined,
      parametrosTecnicos,
      perfilesOperativos: form.perfilesOperativos,
    };
  }
  delete parametrosTecnicos.anchoMinRolloMm;
  delete parametrosTecnicos.anchoMaxRolloMm;
  return { ...form, geometriaTrabajo: "plano", parametrosTecnicos };
}

const STRUCTURED_MARGIN_FIELDS = new Set(["margenesNoImprimiblesMm", "margenesDesperdicioMm"]);

const marginFieldDefinitions: Record<
  string,
  Array<{ key: string; label: string }>
> = {
  margenesNoImprimiblesMm: [
    { key: "sup", label: "Superior" },
    { key: "inf", label: "Inferior" },
    { key: "izq", label: "Izquierdo" },
    { key: "der", label: "Derecho" },
  ],
  margenesDesperdicioMm: [
    { key: "inicio", label: "Inicio" },
    { key: "fin", label: "Fin" },
    { key: "izquierdo", label: "Izquierdo" },
    { key: "derecho", label: "Derecho" },
  ],
};

function normalizeMarginValue(value: unknown): Record<string, number | undefined> {
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, number | undefined>;
      }
    } catch {
      return {};
    }
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, number | undefined>;
  }
  return {};
}

function getFriendlyFieldDescription(field: MaquinariaTemplateField) {
  if (field.key === "margenesNoImprimiblesMm") {
    return "Distancia que la máquina no puede imprimir en cada borde.";
  }
  if (field.key === "margenesDesperdicioMm") {
    return "Material reservado como desperdicio al iniciar, terminar o en los laterales.";
  }
  return field.description;
}

// ─── Renderer genérico de un campo del template ────────────────────

interface FieldInputProps {
  field: MaquinariaTemplateField;
  value: unknown;
  onChange: (value: unknown) => void;
}

function FieldInput({ field, value, onChange }: FieldInputProps) {
  const id = `field-${field.scope}-${field.key}`;

  if (STRUCTURED_MARGIN_FIELDS.has(field.key)) {
    const current = normalizeMarginValue(value);
    const definitions = marginFieldDefinitions[field.key] ?? [];
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {definitions.map((definition) => (
          <div key={definition.key} className="min-w-0 space-y-1">
            <Label htmlFor={`${id}-${definition.key}`} className="text-xs">
              {definition.label}
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id={`${id}-${definition.key}`}
                type="number"
                inputMode="decimal"
                min={0}
                value={
                  typeof current[definition.key] === "number"
                    ? current[definition.key]
                    : current[definition.key]
                      ? Number(current[definition.key])
                      : ""
                }
                onChange={(event) => {
                  const nextValue = event.target.value;
                  onChange({
                    ...current,
                    [definition.key]: nextValue === "" ? undefined : Number(nextValue),
                  });
                }}
              />
              <span className="text-muted-foreground text-xs">mm</span>
            </div>
          </div>
        ))}
      </div>
    );
  }

  switch (field.kind) {
    case "text":
      return (
        <Input
          id={id}
          value={typeof value === "string" ? value : ""}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case "textarea":
      return (
        <Textarea
          id={id}
          rows={3}
          value={
            typeof value === "string"
              ? value
              : value !== undefined && value !== null
                ? JSON.stringify(value, null, 2)
                : ""
          }
          placeholder={field.placeholder}
          onChange={(e) => {
            const raw = e.target.value;
            try {
              onChange(JSON.parse(raw));
            } catch {
              onChange(raw);
            }
          }}
        />
      );

    case "number":
      return (
        <div className="flex items-center gap-2">
          <Input
            id={id}
            type="number"
            inputMode="decimal"
            value={typeof value === "number" ? value : value ? Number(value) : ""}
            placeholder={field.placeholder}
            onChange={(e) => {
              const v = e.target.value;
              onChange(v === "" ? undefined : Number(v));
            }}
          />
          {field.unit && (
            <span className="text-muted-foreground text-xs">{field.unit}</span>
          )}
        </div>
      );

    case "boolean":
      return (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => onChange(e.target.checked)}
          />
          <span>Sí</span>
        </label>
      );

    case "select":
      return (
        <Select
          value={typeof value === "string" ? value : ""}
          onValueChange={(v) => onChange(v ?? "")}
        >
          <SelectTrigger id={id} className="w-full min-w-0">
            <SelectDisplay label={getOptionLabel(field.options, value)} />
          </SelectTrigger>
          <SelectContent>
            {field.options?.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );

    case "multiselect": {
      const current = Array.isArray(value)
        ? (value as string[])
        : typeof value === "string" && value
          ? [value]
          : [];
      return (
        <div className="flex flex-col gap-1.5">
          {current.length > 0 && (
            <p className="text-muted-foreground text-xs">
              Seleccionado: {getSelectedLabels(field.options, current)}
            </p>
          )}
          {field.options?.map((opt) => (
            <label key={opt.value} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={current.includes(opt.value)}
                onChange={(e) => {
                  const next = e.target.checked
                    ? [...current, opt.value]
                    : current.filter((v) => v !== opt.value);
                  onChange(next);
                }}
              />
              <span>{opt.label}</span>
            </label>
          ))}
        </div>
      );
    }
  }
}

// ─── Componente principal ──────────────────────────────────────────

export function MaquinariaPanel({
  initialMaquinas,
  plantas,
  centrosCosto,
  initialEditingId,
  initialCreate = false,
}: MaquinariaPanelProps) {
  const router = useRouter();
  const [maquinas, setMaquinas] = React.useState(initialMaquinas);
  const [isSheetOpen, setIsSheetOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<MaquinaPayload>(() =>
    emptyMaquina(plantas[0]?.id ?? ""),
  );
  const [perfiles, setPerfiles] = React.useState<LocalPerfil[]>([]);
  const [filterText, setFilterText] = React.useState("");
  const [filterPlantilla, setFilterPlantilla] = React.useState<PlantillaMaquinaria | "all">("all");
  const [saving, setSaving] = React.useState(false);
  const [openSection, setOpenSection] = React.useState<string | null>("capacidades_fisicas");
  const [materiasPrimas, setMateriasPrimas] = React.useState<MateriaPrima[]>([]);
  const [loadingMaterias, setLoadingMaterias] = React.useState(false);

  const template: MaquinariaTemplateDefinition | null = React.useMemo(
    () => getMaquinariaTemplate(form.plantilla),
    [form.plantilla],
  );

  React.useEffect(() => {
    if (!isSheetOpen || materiasPrimas.length > 0 || loadingMaterias) return;
    setLoadingMaterias(true);
    getMateriasPrimas()
      .then(setMateriasPrimas)
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : "No se pudieron cargar materias primas");
      })
      .finally(() => setLoadingMaterias(false));
  }, [isSheetOpen, loadingMaterias, materiasPrimas.length]);

  // Filtros aplicados
  const filteredMaquinas = React.useMemo(() => {
    let result = maquinas;
    if (filterText) {
      const q = filterText.toLowerCase();
      result = result.filter(
        (m) =>
          m.nombre.toLowerCase().includes(q) ||
          m.codigo.toLowerCase().includes(q),
      );
    }
    if (filterPlantilla !== "all") {
      result = result.filter((m) => m.plantilla === filterPlantilla);
    }
    return result;
  }, [maquinas, filterText, filterPlantilla]);

  const openNueva = React.useCallback(() => {
    setEditingId(null);
    setForm(emptyMaquina(plantas[0]?.id ?? ""));
    setPerfiles([]);
    setOpenSection("capacidades_fisicas");
    setIsSheetOpen(true);
  }, [plantas]);

  const openEditar = React.useCallback((maquina: Maquina) => {
    setEditingId(maquina.id);
    const payload = maquinaToPayload(maquina);
    setForm(payload);
    setPerfiles(
      payload.perfilesOperativos.map((p, i) => ({
        ...p,
        uiKey: `p-${i}-${Date.now()}`,
      })),
    );
    setOpenSection("capacidades_fisicas");
    setIsSheetOpen(true);
  }, []);

  const updateMaquinariaUrl = React.useCallback((path: string) => {
    window.history.pushState(null, "", path);
  }, []);

  React.useEffect(() => {
    if (initialCreate) {
      openNueva();
      return;
    }
    if (initialEditingId) {
      const maquina = maquinas.find((item) => item.id === initialEditingId);
      if (maquina) openEditar(maquina);
    }
  }, [initialCreate, initialEditingId, maquinas, openEditar, openNueva]);

  const handleNueva = () => {
    openNueva();
    updateMaquinariaUrl("/costos/maquinaria/nueva");
  };

  const handleEditar = (maquina: Maquina) => {
    openEditar(maquina);
    updateMaquinariaUrl(`/costos/maquinaria/${maquina.id}`);
  };

  const handlePlantillaChange = (newPlantilla: PlantillaMaquinaria) => {
    const newTemplate = getMaquinariaTemplate(newPlantilla);
    setForm((prev) => ({
      ...prev,
      plantilla: newPlantilla,
      geometriaTrabajo: newTemplate?.geometry ?? prev.geometriaTrabajo,
      unidadProduccionPrincipal:
        newTemplate?.defaultProductionUnit ?? prev.unidadProduccionPrincipal,
      // Reset paramsTecnicos al cambiar plantilla (el shape es distinto).
      parametrosTecnicos: {},
      consumibles: [],
    }));
    setPerfiles([]); // los perfiles también dependen del template
  };

  const handleMaquinaFieldChange = (field: MaquinariaTemplateField, value: unknown) => {
    setForm((current) => {
      const next = setMaquinaFieldValue(current, field.key, value);
      return field.key === "geometria" ? cleanGranFormatoGeometryFields(next, value) : next;
    });
    if (field.key === "geometria" && value !== "MESA_EXTENSORA") {
      setPerfiles((current) =>
        current.map((perfil) => {
          const detalle = { ...(perfil.detalle ?? {}) };
          delete detalle.modoOperacion;
          return { ...perfil, detalle };
        }),
      );
    }
  };

  const handleAgregarPerfil = () => {
    setPerfiles((prev) => [
      ...prev,
      {
        uiKey: `p-${Date.now()}-${Math.random()}`,
        id: crypto.randomUUID(),
        nombre: "Nuevo perfil",
        tipoPerfil: "impresion",
        activo: true,
        detalle: {},
      },
    ]);
  };

  const handleEliminarPerfil = (uiKey: string) => {
    setPerfiles((prev) => {
      const perfil = prev.find((p) => p.uiKey === uiKey);
      if (perfil?.id) {
        setForm((current) => ({
          ...current,
          consumibles: current.consumibles.filter(
            (consumible) => consumible.perfilOperativoId !== perfil.id,
          ),
        }));
      }
      return prev.filter((p) => p.uiKey !== uiKey);
    });
  };

  const handleDuplicarPerfil = (uiKey: string) => {
    const source = perfiles.find((perfil) => perfil.uiKey === uiKey);
    if (!source) return;

    const newProfileId = crypto.randomUUID();
    const duplicateName = `${source.nombre || "Perfil"} copia`;
    const duplicatedPerfil: LocalPerfil = {
      ...source,
      uiKey: `p-${Date.now()}-${Math.random()}`,
      id: newProfileId,
      nombre: duplicateName,
      detalle: cloneRecord(source.detalle) ?? {},
      reglaSeleccionJson: cloneRecord(source.reglaSeleccionJson),
    };

    setPerfiles((prev) => {
      const sourceIndex = prev.findIndex((perfil) => perfil.uiKey === uiKey);
      const next = [...prev];
      next.splice(sourceIndex + 1, 0, duplicatedPerfil);
      return next;
    });

    if (source.id) {
      setForm((current) => ({
        ...current,
        consumibles: [
          ...current.consumibles,
          ...current.consumibles
            .filter((consumible) => consumible.perfilOperativoId === source.id)
            .map((consumible) => ({
              ...consumible,
              id: crypto.randomUUID(),
              perfilOperativoId: newProfileId,
              perfilOperativoNombre: duplicateName,
              nombre: consumible.nombre
                ? `${consumible.nombre} copia`
                : consumible.nombre,
              detalle: cloneRecord(consumible.detalle),
            })),
        ],
      }));
    }
  };

  const handleGuardar = async () => {
    if (!form.nombre.trim()) {
      toast.error("La máquina necesita un nombre");
      return;
    }
    setSaving(true);
    try {
      const perfilesOperativos = perfiles.map((perfil) => {
        const payloadPerfil: Partial<LocalPerfil> = { ...perfil };
        delete payloadPerfil.uiKey;
        return payloadPerfil as NonNullable<MaquinaPayload["perfilesOperativos"]>[number];
      });
      const payload: MaquinaPayload = {
        ...form,
        perfilesOperativos,
      };
      if (editingId) {
        const updated = await updateMaquina(editingId, payload);
        setMaquinas((prev) => prev.map((m) => (m.id === editingId ? updated : m)));
        toast.success(`"${updated.nombre}" actualizada`);
      } else {
        const created = await createMaquina(payload);
        setMaquinas((prev) => [...prev, created]);
        toast.success(`"${created.nombre}" creada`);
      }
      setIsSheetOpen(false);
      updateMaquinariaUrl("/costos/maquinaria");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error guardando");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (maquina: Maquina) => {
    try {
      const updated = await toggleMaquina(maquina.id);
      setMaquinas((prev) => prev.map((m) => (m.id === maquina.id ? updated : m)));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    }
  };

  const handleDesactivar = async (maquina: Maquina) => {
    if (!confirm(`¿Desactivar "${maquina.nombre}"? (no se elimina, queda inactiva)`)) return;
    try {
      const updated = await toggleMaquina(maquina.id);
      setMaquinas((prev) => prev.map((m) => (m.id === maquina.id ? updated : m)));
      toast.success("Máquina desactivada");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    }
  };

  return (
    <div className="content">
      <div className="page-head">
        <div className="title-block">
          <h1>Maquinaria</h1>
          <div className="sub">
            Catálogo de máquinas + perfiles operativos. Modelo v3.0 alineado a doc §5-§13.
          </div>
        </div>
        <button type="button" className="btn btn-primary" onClick={handleNueva}>
          <PlusIcon size={14} />
          Nueva máquina
        </button>
      </div>

      <div className="card mb-[14px]">
        <div className="grid grid-cols-1 gap-3 p-4 md:grid-cols-[1fr_220px]">
          <div className="field">
            <label htmlFor="filter-text">Buscar</label>
            <input
              id="filter-text"
              placeholder="Nombre o código..."
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="filter-plantilla">Plantilla</label>
            <select
              id="filter-plantilla"
              className="select w-full"
              value={filterPlantilla}
              onChange={(event) => setFilterPlantilla(event.target.value as PlantillaMaquinaria | "all")}
            >
              <option value="all">Todas</option>
              {maquinariaTemplates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <span className="title">Máquinas</span>
          <span className="count">{filteredMaquinas.length}</span>
        </div>
          {filteredMaquinas.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-sm italic">
              Sin máquinas todavía.
            </p>
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th style={{ width: 36 }}></th>
                  <th>Nombre</th>
                  <th style={{ width: 260 }}>Plantilla</th>
                  <th style={{ width: 110 }}>Estado</th>
                  <th className="right" style={{ width: 90 }}>Perfiles</th>
                  <th className="right" style={{ width: 130 }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredMaquinas.map((m) => (
                  <tr key={m.id} onClick={() => handleEditar(m)}>
                    <td>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleToggle(m);
                        }}
                      >
                        {m.activo ? (
                          <span className="ok-pill"><CheckCircle2Icon size={12} /></span>
                        ) : (
                          <CircleIcon size={14} className="text-[var(--muted-text)]" />
                        )}
                      </button>
                    </td>
                    <td className="name">{m.nombre}</td>
                    <td><span className="tag">{getPlantillaMaquinariaLabel(m.plantilla)}</span></td>
                    <td>
                      <span className={m.estado === "activa" ? "tag ok" : "tag muted"} title={`código: ${m.estado}`}>
                        <span className="d" />
                        {getEstadoMaquinaLabel(m.estado)}
                      </span>
                    </td>
                    <td className="right">
                      {m.perfilesOperativos.length}
                    </td>
                    <td className="right">
                      <span className="inline-flex gap-1.5">
                        <button
                          type="button"
                          className="btn h-7 px-2.5 text-[12px]"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleEditar(m);
                          }}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          className="icon-btn"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleDesactivar(m);
                          }}
                          title="Desactivar"
                        >
                          <Trash2Icon size={14} />
                        </button>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </div>

      {/* Sheet editor */}
      <Sheet
        open={isSheetOpen}
        onOpenChange={(open) => {
          setIsSheetOpen(open);
          if (!open) {
            updateMaquinariaUrl("/costos/maquinaria");
          }
        }}
      >
        <SheetContent className="w-full overflow-y-auto sm:!w-[min(92vw,56rem)] sm:!max-w-4xl">
          <SheetHeader>
            <SheetTitle>{editingId ? "Editar máquina" : "Nueva máquina"}</SheetTitle>
            <SheetDescription>
              Completá los campos según la plantilla elegida. Los discriminantes
              específicos se editan en cada perfil operativo.
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-4 p-4 md:p-6">
            {/* Identidad */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Identidad</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="min-w-0 space-y-1">
                    <Label htmlFor="codigo">Código</Label>
                    <Input
                      id="codigo"
                      value={form.codigo ?? ""}
                      placeholder="auto"
                      onChange={(e) => setForm({ ...form, codigo: e.target.value })}
                    />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <Label htmlFor="nombre">Nombre *</Label>
                    <Input
                      id="nombre"
                      value={form.nombre}
                      onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                    />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <LabelConTooltip
                      label="Plantilla"
                      required
                      tooltip="Tipo de máquina (define qué campos pide y qué familias puede ejecutar). Ej: impresora láser, plotter eco-solvente, guillotina, plegadora."
                    />
                    <Select
                      value={form.plantilla}
                      onValueChange={(v) => handlePlantillaChange((v ?? "impresora_laser") as PlantillaMaquinaria)}
                    >
                      <SelectTrigger className="w-full min-w-0">
                        <SelectDisplay label={getPlantillaMaquinariaLabel(form.plantilla)} />
                      </SelectTrigger>
                      <SelectContent>
                        {maquinariaTemplates.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="min-w-0 space-y-1">
                    <Label>Estado</Label>
                    <Select
                      value={form.estado}
                      onValueChange={(v) =>
                        setForm({
                          ...form,
                          estado: (v ?? "activa") as MaquinaPayload["estado"],
                        })
                      }
                    >
                      <SelectTrigger className="w-full min-w-0">
                        <SelectDisplay label={getEstadoMaquinaLabel(form.estado)} />
                      </SelectTrigger>
                      <SelectContent>
                        {estadoMaquinaItems.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="min-w-0 space-y-1">
                    <Label>Planta</Label>
                    <Select
                      value={form.plantaId}
                      onValueChange={(v) => setForm({ ...form, plantaId: v ?? "" })}
                    >
                      <SelectTrigger className="w-full min-w-0">
                        <SelectDisplay
                          label={plantas.find((planta) => planta.id === form.plantaId)?.nombre}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {plantas.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="min-w-0 space-y-1">
                    <Label>Centro de costo</Label>
                    <Select
                      value={form.centroCostoPrincipalId ?? ""}
                      onValueChange={(v) =>
                        setForm({ ...form, centroCostoPrincipalId: v || undefined })
                      }
                    >
                      <SelectTrigger className="w-full min-w-0">
                        <SelectDisplay
                          label={
                            centrosCosto.find(
                              (centroCosto) => centroCosto.id === form.centroCostoPrincipalId,
                            )?.nombre
                          }
                          placeholder="Sin asignar"
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {centrosCosto.map((cc) => (
                          <SelectItem key={cc.id} value={cc.id}>
                            {cc.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="min-w-0 space-y-1">
                    <LabelConTooltip
                      label="Geometría de trabajo"
                      tooltip="Forma del sustrato sobre el que opera la máquina. Pliego = hojas precortadas; Rollo = bobina continua; Plano/Cilindrico/Volumen = piezas tridimensionales."
                    />
                    <Select
                      value={form.geometriaTrabajo}
                      onValueChange={(v) =>
                        setForm({
                          ...form,
                          geometriaTrabajo: (v ?? "pliego") as MaquinaPayload["geometriaTrabajo"],
                        })
                      }
                    >
                      <SelectTrigger className="w-full min-w-0">
                        <SelectDisplay label={getGeometriaTrabajoMaquinaLabel(form.geometriaTrabajo)} />
                      </SelectTrigger>
                      <SelectContent>
                        {geometriaTrabajoMaquinaItems.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Secciones del template */}
            {template?.sections.map((sec) => (
              <Card key={sec.id}>
                <button
                  type="button"
                  onClick={() => setOpenSection(openSection === sec.id ? null : sec.id)}
                  className="w-full text-left"
                >
                  <CardHeader className="cursor-pointer">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2 text-base">
                          {openSection === sec.id ? (
                            <ChevronDownIcon className="size-4" />
                          ) : (
                            <ChevronRightIcon className="size-4" />
                          )}
                          {sec.title}
                        </CardTitle>
                        <CardDescription className="ml-6 text-xs">
                          {sec.description}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                </button>
                {openSection === sec.id && (
                  <CardContent className="space-y-3">
                    {sec.id === "perfiles_operativos" ? (
                      <PerfilesOperativosEditor
                        perfiles={perfiles}
                        setPerfiles={setPerfiles}
                        sectionFields={sec.fields}
                        form={form}
                        onAgregar={handleAgregarPerfil}
                        onEliminar={handleEliminarPerfil}
                        onDuplicar={handleDuplicarPerfil}
                      />
                    ) : sec.id === "consumibles" || sec.id === "desgaste_repuestos" ? (
                      sec.id === "consumibles" ? (
                        <ConsumiblesImpresionEditor
                          form={form}
                          setForm={setForm}
                          perfiles={perfiles}
                          materiasPrimas={materiasPrimas}
                          loadingMaterias={loadingMaterias}
                        />
                      ) : (
                        <p className="text-muted-foreground text-xs italic">
                          Editor de desgaste simplificado: editá vía API por ahora.
                          UI rica pendiente de iteración UX.
                        </p>
                      )
                    ) : (
                      sec.fields.filter((field) => shouldShowMaquinaField(field, form)).map((field) => (
                        <div key={field.key} className="space-y-1">
                          <Label htmlFor={`field-${field.scope}-${field.key}`} className="text-sm">
                            {field.label}
                            {field.required && <span className="text-destructive"> *</span>}
                          </Label>
                          <FieldInput
                            field={field}
                            value={getMaquinaFieldValue(form, field.key)}
                            onChange={(v) => handleMaquinaFieldChange(field, v)}
                          />
                          {getFriendlyFieldDescription(field) && (
                            <p className="text-muted-foreground text-xs">
                              {getFriendlyFieldDescription(field)}
                            </p>
                          )}
                        </div>
                      ))
                    )}
                  </CardContent>
                )}
              </Card>
            ))}

            {/* Botones */}
            <div className="sticky bottom-0 flex justify-end gap-2 border-t bg-background p-4">
              <Button variant="outline" onClick={() => setIsSheetOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleGuardar} disabled={saving}>
                {saving ? "Guardando..." : editingId ? "Actualizar" : "Crear"}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ─── Sub-componente: editor de consumibles de impresión ────────────

interface ConsumiblesImpresionProps {
  form: MaquinaPayload;
  setForm: React.Dispatch<React.SetStateAction<MaquinaPayload>>;
  perfiles: LocalPerfil[];
  materiasPrimas: MateriaPrima[];
  loadingMaterias: boolean;
}

function ConsumiblesImpresionEditor({
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
        activo: existing?.activo ?? true,
        detalle: { ...(existing?.detalle ?? {}), color: canal },
        observaciones: existing?.observaciones,
        ...patch,
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
                <div key={`laser-${canal}`} className="grid grid-cols-1 gap-2 rounded-md bg-background p-2 md:grid-cols-[120px_1fr_120px_110px_80px] md:items-end">
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
                          rendimientoEstimado:
                            existing?.rendimientoEstimado ??
                            getDefaultRendimientoEstimado(variante?.variante, form.plantilla),
                        });
                      }}
                    >
                      <SelectTrigger className="h-9 w-full min-w-0">
                        <SelectDisplay
                          label={
                            selectedOption
                              ? `${selectedOption.materiaPrima.nombre} · ${selectedOption.variante.nombreVariante ?? selectedOption.variante.sku}`
                              : ""
                          }
                          placeholder="Elegir tóner"
                        />
                      </SelectTrigger>
                      <SelectContent className="max-h-80">
                        {opciones.map((item) => (
                          <SelectItem key={item.variante.id} value={item.variante.id}>
                            {item.materiaPrima.nombre} · {item.variante.nombreVariante ?? item.variante.sku}
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

                  <div className="space-y-1">
                    <Label className="text-xs">Contenido</Label>
                    <Input
                      type="number"
                      min={0}
                      step={1}
                      disabled={!existing}
                      value={existing?.rendimientoEstimado ?? ""}
                      placeholder="g"
                      onChange={(event) =>
                        upsertConsumible(null, canal, {
                          rendimientoEstimado: event.target.value === "" ? undefined : Number(event.target.value),
                        })
                      }
                    />
                  </div>

                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      disabled={!existing}
                      checked={existing?.activo ?? false}
                      onChange={(event) =>
                        upsertConsumible(null, canal, { activo: event.target.checked })
                      }
                    />
                    Activo
                  </label>
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
                  <div key={`${perfil.uiKey}-${canal}`} className="grid grid-cols-1 gap-2 rounded-md bg-background p-2 md:grid-cols-[120px_1fr_120px_110px_80px] md:items-end">
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
                            rendimientoEstimado:
                              existing?.rendimientoEstimado ??
                              getDefaultRendimientoEstimado(variante?.variante, form.plantilla),
                          });
                        }}
                      >
                        <SelectTrigger className="h-9 w-full min-w-0">
                          <SelectDisplay
                            label={
                              selectedOption
                                ? `${selectedOption.materiaPrima.nombre} · ${selectedOption.variante.nombreVariante ?? selectedOption.variante.sku}`
                                : ""
                            }
                            placeholder="Elegir consumible"
                          />
                        </SelectTrigger>
                        <SelectContent className="max-h-80">
                          {opciones.map((item) => (
                            <SelectItem key={item.variante.id} value={item.variante.id}>
                              {item.materiaPrima.nombre} · {item.variante.nombreVariante ?? item.variante.sku}
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

                    <div className="space-y-1">
                      <Label className="text-xs">Contenido</Label>
                      <Input
                        type="number"
                        min={0}
                        step={1}
                        disabled={!existing}
                        value={existing?.rendimientoEstimado ?? ""}
                        placeholder={form.plantilla === "impresora_laser" ? "g" : "ml"}
                        onChange={(event) =>
                          upsertConsumible(perfil, canal, {
                            rendimientoEstimado: event.target.value === "" ? undefined : Number(event.target.value),
                          })
                        }
                      />
                    </div>

                    <label className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        disabled={!existing}
                        checked={existing?.activo ?? false}
                        onChange={(event) =>
                          upsertConsumible(perfil, canal, { activo: event.target.checked })
                        }
                      />
                      Activo
                    </label>
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

function getDefaultRendimientoEstimado(
  variante: MateriaPrimaVariante | undefined,
  plantilla: PlantillaMaquinaria,
) {
  const attrs = variante?.atributosVariante ?? {};
  const volumen = Number(attrs.volumenMl ?? attrs.volumenPresentacion ?? 0);
  if (Number.isFinite(volumen) && volumen > 0) return volumen;
  return plantilla === "impresora_laser" ? 500 : undefined;
}

// ─── Sub-componente: editor de perfiles ────────────────────────────

interface PerfilesProps {
  perfiles: LocalPerfil[];
  setPerfiles: React.Dispatch<React.SetStateAction<LocalPerfil[]>>;
  sectionFields: MaquinariaTemplateField[];
  form: MaquinaPayload;
  onAgregar: () => void;
  onEliminar: (uiKey: string) => void;
  onDuplicar: (uiKey: string) => void;
}

function PerfilesOperativosEditor({
  perfiles,
  setPerfiles,
  sectionFields,
  form,
  onAgregar,
  onEliminar,
  onDuplicar,
}: PerfilesProps) {
  return (
    <div className="space-y-3">
      {perfiles.length === 0 ? (
        <p className="text-muted-foreground text-xs italic">Sin perfiles. Agregá al menos uno.</p>
      ) : (
        perfiles.map((perfil, idx) => (
          <Card key={perfil.uiKey} className="bg-muted/30">
            <CardHeader className="flex flex-row items-center justify-between p-3">
              <div className="flex items-center gap-2">
                <Badge>{idx + 1}</Badge>
                <span className="text-sm font-medium">
                  {perfil.nombre || "(sin nombre)"}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  onClick={() => onDuplicar(perfil.uiKey)}
                  title="Duplicar perfil"
                  aria-label={`Duplicar perfil ${perfil.nombre || idx + 1}`}
                >
                  <CopyIcon className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive size-7"
                  onClick={() => onEliminar(perfil.uiKey)}
                  title="Eliminar perfil"
                  aria-label={`Eliminar perfil ${perfil.nombre || idx + 1}`}
                >
                  <Trash2Icon className="size-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="min-w-0 space-y-1">
                <LabelConTooltip
                  label="Tipo de perfil"
                  iconSize="sm"
                  tooltip="Define qué tipo de operación ejecuta este perfil dentro de la máquina (impresión, corte, laminado, mecanizado, etc.). Una misma máquina puede tener múltiples perfiles si soporta más de un tipo."
                />
                <Select
                  value={perfil.tipoPerfil}
                  onValueChange={(v) => {
                    const next = setPerfilFieldValue(perfil, "tipoPerfil", v ?? "impresion");
                    setPerfiles((prev) =>
                      prev.map((p) => (p.uiKey === perfil.uiKey ? next : p)),
                    );
                  }}
                >
                  <SelectTrigger className="w-full min-w-0">
                    <SelectDisplay
                      label={
                        tipoPerfilOperativoMaquinaItems.find(
                          (item) => item.value === perfil.tipoPerfil,
                        )?.label
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {tipoPerfilOperativoMaquinaItems.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {sectionFields.filter((field) => shouldShowPerfilField(field, form, perfil)).map((field) => (
                <div key={field.key} className="min-w-0 space-y-1">
                  <Label
                    htmlFor={`p-${perfil.uiKey}-${field.key}`}
                    className="text-xs"
                  >
                    {field.label}
                    {field.required && <span className="text-destructive"> *</span>}
                  </Label>
                  <FieldInput
                    field={field}
                    value={getPerfilFieldValue(perfil, field.key)}
                    onChange={(v) => {
                      const next = setPerfilFieldValue(perfil, field.key, v);
                      setPerfiles((prev) =>
                        prev.map((p) => (p.uiKey === perfil.uiKey ? next : p)),
                      );
                    }}
                  />
                  {getFriendlyFieldDescription(field) && (
                    <p className="text-muted-foreground text-xs">
                      {getFriendlyFieldDescription(field)}
                    </p>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        ))
      )}
      <Button variant="outline" size="sm" onClick={onAgregar}>
        <PlusIcon className="mr-2 size-4" />
        Agregar perfil
      </Button>
    </div>
  );
}
