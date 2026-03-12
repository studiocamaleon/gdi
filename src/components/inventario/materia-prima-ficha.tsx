"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeftIcon,
  CirclePlusIcon,
  SaveIcon,
  TrashIcon,
} from "lucide-react";
import { toast } from "sonner";

import { updateMateriaPrima } from "@/lib/materias-primas-api";
import {
  familiaMateriaPrimaItems,
  unidadMateriaPrimaItems,
  type FamiliaMateriaPrima,
  type MateriaPrima,
  type MateriaPrimaPayload,
  type ModoUsoCompatibilidadMateriaPrima,
  type PlantillaMaquinaria,
  type SubfamiliaMateriaPrima,
  type UnidadMateriaPrima,
} from "@/lib/materias-primas";
import {
  SUSTRATO_HOJA_FORMATOS_PRESET,
  getMateriaPrimaTemplate,
} from "@/lib/materia-prima-templates";
import { getUnitDefinition } from "@/lib/unidades";
import type { ProveedorDetalle } from "@/lib/proveedores";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

const subfamiliaMateriaPrimaItems: Array<{ value: SubfamiliaMateriaPrima; label: string }> = [
  { value: "sustrato_hoja", label: "Sustrato hoja" },
  { value: "sustrato_rollo_flexible", label: "Sustrato rollo flexible" },
  { value: "sustrato_rigido", label: "Sustrato rígido" },
  { value: "objeto_promocional_base", label: "Objeto promocional base" },
  { value: "tinta_impresion", label: "Tinta impresión" },
  { value: "toner", label: "Tóner" },
  { value: "film_transferencia", label: "Film transferencia" },
  { value: "papel_transferencia", label: "Papel transferencia" },
  { value: "laminado_film", label: "Laminado film" },
  { value: "quimico_acabado", label: "Químico acabado" },
  { value: "auxiliar_proceso", label: "Auxiliar proceso" },
  { value: "polvo_dtf", label: "Polvo DTF" },
  { value: "filamento_3d", label: "Filamento 3D" },
  { value: "resina_3d", label: "Resina 3D" },
  { value: "modulo_led_carteleria", label: "Módulo LED cartelería" },
  { value: "fuente_alimentacion_led", label: "Fuente alimentación LED" },
  { value: "cableado_conectica", label: "Cableado y conectica" },
  { value: "controlador_led", label: "Controlador LED" },
  { value: "neon_flex_led", label: "Neón flex LED" },
  { value: "accesorio_neon_led", label: "Accesorio neón LED" },
  { value: "chapa_metalica", label: "Chapa metálica" },
  { value: "perfil_estructural", label: "Perfil estructural" },
  { value: "pintura_carteleria", label: "Pintura cartelería" },
  { value: "primer_sellador", label: "Primer sellador" },
  { value: "anillado_encuadernacion", label: "Anillado encuadernación" },
  { value: "tapa_encuadernacion", label: "Tapa encuadernación" },
  { value: "iman_ceramico_flexible", label: "Imán cerámico/flexible" },
  { value: "fijacion_auxiliar", label: "Fijación auxiliar" },
  { value: "accesorio_exhibidor_carton", label: "Accesorio exhibidor cartón" },
  { value: "accesorio_montaje_pop", label: "Accesorio montaje POP" },
  { value: "semielaborado_pop", label: "Semielaborado POP" },
  { value: "argolla_llavero_accesorio", label: "Argolla llavero accesorio" },
  { value: "ojal_ojalillo_remache", label: "Ojal/ojalillo/remache" },
  { value: "portabanner_estructura", label: "Portabanner estructura" },
  { value: "sistema_colgado_montaje", label: "Sistema colgado/montaje" },
  { value: "perfil_bastidor_textil", label: "Perfil bastidor textil" },
  { value: "cinta_doble_faz_tecnica", label: "Cinta doble faz técnica" },
  { value: "adhesivo_liquido_estructural", label: "Adhesivo líquido estructural" },
  { value: "velcro_cierre_tecnico", label: "Velcro/cierre técnico" },
  { value: "embalaje_proteccion", label: "Embalaje/protección" },
  { value: "etiquetado_identificacion", label: "Etiquetado/identificación" },
  { value: "consumible_instalacion", label: "Consumible instalación" },
];

const plantillasMaquinariaItems: Array<{ value: PlantillaMaquinaria; label: string }> = [
  { value: "router_cnc", label: "Router CNC" },
  { value: "corte_laser", label: "Corte láser" },
  { value: "impresora_3d", label: "Impresora 3D" },
  { value: "impresora_dtf", label: "Impresora DTF" },
  { value: "impresora_dtf_uv", label: "Impresora DTF UV" },
  { value: "impresora_uv_mesa_extensora", label: "UV mesa extensora" },
  { value: "impresora_uv_cilindrica", label: "UV cilíndrica" },
  { value: "impresora_uv_flatbed", label: "UV flatbed" },
  { value: "impresora_uv_rollo", label: "UV rollo" },
  { value: "impresora_solvente", label: "Impresora solvente" },
  { value: "impresora_inyeccion_tinta", label: "Inyección tinta" },
  { value: "impresora_latex", label: "Impresora latex" },
  { value: "impresora_sublimacion_gran_formato", label: "Sublimación gran formato" },
  { value: "impresora_laser", label: "Impresora láser" },
  { value: "plotter_cad", label: "Plotter CAD" },
  { value: "mesa_de_corte", label: "Mesa de corte" },
  { value: "plotter_de_corte", label: "Plotter de corte" },
];

