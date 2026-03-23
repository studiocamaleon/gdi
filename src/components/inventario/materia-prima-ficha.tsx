"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeftIcon,
  ChevronDownIcon,
  CirclePlusIcon,
  HistoryIcon,
  InfoIcon,
  PackageIcon,
  SaveIcon,
  TrashIcon,
} from "lucide-react";
import { toast } from "sonner";

import { updateMateriaPrima } from "@/lib/materias-primas-api";
import { getKardex, getStockActual } from "@/lib/inventario-stock-api";
import type { MovimientoStockMateriaPrima, StockMateriaPrimaItem } from "@/lib/inventario-stock";
import {
  familiaMateriaPrimaItems,
  unidadMateriaPrimaItems,
  type FamiliaMateriaPrima,
  type MateriaPrima,
  type MateriaPrimaPayload,
  type SubfamiliaMateriaPrima,
  type UnidadMateriaPrima,
} from "@/lib/materias-primas";
import type { Maquina } from "@/lib/maquinaria";
import { getMateriaPrimaVarianteLabel } from "@/lib/materias-primas-variantes-display";
import {
  SUSTRATO_HOJA_FORMATOS_PRESET,
  getMateriaPrimaTemplateAvailability,
  getMateriaPrimaTemplate,
  getReplacementComponentLabel,
  getReplacementComponentOptionsForTemplates,
} from "@/lib/materia-prima-templates";
import { getPlantillaMaquinariaLabel } from "@/lib/maquinaria-templates";
import { areUnitsCompatible, convertUnitPrice, getUnitDefinition } from "@/lib/unidades";
import { convertFlexibleRollUnitPrice } from "@/lib/unidades-derivadas";
import type { ProveedorDetalle } from "@/lib/proveedores";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const number2Formatter = new Intl.NumberFormat("es-AR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

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

function formatCurrencyUnit(value: number, unitLabel: string) {
  return `$${number2Formatter.format(value)} por ${unitLabel}`;
}

function resolveVarianteUnits(
  variante: LocalVariante,
  fallbackStock: UnidadMateriaPrima,
  fallbackCompra: UnidadMateriaPrima,
) {
  return {
    unidadStock: variante.unidadStock ?? fallbackStock,
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
  precioReferencia?: number;
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
  esConsumible: boolean;
  esRepuesto: boolean;
  activo: boolean;
  atributosTecnicosTexto: string;
  variantes: LocalVariante[];
};

type MateriaPrimaFichaProps = {
  materiaPrima: MateriaPrima;
  proveedores: ProveedorDetalle[];
  maquinas: Maquina[];
};

type InventarioVarianteResumen = {
  varianteId: string;
  varianteLabel: string;
  stockTotal: number;
  costoPromedio: number;
  valorStock: number;
  almacenesConStock: number;
  ultimoMovimiento: MovimientoStockMateriaPrima | null;
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
    presentacionMl: "volumenPresentacion",
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
    proveedorReferenciaId: undefined,
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
  if (fieldKey === "plantillasCompatibles" || fieldKey === "plantillaCompatible") {
    return getPlantillaMaquinariaLabel(value as Parameters<typeof getPlantillaMaquinariaLabel>[0]);
  }

  return value;
}

const COMPONENTES_UNIDAD_IMAGEN_LASER = new Set<string>([
  "drum_opc",
  "developer_unit",
  "charge_unit",
  "drum_cleaning_blade",
]);

function formatFechaCorta(value: string) {
  return new Date(value).toLocaleString();
}

function getMovimientoTipoLabel(tipo: string) {
  switch (tipo) {
    case "ingreso":
      return "Ingreso";
    case "egreso":
      return "Egreso";
    case "ajuste_entrada":
      return "Ajuste +";
    case "ajuste_salida":
      return "Ajuste -";
    case "transferencia_entrada":
      return "Transferencia +";
    case "transferencia_salida":
      return "Transferencia -";
    default:
      return tipo;
  }
}

export function MateriaPrimaFicha({ materiaPrima, proveedores, maquinas }: MateriaPrimaFichaProps) {
  const router = useRouter();
  const [form, setForm] = React.useState<FormState>(() => mapMateriaPrimaToForm(materiaPrima));
  const [savedSnapshot, setSavedSnapshot] = React.useState(() =>
    createFormSnapshot(mapMateriaPrimaToForm(materiaPrima)),
  );
  const [activeTab, setActiveTab] = React.useState("datos-base");
  const [isSaving, setIsSaving] = React.useState(false);
  const [inventarioResumen, setInventarioResumen] = React.useState<InventarioVarianteResumen[]>([]);
  const [inventarioLoading, setInventarioLoading] = React.useState(false);
  const [customFormatoModeByVariante, setCustomFormatoModeByVariante] = React.useState<Record<string, boolean>>({});

  const template = React.useMemo(() => getMateriaPrimaTemplate(form.templateId), [form.templateId]);
  const templateAvailability = React.useMemo(
    () => getMateriaPrimaTemplateAvailability(form.templateId),
    [form.templateId],
  );
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
  const maquinaLabelById = React.useMemo(
    () =>
      new Map(
        maquinas.map((maquina) => [
          maquina.id,
          `${maquina.nombre}${maquina.codigo ? ` (${maquina.codigo})` : ""}`,
        ]),
      ),
    [maquinas],
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

  React.useEffect(() => {
    setForm((prev) => {
      let changed = false;
      const next = { ...prev };

      if (templateAvailability.lockEsRepuesto && prev.esRepuesto !== templateAvailability.esRepuesto) {
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

      return changed ? next : prev;
    });
  }, [
    templateAvailability.esConsumible,
    templateAvailability.esRepuesto,
    templateAvailability.lockEsConsumible,
    templateAvailability.lockEsRepuesto,
  ]);

  React.useEffect(() => {
    let cancelled = false;

    const loadInventario = async () => {
      setInventarioLoading(true);
      try {
        const stockRows = await getStockActual({ materiaPrimaId: materiaPrima.id });
        const byVariante = new Map<string, StockMateriaPrimaItem[]>();

        for (const row of stockRows) {
          const current = byVariante.get(row.varianteId) ?? [];
          current.push(row);
          byVariante.set(row.varianteId, current);
        }

        const ultimoMovimientoByVariante = new Map<string, MovimientoStockMateriaPrima | null>();
        await Promise.all(
          materiaPrima.variantes.map(async (variante) => {
            try {
              const result = await getKardex({
                varianteId: variante.id,
                page: 1,
                pageSize: 1,
              });
              ultimoMovimientoByVariante.set(variante.id, result.items[0] ?? null);
            } catch {
              ultimoMovimientoByVariante.set(variante.id, null);
            }
          }),
        );

        const rows: InventarioVarianteResumen[] = materiaPrima.variantes.map((variante) => {
          const stockItems = byVariante.get(variante.id) ?? [];
          const stockTotal = stockItems.reduce((acc, item) => acc + item.cantidadDisponible, 0);
          const valorStock = stockItems.reduce((acc, item) => acc + item.valorStock, 0);
          const costoPromedio =
            stockTotal > 0 ? valorStock / stockTotal : (variante.precioReferencia ?? 0);

          return {
            varianteId: variante.id,
            varianteLabel: getMateriaPrimaVarianteLabel(materiaPrima, variante, { maxDimensiones: 5 }),
            stockTotal,
            costoPromedio,
            valorStock,
            almacenesConStock: stockItems.length,
            ultimoMovimiento: ultimoMovimientoByVariante.get(variante.id) ?? null,
          };
        });

        if (!cancelled) {
          setInventarioResumen(rows);
        }
      } finally {
        if (!cancelled) {
          setInventarioLoading(false);
        }
      }
    };

    void loadInventario();

    return () => {
      cancelled = true;
    };
  }, [materiaPrima]);

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
    () => form.variantes.filter((variante) => hasVarianteDimensionValue(variante)),
    [form.variantes, hasVarianteDimensionValue],
  );
  const showLaserWearRecommendation = React.useMemo(() => {
    if (template?.id !== "repuesto_impresion_v1") {
      return false;
    }
    return form.variantes.some((variante) => {
      const plantillas = getVarianteAtributoLista(variante, "plantillasCompatibles");
      return plantillas.includes("impresora_laser");
    });
  }, [form.variantes, template?.id]);
  const hasLaserImageUnitComponents = React.useMemo(() => {
    if (template?.id !== "repuesto_impresion_v1") {
      return false;
    }
    return form.variantes.some((variante) => {
      const plantillas = getVarianteAtributoLista(variante, "plantillasCompatibles");
      if (!plantillas.includes("impresora_laser")) {
        return false;
      }
      const tipo = getVarianteAtributo(variante, "tipoComponenteDesgaste").trim().toLowerCase();
      return COMPONENTES_UNIDAD_IMAGEN_LASER.has(tipo);
    });
  }, [form.variantes, template?.id]);
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

  const setVarianteAtributoLista = (varianteId: string, key: string, values: string[]) => {
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
                  value="inventario"
                >
                  Inventario
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
                        disabled={templateAvailability.lockEsConsumible}
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
                        disabled={templateAvailability.lockEsRepuesto}
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
                {showLaserWearRecommendation ? (
                  <div className="rounded-md border border-amber-300/70 bg-amber-50 p-3 text-sm">
                    <div className="flex items-start gap-2">
                      <InfoIcon className="mt-0.5 size-4 text-amber-700" />
                      <div className="space-y-1 text-amber-900">
                        <p className="font-medium">Recomendación para impresión láser</p>
                        <p>
                          En repuestos de unidad de imagen
                          {hasLaserImageUnitComponents
                            ? " (tambor OPC, unidad reveladora, unidad de carga y cuchilla de limpieza)"
                            : ""}{" "}
                          la vida útil real puede caer hasta un 50% respecto del rendimiento estimado por el
                          fabricante cuando se trabaja con papeles de alto gramaje.
                        </p>
                        <p>
                          Sugerencia: si el fabricante declara 100.000 copias, evaluar cargar 50.000 como
                          referencia base para costeo conservador.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : null}

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
                              const tooltipText =
                                key === "vidaUtilReferencia"
                                  ? "Vida útil esperada del repuesto en la unidad seleccionada."
                                  : key === "cantidadPorRecambio"
                                    ? "Cantidad de unidades que se reemplazan en cada cambio."
                                    : "";
                              return (
                                <div className="inline-flex items-center gap-1">
                                  <span>{unit ? `${label} (${unit.symbol})` : label}</span>
                                  {tooltipText ? (
                                    <Tooltip>
                                      <TooltipTrigger>
                                        <InfoIcon className="size-3.5 text-muted-foreground" />
                                      </TooltipTrigger>
                                      <TooltipContent>{tooltipText}</TooltipContent>
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
                              ) : key === "maquinasCompatibles" ? (
                                <DropdownMenu>
                                  <DropdownMenuTrigger className="flex h-9 w-full items-center justify-between rounded-md border px-3 text-left text-sm">
                                    <span>
                                      {(() => {
                                        const count = getVarianteAtributoLista(variante, key).length;
                                        return count > 0
                                          ? `${count} maquina${count > 1 ? "s" : ""} seleccionada${count > 1 ? "s" : ""}`
                                          : "Seleccionar maquinas";
                                      })()}
                                    </span>
                                    <ChevronDownIcon className="size-4 text-muted-foreground" />
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent className="w-[360px]">
                                    {maquinas.map((maquina) => {
                                      const selectedValues = getVarianteAtributoLista(variante, key);
                                      const isChecked = selectedValues.includes(maquina.id);
                                      return (
                                        <DropdownMenuCheckboxItem
                                          key={`${key}-${maquina.id}`}
                                          checked={isChecked}
                                          onCheckedChange={(checked) => {
                                            const nextValues = checked
                                              ? [...selectedValues, maquina.id]
                                              : selectedValues.filter((item) => item !== maquina.id);
                                            setVarianteAtributoLista(variante.id, key, nextValues);
                                          }}
                                        >
                                          {maquina.nombre}
                                          {maquina.codigo ? ` (${maquina.codigo})` : ""}
                                        </DropdownMenuCheckboxItem>
                                      );
                                    })}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              ) : templateFieldByKey.get(key)?.options?.length ? (
                                key === "plantillasCompatibles" ? (
                                  <DropdownMenu>
                                    <DropdownMenuTrigger className="flex h-9 w-full items-center justify-between rounded-md border px-3 text-left text-sm">
                                      <span>
                                        {(() => {
                                          const count = getVarianteAtributoLista(variante, key).length;
                                          return count > 0
                                            ? `${count} plantilla${count > 1 ? "s" : ""} seleccionada${count > 1 ? "s" : ""}`
                                            : "Seleccionar plantillas";
                                        })()}
                                      </span>
                                      <ChevronDownIcon className="size-4 text-muted-foreground" />
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent className="scrollbar-visible max-h-[260px] w-[320px] overflow-y-scroll">
                                      {(templateFieldByKey.get(key)?.options ?? []).map((option) => {
                                        const selectedValues = getVarianteAtributoLista(variante, key);
                                        const isChecked = selectedValues.includes(option);
                                        return (
                                          <DropdownMenuCheckboxItem
                                            key={`${key}-${option}`}
                                            checked={isChecked}
                                          onCheckedChange={(checked) => {
                                            const nextValues = checked
                                              ? [...selectedValues, option]
                                              : selectedValues.filter((item) => item !== option);
                                            setVarianteAtributoLista(variante.id, key, nextValues);
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
                                                getReplacementComponentOptionsForTemplates(nextValues);
                                              if (!availableTipos.some((item) => item === currentTipo)) {
                                                setVarianteAtributo(
                                                  variante.id,
                                                  "tipoComponenteDesgaste",
                                                  "",
                                                );
                                              }
                                            }
                                          }}
                                        >
                                          {getTemplateOptionLabel(key, option)}
                                          </DropdownMenuCheckboxItem>
                                        );
                                      })}
                                    </DropdownMenuContent>
                                  </DropdownMenu>
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
                                        : (templateFieldByKey.get(key)?.options ?? []);
                                    return (
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
                                      {(() => {
                                        const currentValue = getVarianteAtributo(variante, key);
                                        const currentLabel = currentValue
                                          ? getTemplateOptionLabel(key, currentValue)
                                          : "Seleccionar";
                                        return <SelectValue>{currentLabel}</SelectValue>;
                                      })()}
                                    </SelectTrigger>
                                    <SelectContent
                                      className={
                                        key === "tipoComponenteDesgaste" ? "min-w-[360px]" : undefined
                                      }
                                    >
                                      <SelectItem value="__none__">Seleccionar</SelectItem>
                                      {dynamicOptions.map((option) => (
                                        <SelectItem key={`${key}-${option}`} value={option}>
                                          {getTemplateOptionLabel(key, option)}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                    );
                                  })()
                                )
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
                                    {(() => {
                                      const rawValue = getVarianteAtributo(variante, key);
                                      if (key === "plantillasCompatibles") {
                                        const values = getVarianteAtributoLista(variante, key);
                                        return values.length > 0
                                          ? values
                                              .map((value) => getTemplateOptionLabel(key, value))
                                              .join(", ")
                                          : "-";
                                      }
                                      if (key === "maquinasCompatibles") {
                                        const values = getVarianteAtributoLista(variante, key);
                                        return values.length > 0
                                          ? values
                                              .map((value) => maquinaLabelById.get(value) ?? value)
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
                              {(() => {
                                const { unidadStock, unidadCompra } = resolveVarianteUnits(
                                  variante,
                                  form.unidadStock,
                                  form.unidadCompra,
                                );
                                const unidadCompraLabelVariante = getLabel(
                                  unidadMateriaPrimaItems,
                                  unidadCompra,
                                );
                                const unidadStockLabelVariante = getLabel(
                                  unidadMateriaPrimaItems,
                                  unidadStock,
                                );
                                const precioReferencia = variante.precioReferencia ?? null;
                                const canConvert =
                                  typeof precioReferencia === "number" &&
                                  Number.isFinite(precioReferencia) &&
                                  precioReferencia > 0;
                                const precioPorStock =
                                  canConvert
                                    ? areUnitsCompatible(unidadCompra, unidadStock)
                                      ? convertUnitPrice(
                                          precioReferencia as number,
                                          unidadCompra,
                                          unidadStock,
                                        )
                                      : convertFlexibleRollUnitPrice({
                                          pricePerFromUnit: precioReferencia as number,
                                          from: unidadCompra,
                                          to: unidadStock,
                                          subfamilia: form.subfamilia,
                                          attributes: parseJsonField(variante.atributosVarianteTexto, {}),
                                        })
                                    : null;

                                return (
                                  <div className="space-y-1">
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
                                        {unidadCompraLabelVariante}
                                      </span>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                      Precio cargado:{" "}
                                      {typeof precioReferencia === "number" && Number.isFinite(precioReferencia)
                                        ? formatCurrencyUnit(precioReferencia, unidadCompraLabelVariante)
                                        : `Sin definir por ${unidadCompraLabelVariante}`}
                                    </p>
                                    {precioPorStock !== null && unidadCompra !== unidadStock ? (
                                      <p className="text-xs text-muted-foreground">
                                        Valor interno normalizado:{" "}
                                        {formatCurrencyUnit(precioPorStock, unidadStockLabelVariante)}
                                      </p>
                                    ) : null}
                                  </div>
                                );
                              })()}
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
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Stock total</CardTitle>
                    </CardHeader>
                    <CardContent className="text-2xl font-semibold">
                      {number2Formatter.format(
                        inventarioResumen.reduce((acc, item) => acc + item.stockTotal, 0),
                      )}
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Valor stock</CardTitle>
                    </CardHeader>
                    <CardContent className="text-2xl font-semibold">
                      $ {number2Formatter.format(
                        inventarioResumen.reduce((acc, item) => acc + item.valorStock, 0),
                      )}
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Variantes con stock</CardTitle>
                    </CardHeader>
                    <CardContent className="text-2xl font-semibold">
                      {inventarioResumen.filter((item) => item.stockTotal > 0).length}
                    </CardContent>
                  </Card>
                </div>

                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Variante</TableHead>
                        <TableHead className="text-right">Stock total</TableHead>
                        <TableHead className="text-right">Costo promedio</TableHead>
                        <TableHead className="text-right">Valor stock</TableHead>
                        <TableHead className="text-right">Almacenes</TableHead>
                        <TableHead>Último movimiento</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {inventarioLoading ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-muted-foreground">
                            Cargando inventario...
                          </TableCell>
                        </TableRow>
                      ) : inventarioResumen.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-muted-foreground">
                            Esta materia prima no tiene variantes definidas para inventario.
                          </TableCell>
                        </TableRow>
                      ) : (
                        inventarioResumen.map((item) => (
                          <TableRow key={item.varianteId}>
                            <TableCell>{item.varianteLabel}</TableCell>
                            <TableCell className="text-right">
                              {number2Formatter.format(item.stockTotal)}
                            </TableCell>
                            <TableCell className="text-right">
                              $ {number2Formatter.format(item.costoPromedio)}
                            </TableCell>
                            <TableCell className="text-right">
                              $ {number2Formatter.format(item.valorStock)}
                            </TableCell>
                            <TableCell className="text-right">{item.almacenesConStock}</TableCell>
                            <TableCell>
                              {item.ultimoMovimiento
                                ? `${getMovimientoTipoLabel(item.ultimoMovimiento.tipo)} · ${formatFechaCorta(
                                    item.ultimoMovimiento.createdAt,
                                  )}`
                                : "Sin movimientos"}
                            </TableCell>
                            <TableCell>
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => router.push("/inventario/centro-stock")}
                                >
                                  <PackageIcon className="size-4" />
                                  Centro stock
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => router.push("/inventario/movimientos-kardex")}
                                >
                                  <HistoryIcon className="size-4" />
                                  Historial
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
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
