"use client";
import { useCapacidad } from "@/components/navigation/capacidades-provider";
import { usePuede } from "@/components/navigation/permisos-provider";

import type { MaterialEquivalence } from "@/lib/material-units";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeftIcon,
  LayersIcon,
  DollarSignIcon,
  FileTextIcon,
  CirclePlusIcon,
  HistoryIcon,
  InfoIcon,
  PackageIcon,
  SaveIcon,
  TrashIcon,
} from "lucide-react";
import { toast } from "sonner";

import { updateMateriaPrima } from "@/lib/materias-primas-api";
import { MaterialInventarioPanel } from "./material-inventario-panel";
import {
  familiaMateriaPrimaItems,
  unidadMateriaPrimaItems,
  type FamiliaMateriaPrima,
  type MateriaPrima,
  type MateriaPrimaPayload,
  type SubfamiliaMateriaPrima,
  type UnidadMateriaPrima,
} from "@/lib/materias-primas";
import type { MaquinaResumen } from "@/lib/maquinaria";
import {
  SUSTRATO_HOJA_FORMATOS_PRESET,
  getMateriaPrimaTemplateAvailability,
  getMateriaPrimaTemplate,
  getReplacementComponentLabel,
  getReplacementComponentOptionsForTemplates,
} from "@/lib/materia-prima-templates";
import { getPlantillaMaquinariaLabel } from "@/lib/maquinaria-templates";
import { getUnitDefinition, type UnitCode } from "@/lib/unidades";
import { MaterialConversionFields } from "./material-conversion-fields";
import type { ProveedorOpcion } from "@/lib/proveedores";
import {
  Input,
  Switch,
  Tabs,
  TextArea as Textarea,
  Tooltip,
} from "@heroui/react";
import { ActionButton } from "@/components/design-system/action-button";
import { Badge } from "@/components/ui/badge";
import { NavigationTabList } from "@/components/design-system/navigation-tab-list";
import { SelectField } from "@/components/design-system/select-field";
import { useDesignScope, useDesignTheme } from "@/components/design-system/appearance";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { MaterialMultiSelect } from "./material-multi-select";
import listPage from "@/components/design-system/list-page.module.css";
import styles from "./materiales.module.css";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { numeroMoneda, type Moneda } from "@/lib/moneda";
import { monedaDe } from "@/lib/monedas";
import { MoneyInput } from "@/components/ui/money-input";
import { useConfigRegional } from "@/components/navigation/config-regional-provider";

const subfamiliaMateriaPrimaItems: Array<{
  value: SubfamiliaMateriaPrima;
  label: string;
}> = [
  { value: "sustrato_hoja", label: "Sustrato hoja" },
  { value: "sustrato_rollo_flexible", label: "Sustrato rollo flexible" },
  { value: "sustrato_rigido", label: "Sustrato rígido" },
  { value: "objeto_promocional_base", label: "Objeto promocional base" },
  { value: "tinta_impresion", label: "Tinta impresión" },
  { value: "toner", label: "Tóner" },
  { value: "film_transferencia", label: "Film transferencia" },
  { value: "papel_transferencia", label: "Papel transferencia" },
  { value: "laminado_film", label: "Laminado film" },
  { value: "laminado_pouch", label: "Laminado pouch" },
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
  { value: "componente_editorial", label: "Componente editorial / carpeta" },
  { value: "pegatina_raspadita", label: "Pegatina raspadita" },
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
  {
    value: "adhesivo_liquido_estructural",
    label: "Adhesivo líquido estructural",
  },
  { value: "velcro_cierre_tecnico", label: "Velcro/cierre técnico" },
  { value: "embalaje_proteccion", label: "Embalaje/protección" },
  { value: "etiquetado_identificacion", label: "Etiquetado/identificación" },
  { value: "consumible_instalacion", label: "Consumible instalación" },
  { value: "sellos_automaticos", label: "Sellos automáticos" },
  { value: "sellos_manuales", label: "Sellos manuales" },
  { value: "goma_laserable", label: "Goma laserable" },
  { value: "almohadilla_tinta", label: "Almohadillas y tintas" },
];

function resolveVarianteUnits(
  variante: LocalVariante,
  fallbackStock: UnidadMateriaPrima,
  fallbackCompra: UnidadMateriaPrima,
  fallbackUso: UnidadMateriaPrima,
) {
  return {
    unidadStock: variante.unidadStock ?? fallbackStock,
    unidadUso: variante.unidadUso ?? fallbackUso,
    unidadCompra: variante.unidadCompra ?? fallbackCompra,
  };
}

type LocalVariante = {
  id: string;
  sku: string;
  activo: boolean;
  atributosVarianteTexto: string;
  unidadStock?: UnidadMateriaPrima;
  unidadCompra?: UnidadMateriaPrima;
  unidadUso?: UnidadMateriaPrima;
  precioReferencia?: number;
  moneda?: string;
  unidadPrecio?: UnidadMateriaPrima | null;
  equivalenciaCompra?: number | null;
  equivalencias?: MaterialEquivalence[];
  /**
   * Lo que se ve en el MoneyInput. Va aparte del número porque mientras se
   * tipea el texto puede no parsear ("1234," a mitad de camino) y el input
   * no puede quedarse en blanco; al payload va sólo `precioReferencia`.
   */
  precioReferenciaTexto?: string;
  proveedorReferenciaId?: string;
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
  unidadUso: UnidadMateriaPrima;
  esConsumible: boolean;
  esRepuesto: boolean;
  esProductoBase: boolean;
  activo: boolean;
  atributosTecnicosTexto: string;
  variantes: LocalVariante[];
};

type MateriaPrimaFichaProps = {
  materiaPrima: MateriaPrima;
  proveedores: ProveedorOpcion[];
  maquinas: MaquinaResumen[];
};

/**
 * Factor para MOSTRAR un campo numérico en su `preferredDisplayUnit`
 * (paso en cm) mientras el atributo se GUARDA en la unidad canónica de la
 * plantilla (mm, lo que lee el motor). null = sin conversión.
 * display = raw × factor · raw = display ÷ factor.
 */
function displayUnitFactor(
  field:
    | {
        type: "text" | "number" | "boolean";
        unit?: UnitCode;
        preferredDisplayUnit?: UnitCode;
      }
    | undefined,
): { factor: number; symbol: string } | null {
  if (!field || field.type !== "number") return null;
  if (!field.unit || !field.preferredDisplayUnit) return null;
  if (field.unit === field.preferredDisplayUnit) return null;
  const canonica = getUnitDefinition(field.unit);
  const preferida = getUnitDefinition(field.preferredDisplayUnit);
  if (!canonica || !preferida || canonica.dimension !== preferida.dimension) {
    return null;
  }
  return {
    factor: canonica.factorToBase / preferida.factorToBase,
    symbol: preferida.symbol,
  };
}

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

function readFiniteNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(",", ".").trim());
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function setNumberIfMissing(
  attrs: Record<string, unknown>,
  key: string,
  rawValue: unknown,
  divider = 1,
) {
  if (attrs[key] !== undefined) return;
  const parsed = readFiniteNumber(rawValue);
  if (parsed === null) return;
  attrs[key] = parsed / divider;
}

function setLegacyNumber(
  attrs: Record<string, unknown>,
  key: string,
  rawValue: unknown,
  multiplier = 1,
) {
  const parsed = readFiniteNumber(rawValue);
  if (parsed === null) return;
  attrs[key] = Math.round(parsed * multiplier * 1000) / 1000;
}

// Templates cuyo alta de variantes se comporta como pliego/hoja: selector de
// formato comercial + ancho/alto en cm sincronizados con anchoMm/largoMm.
const SHEET_LIKE_TEMPLATE_IDS = new Set([
  "sustrato_hoja_v1",
  "componente_editorial_hoja_v1",
]);

const ROLL_LIKE_TEMPLATE_IDS = new Set([
  "sustrato_rollo_flexible_v1",
  "vinilo_esmerilado_rollo_v1",
  "vinilo_de_corte_rollo_v1",
]);

function normalizeVarianteAtributos(
  attrs: Record<string, unknown>,
  templateId?: string,
): Record<string, unknown> {
  const normalized = { ...attrs };
  const normalizedTemplateId = getMateriaPrimaTemplate(templateId ?? "")?.id;

  if (SHEET_LIKE_TEMPLATE_IDS.has(normalizedTemplateId ?? "")) {
    setNumberIfMissing(normalized, "ancho", normalized.anchoMm, 10);
    setNumberIfMissing(
      normalized,
      "alto",
      normalized.largoMm ?? normalized.altoMm,
      10,
    );
    setNumberIfMissing(normalized, "gramaje", normalized.gramajeGr);
  } else if (ROLL_LIKE_TEMPLATE_IDS.has(normalizedTemplateId ?? "")) {
    setNumberIfMissing(normalized, "ancho", normalized.anchoMm, 1000);
    setNumberIfMissing(
      normalized,
      "largo",
      normalized.largoRolloMm ?? normalized.largoMm,
      1000,
    );
  } else if (normalizedTemplateId === "sustrato_rigido_v1") {
    setNumberIfMissing(normalized, "ancho", normalized.anchoMm, 1000);
    setNumberIfMissing(
      normalized,
      "alto",
      normalized.largoMm ?? normalized.altoMm,
      1000,
    );
    setNumberIfMissing(normalized, "espesor", normalized.espesorMm);
  } else if (normalizedTemplateId === "laminado_film_v1") {
    setNumberIfMissing(normalized, "ancho", normalized.anchoMm);
    setNumberIfMissing(
      normalized,
      "largo",
      normalized.largoRolloMm ?? normalized.largoMm,
      1000,
    );
  } else if (normalizedTemplateId === "laminado_pouch_v1") {
    setNumberIfMissing(normalized, "ancho", normalized.anchoMm);
    setNumberIfMissing(
      normalized,
      "alto",
      normalized.altoMm ?? normalized.largoMm,
    );
    setNumberIfMissing(
      normalized,
      "margenNoUsable",
      normalized.margenNoUsableMm,
    );
    setNumberIfMissing(normalized, "espesor", normalized.espesorMicrones);
  } else if (normalizedTemplateId === "iman_flexible_rollo_v1") {
    setNumberIfMissing(normalized, "ancho", normalized.anchoMm);
    setNumberIfMissing(
      normalized,
      "largo",
      normalized.largoRolloMm ?? normalized.largoMm,
      1000,
    );
    setNumberIfMissing(normalized, "espesor", normalized.espesorMm);
  } else if (normalizedTemplateId === "iman_redondo_v1") {
    setNumberIfMissing(normalized, "diametro", normalized.diametroMm);
    setNumberIfMissing(normalized, "espesor", normalized.espesorMm);
  } else if (normalizedTemplateId === "fuente_alimentacion_led_v1") {
    // La fuente se carga por CORRIENTE (así se compra); la capacidad en W —
    // el atributo que usa el selector del motor — se deriva: A × V.
    const amperes = readFiniteNumber(normalized.corriente);
    const volts = readFiniteNumber(
      String(normalized.tension ?? "").replace(/v$/i, ""),
    );
    if (amperes !== null && amperes > 0 && volts !== null && volts > 0) {
      normalized.capacidad = Math.round(amperes * volts * 100) / 100;
    }
  }

  const aliasMap: Record<string, string> = {
    anchoCm: "ancho",
    altoCm: "alto",
    gramajeGm2: "gramaje",
    espesorMicrones: "espesor",
    presentacionMl: "volumenPresentacion",
    volumenMl: "volumenPresentacion",
    materialBase: "material",
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
    precioReferenciaTexto: "",
    proveedorReferenciaId: undefined,
  };
}

function mapMateriaPrimaToForm(
  materiaPrima: MateriaPrima,
  moneda: Moneda,
): FormState {
  return {
    codigo: materiaPrima.codigo,
    nombre: materiaPrima.nombre,
    descripcion: materiaPrima.descripcion,
    familia: materiaPrima.familia,
    subfamilia: materiaPrima.subfamilia,
    tipoTecnico: materiaPrima.tipoTecnico,
    templateId: materiaPrima.templateId,
    unidadStock: materiaPrima.unidadStock,
    unidadUso: materiaPrima.unidadUso ?? materiaPrima.unidadStock,
    unidadCompra: materiaPrima.unidadCompra,
    esConsumible: materiaPrima.esConsumible,
    esRepuesto: materiaPrima.esRepuesto,
    esProductoBase: materiaPrima.esProductoBase ?? false,
    activo: materiaPrima.activo,
    atributosTecnicosTexto: JSON.stringify(
      materiaPrima.atributosTecnicos ?? {},
      null,
      2,
    ),
    variantes:
      materiaPrima.variantes.length > 0
        ? materiaPrima.variantes.map((variante) => ({
            id: variante.id,
            sku: variante.sku,
            activo: variante.activo,
            atributosVarianteTexto: JSON.stringify(
              normalizeVarianteAtributos(
                variante.atributosVariante ?? {},
                materiaPrima.templateId,
              ),
              null,
              2,
            ),
            unidadStock: variante.unidadStock ?? undefined,
            unidadUso: variante.unidadUso ?? undefined,
            equivalencias: variante.equivalencias,
            unidadCompra: variante.unidadCompra ?? undefined,
            unidadPrecio: variante.unidadPrecio ?? null,
            equivalenciaCompra: variante.equivalenciaCompra ?? null,
            precioReferencia: variante.precioReferencia ?? undefined,
            moneda: variante.moneda || moneda.codigo,
            precioReferenciaTexto:
              variante.precioReferencia != null
                ? numeroMoneda(
                    variante.precioReferencia,
                    monedaDe(variante.moneda || moneda.codigo),
                  )
                : "",
            proveedorReferenciaId: variante.proveedorReferenciaId ?? undefined,
          }))
        : [createEmptyVariante()],
  };
}