const modoUsoItems: Array<{ value: ModoUsoCompatibilidadMateriaPrima; label: string }> = [
  { value: "sustrato_directo", label: "Sustrato directo" },
  { value: "tinta", label: "Tinta" },
  { value: "transferencia", label: "Transferencia" },
  { value: "laminacion", label: "Laminación" },
  { value: "auxiliar", label: "Auxiliar" },
  { value: "montaje", label: "Montaje" },
  { value: "embalaje", label: "Embalaje" },
];

function getLabel<T extends string>(
  items: Array<{ value: T; label: string }>,
  value: T | null | undefined,
  fallback = "Sin definir",
) {
  if (!value) {
    return fallback;
  }
  return items.find((item) => item.value === value)?.label ?? fallback;
}


type LocalVariante = {
  id: string;
  sku: string;
  activo: boolean;
  atributosVarianteTexto: string;
  unidadStock?: UnidadMateriaPrima;
  unidadCompra?: UnidadMateriaPrima;
  precioReferencia?: number;
  proveedorReferenciaId?: string;
};

type LocalCompatibilidad = {
  id: string;
  varianteSku?: string;
  plantillaMaquinaria?: PlantillaMaquinaria;
  modoUso: ModoUsoCompatibilidadMateriaPrima;
  consumoBase?: number;
  unidadConsumo?: UnidadMateriaPrima;
  mermaBasePct?: number;
  activo: boolean;
};

type FormState = {
  codigo: string;
  nombre: string;
  descripcion: string;
  familia: FamiliaMateriaPrima;
  subfamilia: SubfamiliaMateriaPrima;
  tipoTecnico: string;
  templateId: string;
  unidadStock: UnidadMateriaPrima;
  unidadCompra: UnidadMateriaPrima;
  esConsumible: boolean;
  esRepuesto: boolean;
  activo: boolean;
  atributosTecnicosTexto: string;
  variantes: LocalVariante[];
  compatibilidades: LocalCompatibilidad[];
};

type MateriaPrimaFichaProps = {
  materiaPrima: MateriaPrima;
  proveedores: ProveedorDetalle[];
};

function parseJsonField(text: string, fallback: Record<string, unknown>) {
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return fallback;
  } catch {
    return fallback;
  }
}

function normalizeVarianteAtributos(attrs: Record<string, unknown>): Record<string, unknown> {
  const normalized = { ...attrs };
  const aliasMap: Record<string, string> = {
    anchoCm: "ancho",
    altoCm: "alto",
    gramajeGm2: "gramaje",
    anchoRolloM: "ancho",
    largoRolloM: "largo",
    anchoM: "ancho",
    altoM: "alto",
    espesorMm: "espesor",
    espesorMicrones: "espesor",
    anchoMm: "ancho",
    altoMm: "alto",
    largoM: "largo",
    presentacionMl: "presentacion",
    diametroMm: "diametro",
    diametroInternoMm: "diametroInterno",
    anchoCompatibleMm: "anchoCompatible",
    tensionV: "tension",
    tensionSalidaV: "tensionSalida",
    tensionEntradaV: "tensionEntrada",
    tensionAislacionV: "tensionAislacion",
    potenciaW: "potencia",
    potenciaWm: "potenciaLineal",
    corrienteNominalA: "corrienteNominal",
    corrienteSalidaMaxA: "corrienteSalidaMax",
    corrienteMaxCanalA: "corrienteMaxCanal",
    corrienteTotalMaxA: "corrienteTotalMax",
    corrienteMaxA: "corrienteMax",
    flujoLuminosoLm: "flujoLuminoso",
    seccionMm2: "seccion",
  };

  for (const [legacyKey, canonicalKey] of Object.entries(aliasMap)) {
    const legacyValue = normalized[legacyKey];
    if (legacyValue !== undefined && normalized[canonicalKey] === undefined) {
      normalized[canonicalKey] = legacyValue;
    }
    if (legacyKey in normalized) {
      delete normalized[legacyKey];
    }
  }

  return normalized;
}

function sortForStableJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortForStableJson);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, nested]) => [key, sortForStableJson(nested)]),
    );
  }
  return value;
}

function createEmptyVariante(): LocalVariante {
  const seed = crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
  return {
    id: crypto.randomUUID(),
    sku: `MPV-${seed}`,
    activo: true,
    atributosVarianteTexto: "{}",
    unidadStock: undefined,
    unidadCompra: undefined,
    precioReferencia: undefined,
    proveedorReferenciaId: undefined,
  };
}

function createEmptyCompatibilidad(): LocalCompatibilidad {
  return {
    id: crypto.randomUUID(),
    varianteSku: undefined,
    plantillaMaquinaria: undefined,
    modoUso: "sustrato_directo",
    consumoBase: undefined,
    unidadConsumo: undefined,
    mermaBasePct: undefined,
    activo: true,
  };
}

