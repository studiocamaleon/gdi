"use client";

/**
 * <PrecioCatalogoManager /> — CRUD genérico para los catálogos de
 * impuestos y comisiones del Tab Precio. Como los modelos son espejados
 * (codigo, nombre, porcentaje, detalleJson, activo), un solo componente
 * sirve para ambos: la diferencia son labels y los endpoints.
 *
 * Importante: el caller (Server Component) sólo pasa `tipo` + `initialItems`.
 * El adapter (icono lucide + funciones API + textos) se resuelve INTERNAMENTE
 * porque LucideIcon y funciones no son serializables a través del boundary
 * Server → Client de React Server Components.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  PencilIcon,
  PercentIcon,
  PlusIcon,
  ReceiptIcon,
  Trash2Icon,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
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
import { ConfirmacionDestructiva } from "@/components/ui/confirmacion-destructiva";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LabelConTooltip } from "@/components/ui/label-con-tooltip";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  actualizarComisionCatalogo,
  actualizarImpuestoCatalogo,
  crearComisionCatalogo,
  crearImpuestoCatalogo,
  eliminarComisionCatalogo,
  eliminarImpuestoCatalogo,
} from "@/lib/productos-servicios-api";

// ─── Modelo común a impuestos y comisiones ────────────────────────────

export interface PrecioCatalogoItem {
  id: string;
  codigo: string;
  nombre: string;
  porcentaje: number;
  /** Solo impuestos: NETO | BRUTO_COBRADO. */
  baseCalculo?: string;
  /** Solo impuestos: POR_FUERA | POR_DENTRO. */
  traslado?: string;
  /** Solo impuestos: PRODUCTO | TENANT. */
  alcance?: string;
  detalleJson: unknown | null;
  activo: boolean;
  _count?: { productosAplicados: number };
}

interface CrearPrecioCatalogoPayload {
  codigo: string;
  nombre: string;
  porcentaje: number;
  baseCalculo?: "NETO" | "BRUTO_COBRADO";
  traslado?: "POR_FUERA" | "POR_DENTRO";
  alcance?: "PRODUCTO" | "TENANT";
  detalleJson?: Record<string, unknown>;
}

interface ActualizarPrecioCatalogoPayload {
  nombre?: string;
  porcentaje?: number;
  baseCalculo?: "NETO" | "BRUTO_COBRADO";
  traslado?: "POR_FUERA" | "POR_DENTRO";
  alcance?: "PRODUCTO" | "TENANT";
  detalleJson?: Record<string, unknown>;
  activo?: boolean;
}

/**
 * Los 3 comportamientos válidos de un impuesto (combinación traslado + base).
 * POR_FUERA sólo tiene sentido sobre el NETO, así que se ofrecen como un
 * único selector en vez de dos campos que permitan combos inválidos.
 */
const COMPORTAMIENTOS_IMPUESTO = [
  {
    value: "por_fuera_neto",
    traslado: "POR_FUERA",
    baseCalculo: "NETO",
    label: "Se agrega al precio (IVA)",
    hint: "Se calcula sobre el neto, se suma al total y se discrimina en la factura. No participa del margen.",
    badge: "IVA / por fuera",
  },
  {
    value: "por_dentro_neto",
    traslado: "POR_DENTRO",
    baseCalculo: "NETO",
    label: "Costo sobre el neto (IIBB)",
    hint: "Costo real de la empresa: se embebe en el precio neto vía gross-up. No se muestra al cliente.",
    badge: "s/ neto",
  },
  {
    value: "por_dentro_bruto",
    traslado: "POR_DENTRO",
    baseCalculo: "BRUTO_COBRADO",
    label: "Costo sobre lo cobrado (imp. al cheque)",
    hint: "Costo sobre el total acreditado (incluye IVA), como el impuesto al débito/crédito bancario.",
    badge: "s/ cobrado",
  },
] as const;

