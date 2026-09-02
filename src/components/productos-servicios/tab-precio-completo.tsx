"use client";

/**
 * <TabPrecioCompleto /> — Tab Precio del producto con las 5 secciones
 * profesionales (Sprint 5.b):
 *
 *   1. Método de cálculo (delega en <TabPrecioEditor>)
 *   2. Esquema impositivo (multi-select del catálogo + % total + link al
 *      catálogo)
 *   3. Esquemas de comisiones (multi-select del catálogo + % total + link al
 *      catálogo)
 *   4. Precios especiales por cliente (tabla CRUD con su propio editor)
 *
 * Estado y persistencia:
 *   - Sección 1 (método): el caller controla `precioConfig` + `onChange`.
 *     Se persiste cuando el caller llama a actualizar producto.
 *   - Secciones 2-4: persistencia INMEDIATA vía endpoints dedicados (cada
 *     "Guardar selección" es una llamada PUT batch atómica). Esto evita
 *     que el usuario pierda cambios si abandona el wizard sin guardar el
 *     producto, y permite editarlas desde cualquier vista del producto.
 *   - `productoId` requerido: si el producto aún no existe (modo crear sin
 *     guardar), las secciones 2-4 muestran un "guardá primero".
 */

import * as React from "react";
import Link from "next/link";
import {
  BadgeDollarSignIcon,
  ExternalLinkIcon,
  HandCoinsIcon,
  InfoIcon,
  PencilIcon,
  PlusIcon,
  ReceiptTextIcon,
  SaveIcon,
  Trash2Icon,
  UsersRoundIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmacionDestructiva } from "@/components/ui/confirmacion-destructiva";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { HumanSelect } from "@/components/ui/human-select";
import { LabelConTooltip } from "@/components/ui/label-con-tooltip";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { TabPrecioEditor, type TabPrecioConfig } from "./tab-precio-editor";
import { PricingSectionHeader } from "./pricing-section-header";
import pricingStyles from "./pricing-visual.module.css";
import {
  actualizarPrecioEspecialCliente,
  crearPrecioEspecialCliente,
  eliminarPrecioEspecialCliente,
  getCategoriaFiscal,
  getComisionesAplicadas,
  getComisionesCatalogo,
  getImpuestosCatalogo,
  getPreciosEspecialesProducto,
  setCategoriaFiscal,
  setComisionesAplicadas,
  type ComisionAplicada,
  type ComisionCatalogoItem,
  type ImpuestoCatalogoItem,
  type PrecioEspecialClienteItem,
} from "@/lib/productos-servicios-api";
import { getClientes } from "@/lib/clientes-api";
import type { ClienteDetalle } from "@/lib/clientes";

interface Props {
  /** ID del producto; si es null el producto aún no existe (crear mode no guardado). */
  productoId: string | null;
  /** Config del método de cálculo (sección 1). */
  precioConfig: TabPrecioConfig;
  onChangePrecioConfig: (cfg: TabPrecioConfig) => void;
  unidadComercial?: string;
  precioDirty?: boolean;
  guardandoPrecio?: boolean;
  onGuardarPrecio?: () => Promise<void> | void;
  /** Editor opcional de la estrategia y los bloques de un producto compuesto. */
  pricingCompuestoSection?: React.ReactNode;
}

type PricingSaveState = {
  dirty: boolean;
  loaded: boolean;
  saving: boolean;
  save: () => Promise<void>;
};

const idleSaveState: PricingSaveState = {
  dirty: false,
  loaded: false,
  saving: false,
  save: async () => undefined,
};

