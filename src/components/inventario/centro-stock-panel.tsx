"use client";

import {
  StockConversionFields,
  stockUnitLabel,
} from "./stock-conversion-fields";
import {
  normalizeMaterialUnit,
  type MaterialUnitContext,
} from "@/lib/material-units";

import * as React from "react";
import { formatearMoneda } from "@/lib/moneda";
import { useConfigRegional } from "@/components/navigation/config-regional-provider";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeftRight,
  BoxIcon,
  CirclePlusIcon,
  History,
  RefreshCw,
  Warehouse,
} from "lucide-react";
import { toast } from "sonner";

import {
  createAlmacen,
  registrarMovimientoStock,
  registrarTransferenciaStock,
} from "@/lib/inventario-stock-api";
import { updateVariantePrecioReferencia } from "@/lib/materias-primas-api";
import type {
  AlmacenMateriaPrima,
  OrigenMovimientoStockMateriaPrima,
  StockMateriaPrimaItem,
} from "@/lib/inventario-stock";
import type { MateriaPrima } from "@/lib/materias-primas";
import {
  getMateriaPrimaVarianteLabel,
  getVarianteDisplayName,
} from "@/lib/materias-primas-variantes-display";
import { Card, Chip, Input, Spinner } from "@heroui/react";
import { ActionButton } from "@/components/design-system/action-button";
import { ActionLink } from "@/components/design-system/action-link";
import { FormSheet } from "@/components/design-system/form-sheet";
import { FormDialog } from "@/components/design-system/form-dialog";
import { SelectField } from "@/components/design-system/select-field";
import {
  useDesignScope,
  useDesignTheme,
} from "@/components/design-system/appearance";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePuede } from "@/components/navigation/permisos-provider";
import {
  inventoryHref,
  notifyInventoryChanged,
} from "@/lib/inventario-navigation";
import { useInventoryQuery } from "./use-inventory-query";
import { useStockPage } from "./use-stock-page";
import { InventoryVariantPicker } from "./inventory-variant-picker";
import {
  ConfiguracionReservas,
  ReservasDeSaldo,
} from "./reservas-stock-controls";
import layout from "@/components/design-system/list-page.module.css";
import materialStyles from "./materiales.module.css";
import styles from "./centro-stock.module.css";

type CentroStockPanelProps = {
  initialAlmacenes: AlmacenMateriaPrima[];
  materiasPrimas: MateriaPrima[];
};

const ORIGEN_ITEMS: Array<{ value: OrigenMovimientoStockMateriaPrima; label: string }> = [
  { value: "compra", label: "Compra" },
  { value: "consumo_produccion", label: "Consumo producción" },
  { value: "ajuste_manual", label: "Ajuste manual" },
  { value: "devolucion", label: "Devolución" },
  { value: "otro", label: "Otro" },
];
const UMBRAL_VARIACION_COSTO_ABS = 0.1;
const quantityFormatter = new Intl.NumberFormat("es-AR", {
  maximumFractionDigits: 8,
});
const number2Formatter = new Intl.NumberFormat("es-AR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function getDefaultUbicacionId(almacen: AlmacenMateriaPrima | undefined) {
  if (!almacen) return "";
  return (
    almacen.ubicaciones.find(
      (item) => item.activo && item.codigo === "PRINCIPAL",
    )?.id ??
    almacen.ubicaciones.find((item) => item.activo)?.id ??
    ""
  );
}

function generateAutoAlmacenCodigo() {
  const base36 = Date.now().toString(36).toUpperCase();
  return `ALM-${base36.slice(-6)}`;
}