type ComportamientoImpuesto =
  (typeof COMPORTAMIENTOS_IMPUESTO)[number]["value"];

function getComportamiento(item: PrecioCatalogoItem): ComportamientoImpuesto {
  if (item.traslado === "POR_FUERA") return "por_fuera_neto";
  if (item.baseCalculo === "BRUTO_COBRADO") return "por_dentro_bruto";
  return "por_dentro_neto";
}

export type PrecioCatalogoTipo = "impuestos" | "comisiones";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function getDesglosarCliente(detalleJson: unknown) {
  const detalle = asRecord(detalleJson);
  return detalle.desglosarCliente !== false;
}

interface PrecioCatalogoAdapter {
  entidadSingular: string;
  entidadPlural: string;
  articuloSingular: string;
  icono: LucideIcon;
  placeholderCodigo: string;
  placeholderNombre: string;
  placeholderDetalleJson: string;
  tooltipPorcentaje: string;
  tooltipDetalleJson: string;
  crear: (payload: CrearPrecioCatalogoPayload) => Promise<unknown>;
  actualizar: (
    id: string,
    payload: ActualizarPrecioCatalogoPayload,
  ) => Promise<unknown>;
  eliminar: (id: string) => Promise<unknown>;
}

const ADAPTERS: Record<PrecioCatalogoTipo, PrecioCatalogoAdapter> = {
  impuestos: {
    entidadSingular: "impuesto",
    entidadPlural: "Impuestos",
    articuloSingular: "el impuesto",
    icono: ReceiptIcon,
    placeholderCodigo: "iva_21",
    placeholderNombre: "IVA 21%",
    placeholderDetalleJson: '{"jurisdiccion": "AR", "categoria": "general"}',
    tooltipPorcentaje:
      "Porcentaje del impuesto. Sobre qué base se aplica lo define el Comportamiento: sobre el neto (IVA, IIBB) o sobre el total cobrado (imp. al cheque).",
    tooltipDetalleJson:
      "Metadata adicional del impuesto (jurisdicción, categoría AFIP, código fiscal, etc.). El motor no usa este campo, queda como referencia para reportes y exportaciones.",
    crear: crearImpuestoCatalogo,
    actualizar: actualizarImpuestoCatalogo,
    eliminar: eliminarImpuestoCatalogo,
  },
  comisiones: {
    entidadSingular: "comisión",
    entidadPlural: "Comisiones",
    articuloSingular: "la comisión",
    icono: PercentIcon,
    placeholderCodigo: "vendedor_5",
    placeholderNombre: "Comisión vendedor 5%",
    placeholderDetalleJson: '{"tipo": "vendedor", "empleadoId": null}',
    tooltipPorcentaje:
      "Porcentaje de la comisión sobre el precio neto (sin IVA). Se embebe en el precio como un costo más.",
    tooltipDetalleJson:
      "Metadata del esquema (tipo: 'vendedor' o 'financiera', empleadoId asignado, condiciones especiales, etc.). El motor no usa este campo directamente.",
    crear: crearComisionCatalogo,
    actualizar: actualizarComisionCatalogo,
    eliminar: eliminarComisionCatalogo,
  },
};

interface Props {
  initialItems: PrecioCatalogoItem[];
  tipo: PrecioCatalogoTipo;
}

// ─── Componente principal ────────────────────────────────────────────