function mapMateriaPrimaToForm(materiaPrima: MateriaPrima): FormState {
  return {
    codigo: materiaPrima.codigo,
    nombre: materiaPrima.nombre,
    descripcion: materiaPrima.descripcion,
    familia: materiaPrima.familia,
    subfamilia: materiaPrima.subfamilia,
    tipoTecnico: materiaPrima.tipoTecnico,
    templateId: materiaPrima.templateId,
    unidadStock: materiaPrima.unidadStock,
    unidadCompra: materiaPrima.unidadCompra,
    esConsumible: materiaPrima.esConsumible,
    esRepuesto: materiaPrima.esRepuesto,
    activo: materiaPrima.activo,
    atributosTecnicosTexto: JSON.stringify(materiaPrima.atributosTecnicos ?? {}, null, 2),
    variantes:
      materiaPrima.variantes.length > 0
        ? materiaPrima.variantes.map((variante) => ({
            id: variante.id,
            sku: variante.sku,
            activo: variante.activo,
            atributosVarianteTexto: JSON.stringify(
              normalizeVarianteAtributos(variante.atributosVariante ?? {}),
              null,
              2,
            ),
            unidadStock: variante.unidadStock ?? undefined,
            unidadCompra: variante.unidadCompra ?? undefined,
            precioReferencia: variante.precioReferencia ?? undefined,
            proveedorReferenciaId: variante.proveedorReferenciaId ?? undefined,
          }))
        : [createEmptyVariante()],
    compatibilidades:
      materiaPrima.compatibilidades.length > 0
        ? materiaPrima.compatibilidades.map((compatibilidad) => ({
            id: compatibilidad.id,
            varianteSku:
              materiaPrima.variantes.find((variante) => variante.id === compatibilidad.varianteId)?.sku ??
              undefined,
            plantillaMaquinaria: compatibilidad.plantillaMaquinaria ?? undefined,
            modoUso: compatibilidad.modoUso,
            consumoBase: compatibilidad.consumoBase ?? undefined,
            unidadConsumo: compatibilidad.unidadConsumo ?? undefined,
            mermaBasePct: compatibilidad.mermaBasePct ?? undefined,
            activo: compatibilidad.activo,
          }))
        : [],
  };
}