export function CentroStockPanel({
  initialAlmacenes,
  materiasPrimas,
}: CentroStockPanelProps) {
  const { moneda } = useConfigRegional();
  const router = useRouter();
  const scope = useDesignScope();
  const theme = useDesignTheme();
  const canManage = usePuede("inventario.gestionar");
  const query = useInventoryQuery();
  const { result, loading, error, refresh } = useStockPage({
    materiaPrimaId: query.materiaPrimaId,
    varianteId: query.varianteId,
    almacenId: query.almacenId,
    ubicacionId: query.ubicacionId,
    search: query.search,
    soloConStock: query.soloConStock,
    page: query.page,
    pageSize: 50,
  });
  const [depositsOpen, setDepositsOpen] = React.useState(false);
  const [destinoUbicacionId, setDestinoUbicacionId] = React.useState("");
  const [ingresoInicialUbicacionId, setIngresoInicialUbicacionId] =
    React.useState("");
  const activeWarehouses = initialAlmacenes.filter((item) => item.activo);
  const activeLocations = activeWarehouses.flatMap((almacen) =>
    almacen.ubicaciones
      .filter((item) => item.activo)
      .map((item) => ({
        ...item,
        almacenId: almacen.id,
        label: `${almacen.nombre} · ${item.nombre}`,
      })),
  );
  const pages = Math.max(1, Math.ceil((result?.total ?? 0) / 50));
  React.useEffect(() => {
    if (!loading && !error && result && query.page > pages)
      query.update({ page: String(pages) }, false);
  }, [loading, error, result, query, pages]);
  const afterMutation = () => {
    notifyInventoryChanged();
    router.refresh();
  };

  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [almacenNombre, setAlmacenNombre] = React.useState("");
  const [almacenDescripcion, setAlmacenDescripcion] = React.useState("");

  const [movOpen, setMovOpen] = React.useState(false);
  const [trxOpen, setTrxOpen] = React.useState(false);
  const [ingresoInicialOpen, setIngresoInicialOpen] = React.useState(false);
  const [rowSelected, setRowSelected] =
    React.useState<StockMateriaPrimaItem | null>(null);

  const [tipo, setTipo] = React.useState<
    "ingreso" | "egreso" | "ajuste_entrada" | "ajuste_salida"
  >("ingreso");
  const [origen, setOrigen] =
    React.useState<OrigenMovimientoStockMateriaPrima>("compra");
  const [unidadMovimiento, setUnidadMovimiento] = React.useState("");
  const [cantidadRealStock, setCantidadRealStock] = React.useState("");
  const [unidadIngreso, setUnidadIngreso] = React.useState("");
  const [cantidadRealIngreso, setCantidadRealIngreso] = React.useState("");
  const [cantidad, setCantidad] = React.useState("1");
  const [costoUnitario, setCostoUnitario] = React.useState("");
  const [referenciaId, setReferenciaId] = React.useState("");

  const [cantidadTransfer, setCantidadTransfer] = React.useState("1");
  const [ingresoInicialAlmacenId, setIngresoInicialAlmacenId] =
    React.useState("");
  const [ingresoInicialVarianteId, setIngresoInicialVarianteId] =
    React.useState("");
  const [ingresoInicialOrigen, setIngresoInicialOrigen] =
    React.useState<OrigenMovimientoStockMateriaPrima>("compra");
  const [ingresoInicialCantidad, setIngresoInicialCantidad] = React.useState("1");
  const [ingresoInicialCostoUnitario, setIngresoInicialCostoUnitario] = React.useState("");
  const [ingresoInicialReferenciaId, setIngresoInicialReferenciaId] = React.useState("");
  const [confirmPrecioOpen, setConfirmPrecioOpen] = React.useState(false);
  const [confirmPrecioData, setConfirmPrecioData] = React.useState<{
    etiqueta: string;
    precioReferencia: number | null;
    costoUnitario: number;
    moneda: string;
  } | null>(null);
  const confirmPrecioResolverRef = React.useRef<((value: boolean) => void) | null>(null);

  const variantesIngresoInicial = React.useMemo(() => {
    return materiasPrimas
      .filter((mp) => mp.activo)
      .flatMap((mp) =>
        mp.variantes
          .filter((variante) => variante.activo)
          .map((variante) => ({
            varianteId: variante.id,
            label: getMateriaPrimaVarianteLabel(mp, variante, { maxDimensiones: 5 }),
            searchText: `${mp.nombre} ${variante.nombreVariante ?? ""} ${variante.sku}`.toLowerCase(),
          })),
      )
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [materiasPrimas]);

  const varianteMetaById = React.useMemo(() => {
    const map = new Map<
      string,
      {
        materiaPrimaNombre: string;
        varianteNombre: string;
        precioReferencia: number | null;
        moneda: string;
        puedeActualizarReferencia: boolean;
        unidades: MaterialUnitContext;
      }
    >();

    for (const materiaPrima of materiasPrimas) {
      for (const variante of materiaPrima.variantes) {
        map.set(variante.id, {
          unidades: {
            unidadStock: variante.unidadStock ?? materiaPrima.unidadStock,
            unidadCompra: variante.unidadCompra ?? materiaPrima.unidadCompra,
            unidadUso:
              variante.unidadUso ??
              materiaPrima.unidadUso ??
              variante.unidadStock ??
              materiaPrima.unidadStock,
            unidadPrecio: variante.unidadPrecio,
            equivalenciaCompra: variante.equivalenciaCompra,
            equivalencias: variante.equivalencias,
            templateId: materiaPrima.templateId,
            atributos: variante.atributosVariante,
          },
          materiaPrimaNombre: materiaPrima.nombre,
          varianteNombre: getVarianteDisplayName(materiaPrima, variante, {
            maxDimensiones: 5,
          }),
          puedeActualizarReferencia:
            (!variante.moneda || variante.moneda === moneda.codigo) &&
            (variante.unidadPrecio ??
              variante.unidadCompra ??
              materiaPrima.unidadCompra) ===
              (variante.unidadStock ?? materiaPrima.unidadStock),
          precioReferencia: variante.precioReferencia ?? null,
          moneda: (variante.moneda || "ARS").trim().toUpperCase(),
        });
      }
    }

    return map;
  }, [materiasPrimas, moneda.codigo]);

  const unidadesMovimiento = rowSelected
    ? varianteMetaById.get(rowSelected.varianteId)?.unidades
    : undefined;
  const unidadesIngreso = varianteMetaById.get(
    ingresoInicialVarianteId,
  )?.unidades;

  const maybeActualizarPrecioReferencia = React.useCallback(
    async (varianteId: string, costoUnitario: number | undefined) => {
      if (costoUnitario === undefined) return;
      const meta = varianteMetaById.get(varianteId);
      if (!meta || !meta.puedeActualizarReferencia) return;

      const etiqueta = `${meta.materiaPrimaNombre} - ${meta.varianteNombre}`;
      const precioReferencia = meta.precioReferencia;

      let shouldSuggestUpdate = false;

      if (!precioReferencia || precioReferencia <= 0) {
        shouldSuggestUpdate = true;
      } else {
        const variacionAbs = Math.abs(costoUnitario - precioReferencia);
        if (variacionAbs >= UMBRAL_VARIACION_COSTO_ABS) {
          shouldSuggestUpdate = true;
        }
      }

      if (!shouldSuggestUpdate) return;

      const confirmed = await new Promise<boolean>((resolve) => {
        confirmPrecioResolverRef.current = resolve;
        setConfirmPrecioData({
          etiqueta,
          precioReferencia,
          costoUnitario,
          moneda: meta.moneda,
        });
        setConfirmPrecioOpen(true);
      });
      if (!confirmed) return;

      try {
        await updateVariantePrecioReferencia(varianteId, {
          precioReferencia: costoUnitario,
          moneda: meta.moneda,
        });
        toast.success("Precio referencia actualizado.");
      } catch (error) {
        toast.error(
          error instanceof Error
            ? `Se registró el ingreso, pero no se pudo actualizar el precio referencia: ${error.message}`
            : "Se registró el ingreso, pero no se pudo actualizar el precio referencia.",
        );
      }
    },
    [varianteMetaById],
  );

  const resolveIngresoCostWithReference = React.useCallback(
    (
      varianteId: string,
      rawCost: string,
    ): { cost: number | undefined; usedReferencia: boolean; missingReferenciaForZero: boolean } => {
      const trimmed = rawCost.trim();
      if (!trimmed.length) {
        return { cost: undefined, usedReferencia: false, missingReferenciaForZero: false };
      }
      const parsed = Number(trimmed);
      if (!Number.isFinite(parsed) || parsed < 0) {
        return { cost: Number.NaN, usedReferencia: false, missingReferenciaForZero: false };
      }
      if (parsed !== 0) {
        return { cost: parsed, usedReferencia: false, missingReferenciaForZero: false };
      }

      const precioReferencia =
        varianteMetaById.get(varianteId)?.precioReferencia ?? null;
      if (
        typeof precioReferencia === "number" &&
        Number.isFinite(precioReferencia) &&
        precioReferencia > 0
      ) {
        return {
          cost: undefined,
          usedReferencia: true,
          missingReferenciaForZero: false,
        };
      }

      return { cost: 0, usedReferencia: false, missingReferenciaForZero: true };
    },
    [varianteMetaById],
  );

  const resolveConfirmPrecio = React.useCallback((value: boolean) => {
    setConfirmPrecioOpen(false);
    setConfirmPrecioData(null);
    if (confirmPrecioResolverRef.current) {
      confirmPrecioResolverRef.current(value);
      confirmPrecioResolverRef.current = null;
    }
  }, []);

  const handleCreateAlmacen = async () => {
    if (!canManage || isSaving) return;
    if (!almacenNombre.trim()) {
      toast.error("Completa el nombre del almacén.");
      return;
    }
    const generatedCodigo = generateAutoAlmacenCodigo();

    setIsSaving(true);
    try {
      await createAlmacen({
        codigo: generatedCodigo,
        nombre: almacenNombre.trim(),
        descripcion: almacenDescripcion.trim() || undefined,
        activo: true,
      });
      toast.success("Almacén creado. Se generó una ubicación interna principal automáticamente.");
      setAlmacenNombre("");
      setAlmacenDescripcion("");
      setIsCreateOpen(false);
      afterMutation();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo crear el almacén.");
    } finally {
      setIsSaving(false);
    }
  };

  const openMovimiento = (row: StockMateriaPrimaItem) => {
    setRowSelected(row);
    setTipo("ingreso");
    setOrigen("compra");
    setUnidadMovimiento(
      varianteMetaById.get(row.varianteId)?.unidades.unidadStock ?? "",
    );
    setCantidadRealStock("");
    setCantidad("1");
    setCostoUnitario("");
    setReferenciaId("");
    setMovOpen(true);
  };

  const openTransferencia = (row: StockMateriaPrimaItem) => {
    setRowSelected(row);
    setDestinoUbicacionId(
      activeLocations.find((item) => item.id !== row.ubicacionId)?.id ?? "",
    );
    setCantidadTransfer("1");
    setTrxOpen(true);
  };

  const openIngresoInicial = () => {
    if (activeWarehouses.length === 0) {
      toast.error("Primero crea un almacén.");
      return;
    }

    if (variantesIngresoInicial.length === 0) {
      toast.error("No hay materias primas activas con variantes para ingresar stock.");
      return;
    }

    setUnidadIngreso("");
    setCantidadRealIngreso("");
    const warehouse =
      activeWarehouses.find((item) => item.id === query.almacenId) ??
      activeWarehouses[0];
    setIngresoInicialAlmacenId(warehouse?.id ?? "");
    setIngresoInicialUbicacionId(
      warehouse?.ubicaciones.find(
        (item) => item.activo && item.id === query.ubicacionId,
      )?.id ?? getDefaultUbicacionId(warehouse),
    );
    const variantId = variantesIngresoInicial.some(
      (item) => item.varianteId === query.varianteId,
    )
      ? query.varianteId!
      : "";
    setIngresoInicialVarianteId(variantId);
    setUnidadIngreso(
      varianteMetaById.get(variantId)?.unidades.unidadCompra ?? "",
    );
    setIngresoInicialOrigen("compra");
    setIngresoInicialCantidad("1");
    setIngresoInicialCostoUnitario("");
    setIngresoInicialReferenciaId("");
    setIngresoInicialOpen(true);
  };

  const handleRegistrarMovimiento = async () => {
    if (!canManage || isSaving) return;
    if (!rowSelected) return;
    const ubicacionId = rowSelected.ubicacionId;
    if (!ubicacionId) {
      toast.error(
        "No se pudo identificar la ubicación del saldo seleccionado.",
      );
      return;
    }

    const qty = Number(cantidad);
    if (!Number.isFinite(qty) || qty <= 0) {
      toast.error("La cantidad debe ser mayor a 0.");
      return;
    }

    const {
      cost,
      usedReferencia,
      missingReferenciaForZero,
    } = tipo === "ingreso"
      ? resolveIngresoCostWithReference(rowSelected.varianteId, costoUnitario)
      : {
          cost: costoUnitario.trim().length ? Number(costoUnitario) : undefined,
          usedReferencia: false,
          missingReferenciaForZero: false,
        };

    if (cost !== undefined && (!Number.isFinite(cost) || cost < 0)) {
      toast.error("Costo unitario inválido.");
      return;
    }
    if (missingReferenciaForZero) {
      toast.error(
        "No se puede ingresar costo 0: la variante no tiene precio de referencia cargado.",
      );
      return;
    }

    setIsSaving(true);
    try {
      await registrarMovimientoStock({
        varianteId: rowSelected.varianteId,
        ubicacionId,
        tipo,
        origen,
        cantidad: qty,
        unidad: unidadMovimiento || unidadesMovimiento?.unidadStock,
        cantidadStock:
          cantidadRealStock && ["ingreso", "ajuste_entrada"].includes(tipo)
            ? Number(cantidadRealStock)
            : undefined,
        costoUnitario: cost,
        referenciaTipo: "manual",
        referenciaId: referenciaId.trim() || undefined,
      });
      if (tipo === "ingreso") {
        if (usedReferencia) {
          toast.message("Se aplicó automáticamente el precio de referencia de la materia prima.");
        }
        if (
          !cantidadRealStock &&
          normalizeMaterialUnit(
            unidadMovimiento || unidadesMovimiento?.unidadStock || "",
          ) === normalizeMaterialUnit(unidadesMovimiento?.unidadStock || "")
        )
          await maybeActualizarPrecioReferencia(rowSelected.varianteId, cost);
      }
      toast.success("Movimiento registrado.");
      setMovOpen(false);
      afterMutation();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo registrar movimiento.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRegistrarTransferencia = async () => {
    if (!canManage || isSaving) return;
    if (!rowSelected || !destinoUbicacionId) {
      toast.error("Seleccioná una ubicación de destino.");
      return;
    }

    const qty = Number(cantidadTransfer);
    if (!Number.isFinite(qty) || qty <= 0) {
      toast.error("La cantidad debe ser mayor a 0.");
      return;
    }

    const ubicacionOrigenId = rowSelected.ubicacionId;
    const ubicacionDestinoId = activeLocations.find(
      (item) => item.id === destinoUbicacionId && item.id !== ubicacionOrigenId,
    )?.id;

    if (!ubicacionOrigenId || !ubicacionDestinoId) {
      toast.error(
        "Seleccioná una ubicación de destino activa y diferente del origen.",
      );
      return;
    }

    setIsSaving(true);
    try {
      await registrarTransferenciaStock({
        varianteId: rowSelected.varianteId,
        ubicacionOrigenId,
        ubicacionDestinoId,
        cantidad: qty,
        referenciaTipo: "manual",
      });
      toast.success("Transferencia registrada.");
      setTrxOpen(false);
      afterMutation();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo transferir.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRegistrarIngresoInicial = async () => {
    if (!canManage || isSaving) return;
    if (!ingresoInicialAlmacenId || !ingresoInicialVarianteId) {
      toast.error("Selecciona almacén y materia prima.");
      return;
    }

    const almacen = initialAlmacenes.find((item) => item.id === ingresoInicialAlmacenId);
    const ubicacionId = almacen?.activo
      ? almacen.ubicaciones.find(
          (item) => item.id === ingresoInicialUbicacionId && item.activo,
        )?.id
      : undefined;
    if (!ubicacionId) {
      toast.error("Seleccioná una ubicación activa para ingresar el stock.");
      return;
    }

    const qty = Number(ingresoInicialCantidad);
    if (!Number.isFinite(qty) || qty <= 0) {
      toast.error("La cantidad debe ser mayor a 0.");
      return;
    }

    const {
      cost,
      usedReferencia,
      missingReferenciaForZero,
    } = resolveIngresoCostWithReference(ingresoInicialVarianteId, ingresoInicialCostoUnitario);
    if (cost !== undefined && (!Number.isFinite(cost) || cost < 0)) {
      toast.error("Costo unitario inválido.");
      return;
    }
    if (missingReferenciaForZero) {
      toast.error(
        "No se puede ingresar costo 0: la variante no tiene precio de referencia cargado.",
      );
      return;
    }

    setIsSaving(true);
    try {
      await registrarMovimientoStock({
        varianteId: ingresoInicialVarianteId,
        ubicacionId,
        tipo: "ingreso",
        origen: ingresoInicialOrigen,
        cantidad: qty,
        unidad: unidadIngreso || unidadesIngreso?.unidadCompra,
        cantidadStock: cantidadRealIngreso
          ? Number(cantidadRealIngreso)
          : undefined,
        costoUnitario: cost,
        referenciaTipo: "manual",
        referenciaId: ingresoInicialReferenciaId.trim() || undefined,
      });
      if (usedReferencia) {
        toast.message("Se aplicó automáticamente el precio de referencia de la materia prima.");
      }
      if (
        !cantidadRealIngreso &&
        normalizeMaterialUnit(
          unidadIngreso || unidadesIngreso?.unidadCompra || "",
        ) === normalizeMaterialUnit(unidadesIngreso?.unidadStock || "")
      )
        await maybeActualizarPrecioReferencia(ingresoInicialVarianteId, cost);
      toast.success("Ingreso registrado.");
      setIngresoInicialOpen(false);
      afterMutation();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo registrar ingreso.");
    } finally {
      setIsSaving(false);
    }
  };

  const variantOptions = materiasPrimas
    .filter(
      (material) =>
        !query.materiaPrimaId || material.id === query.materiaPrimaId,
    )
    .flatMap((material) =>
      material.variantes.map((variant) => ({
        id: variant.id,
        label: getMateriaPrimaVarianteLabel(material, variant, {
          maxDimensiones: 5,
        }),
      })),
    );
  const context = {
    materiaPrimaId: query.materiaPrimaId,
    varianteId: query.varianteId,
    almacenId: query.almacenId,
    ubicacionId: query.ubicacionId,
  };
  const materialContext = materiasPrimas.find(
    (material) => material.id === query.materiaPrimaId,
  );
  const closeActions = (
    close: () => void,
    save: () => Promise<void>,
    label: string,
  ) => (
    <>
      <ActionButton variant="outline" onPress={close} isDisabled={isSaving}>
        Cancelar
      </ActionButton>
      <ActionButton onPress={save} isPending={isSaving} isDisabled={isSaving}>
        {isSaving ? "Guardando…" : label}
      </ActionButton>
    </>
  );
  const rowDescription = rowSelected
    ? `${varianteMetaById.get(rowSelected.varianteId)?.materiaPrimaNombre ?? rowSelected.materiaPrimaNombre} · ${varianteMetaById.get(rowSelected.varianteId)?.varianteNombre ?? ""} · ${rowSelected.almacenNombre} / ${rowSelected.ubicacionNombre}`
    : "";

  return (
    <section
      {...scope}
      data-visual="brand"
      className={`${theme} ${layout.page} ${materialStyles.page}`}
    >
      <header className={layout.header}>
        <div>
          <p className={materialStyles.eyebrow}>Inventario · Existencias</p>
          <h1>
            Stock<span className={materialStyles.titleDot}>.</span>
          </h1>
          <p className={layout.subtitle}>
            Materiales por depósito y ubicación. Ingresos, ajustes y
            transferencias.
          </p>
        </div>
        <div className={styles.headerActions}>
          {canManage && <ConfiguracionReservas />}
          <ActionButton variant="outline" onPress={() => setDepositsOpen(true)}>
            <Warehouse data-icon="inline-start" />
            Depósitos
          </ActionButton>
          <ActionLink
            variant="outline"
            href={inventoryHref("movimientos", context)}
          >
            <History data-icon="inline-start" />
            Movimientos
          </ActionLink>
          {canManage && (
            <ActionButton onPress={openIngresoInicial}>
              <CirclePlusIcon data-icon="inline-start" />
              Ingresar stock
            </ActionButton>
          )}
        </div>
      </header>
      <Card className={`${layout.results} ${styles.results}`}>
        {(query.materiaPrimaId || query.ubicacionId) && (
          <div className={styles.context}>
            <span>
              {materialContext
                ? `Material: ${materialContext.nombre}`
                : query.materiaPrimaId
                  ? "Material seleccionado"
                  : ""}
              {query.ubicacionId ? " · Ubicación seleccionada" : ""}
            </span>
            <ActionButton
              variant="ghost"
              onPress={() =>
                query.update({
                  materiaPrimaId: undefined,
                  varianteId: undefined,
                  ubicacionId: undefined,
                })
              }
            >
              Ver todos los materiales
            </ActionButton>
          </div>
        )}
        <div className={styles.toolbar}>
          <div className={styles.filter}>
            <span>Material / variante</span>
            <InventoryVariantPicker
              label="Filtrar stock por variante"
              value={query.varianteId ?? "__all__"}
              options={[
                { id: "__all__", label: "Todas las variantes" },
                ...variantOptions,
              ]}
              onChange={(value) =>
                query.update({
                  varianteId: value === "__all__" ? undefined : value,
                })
              }
            />
          </div>
          <div className={styles.filter}>
            <span>Depósito</span>
            <SelectField
              aria-label="Filtrar stock por depósito"
              value={query.almacenId ?? ""}
              options={[
                { value: "", label: "Todos los depósitos" },
                ...initialAlmacenes.map((item) => ({
                  value: item.id,
                  label: `${item.nombre}${item.activo ? "" : " · Inactivo"}`,
                })),
              ]}
              onChange={(value) =>
                query.update({ almacenId: value, ubicacionId: undefined })
              }
            />
          </div>
          <div className={styles.filter}>
            <span>Existencias</span>
            <SelectField
              aria-label="Filtrar por existencia"
              value={query.soloConStock ? "con" : "todos"}
              options={[
                { value: "todos", label: "Todos los saldos" },
                { value: "con", label: "Sólo con stock" },
              ]}
              onChange={(value) =>
                query.update({
                  soloConStock: value === "con" ? "true" : undefined,
                })
              }
            />
          </div>
          <ActionButton
            variant="outline"
            onPress={refresh}
            isDisabled={loading}
            aria-label="Actualizar stock"
          >
            <RefreshCw data-icon="inline-start" />
            Actualizar
          </ActionButton>
        </div>
        <div aria-busy={loading}>
          {loading ? (
            <div className={layout.empty} role="status">
              <Spinner size="sm" />
              Consultando existencias…
            </div>
          ) : error ? (
            <Empty className={layout.empty}>
              <EmptyHeader>
                <EmptyTitle>No pudimos consultar el stock</EmptyTitle>
                <EmptyDescription>{error}</EmptyDescription>
              </EmptyHeader>
              <ActionButton variant="outline" onPress={refresh}>
                Reintentar
              </ActionButton>
            </Empty>
          ) : !result?.items.length ? (
            <Empty className={layout.empty}>
              <EmptyHeader>
                <BoxIcon aria-hidden />
                <EmptyTitle>Sin saldos para esta selección</EmptyTitle>
                <EmptyDescription>
                  No hay saldos que coincidan con estos filtros.
                  {canManage &&
                    " Podés registrar existencias desde «Ingresar stock»."}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <Table
              className={`${materialStyles.table} ${styles.table}`}
              aria-label="Existencias por ubicación"
            >
              <TableHeader>
                <TableRow>
                  <TableHead>Material / variante</TableHead>
                  <TableHead>Depósito / ubicación</TableHead>
                  <TableHead className="text-right">
                    Existencia física
                  </TableHead>
                  <TableHead className="text-right">Reservado</TableHead>
                  <TableHead className="text-right">Libre</TableHead>
                  <TableHead className="text-right">Costo promedio</TableHead>
                  <TableHead className="text-right">Valor stock</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.items.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <div className={styles.material}>
                        <Link
                          href={`/inventario/materias-primas/${row.materiaPrimaId}`}
                        >
                          {row.materiaPrimaNombre}
                        </Link>
                        <span className={styles.secondary}>
                          {varianteMetaById.get(row.varianteId)
                            ?.varianteNombre ?? "Variante"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {row.almacenNombre}
                      <span className={styles.secondary}>
                        {row.ubicacionNombre}
                      </span>
                    </TableCell>
                    <TableCell className={styles.number}>
                      {quantityFormatter.format(row.cantidadDisponible)}{" "}
                      {stockUnitLabel(row.unidadStock ?? "")}
                    </TableCell>
                    <TableCell className={styles.number}>
                      <ReservasDeSaldo
                        varianteId={row.varianteId}
                        ubicacionId={row.ubicacionId}
                        cantidad={row.cantidadReservada ?? 0}
                        unidad={row.unidadStock ?? ""}
                      />
                    </TableCell>
                    <TableCell className={styles.number}>
                      {quantityFormatter.format(
                        row.cantidadLibre ?? row.cantidadDisponible,
                      )}{" "}
                      {stockUnitLabel(row.unidadStock ?? "")}
                    </TableCell>
                    <TableCell className={styles.number}>
                      {formatearMoneda(row.costoPromedio, moneda, {
                        decimales: 6,
                      })}
                      <span className={styles.secondary}>
                        por{" "}
                        {stockUnitLabel(row.unidadStock ?? "").toLowerCase()}
                      </span>
                    </TableCell>
                    <TableCell className={styles.number}>
                      {formatearMoneda(row.valorStock, moneda, {
                        decimales: 2,
                      })}
                    </TableCell>
                    <TableCell>
                      <div className={styles.rowActions}>
                        {canManage && (
                          <>
                            <ActionButton
                              variant="outline"
                              onPress={() => openMovimiento(row)}
                            >
                              Movimiento
                            </ActionButton>
                            <ActionButton
                              variant="outline"
                              onPress={() => openTransferencia(row)}
                              isDisabled={
                                (row.cantidadLibre ?? row.cantidadDisponible) <=
                                  0 ||
                                !activeLocations.some(
                                  (item) => item.id !== row.ubicacionId,
                                )
                              }
                              title="Transferir desde esta ubicación"
                              aria-label="Transferir desde esta ubicación"
                              isIconOnly
                            >
                              <ArrowLeftRight />
                            </ActionButton>
                          </>
                        )}
                        <ActionLink
                          variant="outline"
                          href={inventoryHref("movimientos", {
                            materiaPrimaId: row.materiaPrimaId,
                            varianteId: row.varianteId,
                            almacenId: row.almacenId,
                            ubicacionId: row.ubicacionId,
                          })}
                          aria-label="Ver movimientos de esta ubicación"
                        >
                          <History data-icon="inline-start" />
                        </ActionLink>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
        {!error && result && !loading && (
          <div className={layout.pager}>
            <span>
              {result.total}{" "}
              {result.total === 1
                ? "saldo por ubicación"
                : "saldos por ubicación"}{" "}
              · Página {result.page} de {pages}
            </span>
            <div className={styles.actions}>
              <ActionButton
                variant="outline"
                isDisabled={query.page <= 1}
                onPress={() =>
                  query.update({ page: String(query.page - 1) }, false)
                }
              >
                Anterior
              </ActionButton>
              <ActionButton
                variant="outline"
                isDisabled={query.page >= pages}
                onPress={() =>
                  query.update({ page: String(query.page + 1) }, false)
                }
              >
                Siguiente
              </ActionButton>
            </div>
          </div>
        )}
      </Card>

      {depositsOpen && (
        <FormSheet
          title="Depósitos"
          description="Lugares donde guardás tus materiales."
          onClose={() => setDepositsOpen(false)}
          footer={
            canManage ? (
              <ActionButton
                onPress={() => {
                  setDepositsOpen(false);
                  setIsCreateOpen(true);
                }}
              >
                <CirclePlusIcon data-icon="inline-start" />
                Nuevo depósito
              </ActionButton>
            ) : undefined
          }
        >
          <div className={styles.deposits}>
            {initialAlmacenes.length ? (
              initialAlmacenes.map((item) => (
                <div key={item.id} className={styles.deposit}>
                  <div>
                    <strong>{item.nombre}</strong>
                    <span className={styles.secondary}>
                      {item.ubicaciones
                        .filter((location) => location.activo)
                        .map((location) => location.nombre)
                        .join(" · ") || "Sin ubicaciones activas"}
                    </span>
                  </div>
                  <Chip size="sm" variant="soft">
                    {item.activo ? "Activo" : "Inactivo"}
                  </Chip>
                </div>
              ))
            ) : (
              <p>Todavía no hay depósitos.</p>
            )}
          </div>
        </FormSheet>
      )}
      {canManage && isCreateOpen && (
        <FormSheet
          title="Nuevo depósito"
          description="Se crea con una ubicación principal lista para usar."
          onClose={() => setIsCreateOpen(false)}
          busy={isSaving}
          footer={closeActions(
            () => setIsCreateOpen(false),
            handleCreateAlmacen,
            "Crear depósito",
          )}
        >
          <FieldGroup className={styles.form}>
            <Field>
              <FieldLabel htmlFor="stock-deposito-nombre">Nombre</FieldLabel>
              <Input
                id="stock-deposito-nombre"
                value={almacenNombre}
                onChange={(event) => setAlmacenNombre(event.target.value)}
                autoFocus
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="stock-deposito-descripcion">
                Descripción · opcional
              </FieldLabel>
              <Input
                id="stock-deposito-descripcion"
                value={almacenDescripcion}
                onChange={(event) => setAlmacenDescripcion(event.target.value)}
              />
            </Field>
          </FieldGroup>
        </FormSheet>
      )}
      {canManage && movOpen && rowSelected && (
        <FormSheet
          title="Registrar movimiento"
          description={rowDescription}
          onClose={() => setMovOpen(false)}
          busy={isSaving}
          footer={closeActions(
            () => setMovOpen(false),
            handleRegistrarMovimiento,
            "Registrar movimiento",
          )}
        >
          <FieldGroup className={`${styles.form} ${styles.formGrid}`}>
            <Field>
              <FieldLabel>Tipo</FieldLabel>
              <SelectField
                aria-label="Tipo de movimiento"
                value={tipo}
                options={[
                  { value: "ingreso", label: "Ingreso" },
                  { value: "egreso", label: "Egreso" },
                  { value: "ajuste_entrada", label: "Ajuste de entrada" },
                  { value: "ajuste_salida", label: "Ajuste de salida" },
                ]}
                onChange={(value) => {
                  setTipo(value as typeof tipo);
                  setCantidadRealStock("");
                }}
              />
            </Field>
            <Field>
              <FieldLabel>Origen</FieldLabel>
              <SelectField
                aria-label="Origen del movimiento"
                value={origen}
                options={ORIGEN_ITEMS}
                onChange={(value) =>
                  setOrigen(value as OrigenMovimientoStockMateriaPrima)
                }
              />
            </Field>
            <Field className={styles.full}>
              <FieldLabel htmlFor="stock-mov-cantidad">Cantidad</FieldLabel>
              <Input
                id="stock-mov-cantidad"
                type="number"
                min="0.00000001"
                step="any"
                value={cantidad}
                onChange={(event) => setCantidad(event.target.value)}
              />
            </Field>
            <div className={styles.full}>
              <StockConversionFields
                context={unidadesMovimiento}
                unidad={unidadMovimiento}
                onUnidad={setUnidadMovimiento}
                cantidad={cantidad}
                cantidadStock={cantidadRealStock}
                onCantidadStock={setCantidadRealStock}
                ingreso={["ingreso", "ajuste_entrada"].includes(tipo)}
              />
            </div>
            <Field className={styles.full}>
              <FieldLabel htmlFor="stock-mov-costo">
                Costo por{" "}
                {stockUnitLabel(
                  unidadMovimiento ||
                    unidadesMovimiento?.unidadStock ||
                    "unidad",
                ).toLowerCase()}{" "}
                en {moneda.codigo} · opcional
              </FieldLabel>
              <Input
                id="stock-mov-costo"
                type="number"
                min="0"
                step="any"
                value={costoUnitario}
                onChange={(event) => setCostoUnitario(event.target.value)}
              />
            </Field>
            <Field className={styles.full}>
              <FieldLabel htmlFor="stock-mov-referencia">
                Referencia · opcional
              </FieldLabel>
              <Input
                id="stock-mov-referencia"
                value={referenciaId}
                onChange={(event) => setReferenciaId(event.target.value)}
              />
            </Field>
          </FieldGroup>
        </FormSheet>
      )}
      {canManage && trxOpen && rowSelected && (
        <FormSheet
          title="Transferir stock"
          description={rowDescription}
          onClose={() => setTrxOpen(false)}
          busy={isSaving}
          footer={closeActions(
            () => setTrxOpen(false),
            handleRegistrarTransferencia,
            "Transferir",
          )}
        >
          <FieldGroup className={styles.form}>
            <Field>
              <FieldLabel>Destino</FieldLabel>
              <SelectField
                aria-label="Ubicación de destino"
                value={destinoUbicacionId}
                options={activeLocations
                  .filter((item) => item.id !== rowSelected.ubicacionId)
                  .map((item) => ({ value: item.id, label: item.label }))}
                onChange={setDestinoUbicacionId}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="stock-transferencia-cantidad">
                Cantidad en{" "}
                {stockUnitLabel(rowSelected.unidadStock ?? "").toLowerCase()}
              </FieldLabel>
              <Input
                id="stock-transferencia-cantidad"
                type="number"
                min="0.00000001"
                max={rowSelected.cantidadDisponible}
                step="any"
                value={cantidadTransfer}
                onChange={(event) => setCantidadTransfer(event.target.value)}
              />
            </Field>
            <p>
              Existencia en origen:{" "}
              {quantityFormatter.format(rowSelected.cantidadDisponible)}{" "}
              {stockUnitLabel(rowSelected.unidadStock ?? "").toLowerCase()}.
            </p>
          </FieldGroup>
        </FormSheet>
      )}
      {canManage && ingresoInicialOpen && (
        <FormSheet
          title="Ingresar stock"
          description="Registrá la cantidad recibida y dónde se guarda."
          onClose={() => setIngresoInicialOpen(false)}
          busy={isSaving}
          footer={closeActions(
            () => setIngresoInicialOpen(false),
            handleRegistrarIngresoInicial,
            "Ingresar stock",
          )}
        >
          <FieldGroup className={`${styles.form} ${styles.formGrid}`}>
            <Field>
              <FieldLabel>Depósito</FieldLabel>
              <SelectField
                aria-label="Depósito del ingreso"
                value={ingresoInicialAlmacenId}
                options={activeWarehouses.map((item) => ({
                  value: item.id,
                  label: item.nombre,
                }))}
                onChange={(value) => {
                  setIngresoInicialAlmacenId(value);
                  setIngresoInicialUbicacionId(
                    getDefaultUbicacionId(
                      activeWarehouses.find((item) => item.id === value),
                    ),
                  );
                }}
              />
            </Field>
            <Field>
              <FieldLabel>Ubicación</FieldLabel>
              <SelectField
                aria-label="Ubicación del ingreso"
                value={ingresoInicialUbicacionId}
                options={activeLocations
                  .filter((item) => item.almacenId === ingresoInicialAlmacenId)
                  .map((item) => ({ value: item.id, label: item.nombre }))}
                onChange={setIngresoInicialUbicacionId}
              />
            </Field>
            <Field className={styles.full}>
              <FieldLabel>Material / variante</FieldLabel>
              <InventoryVariantPicker
                label="Material del ingreso"
                value={ingresoInicialVarianteId}
                options={variantesIngresoInicial.map((item) => ({
                  id: item.varianteId,
                  label: item.label,
                }))}
                onChange={(value) => {
                  setIngresoInicialVarianteId(value);
                  setUnidadIngreso(
                    varianteMetaById.get(value)?.unidades.unidadCompra ?? "",
                  );
                  setCantidadRealIngreso("");
                }}
              />
            </Field>
            <Field>
              <FieldLabel>Origen</FieldLabel>
              <SelectField
                aria-label="Origen del ingreso"
                value={ingresoInicialOrigen}
                options={ORIGEN_ITEMS}
                onChange={(value) =>
                  setIngresoInicialOrigen(
                    value as OrigenMovimientoStockMateriaPrima,
                  )
                }
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="stock-ingreso-cantidad">Cantidad</FieldLabel>
              <Input
                id="stock-ingreso-cantidad"
                type="number"
                min="0.00000001"
                step="any"
                value={ingresoInicialCantidad}
                onChange={(event) =>
                  setIngresoInicialCantidad(event.target.value)
                }
              />
            </Field>
            <div className={styles.full}>
              <StockConversionFields
                context={unidadesIngreso}
                unidad={unidadIngreso || unidadesIngreso?.unidadCompra || ""}
                onUnidad={setUnidadIngreso}
                cantidad={ingresoInicialCantidad}
                cantidadStock={cantidadRealIngreso}
                onCantidadStock={setCantidadRealIngreso}
                ingreso
              />
            </div>
            <Field className={styles.full}>
              <FieldLabel htmlFor="stock-ingreso-costo">
                Costo por{" "}
                {stockUnitLabel(
                  unidadIngreso || unidadesIngreso?.unidadCompra || "unidad",
                ).toLowerCase()}{" "}
                en {moneda.codigo} · opcional
              </FieldLabel>
              <Input
                id="stock-ingreso-costo"
                type="number"
                min="0"
                step="any"
                value={ingresoInicialCostoUnitario}
                onChange={(event) =>
                  setIngresoInicialCostoUnitario(event.target.value)
                }
              />
            </Field>
            <Field className={styles.full}>
              <FieldLabel htmlFor="stock-ingreso-referencia">
                Referencia · opcional
              </FieldLabel>
              <Input
                id="stock-ingreso-referencia"
                value={ingresoInicialReferenciaId}
                onChange={(event) =>
                  setIngresoInicialReferenciaId(event.target.value)
                }
              />
            </Field>
          </FieldGroup>
        </FormSheet>
      )}
      <FormDialog
        isOpen={confirmPrecioOpen}
        onOpenChange={(open) => {
          if (!open) resolveConfirmPrecio(false);
        }}
        title="Actualizar precio de referencia"
        description="El ingreso ya se registró. Podés usar este costo para próximas cotizaciones."
      >
        {confirmPrecioData && (
          <div className={styles.dialogBody}>
            <strong>{confirmPrecioData.etiqueta}</strong>
            <p>
              Referencia actual:{" "}
              {confirmPrecioData.precioReferencia === null
                ? "Sin definir"
                : number2Formatter.format(
                    confirmPrecioData.precioReferencia,
                  )}{" "}
              {confirmPrecioData.moneda}
            </p>
            <p>
              Costo ingresado:{" "}
              {number2Formatter.format(confirmPrecioData.costoUnitario)}{" "}
              {confirmPrecioData.moneda}
            </p>
          </div>
        )}
        <div className={styles.dialogFooter}>
          <ActionButton
            variant="outline"
            onPress={() => resolveConfirmPrecio(false)}
          >
            Conservar referencia
          </ActionButton>
          <ActionButton onPress={() => resolveConfirmPrecio(true)}>
            Actualizar precio
          </ActionButton>
        </div>
      </FormDialog>
    </section>
  );
}
