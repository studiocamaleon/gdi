"use client";

import * as React from "react";
import {
  CheckIcon,
  CircleAlertIcon,
  CalculatorIcon,
  CopyIcon,
  InfoIcon,
  PlusIcon,
  SaveIcon,
  SparklesIcon,
  Trash2Icon,
} from "lucide-react";
import { toast } from "sonner";

import { GdiSpinner } from "@/components/brand/gdi-spinner";
import {
  calcularTarifaCentroCosto,
  getCentroCostoConfiguracion,
  getCentroCostoTarifas,
  publicarTarifaCentroCosto,
  replaceCentroCostoComponentes,
  replaceCentroCostoRecursos,
  upsertCentroCostoRecursosMaquinaria,
  updateCentroCostoConfiguracionBase,
  upsertCentroCostoCapacidad,
} from "@/lib/costos-api";
import {
  AreaCosto,
  categoriaComponenteCostoItems,
  CentroCosto,
  CentroCostoCapacidadPayload,
  CentroCostoComponenteCostoPayload,
  CentroCostoPayload,
  CentroCostoRecursoMaquinariaPayload,
  CentroCostoRecursoMaquinariaPeriodo,
  EmpleadoDisponibilidadCentroCosto,
  CentroCostoRecursoPayload,
  getCategoriaComponenteCostoLabel,
  getCategoriaGraficaLabel,
  getCurrentPeriodo,
  getImputacionPreferidaLabel,
  getSuggestedUnidadBase,
  getTipoGastoGeneralLabel,
  getTipoCentroLabel,
  getTipoRecursoLabel,
  getUnidadBaseLabel,
  imputacionPreferidaItems,
  Planta,
  tipoGastoGeneralItems,
  tipoRecursoItems,
  unidadBaseItems,
} from "@/lib/costos";
import { EmpleadoDetalle } from "@/lib/empleados";
import { getMaquinas } from "@/lib/maquinaria-api";
import { Maquina } from "@/lib/maquinaria";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type CentroCostoConfiguratorProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  centro: CentroCosto | null;
  plantas: Planta[];
  areas: AreaCosto[];
  empleados: EmpleadoDetalle[];
  onConfigured: () => Promise<void> | void;
};

type WizardStep = "identidad" | "recursos" | "costos" | "capacidad" | "resultado";

type RepartoAbsorbidoItem = {
  desdeCentroCostoId: string;
  desdeCentroCodigo: string;
  desdeCentroNombre: string;
  monto: number;
};

type LocalRecurso = CentroCostoRecursoPayload & { id: string };
type LocalComponente = CentroCostoComponenteCostoPayload & { id: string };
const wizardSheetClassName =
  "w-screen max-w-none overflow-y-auto data-[side=right]:w-[96vw] data-[side=right]:sm:max-w-[96vw] md:data-[side=right]:w-[92vw] md:data-[side=right]:sm:max-w-[92vw] lg:data-[side=right]:w-[1100px] lg:data-[side=right]:sm:max-w-[1100px] xl:data-[side=right]:w-[1280px] xl:data-[side=right]:sm:max-w-[1280px]";
const systemCurrencyCode = "ARS";

function createLocalId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

function createResource(
  tipoRecurso: CentroCostoRecursoPayload["tipoRecurso"] = "empleado",
): LocalRecurso {
  return {
    id: createLocalId(),
    tipoRecurso,
    empleadoId: undefined,
    nombreRecurso: "",
    tipoGastoGeneral: undefined,
    valorMensual: undefined,
    vidaUtilRestanteMeses: undefined,
    valorActual: undefined,
    valorFinalVida: undefined,
    descripcion: "",
    porcentajeAsignacion: undefined,
    activo: true,
  };
}

function createComponent(
  categoria: CentroCostoComponenteCostoPayload["categoria"] = "otros",
  nombre = "",
  origen: CentroCostoComponenteCostoPayload["origen"] = "manual",
): LocalComponente {
  return {
    id: createLocalId(),
    categoria,
    nombre,
    origen,
    importeMensual: 0,
    notas: "",
    detalle: undefined,
  };
}

function normalizeNumber(value: unknown) {
  const numericValue =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : NaN;

  if (!Number.isFinite(numericValue)) {
    return 0;
  }

  return numericValue;
}

function getDetailValue(
  component: LocalComponente | CentroCostoComponenteCostoPayload,
  key: string,
) {
  return component.detalle && typeof component.detalle === "object"
    ? component.detalle[key]
    : undefined;
}

function getDerivedComponentKey(component: LocalComponente) {
  const kind = getDetailValue(component, "kind");
  const sourceKey = getDetailValue(component, "sourceKey");
  const part = getDetailValue(component, "part");

  if (typeof kind !== "string" || typeof sourceKey !== "string") {
    return null;
  }

  return part ? `${kind}:${sourceKey}:${String(part)}` : `${kind}:${sourceKey}`;
}

function isDerivedComponent(component: LocalComponente) {
  return getDerivedComponentKey(component) !== null;
}

function createManualCostComponent(
  categoria: LocalComponente["categoria"] = "otros",
  nombre = "",
) {
  return createComponent(categoria, nombre, "manual");
}

const additionalCostCategories = new Set<LocalComponente["categoria"]>([
  "energia",
  "mantenimiento",
  "alquiler",
  "insumos_indirectos",
  "otros",
]);

const additionalCostCategoryItems = categoriaComponenteCostoItems.filter((item) =>
  additionalCostCategories.has(item.value),
);

function createEmployeeDerivedComponent(params: {
  part: "sueldos" | "cargas";
  empleadoId: string;
  empleadoNombre: string;
  porcentajeAsignacion: number;
  current?: LocalComponente;
}) {
  const sueldoNeto = normalizeNumber(getDetailValue(params.current ?? createComponent(), "sueldoNeto"));
  const cargasSociales = normalizeNumber(
    getDetailValue(params.current ?? createComponent(), "cargasSociales"),
  );
  const baseMensual = params.part === "sueldos" ? sueldoNeto : cargasSociales;
  const importeMensual = Number(
    ((baseMensual * params.porcentajeAsignacion) / 100).toFixed(2),
  );

  return {
    id: params.current?.id ?? createLocalId(),
    categoria: params.part,
    nombre:
      params.part === "sueldos"
        ? `Sueldo neto - ${params.empleadoNombre}`
        : `Cargas sociales - ${params.empleadoNombre}`,
    origen: "sugerido" as const,
    importeMensual,
    notas: params.current?.notas ?? "",
    detalle: {
      kind: "empleado",
      sourceKey: params.empleadoId,
      empleadoId: params.empleadoId,
      empleadoNombre: params.empleadoNombre,
      part: params.part,
      sueldoNeto,
      cargasSociales,
      porcentajeAsignacion: params.porcentajeAsignacion,
      moneda: systemCurrencyCode,
      baseMensual,
    },
  } satisfies LocalComponente;
}

function calculateMachineCostPreview(item: CentroCostoRecursoMaquinariaPeriodo) {
  const amortizacionMensual = Number(
    (Math.max(0, item.valorCompra - item.valorResidual) / Math.max(1, item.vidaUtilMeses)).toFixed(2),
  );
  const horasProductivas = Number(
    (
      item.horasProgramadasMes *
      (item.disponibilidadPct / 100) *
      (item.eficienciaPct / 100)
    ).toFixed(2),
  );
  const energiaMensual = Number(
    (
      item.potenciaNominalKw *
      (item.factorCargaPct / 100) *
      horasProductivas *
      item.tarifaEnergiaKwh
    ).toFixed(2),
  );
  const costoMensualTotal = Number(
    (
      amortizacionMensual +
      energiaMensual +
      item.mantenimientoMensual +
      item.segurosMensual +
      item.otrosFijosMensual
    ).toFixed(2),
  );
  const tarifaHora = Number(
    (horasProductivas > 0 ? costoMensualTotal / horasProductivas : 0).toFixed(2),
  );

  return {
    amortizacionMensual,
    horasProductivas,
    energiaMensual,
    costoMensualTotal,
    tarifaHora,
  };
}

function createMachineCostDefault(
  resource: LocalRecurso,
  machineName: string,
): CentroCostoRecursoMaquinariaPeriodo {
  const base: CentroCostoRecursoMaquinariaPeriodo = {
    id: "",
    centroCostoRecursoId: resource.id,
    periodo: "",
    maquinaId: resource.maquinaId ?? "",
    maquinaNombre: machineName,
    metodoDepreciacion: "lineal",
    valorCompra: 0,
    valorResidual: 0,
    vidaUtilMeses: 60,
    potenciaNominalKw: 0,
    factorCargaPct: 100,
    tarifaEnergiaKwh: 0,
    horasProgramadasMes: 160,
    disponibilidadPct: 85,
    eficienciaPct: 85,
    horasProductivas: 0,
    mantenimientoMensual: 0,
    segurosMensual: 0,
    otrosFijosMensual: 0,
    amortizacionMensual: 0,
    energiaMensual: 0,
    costoMensualTotal: 0,
    tarifaHora: 0,
    updatedAt: "",
  };
  const preview = calculateMachineCostPreview(base);
  return {
    ...base,
    ...preview,
  };
}

function syncDerivedComponents(params: {
  resources: LocalRecurso[];
  current: LocalComponente[];
  empleadoLabelById: Map<string, string>;
}) {
  const manualComponents = params.current.filter((component) => !isDerivedComponent(component));
  const existingDerived = new Map(
    params.current
      .map((component) => [getDerivedComponentKey(component), component] as const)
      .filter((entry): entry is [string, LocalComponente] => Boolean(entry[0])),
  );
  const derivedComponents: LocalComponente[] = [];

  for (const resource of params.resources) {
    if (!resource.activo) {
      continue;
    }

    if (resource.tipoRecurso === "empleado" && resource.empleadoId) {
      const empleadoNombre =
        params.empleadoLabelById.get(resource.empleadoId) ?? "Persona sin nombre";
      const porcentajeAsignacion = resource.porcentajeAsignacion ?? 0;
      const sueldoKey = `empleado:${resource.empleadoId}:sueldos`;
      const cargasKey = `empleado:${resource.empleadoId}:cargas`;

      derivedComponents.push(
        createEmployeeDerivedComponent({
          part: "sueldos",
          empleadoId: resource.empleadoId,
          empleadoNombre,
          porcentajeAsignacion,
          current: existingDerived.get(sueldoKey),
        }),
        createEmployeeDerivedComponent({
          part: "cargas",
          empleadoId: resource.empleadoId,
          empleadoNombre,
          porcentajeAsignacion,
          current: existingDerived.get(cargasKey),
        }),
      );
      continue;
    }

  }

  return [...derivedComponents, ...manualComponents];
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: systemCurrencyCode,
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function formatPeriodo(periodo: string) {
  const [year, month] = periodo.split("-");

  if (!year || !month) {
    return periodo;
  }

  return `${month}/${year}`;
}

function extractRepartoAbsorbido(resumen: Record<string, unknown> | null | undefined) {
  const total =
    typeof resumen?.costoMensualAbsorbidoReparto === "number"
      ? resumen.costoMensualAbsorbidoReparto
      : 0;
  const itemsRaw = Array.isArray(resumen?.desgloseRepartoAbsorbido)
    ? resumen.desgloseRepartoAbsorbido
    : [];
  const desglose = itemsRaw
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }
      const data = item as Record<string, unknown>;
      if (
        typeof data.desdeCentroCostoId !== "string" ||
        typeof data.desdeCentroCodigo !== "string" ||
        typeof data.desdeCentroNombre !== "string" ||
        typeof data.monto !== "number"
      ) {
        return null;
      }
      return {
        desdeCentroCostoId: data.desdeCentroCostoId,
        desdeCentroCodigo: data.desdeCentroCodigo,
        desdeCentroNombre: data.desdeCentroNombre,
        monto: data.monto,
      } satisfies RepartoAbsorbidoItem;
    })
    .filter((item): item is RepartoAbsorbidoItem => Boolean(item));

  return {
    total,
    desglose,
  };
}