export function TabPrecioCompleto({
  productoId,
  precioConfig,
  onChangePrecioConfig,
  unidadComercial,
  precioDirty = false,
  guardandoPrecio = false,
  onGuardarPrecio,
  pricingCompuestoSection,
}: Props) {
  const [impuestosState, setImpuestosState] = React.useState<PricingSaveState>(idleSaveState);
  const [comisionesState, setComisionesState] = React.useState<PricingSaveState>(idleSaveState);
  const [guardandoTodo, setGuardandoTodo] = React.useState(false);

  const hasUnifiedSave = !!onGuardarPrecio;
  const isDirty =
    precioDirty ||
    (impuestosState.loaded && impuestosState.dirty) ||
    (comisionesState.loaded && comisionesState.dirty);
  const isSaving =
    guardandoTodo || guardandoPrecio || impuestosState.saving || comisionesState.saving;

  const guardarCambios = async () => {
    if (!onGuardarPrecio || !productoId || !isDirty || isSaving) return;
    setGuardandoTodo(true);
    try {
      if (impuestosState.loaded && impuestosState.dirty) await impuestosState.save();
      if (comisionesState.loaded && comisionesState.dirty) await comisionesState.save();
      if (precioDirty) await onGuardarPrecio();
      toast.success("Cambios de pricing guardados");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error guardando cambios");
    } finally {
      setGuardandoTodo(false);
    }
  };

  return (
    <div className={pricingStyles.root}>
      {/* Sección 1 — Método de cálculo (siempre visible, no requiere productoId) */}
      <Card className={pricingStyles.section}>
        <PricingSectionHeader
          step="01"
          eyebrow="Regla base"
          title="Método de cálculo"
          description="Define cómo el costo productivo se convierte en precio de venta."
          icon={BadgeDollarSignIcon}
        />
        <CardContent className={pricingStyles.sectionContent}>
          <TabPrecioEditor
            value={precioConfig}
            onChange={(next) =>
              onChangePrecioConfig({
                ...next,
                ...(precioConfig.compuesto
                  ? { compuesto: precioConfig.compuesto }
                  : {}),
              })
            }
            unidadComercial={unidadComercial}
          />
        </CardContent>
      </Card>

      {pricingCompuestoSection}

      {productoId == null ? (
        <Alert>
          <InfoIcon />
          <AlertTitle>Guardá el producto para completar su arquitectura de precio</AlertTitle>
          <AlertDescription>
            Impuestos, comisiones y excepciones por cliente requieren que el producto exista.
          </AlertDescription>
        </Alert>
      ) : (
        <>
          <div className={pricingStyles.commercialGrid}>
            <SeccionImpuestos
              productoId={productoId}
              onStateChange={hasUnifiedSave ? setImpuestosState : undefined}
            />
            <SeccionComisiones
              productoId={productoId}
              onStateChange={hasUnifiedSave ? setComisionesState : undefined}
            />
          </div>
          <PreciosEspecialesClientesCard
            productoId={productoId}
            unidadComercial={unidadComercial}
          />
        </>
      )}
      {hasUnifiedSave && (isDirty || isSaving) && (
        <div className="save-sticky-footer pricing-sticky-footer">
          <div className={pricingStyles.stickyCopy}>
            <span className={pricingStyles.stickyDot} aria-hidden="true" />
            {isDirty ? "Hay cambios sin guardar en pricing." : "No hay cambios pendientes."}
          </div>
          <Button onClick={guardarCambios} disabled={!productoId || !isDirty || isSaving}>
            {isSaving ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <SaveIcon data-icon="inline-start" />
            )}
            {isSaving ? "Guardando..." : "Guardar cambios"}
          </Button>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// SECCIÓN 2 — Impuestos
// ════════════════════════════════════════════════════════════════════════

/** Opciones de categoría fiscal del producto (Fase 2, AR). */
const CATEGORIA_FISCAL_OPCIONES = [
  { value: "general", nombre: "Normal", sub: "Lleva IVA" },
  { value: "exento", nombre: "Exento", sub: "Sin IVA" },
] as const;

function SeccionImpuestos({
  productoId,
  onStateChange,
}: {
  productoId: string;
  onStateChange?: (state: PricingSaveState) => void;
}) {
  const [catalogo, setCatalogo] = React.useState<ImpuestoCatalogoItem[]>([]);
  const [categoria, setCategoria] = React.useState<string>("general");
  const [original, setOriginal] = React.useState<string>("general");
  const [cargando, setCargando] = React.useState(true);
  const [guardando, setGuardando] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    setCargando(true);
    Promise.all([getImpuestosCatalogo(true), getCategoriaFiscal(productoId)])
      .then(([cat, cf]) => {
        if (cancelled) return;
        setCatalogo(cat);
        setCategoria(cf.categoriaFiscal);
        setOriginal(cf.categoriaFiscal);
      })
      .catch(() => undefined)
      .finally(() => !cancelled && setCargando(false));
    return () => {
      cancelled = true;
    };
  }, [productoId]);

  const dirty = categoria !== original;

  // Datos informativos: la alícuota del IVA general y los impuestos de empresa
  // (alcance TENANT) que se aplican solos a todo, sin marcar por producto.
  const ivaGeneralPct = React.useMemo(
    () =>
      catalogo.find(
        (c) => c.traslado === "POR_FUERA" && c.alcance === "PRODUCTO",
      )?.porcentaje ?? null,
    [catalogo],
  );
  const impuestosEmpresa = React.useMemo(
    () => catalogo.filter((c) => c.alcance === "TENANT" && c.activo),
    [catalogo],
  );

  const guardar = React.useCallback(async () => {
    setGuardando(true);
    try {
      const res = await setCategoriaFiscal(productoId, categoria);
      setOriginal(res.categoriaFiscal);
      setCategoria(res.categoriaFiscal);
      if (!onStateChange) toast.success("Categoría fiscal del producto actualizada");
    } finally {
      setGuardando(false);
    }
  }, [onStateChange, productoId, categoria]);

  React.useEffect(() => {
    onStateChange?.({ dirty: !cargando && dirty, loaded: !cargando, saving: guardando, save: guardar });
  }, [cargando, dirty, guardando, guardar, onStateChange]);

  return (
    <Card className={`${pricingStyles.section} ${pricingStyles.sectionCompact}`}>
      <PricingSectionHeader
        step="03A"
        eyebrow="Cargas comerciales"
        title="Impuestos"
        description="Define el tratamiento fiscal del precio final del producto."
        icon={ReceiptTextIcon}
        action={
          <Button
            render={<Link href="/configuracion/impuestos" />}
            nativeButton={false}
            variant="outline"
            size="sm"
          >
            <ExternalLinkIcon data-icon="inline-start" />
            Catálogo
          </Button>
        }
      />
      <CardContent className={pricingStyles.sectionContent}>
        {cargando ? (
          <div className={pricingStyles.loading} aria-label="Cargando impuestos">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-10 w-4/5" />
          </div>
        ) : (
          <>
            <ToggleGroup
              multiple={false}
              value={[categoria]}
              onValueChange={(values) => {
                const next = values.at(-1);
                if (next) setCategoria(next);
              }}
              variant="outline"
              className={`${pricingStyles.segmented} ${pricingStyles.taxSegmented} grid w-full grid-cols-2`}
            >
              {CATEGORIA_FISCAL_OPCIONES.map((op) => {
                return (
                  <ToggleGroupItem key={op.value} value={op.value}>
                    <span className={pricingStyles.optionName}>{op.nombre}</span>
                    <span className={pricingStyles.optionDescription}>{op.sub}</span>
                    {op.value === "general" && ivaGeneralPct != null && (
                      <Badge variant="outline" className={pricingStyles.optionBadge}>
                        {ivaGeneralPct.toFixed(2)}%
                      </Badge>
                    )}
                  </ToggleGroupItem>
                );
              })}
            </ToggleGroup>
            {impuestosEmpresa.length > 0 && (
              <Alert className={pricingStyles.automaticNote}>
                <InfoIcon />
                <AlertTitle>Aplicación automática</AlertTitle>
                <AlertDescription>
                  {impuestosEmpresa
                    .map((c) => `${c.nombre} (${c.porcentaje.toFixed(2)}%)`)
                    .join(" · ")}
                </AlertDescription>
              </Alert>
            )}
            {!onStateChange && (
              <div className={pricingStyles.summaryRow}>
                <span className="text-sm text-muted-foreground">
                  Tratamiento fiscal del producto
                </span>
                <Button
                  onClick={() => {
                    guardar().catch((err) =>
                      toast.error(err instanceof Error ? err.message : "Error guardando"),
                    );
                  }}
                  disabled={!dirty || guardando}
                  size="sm"
                >
                  {guardando ? <Spinner data-icon="inline-start" /> : null}
                  {guardando ? "Guardando..." : "Guardar categoría"}
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ════════════════════════════════════════════════════════════════════════
// SECCIÓN 3 — Comisiones (espejo de impuestos)
// ════════════════════════════════════════════════════════════════════════

function SeccionComisiones({
  productoId,
  onStateChange,
}: {
  productoId: string;
  onStateChange?: (state: PricingSaveState) => void;
}) {
  const [catalogo, setCatalogo] = React.useState<ComisionCatalogoItem[]>([]);
  const [aplicadas, setAplicadas] = React.useState<ComisionAplicada[]>([]);
  const [seleccionadas, setSeleccionadas] = React.useState<string[]>([]);
  const [cargando, setCargando] = React.useState(true);
  const [guardando, setGuardando] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    setCargando(true);
    Promise.all([getComisionesCatalogo(true), getComisionesAplicadas(productoId)])
      .then(([cat, apli]) => {
        if (cancelled) return;
        setCatalogo(cat);
        setAplicadas(apli);
        setSeleccionadas(apli.map((a) => a.comisionCatalogoId));
      })
      .catch(() => undefined)
      .finally(() => !cancelled && setCargando(false));
    return () => {
      cancelled = true;
    };
  }, [productoId]);

  const toggle = (id: string) => {
    setSeleccionadas((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const dirty = React.useMemo(() => {
    const apliIds = aplicadas.map((a) => a.comisionCatalogoId).sort();
    const selIds = [...seleccionadas].sort();
    return JSON.stringify(apliIds) !== JSON.stringify(selIds);
  }, [aplicadas, seleccionadas]);

  // La pasarela ahora es TENANT (se aplica sola a todo): acá sólo se tildan las
  // de vendedor (por producto). Las de pasarela se muestran como nota.
  const catalogoVendedor = React.useMemo(
    () => catalogo.filter((c) => c.alcance !== "TENANT"),
    [catalogo],
  );
  const pasarelas = React.useMemo(
    () => catalogo.filter((c) => c.alcance === "TENANT"),
    [catalogo],
  );

  const totalPct = React.useMemo(() => {
    return catalogoVendedor
      .filter((c) => seleccionadas.includes(c.id))
      .reduce((acc, c) => acc + c.porcentaje, 0);
  }, [catalogoVendedor, seleccionadas]);

  const guardar = React.useCallback(async () => {
    setGuardando(true);
    const items = seleccionadas.map((id, idx) => ({
      comisionCatalogoId: id,
      orden: idx,
    }));
    try {
      const nuevos = await setComisionesAplicadas(productoId, items);
      setAplicadas(nuevos);
      if (!onStateChange) toast.success("Comisiones del producto actualizadas");
    } finally {
      setGuardando(false);
    }
  }, [onStateChange, productoId, seleccionadas]);

  React.useEffect(() => {
    onStateChange?.({ dirty: !cargando && dirty, loaded: !cargando, saving: guardando, save: guardar });
  }, [cargando, dirty, guardando, guardar, onStateChange]);

  return (
    <Card className={`${pricingStyles.section} ${pricingStyles.sectionCompact}`}>
      <PricingSectionHeader
        step="03B"
        eyebrow="Cargas comerciales"
        title="Comisiones"
        description="Selecciona las comisiones variables asociadas a la venta."
        icon={HandCoinsIcon}
        action={
          <Button
            render={<Link href="/configuracion/comisiones" />}
            nativeButton={false}
            variant="outline"
            size="sm"
          >
            <ExternalLinkIcon data-icon="inline-start" />
            Catálogo
          </Button>
        }
      />
      <CardContent className={pricingStyles.sectionContent}>
        {cargando ? (
          <div className={pricingStyles.loading} aria-label="Cargando comisiones">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-10 w-3/4" />
          </div>
        ) : catalogoVendedor.length === 0 ? (
          <EstadoVacio
            variant="compacto"
            titulo="Sin comisiones de vendedor"
            descripcion="Creá una comisión de vendedor en el catálogo para asignarla a este producto. La de pasarela se aplica sola."
            cta={{
              label: "Ir al catálogo",
              href: "/configuracion/comisiones",
              icon: ExternalLinkIcon,
            }}
          />
        ) : (
          <>
            <FieldGroup
              data-slot="checkbox-group"
              className={`${pricingStyles.checkGrid} ${pricingStyles.checkGridSingle}`}
            >
              {catalogoVendedor.map((c) => {
                const checked = seleccionadas.includes(c.id);
                return (
                  <Field
                    key={c.id}
                    orientation="horizontal"
                    className={pricingStyles.checkOption}
                  >
                    <Checkbox
                      id={`comision-${c.id}`}
                      checked={checked}
                      onCheckedChange={() => toggle(c.id)}
                    />
                    <FieldContent>
                      <div className="flex items-center justify-between gap-2">
                        <FieldLabel htmlFor={`comision-${c.id}`}>
                          {c.nombre}
                        </FieldLabel>
                        <Badge variant="outline">
                          {c.porcentaje.toFixed(2)}%
                        </Badge>
                      </div>
                      <FieldDescription>
                        Se aplica al precio de esta venta.
                      </FieldDescription>
                    </FieldContent>
                  </Field>
                );
              })}
            </FieldGroup>
            <div className={pricingStyles.summaryRow}>
              <div className="text-sm">
                <span className="text-muted-foreground">Total seleccionado</span>{" "}
                <span className={pricingStyles.summaryValue}>
                  {totalPct.toFixed(2)}%
                </span>
              </div>
              {!onStateChange && (
                <Button
                  onClick={() => {
                    guardar().catch((err) =>
                      toast.error(err instanceof Error ? err.message : "Error guardando"),
                    );
                  }}
                  disabled={!dirty || guardando}
                  size="sm"
                >
                  {guardando ? <Spinner data-icon="inline-start" /> : null}
                  {guardando ? "Guardando..." : "Guardar selección"}
                </Button>
              )}
            </div>
            {pasarelas.length > 0 && (
              <Alert className={pricingStyles.automaticNote}>
                <InfoIcon />
                <AlertTitle>Aplicación automática</AlertTitle>
                <AlertDescription>
                  {pasarelas
                    .map((c) => `${c.nombre} (${c.porcentaje.toFixed(2)}%)`)
                    .join(" · ")}
                </AlertDescription>
              </Alert>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ════════════════════════════════════════════════════════════════════════
// SECCIÓN 4 — Precios especiales por cliente
// ════════════════════════════════════════════════════════════════════════

export function PreciosEspecialesClientesCard({
  productoId,
  unidadComercial,
  descripcion = "Reemplaza el precio estándar cuando el cliente seleccionado compra este producto. Cada cliente puede tener su propio método de cálculo.",
}: {
  productoId: string;
  unidadComercial?: string;
  descripcion?: string;
}) {
  const [items, setItems] = React.useState<PrecioEspecialClienteItem[]>([]);
  const [clientes, setClientes] = React.useState<ClienteDetalle[]>([]);
  const [cargando, setCargando] = React.useState(true);
  const [editando, setEditando] = React.useState<PrecioEspecialClienteItem | null>(null);
  const [creandoNuevo, setCreandoNuevo] = React.useState(false);
  const [aBorrar, setABorrar] = React.useState<PrecioEspecialClienteItem | null>(null);

  // Form state (para nuevo o edit)
  const [clienteId, setClienteId] = React.useState("");
  const [config, setConfig] = React.useState<TabPrecioConfig>({
    metodoCalculo: "por_margen",
    detalle: { marginPct: 40 },
  });
  const [guardando, setGuardando] = React.useState(false);

  const recargar = React.useCallback(() => {
    setCargando(true);
    Promise.all([getPreciosEspecialesProducto(productoId), getClientes()])
      .then(([list, clis]) => {
        setItems(list);
        setClientes(clis);
      })
      .catch(() => undefined)
      .finally(() => setCargando(false));
  }, [productoId]);

  React.useEffect(() => {
    recargar();
  }, [recargar]);

  const abrirNuevo = () => {
    setEditando(null);
    setClienteId("");
    setConfig({ metodoCalculo: "por_margen", detalle: { marginPct: 40 } });
    setCreandoNuevo(true);
  };

  const abrirEditar = (item: PrecioEspecialClienteItem) => {
    setEditando(item);
    setClienteId(item.clienteId);
    setConfig(item.configJson as TabPrecioConfig);
    setCreandoNuevo(true);
  };

  const cancelar = () => {
    setCreandoNuevo(false);
    setEditando(null);
  };

  const guardar = async () => {
    if (!clienteId) {
      toast.error("Elegí un cliente");
      return;
    }
    setGuardando(true);
    try {
      if (editando) {
        await actualizarPrecioEspecialCliente(editando.id, {
          configJson: config as unknown as Record<string, unknown>,
        });
        toast.success("Precio especial actualizado");
      } else {
        await crearPrecioEspecialCliente(productoId, {
          clienteId,
          configJson: config as unknown as Record<string, unknown>,
        });
        toast.success("Precio especial creado");
      }
      cancelar();
      recargar();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error guardando");
    } finally {
      setGuardando(false);
    }
  };

  const togglearActivo = async (item: PrecioEspecialClienteItem, nuevoActivo: boolean) => {
    try {
      await actualizarPrecioEspecialCliente(item.id, { activo: nuevoActivo });
      recargar();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    }
  };

  const ejecutarBorrado = async () => {
    if (!aBorrar) return;
    try {
      await eliminarPrecioEspecialCliente(aBorrar.id);
      toast.success("Precio especial eliminado");
      setABorrar(null);
      recargar();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    }
  };

  // Clientes disponibles para nuevo: todos los que no tengan ya un precio
  // especial activo (excepto el que está editando)
  const clientesUsadosIds = new Set(items.filter((i) => i.id !== editando?.id).map((i) => i.clienteId));
  const clientesDisponibles = clientes.filter((c) => !clientesUsadosIds.has(c.id));

  return (
    <Card className={pricingStyles.section}>
      <PricingSectionHeader
        step="04"
        eyebrow="Excepciones comerciales"
        title="Precios especiales por cliente"
        description={descripcion}
        icon={UsersRoundIcon}
        action={
          <Button
            size="sm"
            onClick={abrirNuevo}
            disabled={creandoNuevo || clientesDisponibles.length === 0}
          >
            <PlusIcon data-icon="inline-start" />
            Agregar
          </Button>
        }
      />
      <CardContent className={pricingStyles.sectionContent}>
        {cargando ? (
          <div className={pricingStyles.loading} aria-label="Cargando precios especiales">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : items.length === 0 && !creandoNuevo ? (
          <EstadoVacio
            variant="compacto"
            titulo="Sin precios especiales configurados"
            descripcion="Por default todos los clientes pagan el precio standard. Si querés cobrar distinto a algún cliente puntual, agregalo acá."
          />
        ) : items.length > 0 ? (
          <div className={pricingStyles.tableShell}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Método</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => {
                  const cfg = item.configJson as TabPrecioConfig;
                  return (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div className="font-medium">{item.cliente.nombre}</div>
                        {item.cliente.razonSocial && (
                          <div className="text-muted-foreground text-xs">
                            {item.cliente.razonSocial}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {cfg.metodoCalculo.replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Switch
                          aria-label={`${item.activo ? "Desactivar" : "Activar"} precio especial de ${item.cliente.nombre}`}
                          checked={item.activo}
                          onCheckedChange={(c) => togglearActivo(item, c)}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          aria-label={`Editar precio especial de ${item.cliente.nombre}`}
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => abrirEditar(item)}
                        >
                          <PencilIcon />
                        </Button>
                        <Button
                          aria-label={`Eliminar precio especial de ${item.cliente.nombre}`}
                          variant="destructive"
                          size="icon-sm"
                          onClick={() => setABorrar(item)}
                        >
                          <Trash2Icon />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : null}

        {creandoNuevo && (
          <Card className={pricingStyles.specialEditor}>
            <CardHeader className={pricingStyles.specialEditorHeader}>
              <CardTitle>
                {editando ? "Editar precio especial" : "Nuevo precio especial"}
              </CardTitle>
              <CardDescription>
                Esta regla reemplaza la configuración general sólo para el cliente elegido.
              </CardDescription>
            </CardHeader>
            <CardContent className={pricingStyles.specialEditorContent}>
              <FieldGroup>
                <Field>
                <LabelConTooltip
                  label="Cliente"
                  required
                  tooltip="El cliente que va a recibir este precio especial cuando se le cotice este producto."
                />
                <HumanSelect
                  value={clienteId}
                  onValueChange={(v) => setClienteId(v ?? "")}
                  disabled={!!editando}
                  options={(editando ? clientes : clientesDisponibles).map((c) => ({
                    value: c.id,
                    label: c.nombre,
                    code: c.razonSocial,
                    description: [c.email, c.ciudad].filter(Boolean).join(" · ") || undefined,
                  }))}
                  placeholder="Elegí un cliente"
                  contentClassName="max-h-80"
                />
                {editando && (
                  <FieldDescription>
                    El cliente no se puede cambiar. Si querés cambiarlo, eliminá este y creá otro.
                  </FieldDescription>
                )}
                </Field>

                <Field>
                  <FieldTitle>Regla especial</FieldTitle>
                <TabPrecioEditor
                  value={config}
                  onChange={setConfig}
                  unidadComercial={unidadComercial}
                />
                </Field>
              </FieldGroup>
            </CardContent>
            <CardFooter className={pricingStyles.specialEditorFooter}>
              <Button variant="outline" size="sm" onClick={cancelar} disabled={guardando}>
                Cancelar
              </Button>
              <Button size="sm" onClick={guardar} disabled={guardando || !clienteId}>
                {guardando ? <Spinner data-icon="inline-start" /> : null}
                {guardando ? "Guardando..." : editando ? "Guardar cambios" : "Crear"}
              </Button>
            </CardFooter>
          </Card>
        )}
      </CardContent>

      <ConfirmacionDestructiva
        open={!!aBorrar}
        onOpenChange={(open) => !open && setABorrar(null)}
        titulo="Eliminar precio especial"
        descripcion={
          aBorrar ? (
            <>
              Vas a eliminar el precio especial de <strong>{aBorrar.cliente.nombre}</strong>{" "}
              para este producto.
            </>
          ) : null
        }
        impacto={[
          "El cliente vuelve a pagar el precio standard del producto.",
          "Las cotizaciones existentes para este cliente NO se modifican (quedan con sus snapshots).",
        ]}
        nombreItem={aBorrar?.cliente.nombre}
        requiereTipear={false}
        accionLabel="Eliminar"
        onConfirmar={ejecutarBorrado}
      />
    </Card>
  );
}