function buildPayload(
  form: FormState,
  templateDimensiones: string[],
  templateFields: Array<{ key: string; type: "text" | "number" | "boolean" }>,
): MateriaPrimaPayload {
  const numberFieldKeys = new Set(
    templateFields.filter((field) => field.type === "number").map((field) => field.key),
  );

  const normalizeAttrsForSave = (attrs: Record<string, unknown>) => {
    const normalized = { ...attrs };
    for (const key of numberFieldKeys) {
      const raw = normalized[key];
      if (raw === undefined || raw === null || raw === "") continue;
      if (typeof raw === "number") continue;
      const parsed = Number(String(raw).replace(",", ".").trim());
      if (Number.isFinite(parsed)) {
        normalized[key] = parsed;
      }
    }
    return normalized;
  };

  return {
    codigo: form.codigo,
    nombre: form.nombre,
    descripcion: form.descripcion,
    familia: form.familia,
    subfamilia: form.subfamilia,
    tipoTecnico: form.tipoTecnico,
    templateId: form.templateId,
    unidadStock: form.unidadStock,
    unidadCompra: form.unidadCompra,
    esConsumible: form.esConsumible,
    esRepuesto: form.esRepuesto,
    activo: form.activo,
    atributosTecnicos: parseJsonField(form.atributosTecnicosTexto, {}),
    variantes: form.variantes
      .map((variante, index) => {
        const attrs = normalizeAttrsForSave(parseJsonField(variante.atributosVarianteTexto, {}));
        const hasDimensionValue = templateDimensiones.some((key) => {
          const value = attrs[key];
          if (typeof value === "number") return Number.isFinite(value);
          if (typeof value === "boolean") return true;
          return String(value ?? "").trim().length > 0;
        });
        if (!hasDimensionValue) {
          return null;
        }
        const generatedSku = `${form.codigo}-VAR-${index + 1}`;
        return {
          sku: variante.sku.trim() || generatedSku,
          activo: variante.activo,
          atributosVariante: attrs,
          unidadStock: variante.unidadStock,
          unidadCompra: variante.unidadCompra,
          precioReferencia: variante.precioReferencia,
          proveedorReferenciaId: variante.proveedorReferenciaId,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null),
    compatibilidades: form.compatibilidades
      .filter((compatibilidad) => compatibilidad.plantillaMaquinaria)
      .map((compatibilidad) => ({
        varianteSku: compatibilidad.varianteSku,
        plantillaMaquinaria: compatibilidad.plantillaMaquinaria,
        modoUso: compatibilidad.modoUso,
        consumoBase: compatibilidad.consumoBase,
        unidadConsumo: compatibilidad.unidadConsumo,
        mermaBasePct: compatibilidad.mermaBasePct,
        activo: compatibilidad.activo,
      })),
  };
}

function createFormSnapshot(form: FormState) {
  const templateDimensiones = getMateriaPrimaTemplate(form.templateId)?.dimensionesVariante ?? [];
  const templateFields = getMateriaPrimaTemplate(form.templateId)?.camposTecnicos ?? [];
  return JSON.stringify(sortForStableJson(buildPayload(form, templateDimensiones, templateFields)));
}

function formatFieldLabel(key: string) {
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/^./, (char) => char.toUpperCase());
}

export function MateriaPrimaFicha({ materiaPrima, proveedores }: MateriaPrimaFichaProps) {
  const [form, setForm] = React.useState<FormState>(() => mapMateriaPrimaToForm(materiaPrima));
  const [savedSnapshot, setSavedSnapshot] = React.useState(() =>
    createFormSnapshot(mapMateriaPrimaToForm(materiaPrima)),
  );
  const [activeTab, setActiveTab] = React.useState("datos-base");
  const [isSaving, setIsSaving] = React.useState(false);
  const [customFormatoModeByVariante, setCustomFormatoModeByVariante] = React.useState<Record<string, boolean>>({});

  const template = React.useMemo(() => getMateriaPrimaTemplate(form.templateId), [form.templateId]);
  const templateFields = template?.camposTecnicos ?? [];
  const templateFieldByKey = React.useMemo(
    () => new Map(templateFields.map((field) => [field.key, field])),
    [templateFields],
  );
  const familiaLabel = getLabel(familiaMateriaPrimaItems, form.familia);
  const subfamiliaLabel = getLabel(subfamiliaMateriaPrimaItems, form.subfamilia);
  const unidadStockLabel = getLabel(unidadMateriaPrimaItems, form.unidadStock);
  const unidadCompraLabel = getLabel(unidadMateriaPrimaItems, form.unidadCompra);
  const proveedorLabelById = React.useMemo(
    () => new Map(proveedores.map((proveedor) => [proveedor.id, proveedor.nombre])),
    [proveedores],
  );

  const varianteColumns = React.useMemo(() => {
    if (template?.dimensionesVariante?.length) {
      return template.dimensionesVariante;
    }
    return [];
  }, [template]);
  const formatoHojaById = React.useMemo(
    () => new Map(SUSTRATO_HOJA_FORMATOS_PRESET.map((formato) => [formato.id, formato])),
    [],
  );
  const currentSnapshot = React.useMemo(() => createFormSnapshot(form), [form]);
  const hasChanges = currentSnapshot !== savedSnapshot;

  React.useEffect(() => {
    const nextForm = mapMateriaPrimaToForm(materiaPrima);
    setForm(nextForm);
    setSavedSnapshot(createFormSnapshot(nextForm));
    setCustomFormatoModeByVariante({});
  }, [materiaPrima]);

  const setVariante = (id: string, patch: Partial<LocalVariante>) => {
    setForm((prev) => ({
      ...prev,
      variantes: prev.variantes.map((variante) =>
        variante.id === id ? { ...variante, ...patch } : variante,
      ),
    }));
  };

  const setCompatibilidad = (id: string, patch: Partial<LocalCompatibilidad>) => {
    setForm((prev) => ({
      ...prev,
      compatibilidades: prev.compatibilidades.map((item) =>
        item.id === id ? { ...item, ...patch } : item,
      ),
    }));
  };

  const getVarianteAtributos = (variante: LocalVariante) =>
    parseJsonField(variante.atributosVarianteTexto, {});

  const getVarianteAtributo = (variante: LocalVariante, key: string) => {
    const attrs = getVarianteAtributos(variante);
    const value = attrs[key];
    return value === undefined || value === null ? "" : String(value);
  };

  const hasVarianteDimensionValue = React.useCallback(
    (variante: LocalVariante) => {
      const attrs = getVarianteAtributos(variante);
      return varianteColumns.some((key) => {
        const value = attrs[key];
        if (typeof value === "number") return Number.isFinite(value);
        if (typeof value === "boolean") return true;
        return String(value ?? "").trim().length > 0;
      });
    },
    [varianteColumns],
  );

  const variantesPrecio = React.useMemo(
    () => form.variantes.filter((variante) => hasVarianteDimensionValue(variante)),
    [form.variantes, hasVarianteDimensionValue],
  );
  const varianteLabelBySku = React.useMemo(() => {
    const map = new Map<string, string>();
    form.variantes.forEach((variante, index) => {
      map.set(variante.sku, `Variante ${index + 1}`);
    });
    return map;
  }, [form.variantes]);

  const setVarianteAtributo = (varianteId: string, key: string, value: string) => {
    const variante = form.variantes.find((item) => item.id === varianteId);
    if (!variante) return;
    const attrs = getVarianteAtributos(variante);
    const field = templateFieldByKey.get(key);
    if (field?.type === "number") {
      attrs[key] = value;
    } else {
      attrs[key] = value;
    }
    setVariante(varianteId, {
      atributosVarianteTexto: JSON.stringify(attrs),
    });
  };

  const findFormatoHojaPreset = (variante: LocalVariante) => {
    const attrs = getVarianteAtributos(variante);
    const formato = String(attrs.formatoComercial ?? "").trim().toLowerCase();
    const ancho = Number(attrs.ancho);
    const alto = Number(attrs.alto);
    return SUSTRATO_HOJA_FORMATOS_PRESET.find((item) => {
      if (item.nombre.toLowerCase() !== formato) return false;
      return Math.abs(item.ancho - ancho) < 0.001 && Math.abs(item.alto - alto) < 0.001;
    });
  };

  const setFormatoHojaPreset = (varianteId: string, formatoId: string) => {
    const preset = formatoHojaById.get(
      formatoId as (typeof SUSTRATO_HOJA_FORMATOS_PRESET)[number]["id"],
    );
    if (!preset) return;
    const variante = form.variantes.find((item) => item.id === varianteId);
    if (!variante) return;
    const attrs = getVarianteAtributos(variante);
    attrs.formatoComercial = preset.nombre;
    attrs.ancho = preset.ancho;
    attrs.alto = preset.alto;
    setVariante(varianteId, {
      atributosVarianteTexto: JSON.stringify(attrs),
    });
  };

  const isSustratoHojaDimensionLocked = (variante: LocalVariante, key: string) => {
    if (template?.id !== "sustrato_hoja_v1") return false;
    if (key !== "ancho" && key !== "alto") return false;
    if (customFormatoModeByVariante[variante.id] === true) return false;
    return Boolean(findFormatoHojaPreset(variante));
  };

  const addVariante = () => {
    setForm((prev) => ({ ...prev, variantes: [...prev.variantes, createEmptyVariante()] }));
  };

  const removeVariante = (id: string) => {
    setForm((prev) => ({
      ...prev,
      variantes:
        prev.variantes.length === 1
          ? prev.variantes
          : prev.variantes.filter((variante) => variante.id !== id),
      compatibilidades: prev.compatibilidades.map((compatibilidad) => {
        if (compatibilidad.varianteSku) {
          const removed = prev.variantes.find((variante) => variante.id === id);
          if (removed?.sku === compatibilidad.varianteSku) {
            return { ...compatibilidad, varianteSku: undefined };
          }
        }
        return compatibilidad;
      }),
    }));
  };

  const addCompatibilidad = () => {
    setForm((prev) => ({ ...prev, compatibilidades: [...prev.compatibilidades, createEmptyCompatibilidad()] }));
  };

  const removeCompatibilidad = (id: string) => {
    setForm((prev) => ({
      ...prev,
      compatibilidades: prev.compatibilidades.filter((item) => item.id !== id),
    }));
  };

  const save = async () => {
    if (!hasChanges) {
      return;
    }
    if (!form.codigo.trim() || !form.nombre.trim()) {
      toast.error("Completá código y nombre antes de guardar.");
      return;
    }

    setIsSaving(true);
    try {
      const payload = buildPayload(
        form,
        template?.dimensionesVariante ?? [],
        template?.camposTecnicos ?? [],
      );
      const updated = await updateMateriaPrima(materiaPrima.id, payload);
      const updatedForm = mapMateriaPrimaToForm(updated);
      setForm(updatedForm);
      setSavedSnapshot(createFormSnapshot(updatedForm));
      toast.success("Ficha de materia prima actualizada.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo guardar.";
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <Link
                href="/inventario/materias-primas"
                className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
              >
                <ArrowLeftIcon className="size-4" />
                Volver al catálogo
              </Link>
              <CardTitle className="text-2xl">{form.nombre || "Materia prima"}</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={save}
                loading={isSaving}
                loadingText="Guardando..."
                disabled={!hasChanges}
              >
                <SaveIcon className="size-4" />
                Guardar cambios
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="flex items-center justify-between gap-3 border-b px-3 py-2 md:px-4">
              <TabsList
                variant="line"
                className="h-auto max-w-full justify-start gap-1 overflow-x-auto rounded-none border-0 bg-transparent p-0"
              >
                <TabsTrigger
                  className="shrink-0 cursor-pointer rounded-none px-4 py-3 text-sm font-medium transition-colors hover:text-foreground data-active:text-foreground after:!bottom-[1px] after:!h-1 after:!bg-primary after:opacity-0 hover:after:!opacity-70 data-active:after:!opacity-100"
                  value="datos-base"
                >
                  Datos generales
                </TabsTrigger>
                <TabsTrigger
                  className="shrink-0 cursor-pointer rounded-none px-4 py-3 text-sm font-medium transition-colors hover:text-foreground data-active:text-foreground after:!bottom-[1px] after:!h-1 after:!bg-primary after:opacity-0 hover:after:!opacity-70 data-active:after:!opacity-100"
                  value="opciones-variantes"
                >
                  Variantes
                </TabsTrigger>
                <TabsTrigger
                  className="shrink-0 cursor-pointer rounded-none px-4 py-3 text-sm font-medium transition-colors hover:text-foreground data-active:text-foreground after:!bottom-[1px] after:!h-1 after:!bg-primary after:opacity-0 hover:after:!opacity-70 data-active:after:!opacity-100"
                  value="precios"
                >
                  Precios
                </TabsTrigger>
                <TabsTrigger
                  className="shrink-0 cursor-pointer rounded-none px-4 py-3 text-sm font-medium transition-colors hover:text-foreground data-active:text-foreground after:!bottom-[1px] after:!h-1 after:!bg-primary after:opacity-0 hover:after:!opacity-70 data-active:after:!opacity-100"
                  value="compatibilidades"
                >
                  Compatibilidades
                </TabsTrigger>
                <TabsTrigger
                  className="shrink-0 cursor-pointer rounded-none px-4 py-3 text-sm font-medium transition-colors hover:text-foreground data-active:text-foreground after:!bottom-[1px] after:!h-1 after:!bg-primary after:opacity-0 hover:after:!opacity-70 data-active:after:!opacity-100"
                  value="inventario"
                >
                  Inventario y lotes
                </TabsTrigger>
                <TabsTrigger
                  className="shrink-0 cursor-pointer rounded-none px-4 py-3 text-sm font-medium transition-colors hover:text-foreground data-active:text-foreground after:!bottom-[1px] after:!h-1 after:!bg-primary after:opacity-0 hover:after:!opacity-70 data-active:after:!opacity-100"
                  value="historial"
                >
                  Historial
                </TabsTrigger>
              </TabsList>
              <div className="flex items-center gap-2 rounded-lg border px-3 py-2">
                <span className="text-xs text-muted-foreground">Estado</span>
                <Switch
                  checked={form.activo}
                  onCheckedChange={(checked) => setForm((prev) => ({ ...prev, activo: checked }))}
                />
              </div>
            </div>

            <TabsContent value="datos-base" className="m-0 p-4 md:p-6">
              <FieldGroup className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <Field>
                    <FieldLabel>Código</FieldLabel>
                    <Input
                      value={form.codigo}
                      onChange={(event) => setForm((prev) => ({ ...prev, codigo: event.target.value }))}
                    />
                  </Field>
                  <Field>
                    <FieldLabel>Nombre</FieldLabel>
                    <Input
                      value={form.nombre}
                      onChange={(event) => setForm((prev) => ({ ...prev, nombre: event.target.value }))}
                    />
                  </Field>
                </div>

                <Field>
                  <FieldLabel>Descripción</FieldLabel>
                  <Textarea
                    value={form.descripcion}
                    onChange={(event) => setForm((prev) => ({ ...prev, descripcion: event.target.value }))}
                  />
                </Field>

                <div className="grid gap-3 md:grid-cols-2">
                  <Field>
                    <FieldLabel>Familia</FieldLabel>
                    <Select
                      value={form.familia}
                      onValueChange={(value) =>
                        setForm((prev) => ({ ...prev, familia: value as FamiliaMateriaPrima }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue>{familiaLabel}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {familiaMateriaPrimaItems.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field>
                    <FieldLabel>Subfamilia</FieldLabel>
                    <Select
                      value={form.subfamilia}
                      onValueChange={(value) =>
                        setForm((prev) => ({ ...prev, subfamilia: value as SubfamiliaMateriaPrima }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue>{subfamiliaLabel}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {subfamiliaMateriaPrimaItems.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <Field>
                    <FieldLabel>Unidad de uso</FieldLabel>
                    <Select
                      value={form.unidadStock}
                      onValueChange={(value) =>
                        setForm((prev) => ({ ...prev, unidadStock: value as UnidadMateriaPrima }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue>{unidadStockLabel}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {unidadMateriaPrimaItems.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field>
                    <FieldLabel>Unidad de compra</FieldLabel>
                    <Select
                      value={form.unidadCompra}
                      onValueChange={(value) =>
                        setForm((prev) => ({ ...prev, unidadCompra: value as UnidadMateriaPrima }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue>{unidadCompraLabel}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {unidadMateriaPrimaItems.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <Field>
                    <FieldLabel>Disponible como consumible</FieldLabel>
                    <div className="flex h-10 items-center justify-end rounded-md border px-3">
                      <Switch
                        checked={form.esConsumible}
                        onCheckedChange={(checked) =>
                          setForm((prev) => ({ ...prev, esConsumible: checked }))
                        }
                      />
                    </div>
                  </Field>
                  <Field>
                    <FieldLabel>Disponible como repuesto</FieldLabel>
                    <div className="flex h-10 items-center justify-end rounded-md border px-3">
                      <Switch
                        checked={form.esRepuesto}
                        onCheckedChange={(checked) =>
                          setForm((prev) => ({ ...prev, esRepuesto: checked }))
                        }
                      />
                    </div>
                  </Field>
                </div>
              </FieldGroup>
            </TabsContent>

            <TabsContent value="opciones-variantes" className="m-0 p-4 md:p-6">
              <div className="space-y-4">
                <h4 className="text-sm font-semibold">{form.nombre || "Variantes"}</h4>

                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {varianteColumns.map((key) => (
                          <TableHead key={key}>
                            {(() => {
                              const field = templateFieldByKey.get(key);
                              const unit = getUnitDefinition(
                                field?.unit as unknown as Parameters<typeof getUnitDefinition>[0],
                              );
                              const label = field?.label ?? formatFieldLabel(key);
                              return unit ? `${label} (${unit.symbol})` : label;
                            })()}
                          </TableHead>
                        ))}
                        <TableHead>Activa</TableHead>
                        <TableHead className="text-right">Acción</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {form.variantes.map((variante) => (
                        <TableRow key={variante.id}>
                          {varianteColumns.map((key) => (
                            <TableCell key={`${variante.id}-${key}`}>
                              {template?.id === "sustrato_hoja_v1" && key === "formatoComercial" ? (
                                (() => {
                                  const currentValue = getVarianteAtributo(variante, key);
                                  const currentPreset = findFormatoHojaPreset(variante);
                                  const isPreset = Boolean(currentPreset);
                                  const isCustomMode = customFormatoModeByVariante[variante.id] === true;

                                  if (isCustomMode) {
                                    return (
                                      <div className="flex items-center gap-2">
                                        <Input
                                          placeholder="Nombre personalizado"
                                          value={currentValue}
                                          onChange={(event) =>
                                            setVarianteAtributo(variante.id, key, event.target.value)
                                          }
                                        />
                                        <Button
                                          type="button"
                                          variant="outline"
                                          size="sm"
                                          onClick={() =>
                                            setCustomFormatoModeByVariante((prev) => ({
                                              ...prev,
                                              [variante.id]: false,
                                            }))
                                          }
                                        >
                                          Lista
                                        </Button>
                                      </div>
                                    );
                                  }

                                  return (
                                    <Select
                                      value={currentPreset?.id ?? "__none__"}
                                      onValueChange={(value) => {
                                        const next = value ?? "__none__";
                                        if (next === "__custom__") {
                                          setCustomFormatoModeByVariante((prev) => ({
                                            ...prev,
                                            [variante.id]: true,
                                          }));
                                          if (isPreset) {
                                            setVarianteAtributo(variante.id, key, "");
                                          }
                                          return;
                                        }
                                        if (next === "__none__") {
                                          return;
                                        }
                                        setCustomFormatoModeByVariante((prev) => ({
                                          ...prev,
                                          [variante.id]: false,
                                        }));
                                        setFormatoHojaPreset(variante.id, next);
                                      }}
                                    >
                                      <SelectTrigger>
                                        <SelectValue>
                                          {currentPreset?.nombre ?? "Seleccionar formato"}
                                        </SelectValue>
                                      </SelectTrigger>
                                      <SelectContent align="end" className="!w-auto min-w-[220px]">
                                        <SelectItem value="__none__">
                                          <span className="ml-auto w-full text-right">Seleccionar formato</span>
                                        </SelectItem>
                                        {SUSTRATO_HOJA_FORMATOS_PRESET.map((formato) => (
                                          <SelectItem key={formato.id} value={formato.id}>
                                            <span className="ml-auto w-full text-right">
                                              {formato.nombre} ({formato.ancho} x {formato.alto} cm)
                                            </span>
                                          </SelectItem>
                                        ))}
                                        <SelectItem value="__custom__">
                                          <span className="ml-auto w-full text-right">Personalizado</span>
                                        </SelectItem>
                                      </SelectContent>
                                    </Select>
                                  );
                                })()
                              ) : templateFieldByKey.get(key)?.options?.length ? (
                                <Select
                                  value={getVarianteAtributo(variante, key) || "__none__"}
                                  onValueChange={(value) =>
                                    setVarianteAtributo(
                                      variante.id,
                                      key,
                                      value === "__none__" ? "" : (value ?? ""),
                                    )
                                  }
                                >
                                  <SelectTrigger>
                                    <SelectValue>
                                      {getVarianteAtributo(variante, key) || "Seleccionar"}
                                    </SelectValue>
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="__none__">Seleccionar</SelectItem>
                                    {templateFieldByKey.get(key)?.options?.map((option) => (
                                      <SelectItem key={`${key}-${option}`} value={option}>
                                        {option}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              ) : (
                                <Input
                                  type="text"
                                  inputMode={
                                    templateFieldByKey.get(key)?.type === "number" ? "decimal" : undefined
                                  }
                                  value={getVarianteAtributo(variante, key)}
                                  disabled={isSustratoHojaDimensionLocked(variante, key)}
                                  onChange={(event) =>
                                    setVarianteAtributo(variante.id, key, event.target.value)
                                  }
                                />
                              )}
                            </TableCell>
                          ))}
                          <TableCell>
                            <Switch
                              checked={variante.activo}
                              onCheckedChange={(checked) =>
                                setVariante(variante.id, { activo: checked })
                              }
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => removeVariante(variante.id)}
                            >
                              <TrashIcon className="size-4" />
                              Quitar
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex justify-end">
                  <Button type="button" variant="sidebar" size="sm" onClick={addVariante}>
                    <CirclePlusIcon className="size-4" />
                    Agregar variante
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="compatibilidades" className="m-0 p-4 md:p-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold">Compatibilidad con maquinaria</h4>
                  <Button type="button" variant="sidebar" size="sm" onClick={addCompatibilidad}>
                    <CirclePlusIcon className="size-4" />
                    Agregar compatibilidad
                  </Button>
                </div>

                {form.compatibilidades.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Sin compatibilidades cargadas. Definilas para habilitar selección por plantilla/máquina.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {form.compatibilidades.map((compatibilidad) => (
                      <div key={compatibilidad.id} className="space-y-3 rounded-md border p-3">
                        <div className="grid gap-3 md:grid-cols-3">
                          <Field>
                            <FieldLabel>Variante</FieldLabel>
                            <Select
                              value={compatibilidad.varianteSku ?? "__none__"}
                            onValueChange={(value) => {
                                const nextValue = value ?? "__none__";
                                setCompatibilidad(compatibilidad.id, {
                                  varianteSku: nextValue === "__none__" ? undefined : nextValue,
                                });
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue>
                                  {compatibilidad.varianteSku
                                    ? varianteLabelBySku.get(compatibilidad.varianteSku) ?? "Variante"
                                    : "Todas las variantes"}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">Todas las variantes</SelectItem>
                                {form.variantes
                                  .filter((variante) => variante.sku.trim().length > 0)
                                  .map((variante) => (
                                    <SelectItem key={variante.id} value={variante.sku}>
                                      {varianteLabelBySku.get(variante.sku) ?? "Variante"}
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                          </Field>

                          <Field>
                            <FieldLabel>Plantilla de maquinaria</FieldLabel>
                            <Select
                              value={compatibilidad.plantillaMaquinaria ?? "__none__"}
                              onValueChange={(value) =>
                                setCompatibilidad(compatibilidad.id, {
                                  plantillaMaquinaria:
                                    value === "__none__" ? undefined : (value as PlantillaMaquinaria),
                                })
                              }
                            >
                              <SelectTrigger>
                                <SelectValue>
                                  {compatibilidad.plantillaMaquinaria
                                    ? getLabel(
                                        plantillasMaquinariaItems,
                                        compatibilidad.plantillaMaquinaria,
                                      )
                                    : "Sin plantilla"}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">Sin plantilla</SelectItem>
                                {plantillasMaquinariaItems.map((item) => (
                                  <SelectItem key={item.value} value={item.value}>
                                    {item.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </Field>

                          <Field>
                            <FieldLabel>Modo de uso</FieldLabel>
                            <Select
                              value={compatibilidad.modoUso}
                              onValueChange={(value) =>
                                setCompatibilidad(compatibilidad.id, {
                                  modoUso: value as ModoUsoCompatibilidadMateriaPrima,
                                })
                              }
                            >
                              <SelectTrigger>
                                <SelectValue>
                                  {getLabel(modoUsoItems, compatibilidad.modoUso)}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                {modoUsoItems.map((item) => (
                                  <SelectItem key={item.value} value={item.value}>
                                    {item.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </Field>
                        </div>

                        <div className="grid gap-3 md:grid-cols-4">
                          <Field>
                            <FieldLabel>Consumo base</FieldLabel>
                            <Input
                              type="number"
                              min={0}
                              step="0.000001"
                              value={compatibilidad.consumoBase ?? ""}
                              onChange={(event) =>
                                setCompatibilidad(compatibilidad.id, {
                                  consumoBase: event.target.value
                                    ? Number(event.target.value)
                                    : undefined,
                                })
                              }
                            />
                          </Field>
                          <Field>
                            <FieldLabel>Unidad consumo</FieldLabel>
                            <Select
                              value={compatibilidad.unidadConsumo ?? "__none__"}
                              onValueChange={(value) =>
                                setCompatibilidad(compatibilidad.id, {
                                  unidadConsumo:
                                    value === "__none__" ? undefined : (value as UnidadMateriaPrima),
                                })
                              }
                            >
                              <SelectTrigger>
                                <SelectValue>
                                  {compatibilidad.unidadConsumo
                                    ? getLabel(unidadMateriaPrimaItems, compatibilidad.unidadConsumo)
                                    : "Sin unidad"}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">Sin unidad</SelectItem>
                                {unidadMateriaPrimaItems.map((item) => (
                                  <SelectItem key={item.value} value={item.value}>
                                    {item.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </Field>
                          <Field>
                            <FieldLabel>Merma base (%)</FieldLabel>
                            <Input
                              type="number"
                              min={0}
                              step="0.0001"
                              value={compatibilidad.mermaBasePct ?? ""}
                              onChange={(event) =>
                                setCompatibilidad(compatibilidad.id, {
                                  mermaBasePct: event.target.value
                                    ? Number(event.target.value)
                                    : undefined,
                                })
                              }
                            />
                          </Field>
                          <Field className="flex flex-row items-center justify-between rounded-lg border p-3">
                            <FieldLabel>Activa</FieldLabel>
                            <Switch
                              checked={compatibilidad.activo}
                              onCheckedChange={(checked) =>
                                setCompatibilidad(compatibilidad.id, { activo: checked })
                              }
                            />
                          </Field>
                        </div>

                        <div className="flex justify-end">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => removeCompatibilidad(compatibilidad.id)}
                          >
                            <TrashIcon className="size-4" />
                            Quitar compatibilidad
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="precios" className="m-0 p-4 md:p-6">
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  El precio de referencia se define por variante y por unidad de uso (
                  {unidadStockLabel}).
                </p>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nombre</TableHead>
                        <TableHead>Opciones</TableHead>
                        <TableHead>Precio costo</TableHead>
                        <TableHead>Proveedor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {variantesPrecio.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-muted-foreground">
                            Cargá dimensiones en Variantes para definir precios.
                          </TableCell>
                        </TableRow>
                      ) : (
                        variantesPrecio.map((variante) => (
                          <TableRow key={variante.id}>
                            <TableCell>{form.nombre || "Materia prima"}</TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {varianteColumns.map((key) => (
                                  <span
                                    key={`${variante.id}-opt-${key}`}
                                    className="rounded border px-2 py-0.5 text-xs"
                                  >
                                    {(templateFieldByKey.get(key)?.label ?? formatFieldLabel(key))}:{" "}
                                    {getVarianteAtributo(variante, key) || "-"}
                                  </span>
                                ))}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="relative max-w-[260px]">
                                <Input
                                  type="number"
                                  min={0}
                                  step="0.000001"
                                  className="pl-6 pr-20"
                                  value={variante.precioReferencia ?? ""}
                                  onChange={(event) =>
                                    setVariante(variante.id, {
                                      precioReferencia: event.target.value
                                        ? Number(event.target.value)
                                        : undefined,
                                    })
                                  }
                                />
                                <span className="pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 text-xs text-muted-foreground">
                                  $
                                </span>
                                <span className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-xs text-muted-foreground">
                                  {unidadStockLabel}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Select
                                value={variante.proveedorReferenciaId ?? "__none__"}
                                onValueChange={(value) => {
                                  const nextValue = value ?? "__none__";
                                  setVariante(variante.id, {
                                    proveedorReferenciaId:
                                      nextValue === "__none__" ? undefined : nextValue,
                                  });
                                }}
                              >
                                <SelectTrigger>
                                  <SelectValue>
                                    {variante.proveedorReferenciaId
                                      ? proveedorLabelById.get(variante.proveedorReferenciaId) ?? "Sin proveedor"
                                      : "Sin proveedor"}
                                  </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__none__">Sin proveedor</SelectItem>
                                  {proveedores.map((proveedor) => (
                                    <SelectItem key={proveedor.id} value={proveedor.id}>
                                      {proveedor.nombre}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="inventario" className="m-0 p-4 md:p-6">
              <p className="text-sm text-muted-foreground">
                Este tab queda listo para integrar en Fase 4: stock por lote/ubicación, movimientos y kardex.
              </p>
            </TabsContent>

            <TabsContent value="historial" className="m-0 p-4 md:p-6">
              <p className="text-sm text-muted-foreground">
                Este tab queda reservado para auditoría de cambios de plantilla, datos técnicos y precios.
              </p>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </section>
  );
}