export function PrecioCatalogoManager({ initialItems, tipo }: Props) {
  const adapter = ADAPTERS[tipo];
  const router = useRouter();
  const [editando, setEditando] = React.useState<PrecioCatalogoItem | null>(
    null,
  );
  const [openSheet, setOpenSheet] = React.useState(false);
  const [guardando, setGuardando] = React.useState(false);
  const [aBorrar, setABorrar] = React.useState<PrecioCatalogoItem | null>(null);

  // Form state
  const [codigo, setCodigo] = React.useState("");
  const [nombre, setNombre] = React.useState("");
  const [porcentaje, setPorcentaje] = React.useState("");
  const [detalleJsonStr, setDetalleJsonStr] = React.useState("");
  const [desglosarCliente, setDesglosarCliente] = React.useState(true);
  const [comportamiento, setComportamiento] =
    React.useState<ComportamientoImpuesto>("por_dentro_neto");
  const [alcance, setAlcance] = React.useState<"PRODUCTO" | "TENANT">(
    "PRODUCTO",
  );
  const [baseComision, setBaseComision] = React.useState<
    "NETO" | "BRUTO_COBRADO"
  >("NETO");

  const Icono = adapter.icono;

  const abrirNuevo = () => {
    setEditando(null);
    setCodigo("");
    setNombre("");
    setPorcentaje("");
    setDetalleJsonStr("");
    setDesglosarCliente(true);
    setComportamiento("por_dentro_neto");
    setAlcance("PRODUCTO");
    setBaseComision("NETO");
    setOpenSheet(true);
  };

  const abrirEditar = (item: PrecioCatalogoItem) => {
    setEditando(item);
    setCodigo(item.codigo);
    setNombre(item.nombre);
    setPorcentaje(String(item.porcentaje));
    setDetalleJsonStr(
      item.detalleJson ? JSON.stringify(item.detalleJson, null, 2) : "",
    );
    setDesglosarCliente(getDesglosarCliente(item.detalleJson));
    setComportamiento(getComportamiento(item));
    setAlcance(item.alcance === "TENANT" ? "TENANT" : "PRODUCTO");
    setBaseComision(item.baseCalculo === "BRUTO_COBRADO" ? "BRUTO_COBRADO" : "NETO");
    setOpenSheet(true);
  };

  const handleGuardar = async () => {
    setGuardando(true);
    try {
      let detalleJson: Record<string, unknown> | undefined;
      if (detalleJsonStr.trim()) {
        try {
          detalleJson = JSON.parse(detalleJsonStr);
        } catch {
          toast.error("El JSON de configuración no es válido");
          setGuardando(false);
          return;
        }
      }
      if (tipo === "impuestos") {
        detalleJson = {
          ...(detalleJson ?? {}),
          desglosarCliente,
        };
      }
      const porcentajeNum = Number(porcentaje);
      if (
        Number.isNaN(porcentajeNum) ||
        porcentajeNum < 0 ||
        porcentajeNum > 100
      ) {
        toast.error("Porcentaje debe ser un número entre 0 y 100");
        setGuardando(false);
        return;
      }

      const comportamientoDef =
        tipo === "impuestos"
          ? COMPORTAMIENTOS_IMPUESTO.find((c) => c.value === comportamiento)
          : undefined;
      const camposImpuesto = comportamientoDef
        ? {
            traslado: comportamientoDef.traslado,
            baseCalculo: comportamientoDef.baseCalculo,
            alcance,
          }
        : tipo === "comisiones"
          ? { baseCalculo: baseComision }
          : {};

      if (editando) {
        await adapter.actualizar(editando.id, {
          nombre,
          porcentaje: porcentajeNum,
          detalleJson,
          ...camposImpuesto,
        });
        toast.success(
          `${capitalizar(adapter.entidadSingular)} "${nombre}" actualizado`,
        );
      } else {
        await adapter.crear({
          codigo,
          nombre,
          porcentaje: porcentajeNum,
          detalleJson,
          ...camposImpuesto,
        });
        toast.success(
          `${capitalizar(adapter.entidadSingular)} "${nombre}" creado`,
        );
      }
      setOpenSheet(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error guardando");
    } finally {
      setGuardando(false);
    }
  };

  const ejecutarBorrado = async () => {
    if (!aBorrar) return;
    try {
      await adapter.eliminar(aBorrar.id);
      toast.success(`${capitalizar(adapter.entidadSingular)} eliminado`);
      setABorrar(null);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {adapter.entidadPlural}
          </h1>
          <p className="text-muted-foreground text-sm">
            Catálogo de esquemas de {adapter.entidadPlural.toLowerCase()} del
            tenant. Se aplican a productos para calcular el precio final.
          </p>
        </div>
        <Sheet open={openSheet} onOpenChange={setOpenSheet}>
          <SheetTrigger
            render={(props) => (
              <Button {...props} onClick={abrirNuevo}>
                <PlusIcon className="mr-2 size-4" />
                {`Nuevo ${adapter.entidadSingular}`}
              </Button>
            )}
          />
          <SheetContent>
            <SheetHeader>
              <SheetTitle>
                {editando
                  ? `Editar ${adapter.entidadSingular}`
                  : `Nuevo ${adapter.entidadSingular}`}
              </SheetTitle>
              <SheetDescription>
                {editando
                  ? `Editar los datos del ${adapter.entidadSingular}.`
                  : `Crear un nuevo ${adapter.entidadSingular} en el catálogo del tenant.`}
              </SheetDescription>
            </SheetHeader>
            <div className="space-y-4 px-4">
              <div className="space-y-2">
                <Label htmlFor="codigo">Código *</Label>
                <Input
                  id="codigo"
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value)}
                  disabled={!!editando}
                  placeholder={adapter.placeholderCodigo}
                />
                {editando && (
                  <p className="text-muted-foreground text-xs">
                    El código no se puede modificar.
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="nombre">Nombre *</Label>
                <Input
                  id="nombre"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder={adapter.placeholderNombre}
                />
              </div>
              <div className="space-y-2">
                <LabelConTooltip
                  label="Porcentaje (%)"
                  htmlFor="porcentaje"
                  required
                  tooltip={adapter.tooltipPorcentaje}
                />
                <Input
                  id="porcentaje"
                  type="number"
                  min={0}
                  max={100}
                  step={0.01}
                  value={porcentaje}
                  onChange={(e) => setPorcentaje(e.target.value)}
                  placeholder="21"
                />
              </div>
              {tipo === "impuestos" ? (
                <>
                  <div className="space-y-2">
                    <Label>Comportamiento *</Label>
                    <div className="space-y-2">
                      {COMPORTAMIENTOS_IMPUESTO.map((opcion) => (
                        <label
                          key={opcion.value}
                          className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 text-sm ${
                            comportamiento === opcion.value
                              ? "border-foreground"
                              : ""
                          }`}
                        >
                          <input
                            type="radio"
                            name="comportamiento-impuesto"
                            className="mt-1"
                            checked={comportamiento === opcion.value}
                            onChange={() => setComportamiento(opcion.value)}
                          />
                          <span className="space-y-1">
                            <span className="block font-medium">
                              {opcion.label}
                            </span>
                            <span className="text-muted-foreground block text-xs">
                              {opcion.hint}
                            </span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Alcance *</Label>
                    <div className="flex gap-2">
                      <label
                        className={`flex flex-1 cursor-pointer items-start gap-3 rounded-md border p-3 text-sm ${
                          alcance === "PRODUCTO" ? "border-foreground" : ""
                        }`}
                      >
                        <input
                          type="radio"
                          name="alcance-impuesto"
                          className="mt-1"
                          checked={alcance === "PRODUCTO"}
                          onChange={() => setAlcance("PRODUCTO")}
                        />
                        <span className="space-y-1">
                          <span className="block font-medium">Por producto</span>
                          <span className="text-muted-foreground block text-xs">
                            Se asocia producto por producto (ej. IVA con
                            alícuota según el producto).
                          </span>
                        </span>
                      </label>
                      <label
                        className={`flex flex-1 cursor-pointer items-start gap-3 rounded-md border p-3 text-sm ${
                          alcance === "TENANT" ? "border-foreground" : ""
                        }`}
                      >
                        <input
                          type="radio"
                          name="alcance-impuesto"
                          className="mt-1"
                          checked={alcance === "TENANT"}
                          onChange={() => setAlcance("TENANT")}
                        />
                        <span className="space-y-1">
                          <span className="block font-medium">
                            Toda la empresa
                          </span>
                          <span className="text-muted-foreground block text-xs">
                            Aplica a todas las cotizaciones sin asociarlo (ej.
                            IIBB, imp. al cheque).
                          </span>
                        </span>
                      </label>
                    </div>
                  </div>
                  <label className="flex items-start gap-3 rounded-md border p-3 text-sm">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={desglosarCliente}
                      onChange={(event) =>
                        setDesglosarCliente(event.target.checked)
                      }
                    />
                    <span className="space-y-1">
                      <span className="block font-medium">
                        Desglosar al cliente
                      </span>
                      <span className="text-muted-foreground block text-xs">
                        Si está desactivado, el impuesto se incluye dentro del
                        subtotal visible y no aparece como línea separada en el
                        resumen financiero.
                      </span>
                    </span>
                  </label>
                </>
              ) : null}
              {tipo === "comisiones" ? (
                <div className="space-y-2">
                  <Label>Base de cálculo *</Label>
                  <div className="flex gap-2">
                    <label
                      className={`flex flex-1 cursor-pointer items-start gap-3 rounded-md border p-3 text-sm ${
                        baseComision === "NETO" ? "border-foreground" : ""
                      }`}
                    >
                      <input
                        type="radio"
                        name="base-comision"
                        className="mt-1"
                        checked={baseComision === "NETO"}
                        onChange={() => setBaseComision("NETO")}
                      />
                      <span className="space-y-1">
                        <span className="block font-medium">
                          Sobre el neto (vendedor)
                        </span>
                        <span className="text-muted-foreground block text-xs">
                          % sobre el precio sin IVA. Típico para comisiones de
                          venta.
                        </span>
                      </span>
                    </label>
                    <label
                      className={`flex flex-1 cursor-pointer items-start gap-3 rounded-md border p-3 text-sm ${
                        baseComision === "BRUTO_COBRADO"
                          ? "border-foreground"
                          : ""
                      }`}
                    >
                      <input
                        type="radio"
                        name="base-comision"
                        className="mt-1"
                        checked={baseComision === "BRUTO_COBRADO"}
                        onChange={() => setBaseComision("BRUTO_COBRADO")}
                      />
                      <span className="space-y-1">
                        <span className="block font-medium">
                          Sobre lo cobrado (pasarela)
                        </span>
                        <span className="text-muted-foreground block text-xs">
                          % sobre el total cobrado con IVA. Típico para Mercado
                          Pago, tarjetas, etc.
                        </span>
                      </span>
                    </label>
                  </div>
                </div>
              ) : null}
              <div className="space-y-2">
                <LabelConTooltip
                  label="Detalle (JSON)"
                  htmlFor="detalleJson"
                  tooltip={adapter.tooltipDetalleJson}
                />
                <Textarea
                  id="detalleJson"
                  value={detalleJsonStr}
                  onChange={(e) => setDetalleJsonStr(e.target.value)}
                  rows={5}
                  className="font-mono text-xs"
                  placeholder={adapter.placeholderDetalleJson}
                />
                <p className="text-muted-foreground text-xs">
                  Opcional. Si no sabés qué poner, dejá vacío.
                </p>
              </div>
            </div>
            <SheetFooter>
              <Button variant="outline" onClick={() => setOpenSheet(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleGuardar}
                disabled={guardando || !nombre || !codigo || !porcentaje}
              >
                {guardando
                  ? "Guardando..."
                  : editando
                    ? "Guardar cambios"
                    : "Crear"}
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Icono className="size-5" />
            <CardTitle>Catálogo</CardTitle>
          </div>
          <CardDescription>
            {initialItems.length} esquemas en el catálogo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {initialItems.length === 0 ? (
            <EstadoVacio
              variant="compacto"
              icon={<Icono />}
              titulo={`Sin ${adapter.entidadPlural.toLowerCase()} cargados`}
              descripcion={`Empezá creando el primer ${adapter.entidadSingular} del catálogo.`}
              cta={{
                label: `Nuevo ${adapter.entidadSingular}`,
                onClick: abrirNuevo,
                icon: PlusIcon,
              }}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead className="text-right">%</TableHead>
                  {tipo === "impuestos" ? <TableHead>Tipo</TableHead> : null}
                  {tipo === "impuestos" ? <TableHead>Alcance</TableHead> : null}
                  {tipo === "impuestos" ? <TableHead>Cliente</TableHead> : null}
                  {tipo === "comisiones" ? <TableHead>Base</TableHead> : null}
                  <TableHead className="text-center">
                    Productos que lo usan
                  </TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {initialItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="font-medium">{item.nombre}</div>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {item.porcentaje.toFixed(2)}%
                    </TableCell>
                    {tipo === "impuestos" ? (
                      <TableCell>
                        <Badge variant="outline">
                          {COMPORTAMIENTOS_IMPUESTO.find(
                            (c) => c.value === getComportamiento(item),
                          )?.badge ?? "s/ neto"}
                        </Badge>
                      </TableCell>
                    ) : null}
                    {tipo === "impuestos" ? (
                      <TableCell>
                        <Badge
                          variant={
                            item.alcance === "TENANT" ? "default" : "outline"
                          }
                        >
                          {item.alcance === "TENANT"
                            ? "Toda la empresa"
                            : "Por producto"}
                        </Badge>
                      </TableCell>
                    ) : null}
                    {tipo === "impuestos" ? (
                      <TableCell>
                        <Badge
                          variant={
                            getDesglosarCliente(item.detalleJson)
                              ? "default"
                              : "secondary"
                          }
                        >
                          {getDesglosarCliente(item.detalleJson)
                            ? "Desglosado"
                            : "Oculto"}
                        </Badge>
                      </TableCell>
                    ) : null}
                    {tipo === "comisiones" ? (
                      <TableCell>
                        <Badge variant="outline">
                          {item.baseCalculo === "BRUTO_COBRADO"
                            ? "s/ cobrado"
                            : "s/ neto"}
                        </Badge>
                      </TableCell>
                    ) : null}
                    <TableCell className="text-center">
                      <Badge variant="outline">
                        {item._count?.productosAplicados ?? 0}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={item.activo ? "default" : "secondary"}>
                        {item.activo ? "Activo" : "Inactivo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => abrirEditar(item)}
                      >
                        <PencilIcon className="size-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setABorrar(item)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2Icon className="size-3" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <ConfirmacionDestructiva
        open={!!aBorrar}
        onOpenChange={(open) => !open && setABorrar(null)}
        titulo={`Eliminar ${adapter.entidadSingular} del catálogo`}
        descripcion={
          aBorrar ? (
            <>
              Vas a eliminar {adapter.articuloSingular}{" "}
              <strong>{aBorrar.nombre}</strong> ({aBorrar.porcentaje.toFixed(2)}
              %) del catálogo.
            </>
          ) : null
        }
        impacto={
          aBorrar?._count?.productosAplicados
            ? [
                `Hay ${aBorrar._count.productosAplicados} producto(s) usando este esquema.`,
                "Para preservar la integridad de los productos, se marca como inactivo en lugar de borrarse.",
                "Los productos siguen aplicando el porcentaje actual; nuevos productos no podrán seleccionarlo.",
              ]
            : ["Como no está en uso, se elimina definitivamente del catálogo."]
        }
        nombreItem={aBorrar?.nombre}
        accionLabel="Eliminar"
        onConfirmar={ejecutarBorrado}
      />
    </div>
  );
}

function capitalizar(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