function FieldLabelWithTooltip({ label, help }: { label: string; help: string }) {
  return (
    <div className="flex min-h-6 items-center gap-1">
      <FieldLabel>{label}</FieldLabel>
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              type="button"
              className="inline-flex items-center text-muted-foreground transition-colors hover:text-foreground"
              aria-label={`Ayuda: ${label}`}
            >
              <InfoIcon className="size-3.5" />
            </button>
          }
        />
        <TooltipContent className="max-w-sm text-pretty" side="top">
          {help}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

export function CentroCostoConfigurator({
  open,
  onOpenChange,
  centro,
  plantas,
  areas,
  empleados,
  onConfigured,
}: CentroCostoConfiguratorProps) {
  const [periodo, setPeriodo] = React.useState(getCurrentPeriodo());
  const [activeStep, setActiveStep] = React.useState<WizardStep>("identidad");
  const [isLoading, startLoading] = React.useTransition();
  const [isSaving, startSaving] = React.useTransition();
  const [baseForm, setBaseForm] = React.useState<CentroCostoPayload | null>(null);
  const [resourcesForm, setResourcesForm] = React.useState<LocalRecurso[]>([]);
  const [componentsForm, setComponentsForm] = React.useState<LocalComponente[]>([]);
  const [machineCostsForm, setMachineCostsForm] = React.useState<
    CentroCostoRecursoMaquinariaPeriodo[]
  >([]);
  const [capacityForm, setCapacityForm] = React.useState<CentroCostoCapacidadPayload>({
    diasPorMes: 22,
    horasPorDia: 8,
    overrideManualCapacidad: undefined,
  });
  const [draftTariff, setDraftTariff] = React.useState<number | null>(null);
  const [publishedTariff, setPublishedTariff] = React.useState<number | null>(null);
  const [repartoAbsorbidoTotal, setRepartoAbsorbidoTotal] = React.useState(0);
  const [repartoAbsorbidoDesglose, setRepartoAbsorbidoDesglose] = React.useState<
    RepartoAbsorbidoItem[]
  >([]);
  const [, setWarnings] = React.useState<string[]>([]);
  const [empleadosDisponibilidad, setEmpleadosDisponibilidad] = React.useState<
    EmpleadoDisponibilidadCentroCosto[]
  >([]);
  const [maquinas, setMaquinas] = React.useState<Maquina[]>([]);

  const plantaLabelById = React.useMemo(
    () => new Map(plantas.map((planta) => [planta.id, planta.nombre])),
    [plantas],
  );
  const areaLabelById = React.useMemo(
    () => new Map(areas.map((area) => [area.id, area.nombre])),
    [areas],
  );
  const empleadoLabelById = React.useMemo(
    () => new Map(empleados.map((empleado) => [empleado.id, empleado.nombreCompleto])),
    [empleados],
  );
  const maquinaById = React.useMemo(
    () => new Map(maquinas.map((maquina) => [maquina.id, maquina])),
    [maquinas],
  );
  const maquinariaDisponibles = React.useMemo(() => {
    if (!baseForm) {
      return [];
    }
    return maquinas.filter(
      (maquina) => maquina.activo && maquina.plantaId === baseForm.plantaId,
    );
  }, [baseForm, maquinas]);
  const disponibilidadEmpleadoById = React.useMemo(
    () =>
      new Map(
        empleadosDisponibilidad.map((disponibilidad) => [
          disponibilidad.empleadoId,
          disponibilidad,
        ]),
      ),
    [empleadosDisponibilidad],
  );
  const porcentajeAsignadoEnFormularioByEmpleado = React.useMemo(() => {
    const assigned = new Map<string, number>();

    for (const resource of resourcesForm) {
      if (
        resource.tipoRecurso !== "empleado" ||
        !resource.empleadoId ||
        !resource.activo
      ) {
        continue;
      }

      assigned.set(
        resource.empleadoId,
        (assigned.get(resource.empleadoId) ?? 0) +
          (resource.porcentajeAsignacion ?? 0),
      );
    }

    return assigned;
  }, [resourcesForm]);
  const disponibilidadRestanteEmpleadoById = React.useMemo(() => {
    const availability = new Map<string, number>();

    for (const empleado of empleados) {
      const disponibilidadBase =
        disponibilidadEmpleadoById.get(empleado.id)?.porcentajeDisponible ?? 100;
      const porcentajeAsignado =
        porcentajeAsignadoEnFormularioByEmpleado.get(empleado.id) ?? 0;

      availability.set(
        empleado.id,
        Number(Math.max(0, disponibilidadBase - porcentajeAsignado).toFixed(2)),
      );
    }

    return availability;
  }, [
    disponibilidadEmpleadoById,
    empleados,
    porcentajeAsignadoEnFormularioByEmpleado,
  ]);
  const empleadoSeleccionadoEnOtraFila = React.useCallback(
    (empleadoId: string, resourceId: string) =>
      resourcesForm.some(
        (resource) =>
          resource.id !== resourceId &&
          resource.tipoRecurso === "empleado" &&
          resource.empleadoId === empleadoId,
      ),
    [resourcesForm],
  );
  const updateBaseForm = React.useCallback(
    (updater: (current: CentroCostoPayload) => CentroCostoPayload) => {
      setBaseForm((current) => (current ? updater(current) : current));
    },
    [],
  );

  const capacidadTeorica = (capacityForm.diasPorMes || 0) * (capacityForm.horasPorDia || 0);
  const capacidadAutoHoraMaquina = resourcesForm
    .filter((resource) => resource.activo && resource.tipoRecurso === "maquinaria")
    .reduce((total, resource) => {
      const item =
        machineCostsForm.find((current) => current.centroCostoRecursoId === resource.id) ??
        machineCostsForm.find((current) => current.maquinaId === resource.maquinaId);
      if (!item) {
        return total;
      }
      return (
        total +
        item.horasProgramadasMes *
          (item.disponibilidadPct / 100) *
          (item.eficienciaPct / 100)
      );
    }, 0);
  const capacidadAutoHoraHombre = resourcesForm
    .filter((resource) => resource.activo && resource.tipoRecurso === "empleado")
    .reduce(
      (total, resource) =>
        total + capacidadTeorica * ((resource.porcentajeAsignacion ?? 0) / 100),
      0,
    );
  const capacidadAutomatica =
    baseForm?.unidadBaseFutura === "hora_maquina"
      ? capacidadAutoHoraMaquina
      : baseForm?.unidadBaseFutura === "hora_hombre"
        ? capacidadAutoHoraHombre
        : capacidadTeorica;
  const usaCapacidadMaquinaria = baseForm?.unidadBaseFutura === "hora_maquina";
  const capacidadPractica =
    capacityForm.overrideManualCapacidad !== undefined &&
    Number.isFinite(capacityForm.overrideManualCapacidad)
      ? capacityForm.overrideManualCapacidad
      : capacidadAutomatica;
  const costoMensualComponentes = componentsForm.reduce(
    (total, item) => total + (Number(item.importeMensual) || 0),
    0,
  );
  const costoMensualMaquinaria = machineCostsForm.reduce(
    (total, item) => total + (Number(item.costoMensualTotal) || 0),
    0,
  );
  const costoMensualGastosGenerales = resourcesForm
    .filter((item) => item.activo && item.tipoRecurso === "gasto_general")
    .reduce((total, item) => total + (Number(item.valorMensual) || 0), 0);
  const costoMensualActivosFijos = resourcesForm
    .filter((item) => item.activo && item.tipoRecurso === "activo_fijo")
    .reduce((total, item) => {
      const valorActual = Number(item.valorActual) || 0;
      const valorFinalVida = Number(item.valorFinalVida) || 0;
      const vidaUtil = Math.max(1, Number(item.vidaUtilRestanteMeses) || 1);
      const depreciacion = Math.max(0, valorActual - valorFinalVida) / vidaUtil;
      return total + depreciacion;
    }, 0);
  const costoMensualDirecto =
    costoMensualComponentes +
    costoMensualMaquinaria +
    costoMensualGastosGenerales +
    costoMensualActivosFijos;
  const costoMensualTotal = costoMensualDirecto + repartoAbsorbidoTotal;
  const tarifaProyectada =
    costoMensualTotal > 0 && capacidadPractica > 0
      ? costoMensualTotal / capacidadPractica
      : 0;

  const checklistItems = React.useMemo(() => {
    if (!baseForm) {
      return [];
    }

    const recursosActivos = resourcesForm.filter((resource) => resource.activo);
    const dedicacionesValidas = resourcesForm
      .filter((resource) => resource.tipoRecurso === "empleado")
      .every((resource) => {
        if (!resource.empleadoId) {
          return false;
        }

        const disponibilidadBase =
          disponibilidadEmpleadoById.get(resource.empleadoId)?.porcentajeDisponible ??
          100;

        return (
          Boolean(resource.porcentajeAsignacion) &&
          (resource.porcentajeAsignacion ?? 0) > 0 &&
          (resource.porcentajeAsignacion ?? 0) <= disponibilidadBase
        );
      });
    const maquinariaLista = resourcesForm
      .filter((resource) => resource.tipoRecurso === "maquinaria" && resource.activo)
      .every(
        (resource) =>
          Boolean(resource.maquinaId) &&
          machineCostsForm.some((item) => item.centroCostoRecursoId === resource.id),
      );

    return [
      {
        id: "unidad",
        label: "Unidad de costeo definida",
        description: "El centro ya sabe si se va a medir por hora, unidad, m2 o kg.",
        done: baseForm.unidadBaseFutura !== "ninguna",
      },
      {
        id: "recursos",
        label: "Recursos del sector cargados",
        description:
          "Hay al menos una persona, máquina, gasto general o activo fijo activo para este mes.",
        done: recursosActivos.length > 0,
      },
      {
        id: "dedicacion",
        label: "Dedicación de personas validada",
        description:
          "Las personas asignadas tienen porcentaje válido y no superan la disponibilidad del mes.",
        done: dedicacionesValidas,
      },
      {
        id: "costos",
        label: "Costos mensuales cargados",
        description:
          "El costo mensual total del centro es mayor a cero con la información actual.",
        done: costoMensualTotal > 0,
      },
      {
        id: "maquinaria",
        label: "Costeo de maquinaria completo",
        description:
          "Cada máquina activa del centro tiene parámetros de amortización y operación para el período.",
        done: maquinariaLista,
      },
      {
        id: "capacidad",
        label: "Capacidad real definida",
        description:
          "La capacidad práctica del mes es mayor a cero y permite calcular la tarifa.",
        done: capacidadPractica > 0,
      },
    ];
  }, [
    baseForm,
    capacidadPractica,
    costoMensualTotal,
    disponibilidadEmpleadoById,
    machineCostsForm,
    resourcesForm,
  ]);
  const checklistReady = React.useMemo(
    () => checklistItems.every((item) => item.done),
    [checklistItems],
  );

  const loadConfiguracion = React.useCallback(
    async (centroId: string, targetPeriodo: string) => {
      const detail = await getCentroCostoConfiguracion(centroId, targetPeriodo);

      setBaseForm({
        plantaId: detail.centro.plantaId,
        areaCostoId: detail.centro.areaCostoId,
        codigo: detail.centro.codigo,
        nombre: detail.centro.nombre,
        descripcion: detail.centro.descripcion,
        tipoCentro: detail.centro.tipoCentro,
        categoriaGrafica: detail.centro.categoriaGrafica,
        imputacionPreferida: detail.centro.imputacionPreferida,
        unidadBaseFutura: detail.centro.unidadBaseFutura,
        responsableEmpleadoId: detail.centro.responsableEmpleadoId || undefined,
        activo: detail.centro.activo,
      });
      setResourcesForm(
        detail.recursos.map((item) => ({
          id: item.id,
          tipoRecurso: item.tipoRecurso,
          empleadoId: item.empleadoId || undefined,
          maquinaId: item.maquinaId || undefined,
          nombreRecurso: item.nombreRecurso || item.maquinaNombre || "",
          tipoGastoGeneral: item.tipoGastoGeneral || undefined,
          valorMensual: item.valorMensual ?? undefined,
          vidaUtilRestanteMeses: item.vidaUtilRestanteMeses ?? undefined,
          valorActual: item.valorActual ?? undefined,
          valorFinalVida: item.valorFinalVida ?? undefined,
          descripcion: item.descripcion || "",
          porcentajeAsignacion: item.porcentajeAsignacion ?? undefined,
          activo: item.activo,
        })),
      );
      setMachineCostsForm(detail.recursosMaquinaria);
      setComponentsForm(
        detail.componentesCosto.map((item) => ({
          id: "id" in item ? item.id : createLocalId(),
          categoria: item.categoria,
          nombre: item.nombre,
          origen: item.origen,
          importeMensual: item.importeMensual,
          notas: item.notas ?? "",
          detalle: item.detalle ?? undefined,
        })),
      );
      setCapacityForm(
        detail.capacidad
          ? {
              diasPorMes: detail.capacidad.diasPorMes,
              horasPorDia: detail.capacidad.horasPorDia,
              overrideManualCapacidad:
                detail.capacidad.overrideManualCapacidad ?? undefined,
            }
          : {
              diasPorMes: 22,
              horasPorDia: 8,
              overrideManualCapacidad: undefined,
            },
      );
      setDraftTariff(detail.tarifaBorrador?.tarifaCalculada ?? null);
      setPublishedTariff(detail.tarifaPublicada?.tarifaCalculada ?? null);
      const reparto = extractRepartoAbsorbido(
        (detail.tarifaBorrador?.resumen as Record<string, unknown> | null | undefined) ??
          (detail.tarifaPublicada?.resumen as Record<string, unknown> | null | undefined),
      );
      setRepartoAbsorbidoTotal(reparto.total);
      setRepartoAbsorbidoDesglose(reparto.desglose);
      setWarnings(detail.advertencias);
      setEmpleadosDisponibilidad(detail.empleadosDisponibilidad);
    },
    [],
  );

  React.useEffect(() => {
    if (!open || !centro) {
      return;
    }

    startLoading(async () => {
      try {
        await loadConfiguracion(centro.id, periodo);
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "No se pudo cargar la configuración del centro.",
        );
      }
    });
  }, [centro, loadConfiguracion, open, periodo]);

  React.useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;

    startLoading(async () => {
      try {
        const data = await getMaquinas();
        if (!cancelled) {
          setMaquinas(data);
        }
      } catch (error) {
        if (!cancelled) {
          toast.error(
            error instanceof Error
              ? error.message
              : "No se pudo cargar el catálogo de máquinas.",
          );
        }
      }
    });

    return () => {
      cancelled = true;
    };
  }, [open]);

  React.useEffect(() => {
    if (!open) {
      setActiveStep("identidad");
      setPeriodo(getCurrentPeriodo());
    }
  }, [open]);

  React.useEffect(() => {
    if (!baseForm) {
      return;
    }

    setComponentsForm((current) => {
      const next = syncDerivedComponents({
        resources: resourcesForm,
        current,
        empleadoLabelById,
      });

      if (JSON.stringify(current) === JSON.stringify(next)) {
        return current;
      }

      return next;
    });
  }, [baseForm, empleadoLabelById, resourcesForm]);

  React.useEffect(() => {
    if (!baseForm) {
      return;
    }

    setMachineCostsForm((current) => {
      const currentByResourceId = new Map(
        current.map((item) => [item.centroCostoRecursoId, item]),
      );
      const next = resourcesForm
        .filter(
          (resource) =>
            resource.tipoRecurso === "maquinaria" &&
            resource.activo &&
            Boolean(resource.maquinaId),
        )
        .map((resource) => {
          const currentItem = currentByResourceId.get(resource.id);
          const maquina = resource.maquinaId
            ? maquinaById.get(resource.maquinaId)
            : null;
          const nextBase = currentItem
            ? {
                ...currentItem,
                centroCostoRecursoId: resource.id,
                maquinaId: resource.maquinaId ?? currentItem.maquinaId,
                maquinaNombre:
                  maquina?.nombre ?? currentItem.maquinaNombre ?? resource.nombreRecurso ?? "",
              }
            : createMachineCostDefault(
                resource,
                maquina?.nombre ?? resource.nombreRecurso ?? "Máquina",
              );
          const preview = calculateMachineCostPreview(nextBase);
          return {
            ...nextBase,
            periodo,
            ...preview,
          };
        });

      if (JSON.stringify(current) === JSON.stringify(next)) {
        return current;
      }

      return next;
    });
  }, [baseForm, maquinaById, periodo, resourcesForm]);

  const handleCopyLastPeriod = () => {
    if (!centro) {
      return;
    }

    startLoading(async () => {
      try {
        const history = await getCentroCostoTarifas(centro.id);
        const referencia = history.find((item) => item.periodo !== periodo);

        if (!referencia) {
          toast.error("Todavía no hay otro período para copiar.");
          return;
        }

        const detail = await getCentroCostoConfiguracion(centro.id, referencia.periodo);
        const copiedResources = detail.recursos.map((item) => ({
          id: createLocalId(),
          tipoRecurso: item.tipoRecurso,
          empleadoId: item.empleadoId || undefined,
          maquinaId: item.maquinaId || undefined,
          nombreRecurso: item.nombreRecurso || item.maquinaNombre || "",
          tipoGastoGeneral: item.tipoGastoGeneral || undefined,
          valorMensual: item.valorMensual ?? undefined,
          vidaUtilRestanteMeses: item.vidaUtilRestanteMeses ?? undefined,
          valorActual: item.valorActual ?? undefined,
          valorFinalVida: item.valorFinalVida ?? undefined,
          descripcion: item.descripcion || "",
          porcentajeAsignacion: item.porcentajeAsignacion ?? undefined,
          activo: item.activo,
        }));
        setResourcesForm(copiedResources);
        const resourceIdByMaquinaId = new Map(
          copiedResources
            .filter((resource) => resource.tipoRecurso === "maquinaria" && resource.maquinaId)
            .map((resource) => [resource.maquinaId as string, resource.id]),
        );
        setMachineCostsForm(
          detail.recursosMaquinaria
            .map((item) => {
              const nextResourceId = resourceIdByMaquinaId.get(item.maquinaId);
              if (!nextResourceId) {
                return null;
              }
              return {
                ...item,
                id: "",
                centroCostoRecursoId: nextResourceId,
              };
            })
            .filter(
              (item): item is CentroCostoRecursoMaquinariaPeriodo =>
                Boolean(item),
            ),
        );
        setComponentsForm(
          detail.componentesCosto.map((item) => ({
            id: createLocalId(),
            categoria: item.categoria,
            nombre: item.nombre,
            origen: item.origen,
            importeMensual: item.importeMensual,
            notas: item.notas ?? "",
            detalle: item.detalle ?? undefined,
          })),
        );
        if (detail.capacidad) {
          setCapacityForm({
            diasPorMes: detail.capacidad.diasPorMes,
            horasPorDia: detail.capacidad.horasPorDia,
            overrideManualCapacidad:
              detail.capacidad.overrideManualCapacidad ?? undefined,
          });
        }
        toast.success(`Copiamos la configuración de ${formatPeriodo(referencia.periodo)}.`);
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "No se pudo copiar la configuración anterior.",
        );
      }
    });
  };

  const persistConfiguration = async () => {
    if (!centro || !baseForm) {
      return;
    }

    await updateCentroCostoConfiguracionBase(centro.id, baseForm);
    await replaceCentroCostoRecursos(
      centro.id,
      periodo,
      resourcesForm.map((item) => ({
        tipoRecurso: item.tipoRecurso,
        empleadoId: item.empleadoId,
        maquinaId: item.maquinaId,
        nombreRecurso: item.nombreRecurso,
        tipoGastoGeneral: item.tipoGastoGeneral,
        valorMensual: item.valorMensual,
        vidaUtilRestanteMeses: item.vidaUtilRestanteMeses,
        valorActual: item.valorActual,
        valorFinalVida: item.valorFinalVida,
        descripcion: item.descripcion,
        porcentajeAsignacion: item.porcentajeAsignacion,
        activo: item.activo,
      })),
    );
    const recursosActualizados = await getCentroCostoConfiguracion(centro.id, periodo);
    const maquinariaPayload: CentroCostoRecursoMaquinariaPayload[] = recursosActualizados.recursos
      .filter(
        (resource) =>
          resource.tipoRecurso === "maquinaria" &&
          resource.activo &&
          Boolean(resource.maquinaId),
      )
      .map((resource) => {
        const currentItem = machineCostsForm.find(
          (item) => item.centroCostoRecursoId === resource.id,
        ) ??
          machineCostsForm.find(
            (item) => item.maquinaId === resource.maquinaId,
          );
        const maquinaNombre = resource.maquinaNombre || resource.nombreRecurso || "Máquina";
        const merged = currentItem
          ? {
              ...currentItem,
              centroCostoRecursoId: resource.id,
              maquinaId: resource.maquinaId,
              maquinaNombre,
            }
          : createMachineCostDefault(
              {
                id: resource.id,
                tipoRecurso: resource.tipoRecurso,
                maquinaId: resource.maquinaId || undefined,
                nombreRecurso: maquinaNombre,
                descripcion: resource.descripcion,
                activo: resource.activo,
              },
              maquinaNombre,
            );
        return {
          centroCostoRecursoId: merged.centroCostoRecursoId,
          metodoDepreciacion: merged.metodoDepreciacion,
          valorCompra: merged.valorCompra,
          valorResidual: merged.valorResidual,
          vidaUtilMeses: merged.vidaUtilMeses,
          potenciaNominalKw: merged.potenciaNominalKw,
          factorCargaPct: merged.factorCargaPct,
          tarifaEnergiaKwh: merged.tarifaEnergiaKwh,
          horasProgramadasMes: merged.horasProgramadasMes,
          disponibilidadPct: merged.disponibilidadPct,
          eficienciaPct: merged.eficienciaPct,
          mantenimientoMensual: merged.mantenimientoMensual,
          segurosMensual: merged.segurosMensual,
          otrosFijosMensual: merged.otrosFijosMensual,
        };
      });
    await upsertCentroCostoRecursosMaquinaria(centro.id, periodo, maquinariaPayload);
    await replaceCentroCostoComponentes(
      centro.id,
      periodo,
      componentsForm.map((item) => ({
        categoria: item.categoria,
        nombre: item.nombre,
        origen: item.origen,
        importeMensual: item.importeMensual,
        notas: item.notas,
        detalle: item.detalle,
      })),
    );
    await upsertCentroCostoCapacidad(centro.id, periodo, capacityForm);
  };

  const handleSaveDraft = () => {
    if (!centro) {
      return;
    }

    startSaving(async () => {
      try {
        await persistConfiguration();
        const result = await calcularTarifaCentroCosto(centro.id, periodo);
        setDraftTariff(result.tarifaBorrador.tarifaCalculada);
        const reparto = extractRepartoAbsorbido(
          result.tarifaBorrador.resumen as Record<string, unknown> | null | undefined,
        );
        setRepartoAbsorbidoTotal(reparto.total);
        setRepartoAbsorbidoDesglose(reparto.desglose);
        setWarnings(result.advertencias);
        await onConfigured();
        toast.success("Borrador guardado.");
        await loadConfiguracion(centro.id, periodo);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "No se pudo guardar el borrador.",
        );
      }
    });
  };

  const handlePublish = () => {
    if (!centro) {
      return;
    }

    startSaving(async () => {
      try {
        await persistConfiguration();
        const result = await publicarTarifaCentroCosto(centro.id, periodo);
        setPublishedTariff(result.tarifaCalculada);
        const reparto = extractRepartoAbsorbido(
          result.resumen as Record<string, unknown> | null | undefined,
        );
        setRepartoAbsorbidoTotal(reparto.total);
        setRepartoAbsorbidoDesglose(reparto.desglose);
        await onConfigured();
        toast.success("Tarifa publicada.");
        onOpenChange(false);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "No se pudo publicar la tarifa.",
        );
      }
    });
  };

  const updateResource = React.useCallback(
    (resourceId: string, updater: (current: LocalRecurso) => LocalRecurso) => {
      setResourcesForm((current) =>
        current.map((item) => (item.id === resourceId ? updater(item) : item)),
      );
    },
    [],
  );

  const updateComponent = React.useCallback(
    (componentId: string, updater: (current: LocalComponente) => LocalComponente) => {
      setComponentsForm((current) =>
        current.map((item) => (item.id === componentId ? updater(item) : item)),
      );
    },
    [],
  );

  const employeeCostGroups = React.useMemo(
    () =>
      resourcesForm
        .filter(
          (resource) =>
            resource.tipoRecurso === "empleado" && resource.empleadoId && resource.activo,
        )
        .map((resource) => {
          const empleadoId = resource.empleadoId as string;
          const sueldo = componentsForm.find(
            (component) =>
              getDerivedComponentKey(component) === `empleado:${empleadoId}:sueldos`,
          );
          const cargas = componentsForm.find(
            (component) =>
              getDerivedComponentKey(component) === `empleado:${empleadoId}:cargas`,
          );

          return {
            resource,
            disponibilidad: disponibilidadEmpleadoById.get(empleadoId) ?? null,
            empleadoNombre: empleadoLabelById.get(empleadoId) ?? "Persona",
            sueldo,
            cargas,
          };
        }),
    [componentsForm, disponibilidadEmpleadoById, empleadoLabelById, resourcesForm],
  );

  const machineCostGroups = React.useMemo(
    () =>
      resourcesForm
        .filter(
          (resource) =>
            resource.tipoRecurso === "maquinaria" &&
            Boolean(resource.maquinaId) &&
            resource.activo,
        )
        .map((resource) => {
          const costItem = machineCostsForm.find(
            (item) => item.centroCostoRecursoId === resource.id,
          );
          const maquina = resource.maquinaId
            ? maquinaById.get(resource.maquinaId)
            : null;
          const merged = costItem
            ? {
                ...costItem,
                maquinaId: resource.maquinaId ?? costItem.maquinaId,
                maquinaNombre:
                  maquina?.nombre ?? costItem.maquinaNombre ?? resource.nombreRecurso ?? "",
              }
            : createMachineCostDefault(
                resource,
                maquina?.nombre ?? resource.nombreRecurso ?? "Máquina",
              );
          const preview = calculateMachineCostPreview(merged);

          return {
            resource,
            item: {
              ...merged,
              ...preview,
            },
          };
        }),
    [machineCostsForm, maquinaById, resourcesForm],
  );

  const manualComponents = React.useMemo(
    () => componentsForm.filter((component) => !isDerivedComponent(component)),
    [componentsForm],
  );
  const hasCostSources = React.useMemo(
    () =>
      employeeCostGroups.length > 0 ||
      machineCostGroups.length > 0 ||
      manualComponents.length > 0 ||
      resourcesForm.some(
        (resource) =>
          resource.activo &&
          (resource.tipoRecurso === "gasto_general" ||
            resource.tipoRecurso === "activo_fijo"),
      ),
    [employeeCostGroups, machineCostGroups, manualComponents, resourcesForm],
  );
  const empleadosCosteadosTotal = React.useMemo(
    () =>
      employeeCostGroups.reduce(
        (total, group) =>
          total + (group.sueldo?.importeMensual ?? 0) + (group.cargas?.importeMensual ?? 0),
        0,
      ),
    [employeeCostGroups],
  );
  const maquinariaCosteadaTotal = React.useMemo(
    () =>
      machineCostGroups.reduce(
        (total, group) => total + (group.item.costoMensualTotal ?? 0),
        0,
      ),
    [machineCostGroups],
  );
  const gastosGeneralesTotales = React.useMemo(
    () =>
      resourcesForm
        .filter((resource) => resource.tipoRecurso === "gasto_general" && resource.activo)
        .reduce((total, resource) => total + (resource.valorMensual ?? 0), 0),
    [resourcesForm],
  );
  const activosFijosTotales = React.useMemo(
    () =>
      resourcesForm
        .filter((resource) => resource.tipoRecurso === "activo_fijo" && resource.activo)
        .reduce((total, resource) => {
          const valorActual = resource.valorActual ?? 0;
          const valorFinalVida = resource.valorFinalVida ?? 0;
          const vidaUtil = Math.max(1, resource.vidaUtilRestanteMeses ?? 1);
          return total + Math.max(0, valorActual - valorFinalVida) / vidaUtil;
        }, 0),
    [resourcesForm],
  );
  const adicionalesCosteadosTotal = React.useMemo(
    () =>
      manualComponents.reduce((total, component) => total + (component.importeMensual ?? 0), 0),
    [manualComponents],
  );

  if (!centro || !baseForm) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className={wizardSheetClassName}>
          <SheetHeader>
            <SheetTitle>Configurar costo</SheetTitle>
            <SheetDescription>Cargando centro de costo...</SheetDescription>
          </SheetHeader>
          <div className="flex min-h-40 items-center justify-center">
            <GdiSpinner className="size-4" />
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  const renderStepContent = () => {
    switch (activeStep) {
      case "identidad":
        return (
          <Card className="rounded-2xl border-border/70 shadow-none">
            <CardHeader>
              <CardTitle>Ajustes de costeo</CardTitle>
              <CardDescription>
                Acá solo ajustás cómo querés usar este centro en el costeo. La
                identidad del centro ya viene definida desde la pantalla anterior.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <div className="grid gap-3 rounded-2xl border border-border/70 bg-muted/20 p-4 lg:grid-cols-4">
                <Field>
                  <p className="text-xs uppercase text-muted-foreground">Centro</p>
                  <p className="font-medium">{baseForm.codigo}</p>
                  <p className="text-sm text-muted-foreground">{baseForm.nombre}</p>
                </Field>
                <Field>
                  <p className="text-xs uppercase text-muted-foreground">Ubicación</p>
                  <p className="font-medium">
                    {plantaLabelById.get(baseForm.plantaId) ?? centro.plantaNombre}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {areaLabelById.get(baseForm.areaCostoId) ?? centro.areaCostoNombre}
                  </p>
                </Field>
                <Field>
                  <p className="text-xs uppercase text-muted-foreground">Clasificación</p>
                  <p className="font-medium">{getTipoCentroLabel(baseForm.tipoCentro)}</p>
                  <p className="text-sm text-muted-foreground">
                    {getCategoriaGraficaLabel(baseForm.categoriaGrafica)}
                  </p>
                </Field>
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Sugerencia</p>
                  <p className="font-medium">
                    {getUnidadBaseLabel(
                      getSuggestedUnidadBase(
                        baseForm.tipoCentro,
                        baseForm.categoriaGrafica,
                      ),
                    )}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    según el tipo actual del centro
                  </p>
                </div>
              </div>

              <FieldGroup className="grid gap-4 lg:grid-cols-2">
                <div>
                  <Field>
                    <FieldLabel htmlFor="wizard-unidad">Cómo querés medirlo</FieldLabel>
                    <Select
                      value={baseForm.unidadBaseFutura}
                      onValueChange={(value) => {
                        if (!value) {
                          return;
                        }

                        updateBaseForm((current) => ({
                          ...current,
                          unidadBaseFutura:
                            value as CentroCostoPayload["unidadBaseFutura"],
                        }));
                      }}
                    >
                      <SelectTrigger id="wizard-unidad" className="w-full">
                        <SelectValue placeholder="Selecciona una unidad">
                          {(value) =>
                            typeof value === "string"
                              ? getUnidadBaseLabel(
                                  value as CentroCostoPayload["unidadBaseFutura"],
                                )
                              : "Selecciona una unidad"
                          }
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {unidadBaseItems.map((item) => (
                            <SelectItem key={item.value} value={item.value}>
                              {item.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    <FieldDescription>
                      Ejemplo: impresión suele trabajar mejor con hora máquina;
                      preprensa, con hora hombre.
                    </FieldDescription>
                  </Field>
                </div>
                <div>
                  <Field>
                    <FieldLabel htmlFor="wizard-imputacion">Tipo de costo</FieldLabel>
                    <Select
                      value={baseForm.imputacionPreferida}
                      onValueChange={(value) => {
                        if (!value) {
                          return;
                        }

                        updateBaseForm((current) => ({
                          ...current,
                          imputacionPreferida:
                            value as CentroCostoPayload["imputacionPreferida"],
                        }));
                      }}
                    >
                      <SelectTrigger id="wizard-imputacion" className="w-full">
                        <SelectValue placeholder="Selecciona una imputacion">
                          {(value) =>
                            typeof value === "string"
                              ? getImputacionPreferidaLabel(
                                  value as CentroCostoPayload["imputacionPreferida"],
                                )
                              : "Selecciona una imputacion"
                          }
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {imputacionPreferidaItems.map((item) => (
                            <SelectItem key={item.value} value={item.value}>
                              {item.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
              </FieldGroup>

              <FieldGroup className="grid gap-4">
                <Field>
                  <FieldLabel htmlFor="wizard-descripcion">Descripción útil</FieldLabel>
                  <Textarea
                    id="wizard-descripcion"
                    value={baseForm.descripcion ?? ""}
                    onChange={(event) =>
                      updateBaseForm((current) => ({
                        ...current,
                        descripcion: event.target.value,
                      }))
                    }
                    rows={4}
                    placeholder="Ejemplo: usar para presupuestos de offset comercial"
                  />
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>
        );
      case "recursos":
        return (
          <Card className="rounded-2xl border-border/70 shadow-none">
            <CardHeader>
              <CardTitle>¿Qué usa este sector para trabajar?</CardTitle>
              <CardDescription>
                Acá definís los recursos del mes. Las personas llevan porcentaje de
                dedicación y el sistema después toma eso para pedir su costo del
                centro sin duplicar asignaciones.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <div className="flex flex-wrap gap-2">
                {(["empleado", "maquinaria", "gasto_general", "activo_fijo"] as const).map(
                  (tipo) => (
                    <Button
                      key={tipo}
                      type="button"
                      variant="outline"
                      onClick={() =>
                        setResourcesForm((current) => [...current, createResource(tipo)])
                      }
                    >
                      <PlusIcon />
                      Agregar {getTipoRecursoLabel(tipo)}
                    </Button>
                  ),
                )}
              </div>

              {resourcesForm.length === 0 ? (
                <Empty className="rounded-2xl border border-dashed border-border/70">
                  <EmptyHeader>
                    <EmptyTitle>Sin recursos cargados</EmptyTitle>
                    <EmptyDescription>
                      Empezá por las personas, maquinaria, gastos generales o activos fijos.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <div className="flex flex-col gap-4">
                  {resourcesForm.map((resource) => (
                    <Card key={resource.id} className="rounded-2xl border-border/70 shadow-none">
                      <CardContent className="flex flex-col gap-4 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <Badge variant="outline">
                            {getTipoRecursoLabel(resource.tipoRecurso)}
                          </Badge>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setResourcesForm((current) =>
                                current.filter((item) => item.id !== resource.id),
                              )
                            }
                          >
                            <Trash2Icon />
                            Quitar
                          </Button>
                        </div>

                        <FieldGroup className="grid gap-4 lg:grid-cols-2">
                          <Field>
                            <FieldLabel>Tipo</FieldLabel>
                            <Select
                              value={resource.tipoRecurso}
                              onValueChange={(value) => {
                                if (!value) {
                                  return;
                                }

                                setResourcesForm((current) =>
                                  current.map((item) =>
                                    item.id === resource.id
                                      ? {
                                          ...item,
                                          tipoRecurso:
                                            value as LocalRecurso["tipoRecurso"],
                                          empleadoId: undefined,
                                          maquinaId: undefined,
                                          nombreRecurso: "",
                                          tipoGastoGeneral: undefined,
                                          valorMensual: undefined,
                                          vidaUtilRestanteMeses: undefined,
                                          valorActual: undefined,
                                          valorFinalVida: undefined,
                                          porcentajeAsignacion: undefined,
                                        }
                                      : item,
                                  ),
                                );
                              }}
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Tipo de recurso">
                                  {(value) =>
                                    typeof value === "string"
                                      ? getTipoRecursoLabel(
                                          value as LocalRecurso["tipoRecurso"],
                                        )
                                      : "Tipo de recurso"
                                  }
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                <SelectGroup>
                                  {tipoRecursoItems.map((item) => (
                                    <SelectItem key={item.value} value={item.value}>
                                      {item.label}
                                    </SelectItem>
                                  ))}
                                </SelectGroup>
                              </SelectContent>
                            </Select>
                          </Field>

                          {resource.tipoRecurso === "empleado" ? (
                            <Field>
                              <FieldLabel>Persona</FieldLabel>
                              <Select
                                value={resource.empleadoId ?? ""}
                                onValueChange={(value) => {
                                  if (!value) {
                                    return;
                                  }

                                  updateResource(resource.id, (current) => ({
                                    ...current,
                                    empleadoId: value,
                                    porcentajeAsignacion:
                                      current.porcentajeAsignacion !== undefined
                                        ? Math.min(
                                            current.porcentajeAsignacion,
                                            disponibilidadEmpleadoById.get(value)
                                              ?.porcentajeDisponible ?? 100,
                                          )
                                        : undefined,
                                  }));
                                }}
                              >
                                <SelectTrigger className="w-full">
                                  <SelectValue placeholder="Selecciona una persona">
                                    {(value) =>
                                      typeof value === "string"
                                        ? empleadoLabelById.get(value) ?? value
                                        : "Selecciona una persona"
                                    }
                                  </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectGroup>
                                    {empleados.map((empleado) => (
                                      <SelectItem
                                        key={empleado.id}
                                        value={empleado.id}
                                        disabled={
                                          Boolean(
                                            (disponibilidadEmpleadoById.get(empleado.id) &&
                                              disponibilidadEmpleadoById.get(empleado.id)!
                                                .porcentajeDisponible <= 0 &&
                                              resource.empleadoId !== empleado.id) ||
                                              empleadoSeleccionadoEnOtraFila(
                                                empleado.id,
                                                resource.id,
                                              ),
                                          )
                                        }
                                      >
                                        {empleado.nombreCompleto}
                                      </SelectItem>
                                    ))}
                                  </SelectGroup>
                                </SelectContent>
                              </Select>
                              {resource.empleadoId ? (
                                <FieldDescription>
                                  Elegí la persona y después definí qué parte de su
                                  tiempo real se dedica a este centro durante el mes.
                                </FieldDescription>
                              ) : null}
                            </Field>
                          ) : null}

                          {resource.tipoRecurso === "maquinaria" ? (
                            <Field>
                              <FieldLabel>Máquina</FieldLabel>
                              <Select
                                value={resource.maquinaId ?? ""}
                                onValueChange={(value) => {
                                  if (!value) {
                                    return;
                                  }
                                  const maquina = maquinariaDisponibles.find(
                                    (item) => item.id === value,
                                  );
                                  setResourcesForm((current) =>
                                    current.map((item) =>
                                      item.id === resource.id
                                        ? {
                                            ...item,
                                            maquinaId: value,
                                            nombreRecurso: maquina?.nombre ?? "",
                                          }
                                        : item,
                                    ),
                                  );
                                }}
                              >
                                <SelectTrigger className="w-full">
                                  <SelectValue placeholder="Selecciona una máquina">
                                    {(value) =>
                                      typeof value === "string"
                                        ? maquinariaDisponibles.find(
                                            (item) => item.id === value,
                                          )?.nombre ?? "Selecciona una máquina"
                                        : "Selecciona una máquina"
                                    }
                                  </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectGroup>
                                    {maquinariaDisponibles.map((maquina) => (
                                      <SelectItem key={maquina.id} value={maquina.id}>
                                        {maquina.nombre} ({maquina.codigo})
                                      </SelectItem>
                                    ))}
                                  </SelectGroup>
                                </SelectContent>
                              </Select>
                              <FieldDescription>
                                Solo se listan máquinas activas de la planta del centro.
                              </FieldDescription>
                            </Field>
                          ) : null}

                          {resource.tipoRecurso === "gasto_general" ? (
                            <>
                              <Field>
                                <FieldLabel>Nombre del gasto</FieldLabel>
                                <Input
                                  value={resource.nombreRecurso ?? ""}
                                  onChange={(event) =>
                                    updateResource(resource.id, (current) => ({
                                      ...current,
                                      nombreRecurso: event.target.value,
                                    }))
                                  }
                                />
                              </Field>
                              <Field>
                                <FieldLabel>Tipo de gasto</FieldLabel>
                                <Select
                                  value={resource.tipoGastoGeneral ?? ""}
                                  onValueChange={(value) => {
                                    if (!value) {
                                      return;
                                    }
                                    updateResource(resource.id, (current) => ({
                                      ...current,
                                      tipoGastoGeneral:
                                        value as LocalRecurso["tipoGastoGeneral"],
                                    }));
                                  }}
                                >
                                  <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Selecciona el tipo">
                                      {(value) =>
                                        typeof value === "string"
                                          ? getTipoGastoGeneralLabel(
                                              value as NonNullable<
                                                LocalRecurso["tipoGastoGeneral"]
                                              >,
                                            )
                                          : "Selecciona el tipo"
                                      }
                                    </SelectValue>
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectGroup>
                                      {tipoGastoGeneralItems.map((item) => (
                                        <SelectItem key={item.value} value={item.value}>
                                          {item.label}
                                        </SelectItem>
                                      ))}
                                    </SelectGroup>
                                  </SelectContent>
                                </Select>
                              </Field>
                              <Field>
                                <FieldLabel>Valor mensual ({systemCurrencyCode})</FieldLabel>
                                <Input
                                  inputMode="decimal"
                                  value={
                                    resource.valorMensual === undefined ||
                                    resource.valorMensual === 0
                                      ? ""
                                      : String(resource.valorMensual)
                                  }
                                  onChange={(event) =>
                                    updateResource(resource.id, (current) => ({
                                      ...current,
                                      valorMensual:
                                        event.target.value === ""
                                          ? undefined
                                          : Number(event.target.value) || 0,
                                    }))
                                  }
                                />
                              </Field>
                            </>
                          ) : null}

                          {resource.tipoRecurso === "activo_fijo" ? (
                            <>
                              <Field>
                                <FieldLabel>Nombre del activo</FieldLabel>
                                <Input
                                  value={resource.nombreRecurso ?? ""}
                                  onChange={(event) =>
                                    updateResource(resource.id, (current) => ({
                                      ...current,
                                      nombreRecurso: event.target.value,
                                    }))
                                  }
                                />
                              </Field>
                              <Field className="lg:col-span-2">
                                <FieldLabel>Detalle de depreciación mensual</FieldLabel>
                                <div className="grid gap-3 rounded-xl border border-border/70 bg-muted/10 p-3 lg:grid-cols-4">
                                  <div className="flex flex-col gap-1.5">
                                    <span className="text-xs text-muted-foreground">Vida útil restante</span>
                                    <div className="relative">
                                      <Input
                                        className="pr-16"
                                        inputMode="numeric"
                                        value={
                                          resource.vidaUtilRestanteMeses === undefined
                                            ? ""
                                            : String(resource.vidaUtilRestanteMeses)
                                        }
                                        onChange={(event) =>
                                          updateResource(resource.id, (current) => ({
                                            ...current,
                                            vidaUtilRestanteMeses:
                                              event.target.value === ""
                                                ? undefined
                                                : Number(event.target.value) || 1,
                                          }))
                                        }
                                      />
                                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                                        Meses
                                      </span>
                                    </div>
                                  </div>
                                  <div className="flex flex-col gap-1.5">
                                    <span className="text-xs text-muted-foreground">
                                      Valor actual ({systemCurrencyCode})
                                    </span>
                                    <Input
                                      inputMode="decimal"
                                      value={
                                        resource.valorActual === undefined || resource.valorActual === 0
                                          ? ""
                                          : String(resource.valorActual)
                                      }
                                      onChange={(event) =>
                                        updateResource(resource.id, (current) => ({
                                          ...current,
                                          valorActual:
                                            event.target.value === ""
                                              ? undefined
                                              : Number(event.target.value) || 0,
                                        }))
                                      }
                                    />
                                  </div>
                                  <div className="flex flex-col gap-1.5">
                                    <span className="text-xs text-muted-foreground">
                                      Valor final de vida ({systemCurrencyCode})
                                    </span>
                                    <Input
                                      inputMode="decimal"
                                      value={
                                        resource.valorFinalVida === undefined ||
                                        resource.valorFinalVida === 0
                                          ? ""
                                          : String(resource.valorFinalVida)
                                      }
                                      onChange={(event) =>
                                        updateResource(resource.id, (current) => ({
                                          ...current,
                                          valorFinalVida:
                                            event.target.value === ""
                                              ? undefined
                                              : Number(event.target.value) || 0,
                                        }))
                                      }
                                    />
                                  </div>
                                  <div className="flex flex-col gap-1.5">
                                    <span className="text-xs text-muted-foreground">
                                      Depreciación mensual ({systemCurrencyCode})
                                    </span>
                                    <div className="flex h-10 items-center rounded-md border border-border bg-background px-3 text-sm font-medium">
                                      {formatMoney(
                                        Math.max(
                                          0,
                                          (resource.valorActual ?? 0) -
                                            (resource.valorFinalVida ?? 0),
                                        ) / Math.max(1, resource.vidaUtilRestanteMeses ?? 1),
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </Field>
                            </>
                          ) : null}
                        </FieldGroup>

                        {resource.tipoRecurso === "empleado" ? (
                          <FieldGroup className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
                            <Field>
                              <FieldLabel>% de dedicación al centro</FieldLabel>
                              <Input
                                inputMode="decimal"
                                max={
                                  resource.empleadoId
                                    ? (disponibilidadEmpleadoById.get(resource.empleadoId)
                                        ?.porcentajeDisponible ?? 100)
                                    : 100
                                }
                                placeholder={
                                  resource.empleadoId
                                    ? String(
                                        disponibilidadEmpleadoById.get(resource.empleadoId)
                                          ?.porcentajeDisponible ?? 100,
                                      )
                                    : "100"
                                }
                                value={
                                  resource.porcentajeAsignacion === undefined ||
                                  resource.porcentajeAsignacion === 0
                                    ? ""
                                    : String(resource.porcentajeAsignacion)
                                }
                                onChange={(event) =>
                                  updateResource(resource.id, (current) => {
                                    if (event.target.value === "") {
                                      return {
                                        ...current,
                                        porcentajeAsignacion: undefined,
                                      };
                                    }

                                    const parsedValue = Number(event.target.value);
                                    const maxAllowed = current.empleadoId
                                      ? (disponibilidadEmpleadoById.get(current.empleadoId)
                                          ?.porcentajeDisponible ?? 100)
                                      : 100;

                                    return {
                                      ...current,
                                      porcentajeAsignacion: Number.isFinite(parsedValue)
                                        ? Math.min(Math.max(parsedValue, 0), maxAllowed)
                                        : undefined,
                                    };
                                  })
                                }
                              />
                              <FieldDescription>
                                Cargá solo la parte disponible para este mes.
                                Ejemplo: si trabaja medio tiempo en este sector,
                                cargá 50.
                              </FieldDescription>
                            </Field>
                            <Field>
                              <FieldLabel>Disponibilidad del mes</FieldLabel>
                              <div className="flex min-h-10 items-center gap-2 rounded-xl border border-border/70 px-3 py-2">
                                {resource.empleadoId ? (
                                  (() => {
                                    const disponibilidad = disponibilidadEmpleadoById.get(
                                      resource.empleadoId,
                                    );
                                    const disponibilidadRestante =
                                      disponibilidadRestanteEmpleadoById.get(
                                        resource.empleadoId,
                                      ) ??
                                      (disponibilidad?.porcentajeDisponible ?? 100);

                                    if (!disponibilidad) {
                                      return (
                                        <Badge variant="outline">
                                          Disponible {formatNumber(disponibilidadRestante)}%
                                        </Badge>
                                      );
                                    }

                                    const colorVariant =
                                      disponibilidadRestante <= 0
                                        ? "destructive"
                                        : disponibilidadRestante <= 30
                                          ? "secondary"
                                          : "outline";

                                    return (
                                      <Tooltip>
                                        <TooltipTrigger
                                          render={
                                            <button
                                              type="button"
                                              className="inline-flex items-center"
                                              aria-label="Ver asignaciones de la persona"
                                            >
                                              <Badge variant={colorVariant}>
                                                Disponible{" "}
                                                {formatNumber(disponibilidadRestante)}
                                                %
                                              </Badge>
                                            </button>
                                          }
                                        />
                                        <TooltipContent
                                          className="max-w-sm text-pretty"
                                          side="left"
                                        >
                                          {disponibilidad.asignacionesOtrosCentros.length ===
                                          0 ? (
                                            <p>
                                              Esta persona no tiene otras
                                              asignaciones activas en{" "}
                                              {formatPeriodo(periodo)}.
                                            </p>
                                          ) : (
                                            <div className="flex flex-col gap-1">
                                              <p className="font-medium">
                                                Usado en otros centros
                                              </p>
                                              {disponibilidad.asignacionesOtrosCentros.map(
                                                (asignacion) => (
                                                  <p key={asignacion.centroCostoId}>
                                                    {asignacion.centroCodigo} ·{" "}
                                                    {asignacion.centroNombre}:{" "}
                                                    {formatNumber(
                                                      asignacion.porcentajeAsignacion,
                                                    )}
                                                    %
                                                  </p>
                                                ),
                                              )}
                                              <p className="pt-1 text-xs">
                                                Restante para este centro en{" "}
                                                {formatPeriodo(periodo)}:{" "}
                                                {formatNumber(disponibilidadRestante)}%
                                              </p>
                                            </div>
                                          )}
                                        </TooltipContent>
                                      </Tooltip>
                                    );
                                  })()
                                ) : (
                                  <span className="text-sm text-muted-foreground">
                                    Seleccioná una persona primero
                                  </span>
                                )}
                              </div>
                            </Field>
                          </FieldGroup>
                        ) : null}

                        <div className="flex items-center justify-between rounded-2xl border border-border/70 bg-muted/20 px-4 py-3">
                          <div>
                            <p className="text-sm font-medium">Recurso activo</p>
                            <p className="text-xs text-muted-foreground">
                              Se tendrá en cuenta al calcular y explicar el centro.
                            </p>
                          </div>
                          <Switch
                            checked={resource.activo}
                            onCheckedChange={(checked) =>
                              setResourcesForm((current) =>
                                current.map((item) =>
                                  item.id === resource.id
                                    ? { ...item, activo: checked }
                                    : item,
                                ),
                              )
                            }
                          />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        );
      case "costos":
        return (
          <Card className="rounded-2xl border-border/70 shadow-none">
            <CardHeader>
              <CardTitle>¿Cuánto te cuesta por mes mantenerlo funcionando?</CardTitle>
              <CardDescription>
                El sistema armó esta pantalla según los recursos del paso 2. Los
                importes se cargan en {systemCurrencyCode} y se recalculan solos
                cuando cambia la dedicación de las personas o los datos de una
                máquina.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <div className="rounded-2xl border border-border/70 bg-muted/10 px-4 py-3 text-sm text-muted-foreground">
                Todos los valores monetarios se cargan en{" "}
                <span className="font-medium">{systemCurrencyCode}</span>.
              </div>

              {!hasCostSources ? (
                <Empty className="rounded-2xl border border-dashed border-border/70">
                  <EmptyHeader>
                    <EmptyTitle>Sin costos cargados</EmptyTitle>
                    <EmptyDescription>
                      Empezá por los recursos del paso 2. Después podés sumar
                      energía, alquiler u otros costos del centro.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <div className="flex flex-col gap-4">
                  {employeeCostGroups.length > 0 ? (
                    <Card className="rounded-2xl border-border/70 shadow-none">
                      <CardHeader>
                        <CardTitle className="text-base">Personas asignadas</CardTitle>
                        <CardDescription>
                          Pedimos sueldo neto y cargas sociales por persona. El
                          sistema prorratea cada monto según el porcentaje del paso
                          2.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="flex flex-col gap-3">
                        {employeeCostGroups.map(({ resource, empleadoNombre, sueldo, cargas }) => (
                          <div
                            key={resource.id}
                            className="flex flex-col gap-4 rounded-2xl border border-border/70 p-4"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-medium">{empleadoNombre}</p>
                                <Badge variant="outline">
                                  {formatNumber(resource.porcentajeAsignacion ?? 0)}%
                                  imputado al centro
                                </Badge>
                              </div>
                              <Tooltip>
                                <TooltipTrigger
                                  render={
                                    <button
                                      type="button"
                                      className="inline-flex items-center text-muted-foreground transition-colors hover:text-foreground"
                                      aria-label="Ver explicación sobre costo laboral"
                                    >
                                      <InfoIcon className="size-4" />
                                    </button>
                                  }
                                />
                                <TooltipContent className="max-w-sm text-pretty" side="left">
                                  Cargá el sueldo neto y las cargas sociales del
                                  mes. El sistema toma solo la parte proporcional
                                  a este centro según la dedicación configurada.
                                </TooltipContent>
                              </Tooltip>
                            </div>

                            <FieldGroup className="grid gap-4 lg:grid-cols-2">
                              <Field>
                                <FieldLabel>Sueldo neto ({systemCurrencyCode})</FieldLabel>
                                <Input
                                  inputMode="decimal"
                                  placeholder="0"
                                  value={
                                    normalizeNumber(
                                      getDetailValue(sueldo ?? createComponent(), "sueldoNeto"),
                                    ) === 0
                                      ? ""
                                      : String(
                                          normalizeNumber(
                                            getDetailValue(
                                              sueldo ?? createComponent(),
                                              "sueldoNeto",
                                            ),
                                          ),
                                        )
                                  }
                                  onChange={(event) =>
                                    sueldo
                                      ? updateComponent(sueldo.id, (current) =>
                                          createEmployeeDerivedComponent({
                                            part: "sueldos",
                                            empleadoId: resource.empleadoId ?? "",
                                            empleadoNombre,
                                            porcentajeAsignacion:
                                              resource.porcentajeAsignacion ?? 0,
                                            current: {
                                              ...current,
                                              detalle: {
                                                ...(current.detalle ?? {}),
                                                sueldoNeto:
                                                  event.target.value === ""
                                                    ? undefined
                                                    : Number(event.target.value) || 0,
                                              },
                                            },
                                          }),
                                        )
                                      : undefined
                                  }
                                />
                              </Field>
                              <Field>
                                <FieldLabel>
                                  Cargas sociales ({systemCurrencyCode})
                                </FieldLabel>
                                <Input
                                  inputMode="decimal"
                                  placeholder="0"
                                  value={
                                    normalizeNumber(
                                      getDetailValue(
                                        cargas ?? createComponent(),
                                        "cargasSociales",
                                      ),
                                    ) === 0
                                      ? ""
                                      : String(
                                          normalizeNumber(
                                            getDetailValue(
                                              cargas ?? createComponent(),
                                              "cargasSociales",
                                            ),
                                          ),
                                        )
                                  }
                                  onChange={(event) =>
                                    cargas
                                      ? updateComponent(cargas.id, (current) =>
                                          createEmployeeDerivedComponent({
                                            part: "cargas",
                                            empleadoId: resource.empleadoId ?? "",
                                            empleadoNombre,
                                            porcentajeAsignacion:
                                              resource.porcentajeAsignacion ?? 0,
                                            current: {
                                              ...current,
                                              detalle: {
                                                ...(current.detalle ?? {}),
                                                cargasSociales:
                                                  event.target.value === ""
                                                    ? undefined
                                                    : Number(event.target.value) || 0,
                                              },
                                            },
                                          }),
                                        )
                                      : undefined
                                  }
                                />
                              </Field>
                            </FieldGroup>

                            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-muted/10 px-4 py-3 text-sm">
                              <span className="text-muted-foreground">
                                Base mensual:{" "}
                                <span className="font-medium text-foreground">
                                  {formatMoney(
                                    normalizeNumber(
                                      getDetailValue(
                                        sueldo ?? createComponent(),
                                        "sueldoNeto",
                                      ),
                                    ) +
                                      normalizeNumber(
                                        getDetailValue(
                                          cargas ?? createComponent(),
                                          "cargasSociales",
                                        ),
                                      ),
                                  )}
                                </span>
                              </span>
                              <span className="text-muted-foreground">
                                Costo imputado:{" "}
                                <span className="font-medium text-foreground">
                                  {formatMoney(
                                    (sueldo?.importeMensual ?? 0) +
                                      (cargas?.importeMensual ?? 0),
                                  )}
                                </span>
                              </span>
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  ) : null}

                  {machineCostGroups.length > 0 ? (
                    <Card className="rounded-2xl border-border/70 shadow-none">
                      <CardHeader>
                        <CardTitle className="text-base">Maquinaria del centro</CardTitle>
                        <CardDescription>
                          Definí amortización y costo operativo para cada máquina.
                          El sistema calcula costo mensual y tarifa por hora.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="flex flex-col gap-4">
                        {machineCostGroups.map(({ resource, item }) =>
                          item ? (
                            <div
                              key={resource.id}
                              className="flex flex-col gap-3 rounded-xl border border-border/70 p-3"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-sm font-semibold">
                                  {item.maquinaNombre || resource.nombreRecurso || "Máquina"}
                                </p>
                                <span className="rounded-md border border-border/70 bg-muted/20 px-2 py-1 text-[11px] text-muted-foreground">
                                  Carga guiada por secciones
                                </span>
                              </div>

                              <div className="grid gap-3 xl:grid-cols-2">
                                <div className="space-y-3">
                                  <section className="rounded-lg border border-border/60 bg-muted/5 p-3">
                                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                      1. Capital
                                    </p>
                                    <FieldGroup className="grid gap-3 md:grid-cols-3">
                                      <Field>
                                        <FieldLabelWithTooltip
                                          label={`Valor de compra (${systemCurrencyCode})`}
                                          help="Costo total de adquisición de la máquina, sin restar valor residual."
                                        />
                                        <Input
                                          inputMode="decimal"
                                          placeholder="0"
                                          value={item.valorCompra === 0 ? "" : String(item.valorCompra)}
                                          onChange={(event) =>
                                            setMachineCostsForm((current) =>
                                              current.map((cost) =>
                                                cost.centroCostoRecursoId === resource.id
                                                  ? {
                                                      ...cost,
                                                      valorCompra:
                                                        event.target.value === ""
                                                          ? 0
                                                          : Number(event.target.value) || 0,
                                                    }
                                                  : cost,
                                              ),
                                            )
                                          }
                                        />
                                      </Field>
                                      <Field>
                                        <FieldLabelWithTooltip
                                          label={`Valor residual (${systemCurrencyCode})`}
                                          help="Valor estimado de recupero al final de la vida útil."
                                        />
                                        <Input
                                          inputMode="decimal"
                                          placeholder="0"
                                          value={item.valorResidual === 0 ? "" : String(item.valorResidual)}
                                          onChange={(event) =>
                                            setMachineCostsForm((current) =>
                                              current.map((cost) =>
                                                cost.centroCostoRecursoId === resource.id
                                                  ? {
                                                      ...cost,
                                                      valorResidual:
                                                        event.target.value === ""
                                                          ? 0
                                                          : Number(event.target.value) || 0,
                                                    }
                                                  : cost,
                                              ),
                                            )
                                          }
                                        />
                                      </Field>
                                      <Field>
                                        <FieldLabelWithTooltip
                                          label="Vida útil (meses)"
                                          help="Meses sobre los que se reparte la amortización lineal."
                                        />
                                        <Input
                                          inputMode="numeric"
                                          placeholder="60"
                                          value={item.vidaUtilMeses === 0 ? "" : String(item.vidaUtilMeses)}
                                          onChange={(event) =>
                                            setMachineCostsForm((current) =>
                                              current.map((cost) =>
                                                cost.centroCostoRecursoId === resource.id
                                                  ? {
                                                      ...cost,
                                                      vidaUtilMeses:
                                                        event.target.value === ""
                                                          ? 1
                                                          : Math.max(1, Number(event.target.value) || 1),
                                                    }
                                                  : cost,
                                              ),
                                            )
                                          }
                                        />
                                      </Field>
                                    </FieldGroup>
                                  </section>

                                  <section className="rounded-lg border border-border/60 bg-muted/5 p-3">
                                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                      2. Energía y Uso
                                    </p>
                                    <FieldGroup className="grid gap-3 md:grid-cols-2">
                                      <Field>
                                        <FieldLabelWithTooltip
                                          label="Potencia nominal (kW)"
                                          help="Potencia eléctrica nominal de placa de la máquina."
                                        />
                                        <Input
                                          inputMode="decimal"
                                          value={item.potenciaNominalKw === 0 ? "" : String(item.potenciaNominalKw)}
                                          onChange={(event) =>
                                            setMachineCostsForm((current) =>
                                              current.map((cost) =>
                                                cost.centroCostoRecursoId === resource.id
                                                  ? {
                                                      ...cost,
                                                      potenciaNominalKw:
                                                        event.target.value === ""
                                                          ? 0
                                                          : Number(event.target.value) || 0,
                                                    }
                                                  : cost,
                                              ),
                                            )
                                          }
                                        />
                                      </Field>
                                      <Field>
                                        <FieldLabelWithTooltip
                                          label="Factor de carga (%)"
                                          help="Porcentaje promedio de uso de potencia respecto al nominal."
                                        />
                                        <Input
                                          inputMode="decimal"
                                          value={item.factorCargaPct === 0 ? "" : String(item.factorCargaPct)}
                                          onChange={(event) =>
                                            setMachineCostsForm((current) =>
                                              current.map((cost) =>
                                                cost.centroCostoRecursoId === resource.id
                                                  ? {
                                                      ...cost,
                                                      factorCargaPct:
                                                        event.target.value === ""
                                                          ? 0
                                                          : Number(event.target.value) || 0,
                                                    }
                                                  : cost,
                                              ),
                                            )
                                          }
                                        />
                                      </Field>
                                      <Field>
                                        <FieldLabelWithTooltip
                                          label={`Tarifa energía (${systemCurrencyCode}/kWh)`}
                                          help="Costo unitario de energía eléctrica por kWh."
                                        />
                                        <Input
                                          inputMode="decimal"
                                          value={item.tarifaEnergiaKwh === 0 ? "" : String(item.tarifaEnergiaKwh)}
                                          onChange={(event) =>
                                            setMachineCostsForm((current) =>
                                              current.map((cost) =>
                                                cost.centroCostoRecursoId === resource.id
                                                  ? {
                                                      ...cost,
                                                      tarifaEnergiaKwh:
                                                        event.target.value === ""
                                                          ? 0
                                                          : Number(event.target.value) || 0,
                                                    }
                                                  : cost,
                                              ),
                                            )
                                          }
                                        />
                                      </Field>
                                      <Field>
                                        <FieldLabelWithTooltip
                                          label="Horas programadas/mes"
                                          help="Horas planificadas de operación mensual antes de pérdidas."
                                        />
                                        <Input
                                          inputMode="decimal"
                                          value={item.horasProgramadasMes === 0 ? "" : String(item.horasProgramadasMes)}
                                          onChange={(event) =>
                                            setMachineCostsForm((current) =>
                                              current.map((cost) =>
                                                cost.centroCostoRecursoId === resource.id
                                                  ? {
                                                      ...cost,
                                                      horasProgramadasMes:
                                                        event.target.value === ""
                                                          ? 0
                                                          : Number(event.target.value) || 0,
                                                    }
                                                  : cost,
                                              ),
                                            )
                                          }
                                        />
                                      </Field>
                                    </FieldGroup>
                                  </section>
                                </div>

                                <div className="space-y-3">
                                  <section className="rounded-lg border border-border/60 bg-muted/5 p-3">
                                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                      3. Productividad Real
                                    </p>
                                    <FieldGroup className="grid gap-3 md:grid-cols-3">
                                      <Field>
                                        <FieldLabelWithTooltip
                                          label="Disponibilidad (%)"
                                          help="Porcentaje de tiempo disponible (descontando paradas y fallas)."
                                        />
                                        <Input
                                          inputMode="decimal"
                                          value={item.disponibilidadPct === 0 ? "" : String(item.disponibilidadPct)}
                                          onChange={(event) =>
                                            setMachineCostsForm((current) =>
                                              current.map((cost) =>
                                                cost.centroCostoRecursoId === resource.id
                                                  ? {
                                                      ...cost,
                                                      disponibilidadPct:
                                                        event.target.value === ""
                                                          ? 0
                                                          : Number(event.target.value) || 0,
                                                    }
                                                  : cost,
                                              ),
                                            )
                                          }
                                        />
                                      </Field>
                                      <Field>
                                        <FieldLabelWithTooltip
                                          label="Eficiencia (%)"
                                          help="Rendimiento operativo real sobre el tiempo disponible."
                                        />
                                        <Input
                                          inputMode="decimal"
                                          value={item.eficienciaPct === 0 ? "" : String(item.eficienciaPct)}
                                          onChange={(event) =>
                                            setMachineCostsForm((current) =>
                                              current.map((cost) =>
                                                cost.centroCostoRecursoId === resource.id
                                                  ? {
                                                      ...cost,
                                                      eficienciaPct:
                                                        event.target.value === ""
                                                          ? 0
                                                          : Number(event.target.value) || 0,
                                                    }
                                                  : cost,
                                              ),
                                            )
                                          }
                                        />
                                      </Field>
                                      <Field>
                                        <FieldLabelWithTooltip
                                          label="Horas productivas"
                                          help="Resultado calculado: horas programadas × disponibilidad × eficiencia."
                                        />
                                        <div className="flex min-h-10 items-center rounded-md border px-3 text-sm text-muted-foreground">
                                          {formatNumber(item.horasProductivas)}
                                        </div>
                                      </Field>
                                    </FieldGroup>
                                  </section>

                                  <section className="rounded-lg border border-border/60 bg-muted/5 p-3">
                                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                      4. Costos Fijos Mensuales
                                    </p>
                                    <FieldGroup className="grid gap-3 md:grid-cols-3">
                                      <Field>
                                        <FieldLabelWithTooltip
                                          label={`Mantenimiento (${systemCurrencyCode})`}
                                          help="Costo mensual estimado de mantenimiento preventivo/correctivo."
                                        />
                                        <Input
                                          inputMode="decimal"
                                          value={item.mantenimientoMensual === 0 ? "" : String(item.mantenimientoMensual)}
                                          onChange={(event) =>
                                            setMachineCostsForm((current) =>
                                              current.map((cost) =>
                                                cost.centroCostoRecursoId === resource.id
                                                  ? {
                                                      ...cost,
                                                      mantenimientoMensual:
                                                        event.target.value === ""
                                                          ? 0
                                                          : Number(event.target.value) || 0,
                                                    }
                                                  : cost,
                                              ),
                                            )
                                          }
                                        />
                                      </Field>
                                      <Field>
                                        <FieldLabelWithTooltip
                                          label={`Seguros (${systemCurrencyCode})`}
                                          help="Prima mensual de seguros asociados al activo."
                                        />
                                        <Input
                                          inputMode="decimal"
                                          value={item.segurosMensual === 0 ? "" : String(item.segurosMensual)}
                                          onChange={(event) =>
                                            setMachineCostsForm((current) =>
                                              current.map((cost) =>
                                                cost.centroCostoRecursoId === resource.id
                                                  ? {
                                                      ...cost,
                                                      segurosMensual:
                                                        event.target.value === ""
                                                          ? 0
                                                          : Number(event.target.value) || 0,
                                                    }
                                                  : cost,
                                              ),
                                            )
                                          }
                                        />
                                      </Field>
                                      <Field>
                                        <FieldLabelWithTooltip
                                          label={`Otros (${systemCurrencyCode})`}
                                          help="Otros costos fijos mensuales imputables a esta máquina."
                                        />
                                        <Input
                                          inputMode="decimal"
                                          value={item.otrosFijosMensual === 0 ? "" : String(item.otrosFijosMensual)}
                                          onChange={(event) =>
                                            setMachineCostsForm((current) =>
                                              current.map((cost) =>
                                                cost.centroCostoRecursoId === resource.id
                                                  ? {
                                                      ...cost,
                                                      otrosFijosMensual:
                                                        event.target.value === ""
                                                          ? 0
                                                          : Number(event.target.value) || 0,
                                                    }
                                                  : cost,
                                              ),
                                            )
                                          }
                                        />
                                      </Field>
                                    </FieldGroup>
                                  </section>
                                </div>
                              </div>

                              <div className="grid gap-2 rounded-xl border border-border/70 bg-muted/10 p-3 text-xs md:grid-cols-2 lg:grid-cols-4">
                                <div className="flex flex-col">
                                  <span className="text-muted-foreground">Amortización</span>
                                  <span className="font-medium text-foreground">
                                    {formatMoney(item.amortizacionMensual)}
                                  </span>
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-muted-foreground">Energía</span>
                                  <span className="font-medium text-foreground">
                                    {formatMoney(item.energiaMensual)}
                                  </span>
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-muted-foreground">Total mensual</span>
                                  <span className="font-medium text-foreground">
                                    {formatMoney(item.costoMensualTotal)}
                                  </span>
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-muted-foreground">Tarifa hora</span>
                                  <span className="font-medium text-foreground">
                                    {formatMoney(item.tarifaHora)} / h
                                  </span>
                                </div>
                              </div>
                            </div>
                          ) : null,
                        )}
                      </CardContent>
                    </Card>
                  ) : null}

                  <Card className="rounded-2xl border-border/70 shadow-none">
                    <CardHeader>
                      <CardTitle className="text-base">Otros costos del centro</CardTitle>
                      <CardDescription>
                        Acá solo van costos adicionales que no surgen de los
                        recursos seleccionados en el paso 2.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-4">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() =>
                            setComponentsForm((current) => [
                              ...current,
                              createManualCostComponent(),
                            ])
                          }
                        >
                          <PlusIcon />
                          Agregar costo manual
                        </Button>
                      </div>

                      {manualComponents.length === 0 ? (
                        <Empty className="rounded-2xl border border-dashed border-border/70">
                          <EmptyHeader>
                            <EmptyTitle>Sin costos manuales</EmptyTitle>
                            <EmptyDescription>
                              Si el centro tiene gastos adicionales, sumalos acá.
                            </EmptyDescription>
                          </EmptyHeader>
                        </Empty>
                      ) : (
                        manualComponents.map((component) => (
                          <Card
                            key={component.id}
                            className="rounded-2xl border-border/70 shadow-none"
                          >
                            <CardContent className="flex flex-col gap-4 p-4">
                              <div className="flex items-start justify-between gap-3">
                                <Badge
                                  variant={
                                    component.origen === "sugerido"
                                      ? "secondary"
                                      : "outline"
                                  }
                                >
                                  {getCategoriaComponenteCostoLabel(component.categoria)}
                                </Badge>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() =>
                                    setComponentsForm((current) =>
                                      current.filter((item) => item.id !== component.id),
                                    )
                                  }
                                >
                                  <Trash2Icon />
                                  Quitar
                                </Button>
                              </div>

                              <FieldGroup className="grid gap-4 lg:grid-cols-3">
                                <Field>
                                  <FieldLabel>Categoría</FieldLabel>
                                  <Select
                                    value={component.categoria}
                                    onValueChange={(value) => {
                                      if (!value) {
                                        return;
                                      }

                                      updateComponent(component.id, (current) => ({
                                        ...current,
                                        categoria: value as LocalComponente["categoria"],
                                      }));
                                    }}
                                  >
                                    <SelectTrigger className="w-full">
                                      <SelectValue placeholder="Categoria">
                                        {(value) =>
                                          typeof value === "string"
                                            ? getCategoriaComponenteCostoLabel(
                                                value as LocalComponente["categoria"],
                                              )
                                            : "Categoria"
                                        }
                                      </SelectValue>
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectGroup>
                                        {additionalCostCategoryItems.map((item) => (
                                          <SelectItem key={item.value} value={item.value}>
                                            {item.label}
                                          </SelectItem>
                                        ))}
                                      </SelectGroup>
                                    </SelectContent>
                                  </Select>
                                </Field>
                                <Field className="lg:col-span-2">
                                  <FieldLabel>Nombre visible</FieldLabel>
                                  <Input
                                    value={component.nombre}
                                    onChange={(event) =>
                                      updateComponent(component.id, (current) => ({
                                        ...current,
                                        nombre: event.target.value,
                                      }))
                                    }
                                  />
                                </Field>
                              </FieldGroup>

                              <FieldGroup className="grid gap-4 lg:grid-cols-3">
                                <Field>
                                  <FieldLabel>
                                    Importe mensual ({systemCurrencyCode})
                                  </FieldLabel>
                                  <Input
                                    inputMode="decimal"
                                    placeholder="0"
                                    value={
                                      component.importeMensual === 0
                                        ? ""
                                        : String(component.importeMensual)
                                    }
                                    onChange={(event) =>
                                      updateComponent(component.id, (current) => ({
                                        ...current,
                                        importeMensual:
                                          event.target.value === ""
                                            ? 0
                                            : Number(event.target.value) || 0,
                                      }))
                                    }
                                  />
                                </Field>

                                <Field className="lg:col-span-2">
                                  <FieldLabel>Notas</FieldLabel>
                                  <Input
                                    value={component.notas ?? ""}
                                    onChange={(event) =>
                                      updateComponent(component.id, (current) => ({
                                        ...current,
                                        notas: event.target.value,
                                      }))
                                    }
                                    placeholder="Opcional"
                                  />
                                </Field>
                              </FieldGroup>
                            </CardContent>
                          </Card>
                        ))
                      )}
                    </CardContent>
                  </Card>

                  <Card className="rounded-2xl border-border/70 shadow-none">
                    <CardHeader>
                      <CardTitle className="text-base">Totales del mes</CardTitle>
                      <CardDescription>
                        Resumen del costo armado hasta ahora.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-3 lg:grid-cols-2">
                      <div className="flex items-center justify-between rounded-xl border border-border/70 px-4 py-3">
                        <span className="text-sm text-muted-foreground">Empleados</span>
                        <span className="font-medium">
                          {formatMoney(empleadosCosteadosTotal)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between rounded-xl border border-border/70 px-4 py-3">
                        <span className="text-sm text-muted-foreground">Maquinaria</span>
                        <span className="font-medium">
                          {formatMoney(maquinariaCosteadaTotal)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between rounded-xl border border-border/70 px-4 py-3">
                        <span className="text-sm text-muted-foreground">
                          Gastos generales
                        </span>
                        <span className="font-medium">
                          {formatMoney(gastosGeneralesTotales)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between rounded-xl border border-border/70 px-4 py-3">
                        <span className="text-sm text-muted-foreground">
                          Activos fijos (depreciación)
                        </span>
                        <span className="font-medium">
                          {formatMoney(activosFijosTotales)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between rounded-xl border border-border/70 px-4 py-3">
                        <span className="text-sm text-muted-foreground">
                          Otros costos del centro
                        </span>
                        <span className="font-medium">
                          {formatMoney(adicionalesCosteadosTotal)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 lg:col-span-2">
                        <span className="text-sm font-medium text-muted-foreground">
                          Total mensual estimado
                        </span>
                        <span className="text-lg font-semibold">
                          {formatMoney(costoMensualTotal)}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </CardContent>
          </Card>
        );
      case "capacidad":
        return (
          <Card className="rounded-2xl border-border/70 shadow-none">
            <CardHeader>
              <CardTitle>¿Cuántas horas reales trabaja al mes?</CardTitle>
              <CardDescription>
                La capacidad práctica se calcula automáticamente según los recursos
                del paso 2. Podés ajustar días/horas base o usar una capacidad manual.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <FieldGroup className="grid gap-4 lg:grid-cols-3">
                <Field>
                  <FieldLabel>Días por mes</FieldLabel>
                  <Input
                    inputMode="decimal"
                    value={String(capacityForm.diasPorMes)}
                    readOnly={usaCapacidadMaquinaria}
                    disabled={usaCapacidadMaquinaria}
                    onChange={(event) =>
                      setCapacityForm((current) => ({
                        ...current,
                        diasPorMes: Number(event.target.value) || 0,
                      }))
                    }
                  />
                  <FieldDescription>
                    {usaCapacidadMaquinaria
                      ? "Se usa capacidad de maquinaria del paso 2."
                      : "Ejemplo: 22"}
                  </FieldDescription>
                </Field>
                <Field>
                  <FieldLabel>Horas por día</FieldLabel>
                  <Input
                    inputMode="decimal"
                    value={String(capacityForm.horasPorDia)}
                    readOnly={usaCapacidadMaquinaria}
                    disabled={usaCapacidadMaquinaria}
                    onChange={(event) =>
                      setCapacityForm((current) => ({
                        ...current,
                        horasPorDia: Number(event.target.value) || 0,
                      }))
                    }
                  />
                  <FieldDescription>
                    {usaCapacidadMaquinaria
                      ? "Se usa capacidad de maquinaria del paso 2."
                      : "Ejemplo: 8"}
                  </FieldDescription>
                </Field>
                <Field>
                  <FieldLabel>Capacidad manual</FieldLabel>
                  <Input
                    inputMode="decimal"
                    value={
                      capacityForm.overrideManualCapacidad === undefined
                        ? ""
                        : String(capacityForm.overrideManualCapacidad)
                    }
                    onChange={(event) =>
                      setCapacityForm((current) => ({
                        ...current,
                        overrideManualCapacidad:
                          event.target.value === ""
                            ? undefined
                            : Number(event.target.value) || 0,
                      }))
                    }
                  />
                  <FieldDescription>
                    Opcional: usala si ya conocés la capacidad real del mes.
                  </FieldDescription>
                </Field>
              </FieldGroup>

              <div className="grid gap-4 lg:grid-cols-3">
                <Card className="rounded-2xl border-border/70 shadow-none">
                  <CardHeader>
                    <CardTitle className="text-base">Horas teóricas</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-semibold">
                      {formatNumber(capacidadTeorica)}
                    </p>
                  </CardContent>
                </Card>
                <Card className="rounded-2xl border-border/70 shadow-none">
                  <CardHeader>
                    <CardTitle className="text-base">Capacidad automática</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-semibold">
                      {formatNumber(capacidadAutomatica)}
                    </p>
                  </CardContent>
                </Card>
                <Card className="rounded-2xl border-border/70 shadow-none">
                  <CardHeader>
                    <CardTitle className="text-base">Horas prácticas</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-semibold">
                      {formatNumber(capacidadPractica)}
                    </p>
                  </CardContent>
                </Card>
                <Card className="rounded-2xl border-border/70 shadow-none">
                  <CardHeader>
                    <CardTitle className="text-base">Unidad elegida</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-semibold">
                      {getUnidadBaseLabel(baseForm.unidadBaseFutura)}
                    </p>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        );
      case "resultado":
        return (
          <div className="flex flex-col gap-5">
            <Card className="rounded-2xl border-border/70 shadow-none">
              <CardHeader>
                <CardTitle>Resultado estimado</CardTitle>
                <CardDescription>
                  Este resumen te muestra qué tarifa podría usar el sistema si
                  publicás este período.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 lg:grid-cols-4">
                <div className="rounded-2xl border border-border/70 p-4">
                  <p className="text-xs uppercase text-muted-foreground">
                    Costo mensual directo
                  </p>
                  <p className="text-3xl font-semibold">
                    {formatMoney(costoMensualDirecto)}
                  </p>
                </div>
                <div className="rounded-2xl border border-border/70 p-4">
                  <p className="text-xs uppercase text-muted-foreground">
                    Absorbido por reparto
                  </p>
                  <p className="text-3xl font-semibold">
                    {formatMoney(repartoAbsorbidoTotal)}
                  </p>
                </div>
                <div className="rounded-2xl border border-border/70 p-4">
                  <p className="text-xs uppercase text-muted-foreground">
                    Costo mensual total
                  </p>
                  <p className="text-3xl font-semibold">
                    {formatMoney(costoMensualTotal)}
                  </p>
                </div>
                <div className="rounded-2xl border border-border/70 p-4">
                  <p className="text-xs uppercase text-muted-foreground">
                    Capacidad real
                  </p>
                  <p className="text-3xl font-semibold">
                    {formatNumber(capacidadPractica)}
                  </p>
                </div>
                <div className="rounded-2xl border border-border/70 p-4">
                  <p className="text-xs uppercase text-muted-foreground">
                    Tarifa calculada
                  </p>
                  <p className="text-3xl font-semibold">
                    {formatMoney(tarifaProyectada)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    por {getUnidadBaseLabel(baseForm.unidadBaseFutura)}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-border/70 shadow-none">
              <CardHeader>
                <CardTitle>Desglose de reparto absorbido</CardTitle>
                <CardDescription>
                  Costos trasladados desde centros con imputación por reparto al centro actual.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {repartoAbsorbidoDesglose.length === 0 ? (
                  <span className="text-sm text-muted-foreground">
                    Este centro no absorbió reparto en el período seleccionado.
                  </span>
                ) : (
                  repartoAbsorbidoDesglose.map((item) => (
                    <div
                      key={`${item.desdeCentroCostoId}-${item.desdeCentroCodigo}`}
                      className="flex items-center justify-between rounded-xl border border-border/70 px-4 py-3"
                    >
                      <div className="flex flex-col">
                        <span className="font-medium">
                          {item.desdeCentroCodigo} · {item.desdeCentroNombre}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          Centro origen del reparto
                        </span>
                      </div>
                      <span className="font-medium">{formatMoney(item.monto)}</span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-border/70 shadow-none">
              <CardHeader>
                <CardTitle>Checklist</CardTitle>
                <CardDescription>
                  Verificación rápida de lo necesario para guardar y publicar este
                  período.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {checklistItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start gap-3 rounded-2xl border border-border/70 px-4 py-3"
                  >
                    <div
                      className={
                        item.done
                          ? "flex size-8 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-700"
                          : "flex size-8 items-center justify-center rounded-full bg-amber-500/10 text-amber-700"
                      }
                    >
                      {item.done ? <CheckIcon /> : <CircleAlertIcon />}
                    </div>
                    <div className="flex flex-1 flex-col">
                      <p className="text-sm font-medium">{item.label}</p>
                      <p className="text-sm text-muted-foreground">
                        {item.description}
                      </p>
                    </div>
                  </div>
                ))}
                <div
                  className={
                    checklistReady
                      ? "rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
                      : "rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
                  }
                >
                  {checklistReady
                    ? "El centro ya tiene lo necesario para guardar un borrador y publicar la tarifa."
                    : "Todavía faltan algunos puntos para publicar con seguridad este período."}
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-border/70 shadow-none">
              <CardHeader>
                <CardTitle>Historial visible</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-border/70 p-4">
                  <p className="text-xs uppercase text-muted-foreground">
                    Último borrador del período
                  </p>
                  <p className="text-2xl font-semibold">
                    {draftTariff === null ? "Sin calcular" : formatMoney(draftTariff)}
                  </p>
                </div>
                <div className="rounded-2xl border border-border/70 p-4">
                  <p className="text-xs uppercase text-muted-foreground">
                    Última tarifa publicada
                  </p>
                  <p className="text-2xl font-semibold">
                    {publishedTariff === null
                      ? "Sin publicar"
                      : formatMoney(publishedTariff)}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        );
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className={wizardSheetClassName}>
        <SheetHeader className="border-b border-border/70">
          <SheetTitle>Configurar costo de {centro.nombre}</SheetTitle>
          <SheetDescription>
            Vamos a ayudarte a estimar el costo del sector {centro.codigo} para un
            mes de vigencia concreto, sin pedirte que pienses como contador.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-6 p-4">
          <div className="flex flex-col gap-4 rounded-2xl border border-border/70 bg-muted/10 p-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Mes de vigencia</span>
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <button
                          type="button"
                          className="inline-flex items-center text-muted-foreground transition-colors hover:text-foreground"
                          aria-label="Explicación sobre el mes de vigencia"
                        >
                          <InfoIcon className="size-4" />
                        </button>
                      }
                    />
                    <TooltipContent className="max-w-sm text-pretty" side="left">
                      Es una foto mensual de costos. Si después no publicás un mes más
                      nuevo, el sistema sigue usando la última tarifa publicada como
                      referencia. Solo necesitás crear otro mes cuando cambian los
                      costos o querés guardar un histórico distinto.
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    type="month"
                    className="w-full sm:w-44"
                    value={periodo}
                    onChange={(event) => setPeriodo(event.target.value)}
                    aria-label="Mes de vigencia"
                  />
                  <Button type="button" variant="outline" onClick={handleCopyLastPeriod}>
                    <CopyIcon />
                    Copiar mes anterior
                  </Button>
                </div>
              </div>
              <Badge variant="outline">Activo {formatPeriodo(periodo)}</Badge>
            </div>

            <Tabs value={activeStep} onValueChange={(value) => setActiveStep(value as WizardStep)}>
              <TabsList className="h-auto w-full flex-wrap justify-start gap-1 rounded-xl border border-sidebar-border/20 bg-sidebar/8 p-1">
                <TabsTrigger value="identidad">1. Ajustes</TabsTrigger>
                <TabsTrigger value="recursos">2. Recursos</TabsTrigger>
                <TabsTrigger value="costos">3. Costos</TabsTrigger>
                <TabsTrigger value="capacidad">4. Capacidad</TabsTrigger>
                <TabsTrigger value="resultado">5. Resultado</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {isLoading ? (
            <div className="flex min-h-56 items-center justify-center">
              <GdiSpinner className="size-4" />
            </div>
          ) : (
            renderStepContent()
          )}
        </div>

        <SheetFooter className="border-t border-border/70">
          <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2">
              {activeStep !== "identidad" ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    const steps: WizardStep[] = [
                      "identidad",
                      "recursos",
                      "costos",
                      "capacidad",
                      "resultado",
                    ];
                    const currentIndex = steps.indexOf(activeStep);
                    setActiveStep(steps[Math.max(currentIndex - 1, 0)]);
                  }}
                >
                  Paso anterior
                </Button>
              ) : null}
              {activeStep !== "resultado" ? (
                <Button
                  type="button"
                  variant="brand"
                  onClick={() => {
                    const steps: WizardStep[] = [
                      "identidad",
                      "recursos",
                      "costos",
                      "capacidad",
                      "resultado",
                    ];
                    const currentIndex = steps.indexOf(activeStep);
                    setActiveStep(steps[Math.min(currentIndex + 1, steps.length - 1)]);
                  }}
                >
                  Siguiente paso
                </Button>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleSaveDraft}
                disabled={isSaving}
              >
                {isSaving ? <GdiSpinner className="size-4" /> : <SaveIcon />}
                Guardar borrador
              </Button>
              <Button
                type="button"
                variant="brand"
                onClick={handlePublish}
                disabled={isSaving}
              >
                {isSaving ? (
                  <GdiSpinner className="size-4" />
                ) : (
                  <SparklesIcon />
                )}
                Publicar tarifa
              </Button>
              <Button
                type="button"
                variant="sidebar"
                onClick={async () => {
                  if (!centro) {
                    return;
                  }

                  startSaving(async () => {
                    try {
                      await persistConfiguration();
                      const result = await calcularTarifaCentroCosto(centro.id, periodo);
                      setDraftTariff(result.tarifaBorrador.tarifaCalculada);
                      const reparto = extractRepartoAbsorbido(
                        result.tarifaBorrador.resumen as
                          | Record<string, unknown>
                          | null
                          | undefined,
                      );
                      setRepartoAbsorbidoTotal(reparto.total);
                      setRepartoAbsorbidoDesglose(reparto.desglose);
                      setWarnings(result.advertencias);
                      toast.success("Tarifa recalculada.");
                    } catch (error) {
                      toast.error(
                        error instanceof Error
                          ? error.message
                          : "No se pudo recalcular la tarifa.",
                      );
                    }
                  });
                }}
                disabled={isSaving}
              >
                {isSaving ? (
                  <GdiSpinner className="size-4" />
                ) : (
                  <CalculatorIcon />
                )}
                Recalcular
              </Button>
            </div>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
