"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowDownIcon, ArrowUpIcon, BoxIcon, CirclePlusIcon } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type CentroStockPanelProps = {
  initialAlmacenes: AlmacenMateriaPrima[];
  initialStock: StockMateriaPrimaItem[];
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
const number2Formatter = new Intl.NumberFormat("es-AR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function getDefaultUbicacionId(almacen: AlmacenMateriaPrima | undefined) {
  if (!almacen) return "";
  return almacen.ubicaciones.find((item) => item.activo)?.id ?? almacen.ubicaciones[0]?.id ?? "";
}

function generateAutoAlmacenCodigo() {
  const base36 = Date.now().toString(36).toUpperCase();
  return `ALM-${base36.slice(-6)}`;
}

export function CentroStockPanel({
  initialAlmacenes,
  initialStock,
  materiasPrimas,
}: CentroStockPanelProps) {
  const router = useRouter();

  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [almacenNombre, setAlmacenNombre] = React.useState("");
  const [almacenDescripcion, setAlmacenDescripcion] = React.useState("");

  const [movOpen, setMovOpen] = React.useState(false);
  const [trxOpen, setTrxOpen] = React.useState(false);
  const [ingresoInicialOpen, setIngresoInicialOpen] = React.useState(false);
  const [rowSelected, setRowSelected] = React.useState<StockMateriaPrimaItem | null>(null);
  const [movimientoModo, setMovimientoModo] = React.useState<"libre" | "ingreso">("libre");

  const [tipo, setTipo] = React.useState<"ingreso" | "egreso" | "ajuste_entrada" | "ajuste_salida">("ingreso");
  const [origen, setOrigen] = React.useState<OrigenMovimientoStockMateriaPrima>("compra");
  const [cantidad, setCantidad] = React.useState("1");
  const [costoUnitario, setCostoUnitario] = React.useState("");
  const [referenciaId, setReferenciaId] = React.useState("");

  const [destinoAlmacenId, setDestinoAlmacenId] = React.useState("");
  const [cantidadTransfer, setCantidadTransfer] = React.useState("1");
  const [ingresoInicialAlmacenId, setIngresoInicialAlmacenId] = React.useState("");
  const [ingresoInicialVarianteId, setIngresoInicialVarianteId] = React.useState("");
  const [ingresoInicialVarianteQuery, setIngresoInicialVarianteQuery] = React.useState("");
  const [ingresoInicialVarianteOpen, setIngresoInicialVarianteOpen] = React.useState(false);
  const [ingresoInicialOrigen, setIngresoInicialOrigen] =
    React.useState<OrigenMovimientoStockMateriaPrima>("compra");
  const [ingresoInicialCantidad, setIngresoInicialCantidad] = React.useState("1");
  const [ingresoInicialCostoUnitario, setIngresoInicialCostoUnitario] = React.useState("");
  const [ingresoInicialReferenciaId, setIngresoInicialReferenciaId] = React.useState("");
  const ingresoInicialVarianteRef = React.useRef<HTMLDivElement | null>(null);
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

  const variantesIngresoInicialFiltradas = React.useMemo(() => {
    const needle = ingresoInicialVarianteQuery.trim().toLowerCase();
    if (!needle) return variantesIngresoInicial;
    return variantesIngresoInicial.filter(
      (item) => item.label.toLowerCase().includes(needle) || item.searchText.includes(needle),
    );
  }, [ingresoInicialVarianteQuery, variantesIngresoInicial]);

  React.useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (ingresoInicialVarianteRef.current && !ingresoInicialVarianteRef.current.contains(target)) {
        setIngresoInicialVarianteOpen(false);
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  const stockPorAlmacen = React.useMemo(() => {
    const map = new Map<
      string,
      {
        almacenId: string;
        almacenNombre: string;
        items: number;
        cantidadTotal: number;
        valorTotal: number;
      }
    >();

    for (const item of initialStock) {
      const entry =
        map.get(item.almacenId) ?? {
          almacenId: item.almacenId,
          almacenNombre: item.almacenNombre,
          items: 0,
          cantidadTotal: 0,
          valorTotal: 0,
        };
      entry.items += 1;
      entry.cantidadTotal += item.cantidadDisponible;
      entry.valorTotal += item.valorStock;
      map.set(item.almacenId, entry);
    }

    return Array.from(map.values()).sort((a, b) => a.almacenNombre.localeCompare(b.almacenNombre));
  }, [initialStock]);

  const varianteMetaById = React.useMemo(() => {
    const map = new Map<
      string,
      {
        materiaPrimaNombre: string;
        varianteNombre: string;
        precioReferencia: number | null;
        moneda: string;
      }
    >();

    for (const materiaPrima of materiasPrimas) {
      for (const variante of materiaPrima.variantes) {
        map.set(variante.id, {
          materiaPrimaNombre: materiaPrima.nombre,
          varianteNombre: getVarianteDisplayName(materiaPrima, variante, {
            maxDimensiones: 5,
          }),
          precioReferencia: variante.precioReferencia ?? null,
          moneda: (variante.moneda || "ARS").trim().toUpperCase(),
        });
      }
    }

    return map;
  }, [materiasPrimas]);

  const maybeActualizarPrecioReferencia = React.useCallback(
    async (varianteId: string, costoUnitario: number | undefined) => {
      if (costoUnitario === undefined) return;
      const meta = varianteMetaById.get(varianteId);
      if (!meta) return;

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

      const precioReferencia = varianteMetaById.get(varianteId)?.precioReferencia ?? null;
      if (typeof precioReferencia === "number" && Number.isFinite(precioReferencia) && precioReferencia > 0) {
        return { cost: precioReferencia, usedReferencia: true, missingReferenciaForZero: false };
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
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo crear el almacén.");
    } finally {
      setIsSaving(false);
    }
  };

  const openMovimiento = (row: StockMateriaPrimaItem) => {
    setRowSelected(row);
    setMovimientoModo("libre");
    setTipo("ingreso");
    setOrigen("compra");
    setCantidad("1");
    setCostoUnitario("");
    setReferenciaId("");
    setMovOpen(true);
  };

  const openTransferencia = (row: StockMateriaPrimaItem) => {
    setRowSelected(row);
    const nextDestino = initialAlmacenes.find((item) => item.id !== row.almacenId)?.id ?? "";
    setDestinoAlmacenId(nextDestino);
    setCantidadTransfer("1");
    setTrxOpen(true);
  };

  const openIngresoInicial = () => {
    if (initialAlmacenes.length === 0) {
      toast.error("Primero crea un almacén.");
      return;
    }

    if (variantesIngresoInicial.length === 0) {
      toast.error("No hay materias primas activas con variantes para ingresar stock.");
      return;
    }

    setIngresoInicialAlmacenId(initialAlmacenes[0]?.id ?? "");
    setIngresoInicialVarianteId("");
    setIngresoInicialVarianteQuery("");
    setIngresoInicialVarianteOpen(false);
    setIngresoInicialOrigen("compra");
    setIngresoInicialCantidad("1");
    setIngresoInicialCostoUnitario("");
    setIngresoInicialReferenciaId("");
    setIngresoInicialOpen(true);
  };

  const handleRegistrarMovimiento = async () => {
    if (!rowSelected) return;
    const almacen = initialAlmacenes.find((item) => item.id === rowSelected.almacenId);
    const ubicacionId = getDefaultUbicacionId(almacen);
    if (!ubicacionId) {
      toast.error("El almacén no tiene ubicación interna principal.");
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
        costoUnitario: cost,
        referenciaTipo: "manual",
        referenciaId: referenciaId.trim() || undefined,
      });
      if (tipo === "ingreso") {
        if (usedReferencia) {
          toast.message("Se aplicó automáticamente el precio de referencia de la materia prima.");
        }
        await maybeActualizarPrecioReferencia(rowSelected.varianteId, cost);
      }
      toast.success("Movimiento registrado.");
      setMovOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo registrar movimiento.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRegistrarTransferencia = async () => {
    if (!rowSelected || !destinoAlmacenId) {
      toast.error("Selecciona un almacén destino.");
      return;
    }

    const qty = Number(cantidadTransfer);
    if (!Number.isFinite(qty) || qty <= 0) {
      toast.error("La cantidad debe ser mayor a 0.");
      return;
    }

    const almacenOrigen = initialAlmacenes.find((item) => item.id === rowSelected.almacenId);
    const almacenDestino = initialAlmacenes.find((item) => item.id === destinoAlmacenId);
    const ubicacionOrigenId = getDefaultUbicacionId(almacenOrigen);
    const ubicacionDestinoId = getDefaultUbicacionId(almacenDestino);

    if (!ubicacionOrigenId || !ubicacionDestinoId) {
      toast.error("No se pudo resolver ubicación principal de origen o destino.");
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
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo transferir.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRegistrarIngresoInicial = async () => {
    if (!ingresoInicialAlmacenId || !ingresoInicialVarianteId) {
      toast.error("Selecciona almacén y materia prima.");
      return;
    }

    const almacen = initialAlmacenes.find((item) => item.id === ingresoInicialAlmacenId);
    const ubicacionId = getDefaultUbicacionId(almacen);
    if (!ubicacionId) {
      toast.error("El almacén no tiene ubicación interna principal.");
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
        costoUnitario: cost,
        referenciaTipo: "manual",
        referenciaId: ingresoInicialReferenciaId.trim() || undefined,
      });
      if (usedReferencia) {
        toast.message("Se aplicó automáticamente el precio de referencia de la materia prima.");
      }
      await maybeActualizarPrecioReferencia(ingresoInicialVarianteId, cost);
      toast.success("Ingreso registrado.");
      setIngresoInicialOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo registrar ingreso.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle>Centro de stock</CardTitle>
            <p className="text-sm text-muted-foreground">
              Gestión simple por almacén para operación PyME. La estructura interna se administra automáticamente.
            </p>
          </div>
          <Button onClick={() => setIsCreateOpen(true)}>
            <CirclePlusIcon className="size-4" />
            Nuevo almacén
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Almacén</TableHead>
                <TableHead>Código</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Items con stock</TableHead>
                <TableHead className="text-right">Cantidad total</TableHead>
                <TableHead className="text-right">Valor stock</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {initialAlmacenes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground">
                    Aún no hay almacenes creados.
                  </TableCell>
                </TableRow>
              ) : (
                initialAlmacenes.map((almacen) => {
                  const resumen = stockPorAlmacen.find((item) => item.almacenId === almacen.id);
                  return (
                    <TableRow key={almacen.id}>
                      <TableCell>{almacen.nombre}</TableCell>
                      <TableCell>{almacen.codigo}</TableCell>
                      <TableCell>
                        <Badge variant={almacen.activo ? "default" : "outline"}>
                          {almacen.activo ? "Activo" : "Inactivo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{resumen?.items ?? 0}</TableCell>
                      <TableCell className="text-right">
                        {number2Formatter.format(resumen?.cantidadTotal ?? 0)}
                      </TableCell>
                      <TableCell className="text-right">
                        $ {number2Formatter.format(resumen?.valorTotal ?? 0)}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle>Detalle de stock actual</CardTitle>
          <Button onClick={openIngresoInicial}>
            <BoxIcon className="size-4" />
            Ingresar stock
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Almacén</TableHead>
                <TableHead>Materia prima</TableHead>
                <TableHead>Variante</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead className="text-right">Cantidad</TableHead>
                <TableHead className="text-right">Costo promedio</TableHead>
                <TableHead className="text-right">Valor stock</TableHead>
                <TableHead className="w-[220px] text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {initialStock.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-muted-foreground">
                    <span>Sin stock cargado todavía. Registra un ingreso para iniciar historial.</span>
                  </TableCell>
                </TableRow>
              ) : (
                initialStock.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.almacenNombre}</TableCell>
                    <TableCell>{row.materiaPrimaNombre}</TableCell>
                    <TableCell>
                      {varianteMetaById.get(row.varianteId)?.varianteNombre ?? row.varianteSku}
                    </TableCell>
                    <TableCell>{row.varianteSku}</TableCell>
                    <TableCell className="text-right">{number2Formatter.format(row.cantidadDisponible)}</TableCell>
                    <TableCell className="text-right">{number2Formatter.format(row.costoPromedio)}</TableCell>
                    <TableCell className="text-right">$ {number2Formatter.format(row.valorStock)}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => openMovimiento(row)}>
                          Movimiento
                        </Button>
                        {initialAlmacenes.length > 1 ? (
                          <Button variant="outline" size="sm" onClick={() => openTransferencia(row)}>
                            Transferir
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Sheet open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <SheetContent className="w-full sm:max-w-3xl">
          <SheetHeader>
            <SheetTitle>Nuevo almacén</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 px-4 pb-4 md:px-6 md:pb-6">
            <p className="text-sm text-muted-foreground">
              El código se genera automáticamente al crear el almacén.
            </p>
            <Field>
              <FieldLabel>Nombre</FieldLabel>
              <Input value={almacenNombre} onChange={(e) => setAlmacenNombre(e.target.value)} />
            </Field>
            <Field>
              <FieldLabel>Descripción</FieldLabel>
              <Input value={almacenDescripcion} onChange={(e) => setAlmacenDescripcion(e.target.value)} />
            </Field>
          </div>
          <SheetFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateAlmacen} disabled={isSaving}>
              {isSaving ? "Guardando..." : "Crear almacén"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Sheet open={movOpen} onOpenChange={setMovOpen}>
        <SheetContent className="w-full sm:max-w-3xl">
          <SheetHeader>
            <SheetTitle>
              {movimientoModo === "ingreso" ? "Ingresar stock" : "Registrar movimiento"}
            </SheetTitle>
          </SheetHeader>
          {rowSelected ? (
            <div className="space-y-4 px-4 pb-4 md:px-6 md:pb-6">
              <p className="text-sm text-muted-foreground">
                {rowSelected.materiaPrimaNombre} · {rowSelected.varianteSku} · {rowSelected.almacenNombre}
              </p>
              {movimientoModo === "libre" ? (
                <Field>
                  <FieldLabel>Tipo</FieldLabel>
                  <select
                    className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                    value={tipo}
                    onChange={(e) =>
                      setTipo(
                        e.target.value as
                          | "ingreso"
                          | "egreso"
                          | "ajuste_entrada"
                          | "ajuste_salida",
                      )
                    }
                  >
                    <option value="ingreso">Ingreso</option>
                    <option value="egreso">Egreso</option>
                    <option value="ajuste_entrada">Ajuste entrada</option>
                    <option value="ajuste_salida">Ajuste salida</option>
                  </select>
                </Field>
              ) : null}
              <Field>
                <FieldLabel>Origen</FieldLabel>
                <select
                  className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                  value={origen}
                  onChange={(e) => setOrigen(e.target.value as OrigenMovimientoStockMateriaPrima)}
                >
                  {ORIGEN_ITEMS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field>
                <FieldLabel>Cantidad</FieldLabel>
                <Input value={cantidad} onChange={(e) => setCantidad(e.target.value)} type="number" min="0" />
              </Field>
              <Field>
                <FieldLabel>Costo unitario (opcional)</FieldLabel>
                <Input
                  value={costoUnitario}
                  onChange={(e) => setCostoUnitario(e.target.value)}
                  type="number"
                  min="0"
                />
              </Field>
              <Field>
                <FieldLabel>Referencia (opcional)</FieldLabel>
                <Input value={referenciaId} onChange={(e) => setReferenciaId(e.target.value)} />
              </Field>
            </div>
          ) : null}
          <SheetFooter>
            <Button variant="outline" onClick={() => setMovOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleRegistrarMovimiento} disabled={isSaving}>
              {isSaving ? "Guardando..." : movimientoModo === "ingreso" ? "Ingresar stock" : "Registrar"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Sheet open={trxOpen} onOpenChange={setTrxOpen}>
        <SheetContent className="w-full sm:max-w-3xl">
          <SheetHeader>
            <SheetTitle>Transferir stock</SheetTitle>
          </SheetHeader>
          {rowSelected ? (
            <div className="space-y-4 px-4 pb-4 md:px-6 md:pb-6">
              <p className="text-sm text-muted-foreground">
                {rowSelected.materiaPrimaNombre} · {rowSelected.varianteSku}
              </p>
              <Field>
                <FieldLabel>Origen</FieldLabel>
                <Input value={rowSelected.almacenNombre} readOnly />
              </Field>
              <Field>
                <FieldLabel>Destino</FieldLabel>
                <select
                  className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                  value={destinoAlmacenId}
                  onChange={(e) => setDestinoAlmacenId(e.target.value)}
                >
                  <option value="">Seleccionar</option>
                  {initialAlmacenes
                    .filter((item) => item.id !== rowSelected.almacenId)
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.nombre}
                      </option>
                    ))}
                </select>
              </Field>
              <Field>
                <FieldLabel>Cantidad</FieldLabel>
                <Input
                  value={cantidadTransfer}
                  onChange={(e) => setCantidadTransfer(e.target.value)}
                  type="number"
                  min="0"
                />
              </Field>
            </div>
          ) : null}
          <SheetFooter>
            <Button variant="outline" onClick={() => setTrxOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleRegistrarTransferencia} disabled={isSaving}>
              {isSaving ? "Guardando..." : "Transferir"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Sheet open={ingresoInicialOpen} onOpenChange={setIngresoInicialOpen}>
        <SheetContent className="w-full sm:max-w-3xl">
          <SheetHeader>
            <SheetTitle>Ingresar stock</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 px-4 pb-4 md:px-6 md:pb-6">
            <Field>
              <FieldLabel>Almacén</FieldLabel>
              <select
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                value={ingresoInicialAlmacenId}
                onChange={(e) => setIngresoInicialAlmacenId(e.target.value)}
              >
                <option value="">Seleccionar</option>
                {initialAlmacenes.map((almacen) => (
                  <option key={almacen.id} value={almacen.id}>
                    {almacen.nombre}
                  </option>
                ))}
              </select>
            </Field>
            <Field>
              <FieldLabel>Materia prima / Variante</FieldLabel>
              <div ref={ingresoInicialVarianteRef} className="relative">
                <Input
                  value={ingresoInicialVarianteQuery}
                  onFocus={() => setIngresoInicialVarianteOpen(true)}
                  onChange={(e) => {
                    setIngresoInicialVarianteQuery(e.target.value);
                    setIngresoInicialVarianteId("");
                    setIngresoInicialVarianteOpen(true);
                  }}
                  placeholder="Buscar materia prima o variante..."
                />
                {ingresoInicialVarianteOpen ? (
                  <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-md border bg-background p-1 shadow-md">
                    {variantesIngresoInicialFiltradas.length === 0 ? (
                      <p className="px-2 py-1 text-sm text-muted-foreground">Sin resultados</p>
                    ) : (
                      variantesIngresoInicialFiltradas.map((item) => (
                        <button
                          key={item.varianteId}
                          type="button"
                          className="w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
                          onClick={() => {
                            setIngresoInicialVarianteId(item.varianteId);
                            setIngresoInicialVarianteQuery(item.label);
                            setIngresoInicialVarianteOpen(false);
                          }}
                        >
                          {item.label}
                        </button>
                      ))
                    )}
                  </div>
                ) : null}
              </div>
            </Field>
            <Field>
              <FieldLabel>Origen</FieldLabel>
              <select
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                value={ingresoInicialOrigen}
                onChange={(e) => setIngresoInicialOrigen(e.target.value as OrigenMovimientoStockMateriaPrima)}
              >
                {ORIGEN_ITEMS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field>
              <FieldLabel>Cantidad</FieldLabel>
              <Input
                value={ingresoInicialCantidad}
                onChange={(e) => setIngresoInicialCantidad(e.target.value)}
                type="number"
                min="0"
              />
            </Field>
            <Field>
              <FieldLabel>Costo unitario (opcional)</FieldLabel>
              <Input
                value={ingresoInicialCostoUnitario}
                onChange={(e) => setIngresoInicialCostoUnitario(e.target.value)}
                type="number"
                min="0"
              />
            </Field>
            <Field>
              <FieldLabel>Referencia (opcional)</FieldLabel>
              <Input
                value={ingresoInicialReferenciaId}
                onChange={(e) => setIngresoInicialReferenciaId(e.target.value)}
              />
            </Field>
          </div>
          <SheetFooter>
            <Button variant="outline" onClick={() => setIngresoInicialOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleRegistrarIngresoInicial} disabled={isSaving}>
              {isSaving ? "Guardando..." : "Ingresar stock"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Sheet
        open={confirmPrecioOpen}
        onOpenChange={(open) => {
          if (!open) {
            resolveConfirmPrecio(false);
          } else {
            setConfirmPrecioOpen(true);
          }
        }}
      >
        <SheetContent
          side="right"
          className="!inset-auto !left-1/2 !top-1/2 !right-auto !h-auto !w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-lg border sm:!max-w-2xl"
        >
          <SheetHeader>
            <SheetTitle>Actualizar precio referencia</SheetTitle>
          </SheetHeader>
          {confirmPrecioData ? (
            <div className="space-y-3 px-4 pb-4 md:px-6 md:pb-6">
              {(() => {
                const delta =
                  typeof confirmPrecioData.precioReferencia === "number"
                    ? confirmPrecioData.costoUnitario - confirmPrecioData.precioReferencia
                    : null;
                const variacionPct =
                  typeof confirmPrecioData.precioReferencia === "number" &&
                  Number.isFinite(confirmPrecioData.precioReferencia) &&
                  confirmPrecioData.precioReferencia > 0
                    ? (Math.abs(
                        confirmPrecioData.costoUnitario - confirmPrecioData.precioReferencia,
                      ) /
                        confirmPrecioData.precioReferencia) *
                      100
                    : null;

                return (
                  <>
              <p className="text-sm text-muted-foreground">
                Se registró el ingreso de stock y detectamos una variación de costo para:
              </p>
              <p className="text-sm font-medium">{confirmPrecioData.etiqueta}</p>
              <div className="rounded-md border p-3 text-sm">
                <p>
                  <span className="text-muted-foreground">Precio referencia actual:</span>{" "}
                  {confirmPrecioData.precioReferencia !== null
                    ? `${number2Formatter.format(confirmPrecioData.precioReferencia)} ${confirmPrecioData.moneda}`
                    : "No definido"}
                </p>
                <p>
                  <span className="text-muted-foreground">Costo ingresado:</span>{" "}
                  {number2Formatter.format(confirmPrecioData.costoUnitario)} {confirmPrecioData.moneda}
                </p>
                {typeof variacionPct === "number" && Number.isFinite(variacionPct) ? (
                  <p>
                    <span className="text-muted-foreground">Variación:</span>{" "}
                    <span className="inline-flex items-center gap-1">
                      {typeof delta === "number" && delta > 0 ? (
                        <ArrowUpIcon className="size-4 text-red-600" />
                      ) : null}
                      {typeof delta === "number" && delta < 0 ? (
                        <ArrowDownIcon className="size-4 text-emerald-600" />
                      ) : null}
                      {number2Formatter.format(variacionPct)}%
                    </span>
                  </p>
                ) : null}
              </div>
              <p className="text-sm text-muted-foreground">
                ¿Quieres actualizar el precio referencia de la variante con el costo ingresado?
              </p>
                  </>
                );
              })()}
            </div>
          ) : null}
          <SheetFooter>
            <Button variant="outline" onClick={() => resolveConfirmPrecio(false)}>
              No actualizar
            </Button>
            <Button onClick={() => resolveConfirmPrecio(true)}>Actualizar precio</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