function buildPayload(
  form: FormState,
  templateDimensiones: string[],
  templateFields: Array<{ key: string; type: "text" | "number" | "boolean" }>,
): MateriaPrimaPayload {
  const numberFieldKeys = new Set(
    templateFields
      .filter((field) => field.type === "number")
      .map((field) => field.key),
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
    const normalizedTemplateId = getMateriaPrimaTemplate(form.templateId)?.id;
    if (SHEET_LIKE_TEMPLATE_IDS.has(normalizedTemplateId ?? "")) {
      setLegacyNumber(normalized, "anchoMm", normalized.ancho, 10);
      setLegacyNumber(normalized, "altoMm", normalized.alto, 10);
      setLegacyNumber(normalized, "largoMm", normalized.alto, 10);
      setLegacyNumber(normalized, "gramajeGr", normalized.gramaje);
    } else if (ROLL_LIKE_TEMPLATE_IDS.has(normalizedTemplateId ?? "")) {
      setLegacyNumber(normalized, "anchoMm", normalized.ancho, 1000);
      setLegacyNumber(normalized, "largoMm", normalized.largo, 1000);
      setLegacyNumber(normalized, "largoRolloMm", normalized.largo, 1000);
    } else if (normalizedTemplateId === "sustrato_rigido_v1") {
      setLegacyNumber(normalized, "anchoMm", normalized.ancho, 1000);
      setLegacyNumber(normalized, "altoMm", normalized.alto, 1000);
      setLegacyNumber(normalized, "largoMm", normalized.alto, 1000);
      setLegacyNumber(normalized, "espesorMm", normalized.espesor);
    } else if (normalizedTemplateId === "laminado_film_v1") {
      setLegacyNumber(normalized, "anchoMm", normalized.ancho);
      setLegacyNumber(normalized, "largoMm", normalized.largo, 1000);
      setLegacyNumber(normalized, "largoRolloMm", normalized.largo, 1000);
    } else if (normalizedTemplateId === "laminado_pouch_v1") {
      setLegacyNumber(normalized, "anchoMm", normalized.ancho);
      setLegacyNumber(normalized, "altoMm", normalized.alto);
      setLegacyNumber(normalized, "largoMm", normalized.alto);
      setLegacyNumber(
        normalized,
        "margenNoUsableMm",
        normalized.margenNoUsable,
      );
      setLegacyNumber(normalized, "espesorMicrones", normalized.espesor);
    } else if (normalizedTemplateId === "iman_flexible_rollo_v1") {
      setLegacyNumber(normalized, "anchoMm", normalized.ancho);
      setLegacyNumber(normalized, "largoMm", normalized.largo, 1000);
      setLegacyNumber(normalized, "largoRolloMm", normalized.largo, 1000);
      setLegacyNumber(normalized, "espesorMm", normalized.espesor);
    } else if (normalizedTemplateId === "iman_redondo_v1") {
      setLegacyNumber(normalized, "diametroMm", normalized.diametro);
      setLegacyNumber(normalized, "espesorMm", normalized.espesor);
    } else if (
      normalizedTemplateId === "tinta_impresion_v1" ||
      normalizedTemplateId === "quimico_acabado_v1"
    ) {
      setLegacyNumber(normalized, "volumenMl", normalized.volumenPresentacion);
    } else if (normalizedTemplateId === "embalaje_proteccion_v1") {
      setLegacyNumber(normalized, "anchoMm", normalized.ancho, 10);
      setLegacyNumber(normalized, "altoMm", normalized.alto, 10);
      setLegacyNumber(normalized, "largoMm", normalized.alto, 10);
      setLegacyNumber(
        normalized,
        "piezasPorCaja",
        normalized.capacidadUnidades,
      );
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
    templateId: getMateriaPrimaTemplate(form.templateId)?.id ?? form.templateId,
    unidadStock: form.unidadStock,
    unidadUso: form.unidadUso,
    unidadCompra: form.unidadCompra,
    esConsumible: form.esConsumible,
    esRepuesto: form.esRepuesto,
    esProductoBase: form.esProductoBase,
    activo: form.activo,
    atributosTecnicos: parseJsonField(form.atributosTecnicosTexto, {}),
    variantes: form.variantes
      .map((variante, index) => {
        const attrs = normalizeAttrsForSave(
          parseJsonField(variante.atributosVarianteTexto, {}),
        );
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
          unidadUso: variante.unidadUso,
          equivalencias: variante.equivalencias,
          unidadCompra: variante.unidadCompra,
          unidadPrecio:
            variante.unidadPrecio === undefined
              ? (variante.unidadCompra ?? form.unidadCompra)
              : variante.unidadPrecio,
          equivalenciaCompra: variante.equivalenciaCompra ?? null,
          precioReferencia: variante.precioReferencia,
          moneda: variante.moneda,
          proveedorReferenciaId: variante.proveedorReferenciaId,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null),
  };
}

function createFormSnapshot(form: FormState) {
  const templateDimensiones =
    getMateriaPrimaTemplate(form.templateId)?.dimensionesVariante ?? [];
  const templateFields =
    getMateriaPrimaTemplate(form.templateId)?.camposTecnicos ?? [];
  return JSON.stringify(
    sortForStableJson(buildPayload(form, templateDimensiones, templateFields)),
  );
}

function formatFieldLabel(key: string) {
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/^./, (char) => char.toUpperCase());
}

const unidadVidaUtilLabelMap: Record<string, string> = {
  copias_a4_equiv: "Copias A4 equivalentes",
  m2: "Metros cuadrados",
  metros_lineales: "Metros lineales",
  horas: "Horas",
  ciclos: "Ciclos",
  piezas: "Piezas",
};

function getTemplateOptionLabel(fieldKey: string, value: string) {
  if (!value) {
    return "";
  }

  if (fieldKey === "tipoComponenteDesgaste") {
    return getReplacementComponentLabel(value) ?? formatFieldLabel(value);
  }
  if (fieldKey === "unidadVidaUtil") {
    return unidadVidaUtilLabelMap[value] ?? formatFieldLabel(value);
  }
  if (
    fieldKey === "plantillasCompatibles" ||
    fieldKey === "plantillaCompatible"
  ) {
    return getPlantillaMaquinariaLabel(
      value as Parameters<typeof getPlantillaMaquinariaLabel>[0],
    );
  }

  return value;
}

const COMPONENTES_UNIDAD_IMAGEN_LASER = new Set<string>([
  "drum_opc",
  "developer_unit",
  "charge_unit",
  "drum_cleaning_blade",
]);

export function MateriaPrimaFicha({
  materiaPrima,
  proveedores,
  maquinas,
}: MateriaPrimaFichaProps) {
  const conMateriales = useCapacidad("materiales");
  const permisoGestionar = usePuede("inventario.gestionar");
  const puedeGestionar = conMateriales && permisoGestionar;
  const { moneda } = useConfigRegional();
  const themeClass = useDesignTheme();
  const scope = useDesignScope();
  const [form, setForm] = React.useState<FormState>(() =>
    mapMateriaPrimaToForm(materiaPrima, moneda),
  );
  const [savedSnapshot, setSavedSnapshot] = React.useState(() =>
    createFormSnapshot(mapMateriaPrimaToForm(materiaPrima, moneda)),
  );
  const [activeTab, setActiveTab] = React.useState("datos-base");
  const [savedMaterial, setSavedMaterial] = React.useState(materiaPrima);
  const [isSaving, setIsSaving] = React.useState(false);
  const [customFormatoModeByVariante, setCustomFormatoModeByVariante] =
    React.useState<Record<string, boolean>>({});

  const template = React.useMemo(
    () => getMateriaPrimaTemplate(form.templateId),
    [form.templateId],
  );
  const templateAvailability = React.useMemo(
    () => getMateriaPrimaTemplateAvailability(form.templateId),
    [form.templateId],
  );
  const templateFields = template?.camposTecnicos ?? [];
  const templateFieldByKey = React.useMemo(
    () => new Map(templateFields.map((field) => [field.key, field])),
    [templateFields],
  );
  const maquinaLabelById = React.useMemo(
    () => new Map(maquinas.map((maquina) => [maquina.id, maquina.nombre])),
    [maquinas],
  );

  const varianteColumns = React.useMemo(() => {
    if (template?.dimensionesVariante?.length) {
      return template.dimensionesVariante;
    }
    return [];
  }, [template]);
  const formatoHojaById = React.useMemo(
    () =>
      new Map(
        SUSTRATO_HOJA_FORMATOS_PRESET.map((formato) => [formato.id, formato]),
      ),
    [],
  );
  const currentSnapshot = React.useMemo(() => createFormSnapshot(form), [form]);
  const pendingChanges = React.useMemo(() => {
    if (currentSnapshot === savedSnapshot) return 0;
    const { variantes: currentVariants = [], ...currentFields } = JSON.parse(currentSnapshot) as MateriaPrimaPayload;
    const { variantes: savedVariants = [], ...savedFields } = JSON.parse(savedSnapshot) as MateriaPrimaPayload;
    // Un cambio por campo general o variante modificada; editar varias veces
    // el mismo valor no suma cambios y restaurarlo al original lo descuenta.
    const fieldKeys = new Set([...Object.keys(currentFields), ...Object.keys(savedFields)]);
    const currentValues = currentFields as Record<string, unknown>;
    const savedValues = savedFields as Record<string, unknown>;
    const fieldChanges = [...fieldKeys].filter((key) =>
      JSON.stringify(currentValues[key]) !== JSON.stringify(savedValues[key]),
    ).length;
    const currentBySku = new Map(currentVariants.map((variant) => [variant.sku, variant]));
    const savedBySku = new Map(savedVariants.map((variant) => [variant.sku, variant]));
    const variantKeys = new Set([...currentBySku.keys(), ...savedBySku.keys()]);
    const variantChanges = [...variantKeys].filter((sku) =>
      JSON.stringify(currentBySku.get(sku)) !== JSON.stringify(savedBySku.get(sku)),
    ).length;
    return fieldChanges + variantChanges;
  }, [currentSnapshot, savedSnapshot]);
  const hasChanges = pendingChanges > 0;

  React.useEffect(() => {
    const nextForm = mapMateriaPrimaToForm(materiaPrima, moneda);
    setForm(nextForm);
    setSavedSnapshot(createFormSnapshot(nextForm));
    setCustomFormatoModeByVariante({});
  }, [materiaPrima, moneda]);

  React.useEffect(() => {
    setForm((prev) => {
      let changed = false;
      const next = { ...prev };

      if (
        templateAvailability.lockEsRepuesto &&
        prev.esRepuesto !== templateAvailability.esRepuesto
      ) {
        next.esRepuesto = templateAvailability.esRepuesto;
        changed = true;
      }
      if (
        templateAvailability.lockEsConsumible &&
        prev.esConsumible !== templateAvailability.esConsumible
      ) {
        next.esConsumible = templateAvailability.esConsumible;
        changed = true;
      }
      if (
        templateAvailability.lockEsProductoBase &&
        prev.esProductoBase !== templateAvailability.esProductoBase
      ) {
        next.esProductoBase = templateAvailability.esProductoBase;
        changed = true;
      }

      return changed ? next : prev;
    });
  }, [
    templateAvailability.esConsumible,
    templateAvailability.esRepuesto,
    templateAvailability.esProductoBase,
    templateAvailability.lockEsConsumible,
    templateAvailability.lockEsRepuesto,
    templateAvailability.lockEsProductoBase,
  ]);

  const setVariante = (id: string, patch: Partial<LocalVariante>) => {
    setForm((prev) => ({
      ...prev,
      variantes: prev.variantes.map((variante) =>
        variante.id === id ? { ...variante, ...patch } : variante,
      ),
    }));
  };

  const getVarianteAtributos = (variante: LocalVariante) =>
    parseJsonField(variante.atributosVarianteTexto, {});

  const getVarianteAtributo = (variante: LocalVariante, key: string) => {
    const attrs = getVarianteAtributos(variante);
    const value =
      key === "maquinasCompatibles" && attrs[key] === undefined
        ? attrs.marcaModeloCompatibilidad
        : attrs[key];
    if (Array.isArray(value)) {
      return value.join(", ");
    }
    return value === undefined || value === null ? "" : String(value);
  };

  const getVarianteAtributoLista = (variante: LocalVariante, key: string) => {
    const attrs = getVarianteAtributos(variante);
    const value =
      key === "maquinasCompatibles" && attrs[key] === undefined
        ? attrs.marcaModeloCompatibilidad
        : attrs[key];
    if (Array.isArray(value)) {
      return value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean);
    }
    if (typeof value === "string") {
      return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    }
    return [];
  };

  const hasVarianteDimensionValue = React.useCallback(
    (variante: LocalVariante) => {
      const attrs = getVarianteAtributos(variante);
      return varianteColumns.some((key) => {
        const value = attrs[key];
        if (Array.isArray(value)) return value.length > 0;
        if (typeof value === "number") return Number.isFinite(value);
        if (typeof value === "boolean") return true;
        return String(value ?? "").trim().length > 0;
      });
    },
    [varianteColumns],
  );

  const variantesPrecio = React.useMemo(
    () =>
      form.variantes.filter((variante) => hasVarianteDimensionValue(variante)),
    [form.variantes, hasVarianteDimensionValue],
  );
  const showLaserWearRecommendation = React.useMemo(() => {
    if (template?.id !== "repuesto_impresion_v1") {
      return false;
    }
    return form.variantes.some((variante) => {
      const plantillas = getVarianteAtributoLista(
        variante,
        "plantillasCompatibles",
      );
      return plantillas.includes("impresora_laser");
    });
  }, [form.variantes, template?.id]);
  const hasLaserImageUnitComponents = React.useMemo(() => {
    if (template?.id !== "repuesto_impresion_v1") {
      return false;
    }
    return form.variantes.some((variante) => {
      const plantillas = getVarianteAtributoLista(
        variante,
        "plantillasCompatibles",
      );
      if (!plantillas.includes("impresora_laser")) {
        return false;
      }
      const tipo = getVarianteAtributo(variante, "tipoComponenteDesgaste")
        .trim()
        .toLowerCase();
      return COMPONENTES_UNIDAD_IMAGEN_LASER.has(tipo);
    });
  }, [form.variantes, template?.id]);
  const setVarianteAtributo = (
    varianteId: string,
    key: string,
    value: string,
  ) => {
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

  const setVarianteAtributoLista = (
    varianteId: string,
    key: string,
    values: string[],
  ) => {
    const variante = form.variantes.find((item) => item.id === varianteId);
    if (!variante) return;
    const attrs = getVarianteAtributos(variante);
    attrs[key] = values;
    if (key === "maquinasCompatibles") {
      delete attrs.marcaModeloCompatibilidad;
    }
    setVariante(varianteId, {
      atributosVarianteTexto: JSON.stringify(attrs),
    });
  };

  const findFormatoHojaPreset = (variante: LocalVariante) => {
    const attrs = getVarianteAtributos(variante);
    const formato = String(attrs.formatoComercial ?? "")
      .trim()
      .toLowerCase();
    const ancho = Number(attrs.ancho);
    const alto = Number(attrs.alto);
    return SUSTRATO_HOJA_FORMATOS_PRESET.find((item) => {
      if (item.nombre.toLowerCase() !== formato) return false;
      return (
        Math.abs(item.ancho - ancho) < 0.001 &&
        Math.abs(item.alto - alto) < 0.001
      );
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

  const isSustratoHojaDimensionLocked = (
    variante: LocalVariante,
    key: string,
  ) => {
    if (!SHEET_LIKE_TEMPLATE_IDS.has(template?.id ?? "")) return false;
    if (key !== "ancho" && key !== "alto") return false;
    if (customFormatoModeByVariante[variante.id] === true) return false;
    return Boolean(findFormatoHojaPreset(variante));
  };

  const addVariante = () => {
    setForm((prev) => ({
      ...prev,
      variantes: [...prev.variantes, createEmptyVariante()],
    }));
  };

  const removeVariante = (id: string) => {
    setForm((prev) => ({
      ...prev,
      variantes:
        prev.variantes.length === 1
          ? prev.variantes
          : prev.variantes.filter((variante) => variante.id !== id),
    }));
  };

  const save = async () => {
    if (!puedeGestionar) return;
    if (!hasChanges) {
      return;
    }
    if (!form.nombre.trim()) {
      toast.error("Completá el nombre antes de guardar.");
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
      const updatedForm = mapMateriaPrimaToForm(updated, moneda);
      setForm(updatedForm);
      setSavedMaterial(updated);
      setSavedSnapshot(createFormSnapshot(updatedForm));
      toast.success("Ficha de materia prima actualizada.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "No se pudo guardar.";
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section
      {...scope} data-visual="brand"
      className={`${themeClass} ${listPage.page} ${styles.page} ${styles.ficha}`}
    >
      <Link href="/inventario/materias-primas" className={styles.backLink}>
        <ArrowLeftIcon size={14} /> Materiales
      </Link>
      <header className={listPage.header}>
        <div>
          <p className={styles.eyebrow}>Inventario · Ficha del material</p>
          <h1>{form.nombre || "Materia prima"}<span className={styles.titleDot}>.</span></h1>
        </div>
        <div className={styles.headerActions}>
          <div className={styles.activeToggle}>
            <span>{form.activo ? "Material activo" : "Material inactivo"}</span>
            <Switch
              size="sm"
              aria-label="Material activo"
              isDisabled={!puedeGestionar}
              isSelected={form.activo}
              onChange={(checked) =>
                setForm((prev) => ({ ...prev, activo: checked }))
              }
            >
              <Switch.Content>
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
              </Switch.Content>
            </Switch>
          </div>
          <ActionButton
            onPress={save}
            isPending={isSaving}
            isDisabled={!puedeGestionar || !hasChanges || isSaving}
            aria-label={isSaving ? "Guardando cambios" : hasChanges
              ? `Guardar cambios, ${pendingChanges} ${pendingChanges === 1 ? "cambio pendiente" : "cambios pendientes"}`
              : "Guardar cambios"}
          >
            <SaveIcon size={16} />
            {isSaving ? "Guardando…" : "Guardar cambios"}
            {hasChanges && (
              <Badge variant="secondary" className="min-w-5 px-1 tabular-nums" aria-hidden="true">
                {pendingChanges}
              </Badge>
            )}
          </ActionButton>
        </div>
      </header>
      <Tabs
        selectedKey={activeTab}
        onSelectionChange={(key) => setActiveTab(String(key))}
        className={styles.tabsRoot}
      >
        <div className={styles.tabsBar}>
          <NavigationTabList
            label="Ficha del material"
            className={styles.fichaTabs}
            variant="detailed"
            tone="graphite"
            items={[
              {
                id: "datos-base",
                label: "Datos generales",
                description: "Identidad y uso",
                icon: <FileTextIcon size={16} />,
              },
              {
                id: "opciones-variantes",
                label: "Variantes",
                description: "Opciones y formatos",
                icon: <LayersIcon size={16} />,
                count: form.variantes.length,
              },
              {
                id: "precios",
                label: "Compra y costos",
                description: "Coeficientes y precios",
                icon: <DollarSignIcon size={16} />,
              },
              {
                id: "inventario",
                label: "Inventario",
                description: "Existencias y valor",
                icon: <PackageIcon size={16} />,
              },
              {
                id: "historial",
                label: "Historial",
                description: "Cambios del material",
                icon: <HistoryIcon size={16} />,
              },
            ]}
          />
        </div>

        <Tabs.Panel id="datos-base" className={styles.generalPanel}>
          <fieldset disabled={!puedeGestionar} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>

          <div className={styles.generalSections}>
            <section className={styles.formSection}>
              <div className={styles.sectionHeading}>
                <span className={styles.sectionIndex}>01</span>
                <div>
                  <h2>Identidad del material</h2>
                  <p>Datos con los que lo reconocés en tu catálogo.</p>
                </div>
              </div>
              <FieldGroup className={styles.formFields}>
                <Field>
                  <FieldLabel htmlFor="material-nombre">Nombre</FieldLabel>
                  <Input
                    id="material-nombre"
                    value={form.nombre}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        nombre: event.target.value,
                      }))
                    }
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="material-descripcion">
                    Descripción
                  </FieldLabel>
                  <Textarea
                    id="material-descripcion"
                    value={form.descripcion}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        descripcion: event.target.value,
                      }))
                    }
                  />
                </Field>

              </FieldGroup>
            </section>
            <section className={styles.formSection}>
              <div className={styles.sectionHeading}>
                <span className={styles.sectionIndex}>02</span>
                <div>
                  <h2>Clasificación y unidades</h2>
                  <p>Familia técnica y unidades para comprar y usar el material.</p>
                </div>
              </div>
              <FieldGroup className={styles.formFields}>
                <div className={styles.formGrid}>
                  <Field>
                    <FieldLabel>Familia</FieldLabel>
                    <SelectField
                      value={form.familia}
                      onChange={(value) =>
                        setForm((prev) => ({
                          ...prev,
                          familia: value as FamiliaMateriaPrima,
                        }))
                      }
                      aria-label="Familia"
                      options={familiaMateriaPrimaItems}
                    />
                  </Field>

                  <Field>
                    <FieldLabel>Subfamilia</FieldLabel>
                    <SelectField
                      value={form.subfamilia}
                      onChange={(value) =>
                        setForm((prev) => ({
                          ...prev,
                          subfamilia: value as SubfamiliaMateriaPrima,
                        }))
                      }
                      aria-label="Subfamilia"
                      options={subfamiliaMateriaPrimaItems}
                    />
                  </Field>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <Field>
                    <FieldLabel>Unidad de compra</FieldLabel>
                    <SelectField
                      value={form.unidadCompra}
                      onChange={(value) =>
                        setForm((prev) => ({
                          ...prev,
                          unidadCompra: value as UnidadMateriaPrima,
                          variantes: prev.variantes.map((v) => ({
                            ...v,
                            unidadCompra: undefined,
                            unidadPrecio: value as UnidadMateriaPrima,
                            equivalenciaCompra: null,
                          })),
                        }))
                      }
                      aria-label="Unidad de compra"
                      options={unidadMateriaPrimaItems}
                    />
                  </Field>
                  <Field>
                    <FieldLabel>Unidad de stock</FieldLabel>
                    <SelectField
                      value={form.unidadStock}
                      onChange={(value) =>
                        setForm((prev) => ({
                          ...prev,
                          unidadStock: value as UnidadMateriaPrima,
                          variantes: prev.variantes.map((v) => ({
                            ...v,
                            unidadStock: undefined,
                            equivalenciaCompra: null,
                          })),
                        }))
                      }
                      aria-label="Unidad de stock"
                      options={unidadMateriaPrimaItems}
                    />
                  </Field>
                  <Field>
                    <FieldLabel>Unidad de consumo</FieldLabel>
                    <SelectField
                      value={form.unidadUso}
                      aria-label="Unidad de consumo"
                      options={unidadMateriaPrimaItems}
                      onChange={(value) =>
                        setForm((prev) => ({
                          ...prev,
                          unidadUso: value as UnidadMateriaPrima,
                          variantes: prev.variantes.map((v) => ({
                            ...v,
                            unidadUso: undefined,
                          })),
                        }))
                      }
                    />
                  </Field>
                </div>

                <p className="text-sm text-muted-foreground">
                  Estas unidades se aplican a todas las variantes al cambiarlas.
                  El stock lleva las existencias; el consumo se usa para
                  cotizar. Los coeficientes de cada variante se configuran en
                  Compra y costos.
                </p>
                <ActionButton
                  variant="secondary"
                  onPress={() => setActiveTab("precios")}
                >
                  Configurar coeficientes ↗
                </ActionButton>
              </FieldGroup>
            </section>
            <section className={styles.formSection}>
              <div className={styles.sectionHeading}>
                <span className={styles.sectionIndex}>03</span>
                <div>
                  <h2>Disponibilidad</h2>
                  <p>Cómo puede utilizarse en la operación de tu empresa.</p>
                </div>
              </div>
              <FieldGroup className={styles.formFields}>
                <div className={styles.formGrid}>
                  <Field>
                    <FieldLabel>Disponible como consumible</FieldLabel>
                    <div className={styles.switchBox}>
                      <Switch
                        size="sm"
                        aria-label="Disponible como consumible"
                        isSelected={form.esConsumible}
                        isDisabled={templateAvailability.lockEsConsumible}
                        onChange={(checked) =>
                          setForm((prev) => ({
                            ...prev,
                            esConsumible: checked,
                          }))
                        }
                      >
                        <Switch.Content>
                          <Switch.Control>
                            <Switch.Thumb />
                          </Switch.Control>
                        </Switch.Content>
                      </Switch>
                    </div>
                  </Field>
                  <Field>
                    <FieldLabel>Disponible como repuesto</FieldLabel>
                    <div className={styles.switchBox}>
                      <Switch
                        size="sm"
                        aria-label="Disponible como repuesto"
                        isSelected={form.esRepuesto}
                        isDisabled={templateAvailability.lockEsRepuesto}
                        onChange={(checked) =>
                          setForm((prev) => ({ ...prev, esRepuesto: checked }))
                        }
                      >
                        <Switch.Content>
                          <Switch.Control>
                            <Switch.Thumb />
                          </Switch.Control>
                        </Switch.Content>
                      </Switch>
                    </div>
                  </Field>
                </div>
              </FieldGroup>
            </section>
          </div>
        </fieldset>
        </Tabs.Panel>

        <Tabs.Panel id="opciones-variantes" className={styles.tabPanel}>
          <fieldset disabled={!puedeGestionar} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>

          <div className="flex flex-col gap-4">
            <div className={styles.sectionHeading}>
              <span className={styles.sectionSymbol}><LayersIcon size={20} aria-hidden /></span>
              <div>
                <h2>Variantes del material</h2>
                <p>Formatos, dimensiones y opciones de {form.nombre || "esta materia prima"}.</p>
              </div>
            </div>
            {showLaserWearRecommendation ? (
              <div className={styles.warning}>
                <div className="flex items-start gap-2">
                  <InfoIcon className="mt-0.5 size-4 shrink-0" />
                  <div className="flex flex-col gap-1">
                    <p className="font-medium">
                      Recomendación para impresión láser
                    </p>
                    <p>
                      En repuestos de unidad de imagen
                      {hasLaserImageUnitComponents
                        ? " (tambor OPC, unidad reveladora, unidad de carga y cuchilla de limpieza)"
                        : ""}{" "}
                      la vida útil real puede caer hasta un 50% respecto del
                      rendimiento estimado por el fabricante cuando se trabaja
                      con papeles de alto gramaje.
                    </p>
                    <p>
                      Sugerencia: si el fabricante declara 100.000 copias,
                      evaluar cargar 50.000 como referencia base para costeo
                      conservador.
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            <div className={styles.tableFrame}>
              <Table className={styles.table}>
                <TableHeader>
                  <TableRow>
                    {varianteColumns.map((key) => (
                      <TableHead key={key}>
                        {(() => {
                          const field = templateFieldByKey.get(key);
                          const conversion = displayUnitFactor(field);
                          const unit = conversion
                            ? { symbol: conversion.symbol }
                            : getUnitDefinition(
                                field?.unit as unknown as Parameters<
                                  typeof getUnitDefinition
                                >[0],
                              );
                          const label = field?.label ?? formatFieldLabel(key);
                          const tooltipText =
                            key === "vidaUtilReferencia"
                              ? "Vida útil esperada del repuesto en la unidad seleccionada."
                              : key === "cantidadPorRecambio"
                                ? "Cantidad de unidades que se reemplazan en cada cambio."
                                : "";
                          return (
                            <div className="inline-flex items-center gap-1">
                              <span>
                                {unit ? `${label} (${unit.symbol})` : label}
                              </span>
                              {tooltipText ? (
                                <Tooltip>
                                  <ActionButton
                                    variant="ghost"
                                    isIconOnly
                                    aria-label="Más información"
                                  >
                                    <InfoIcon className="size-3.5 text-muted-foreground" />
                                  </ActionButton>
                                  <Tooltip.Content
                                    {...scope}
                                    className={themeClass}
                                  >
                                    {tooltipText}
                                  </Tooltip.Content>
                                </Tooltip>
                              ) : null}
                            </div>
                          );
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
                          {SHEET_LIKE_TEMPLATE_IDS.has(template?.id ?? "") &&
                          key === "formatoComercial" ? (
                            (() => {
                              const currentValue = getVarianteAtributo(
                                variante,
                                key,
                              );
                              const currentPreset =
                                findFormatoHojaPreset(variante);
                              const isPreset = Boolean(currentPreset);
                              const isCustomMode =
                                customFormatoModeByVariante[variante.id] ===
                                true;

                              if (isCustomMode) {
                                return (
                                  <div className="flex items-center gap-2">
                                    <Input
                                      aria-label="Formato comercial personalizado"
                                      placeholder="Nombre personalizado"
                                      value={currentValue}
                                      onChange={(event) =>
                                        setVarianteAtributo(
                                          variante.id,
                                          key,
                                          event.target.value,
                                        )
                                      }
                                    />
                                    <ActionButton
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onPress={() =>
                                        setCustomFormatoModeByVariante(
                                          (prev) => ({
                                            ...prev,
                                            [variante.id]: false,
                                          }),
                                        )
                                      }
                                    >
                                      Lista
                                    </ActionButton>
                                  </div>
                                );
                              }

                              return (
                                <SelectField
                                  value={currentPreset?.id ?? "__none__"}
                                  onChange={(value) => {
                                    const next = value ?? "__none__";
                                    if (next === "__custom__") {
                                      setCustomFormatoModeByVariante(
                                        (prev) => ({
                                          ...prev,
                                          [variante.id]: true,
                                        }),
                                      );
                                      if (isPreset) {
                                        setVarianteAtributo(
                                          variante.id,
                                          key,
                                          "",
                                        );
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
                                  aria-label="Formato comercial"
                                  options={[
                                    {
                                      value: "__none__",
                                      label: "Seleccionar formato",
                                    },
                                    ...SUSTRATO_HOJA_FORMATOS_PRESET.map(
                                      (formato) => ({
                                        value: formato.id,
                                        label: `${formato.nombre} (${formato.ancho} x ${formato.alto} cm)`,
                                      }),
                                    ),
                                    {
                                      value: "__custom__",
                                      label: "Personalizado",
                                    },
                                  ]}
                                />
                              );
                            })()
                          ) : key === "maquinasCompatibles" ? (
                            <MaterialMultiSelect
                              label="Máquinas compatibles"
                              placeholder="Seleccionar máquinas"
                              values={getVarianteAtributoLista(variante, key)}
                              options={maquinas.map((maquina) => ({
                                value: maquina.id,
                                label: maquina.nombre,
                              }))}
                              onChange={(nextValues) =>
                                setVarianteAtributoLista(
                                  variante.id,
                                  key,
                                  nextValues,
                                )
                              }
                            />
                          ) : templateFieldByKey.get(key)?.options?.length ? (
                            key === "plantillasCompatibles" ? (
                              <MaterialMultiSelect
                                label="Plantillas compatibles"
                                placeholder="Seleccionar plantillas"
                                values={getVarianteAtributoLista(variante, key)}
                                options={(
                                  templateFieldByKey.get(key)?.options ?? []
                                ).map((option) => ({
                                  value: option,
                                  label: getTemplateOptionLabel(key, option),
                                }))}
                                onChange={(nextValues) => {
                                  setVarianteAtributoLista(
                                    variante.id,
                                    key,
                                    nextValues,
                                  );
                                  if (key === "plantillasCompatibles") {
                                    const currentTipo = getVarianteAtributo(
                                      variante,
                                      "tipoComponenteDesgaste",
                                    )
                                      .trim()
                                      .toLowerCase();
                                    if (currentTipo.length === 0) {
                                      return;
                                    }
                                    const availableTipos =
                                      getReplacementComponentOptionsForTemplates(
                                        nextValues,
                                      );
                                    if (
                                      !availableTipos.some(
                                        (item) => item === currentTipo,
                                      )
                                    ) {
                                      setVarianteAtributo(
                                        variante.id,
                                        "tipoComponenteDesgaste",
                                        "",
                                      );
                                    }
                                  }
                                }}
                              />
                            ) : (
                              (() => {
                                const dynamicOptions =
                                  key === "tipoComponenteDesgaste"
                                    ? getReplacementComponentOptionsForTemplates(
                                        getVarianteAtributoLista(
                                          variante,
                                          "plantillasCompatibles",
                                        ),
                                      )
                                    : (templateFieldByKey.get(key)?.options ??
                                      []);
                                return (
                                  <SelectField
                                    value={
                                      getVarianteAtributo(variante, key) ||
                                      "__none__"
                                    }
                                    onChange={(value) =>
                                      setVarianteAtributo(
                                        variante.id,
                                        key,
                                        value === "__none__"
                                          ? ""
                                          : (value ?? ""),
                                      )
                                    }
                                    aria-label={
                                      templateFieldByKey.get(key)?.label ??
                                      formatFieldLabel(key)
                                    }
                                    options={[
                                      {
                                        value: "__none__",
                                        label: "Seleccionar",
                                      },
                                      ...dynamicOptions.map((option) => ({
                                        value: option,
                                        label: getTemplateOptionLabel(
                                          key,
                                          option,
                                        ),
                                      })),
                                    ]}
                                  />
                                );
                              })()
                            )
                          ) : (
                            (() => {
                              const conversion = displayUnitFactor(
                                templateFieldByKey.get(key),
                              );
                              const raw = getVarianteAtributo(variante, key);
                              const shown =
                                conversion &&
                                raw.trim() !== "" &&
                                Number.isFinite(Number(raw))
                                  ? String(Number(raw) * conversion.factor)
                                  : raw;
                              return (
                                <Input
                                  aria-label={
                                    templateFieldByKey.get(key)?.label ??
                                    formatFieldLabel(key)
                                  }
                                  type="text"
                                  inputMode={
                                    templateFieldByKey.get(key)?.type ===
                                    "number"
                                      ? "decimal"
                                      : undefined
                                  }
                                  value={shown}
                                  disabled={isSustratoHojaDimensionLocked(
                                    variante,
                                    key,
                                  )}
                                  onChange={(event) => {
                                    const texto = event.target.value;
                                    const numero = Number(
                                      texto.replace(",", "."),
                                    );
                                    // Con unidad de display, lo tipeado se convierte a la
                                    // canónica al guardar (cm → mm); texto no numérico pasa
                                    // crudo para no comerse el tipeo.
                                    setVarianteAtributo(
                                      variante.id,
                                      key,
                                      conversion &&
                                        texto.trim() !== "" &&
                                        Number.isFinite(numero)
                                        ? String(numero / conversion.factor)
                                        : texto,
                                    );
                                  }}
                                />
                              );
                            })()
                          )}
                        </TableCell>
                      ))}
                      <TableCell>
                        <Switch
                          size="sm"
                          aria-label="Variante activa"
                          isSelected={variante.activo}
                          onChange={(checked) =>
                            setVariante(variante.id, { activo: checked })
                          }
                        >
                          <Switch.Content>
                            <Switch.Control>
                              <Switch.Thumb />
                            </Switch.Control>
                          </Switch.Content>
                        </Switch>
                      </TableCell>
                      <TableCell className="text-right">
                        <ActionButton
                          type="button"
                          variant="outline"
                          size="sm"
                          onPress={() => removeVariante(variante.id)}
                        >
                          <TrashIcon className="size-4" />
                          Quitar
                        </ActionButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-end">
              <ActionButton
                type="button"
                variant="outline"
                size="sm"
                onPress={addVariante}
              >
                <CirclePlusIcon className="size-4" />
                Agregar variante
              </ActionButton>
            </div>
          </div>
        </fieldset>
        </Tabs.Panel>

        <Tabs.Panel id="precios" className={styles.tabPanel}>
          <fieldset disabled={!puedeGestionar} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>

          <div className="flex flex-col gap-3">
            <div className={styles.sectionHeading}>
              <span className={styles.sectionSymbol}><DollarSignIcon size={20} aria-hidden /></span>
              <div>
                <h2>Compra, uso y costos</h2>
                <p>
                  Cargá el precio por unidad de compra. Si el consumo es
                  diferente, calculamos su costo con los coeficientes del
                  material.
                </p>
              </div>
            </div>
            <div className={styles.tableFrame}>
              <Table className={styles.table}>
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
                                {templateFieldByKey.get(key)?.label ??
                                  formatFieldLabel(key)}
                                :{" "}
                                {(() => {
                                  const rawValue = getVarianteAtributo(
                                    variante,
                                    key,
                                  );
                                  if (key === "plantillasCompatibles") {
                                    const values = getVarianteAtributoLista(
                                      variante,
                                      key,
                                    );
                                    return values.length > 0
                                      ? values
                                          .map((value) =>
                                            getTemplateOptionLabel(key, value),
                                          )
                                          .join(", ")
                                      : "-";
                                  }
                                  if (key === "maquinasCompatibles") {
                                    const values = getVarianteAtributoLista(
                                      variante,
                                      key,
                                    );
                                    return values.length > 0
                                      ? values
                                          .map(
                                            (value) =>
                                              maquinaLabelById.get(value) ??
                                              value,
                                          )
                                          .join(", ")
                                      : "-";
                                  }
                                  return rawValue
                                    ? getTemplateOptionLabel(key, rawValue)
                                    : "-";
                                })()}
                              </span>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <MaterialConversionFields
                            context={{
                              ...resolveVarianteUnits(
                                variante,
                                form.unidadStock,
                                form.unidadCompra,
                                form.unidadUso,
                              ),
                              unidadPrecio:
                                variante.unidadPrecio === undefined
                                  ? (variante.unidadCompra ?? form.unidadCompra)
                                  : variante.unidadPrecio,
                              equivalenciaCompra: variante.equivalenciaCompra,
                              equivalencias: variante.equivalencias,
                              templateId: template?.id ?? form.templateId,
                              atributos: getVarianteAtributos(variante),
                            }}
                            price={variante.precioReferencia}
                            moneda={monedaDe(variante.moneda || moneda.codigo)}
                            onChange={(patch) =>
                              setVariante(variante.id, patch)
                            }
                          >
                            <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-2">
                              <SelectField
                                aria-label="Moneda del costo"
                                value={variante.moneda || moneda.codigo}
                                options={Array.from(
                                  new Set(
                                    [
                                      moneda.codigo,
                                      "USD",
                                      variante.moneda,
                                    ].filter((value): value is string =>
                                      Boolean(value),
                                    ),
                                  ),
                                ).map((value) => ({ value, label: value }))}
                                onChange={(value) =>
                                  setVariante(variante.id, {
                                    moneda: value,
                                    precioReferenciaTexto:
                                      variante.precioReferencia == null
                                        ? ""
                                        : numeroMoneda(
                                            variante.precioReferencia,
                                            monedaDe(value),
                                          ),
                                  })
                                }
                              />
                              <MoneyInput
                                value={
                                  variante.precioReferenciaTexto ??
                                  (variante.precioReferencia != null
                                    ? numeroMoneda(
                                        variante.precioReferencia,
                                        monedaDe(
                                          variante.moneda || moneda.codigo,
                                        ),
                                      )
                                    : "")
                                }
                                moneda={monedaDe(
                                  variante.moneda || moneda.codigo,
                                )}
                                ariaLabel="Precio de referencia"
                                onValueChange={(texto, numero) =>
                                  setVariante(variante.id, {
                                    precioReferenciaTexto: texto,
                                    precioReferencia: numero ?? undefined,
                                  })
                                }
                              />
                            </div>
                          </MaterialConversionFields>
                        </TableCell>
                        <TableCell>
                          <SelectField
                            value={variante.proveedorReferenciaId ?? "__none__"}
                            onChange={(value) => {
                              const nextValue = value ?? "__none__";
                              setVariante(variante.id, {
                                proveedorReferenciaId:
                                  nextValue === "__none__"
                                    ? undefined
                                    : nextValue,
                              });
                            }}
                            aria-label="Proveedor de referencia"
                            options={[
                              { value: "__none__", label: "Sin proveedor" },
                              ...proveedores.map((proveedor) => ({
                                value: proveedor.id,
                                label: proveedor.nombre,
                              })),
                            ]}
                          />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </fieldset>
        </Tabs.Panel>

        <Tabs.Panel id="inventario" className={styles.tabPanel}>
          {activeTab === "inventario" && (
            <MaterialInventarioPanel material={savedMaterial} />
          )}
        </Tabs.Panel>

        <Tabs.Panel id="historial" className={styles.tabPanel}>
          <p className={styles.historyEmpty}>
            <HistoryIcon size={28} aria-hidden />
            <strong>Historial del material</strong>
            El registro de cambios de plantilla, datos técnicos y precios aún no está disponible.
          </p>
        </Tabs.Panel>
      </Tabs>
    </section>
  );
}
