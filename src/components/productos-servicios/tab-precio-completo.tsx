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
  ExternalLinkIcon,
  InfoIcon,
  PencilIcon,
  PlusIcon,
  SaveIcon,
  Trash2Icon,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ConfirmacionDestructiva } from "@/components/ui/confirmacion-destructiva";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { HumanSelect } from "@/components/ui/human-select";
import { Label } from "@/components/ui/label";
import { LabelConTooltip } from "@/components/ui/label-con-tooltip";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TabPrecioEditor, type TabPrecioConfig } from "./tab-precio-editor";
import {
  actualizarPrecioEspecialCliente,
  crearPrecioEspecialCliente,
  eliminarPrecioEspecialCliente,
  getComisionesAplicadas,
  getComisionesCatalogo,
  getImpuestosAplicados,
  getImpuestosCatalogo,
  getPreciosEspecialesProducto,
  setComisionesAplicadas,
  setImpuestosAplicados,
  type ComisionAplicada,
  type ComisionCatalogoItem,
  type ImpuestoAplicado,
  type ImpuestoCatalogoItem,
  type PrecioEspecialClienteItem,
} from "@/lib/productos-servicios-api";
import { getClientes } from "@/lib/clientes-api";
import type { ClienteDetalle } from "@/lib/clientes";
import { cn } from "@/lib/utils";

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
    <div className="pricing-flow">
      {/* Sección 1 — Método de cálculo (siempre visible, no requiere productoId) */}
      <Card className="wiz-section pricing-section">
        <CardHeader className="wiz-section-head">
          <CardTitle>Método de cálculo</CardTitle>
          <CardDescription>
            Cómo se calcula el precio de venta a partir del costo del motor.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TabPrecioEditor
            value={precioConfig}
            onChange={onChangePrecioConfig}
            unidadComercial={unidadComercial}
          />
        </CardContent>
      </Card>

      {productoId == null ? (
        <Card className="bg-muted/30">
          <CardContent className="flex items-start gap-3 pt-6">
            <InfoIcon className="text-muted-foreground mt-0.5 size-4 shrink-0" />
            <div className="text-sm">
              <div className="font-medium">Guardá el producto para configurar el resto.</div>
              <p className="text-muted-foreground mt-1 text-xs">
                Las secciones de impuestos, comisiones y precios especiales por cliente requieren
                que el producto exista primero. Volvé al step 1 y tocá &quot;Crear producto&quot;.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <SeccionImpuestos
            productoId={productoId}
            onStateChange={hasUnifiedSave ? setImpuestosState : undefined}
          />
          <SeccionComisiones
            productoId={productoId}
            onStateChange={hasUnifiedSave ? setComisionesState : undefined}
          />
          <SeccionPreciosEspeciales
            productoId={productoId}
            unidadComercial={unidadComercial}
          />
        </>
      )}
      {hasUnifiedSave && (isDirty || isSaving) && (
        <div className="save-sticky-footer pricing-sticky-footer">
          <div className="pricing-sticky-footer-copy">
            {isDirty ? "Hay cambios sin guardar en pricing." : "No hay cambios pendientes."}
          </div>
          <Button onClick={guardarCambios} disabled={!productoId || !isDirty || isSaving}>
            <SaveIcon className="mr-2 size-4" />
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

function SeccionImpuestos({
  productoId,
  onStateChange,
}: {
  productoId: string;
  onStateChange?: (state: PricingSaveState) => void;
}) {
  const [catalogo, setCatalogo] = React.useState<ImpuestoCatalogoItem[]>([]);
  const [aplicados, setAplicados] = React.useState<ImpuestoAplicado[]>([]);
  const [seleccionados, setSeleccionados] = React.useState<string[]>([]);
  const [cargando, setCargando] = React.useState(true);
  const [guardando, setGuardando] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    setCargando(true);
    Promise.all([getImpuestosCatalogo(true), getImpuestosAplicados(productoId)])
      .then(([cat, apli]) => {
        if (cancelled) return;
        setCatalogo(cat);
        setAplicados(apli);
        setSeleccionados(apli.map((a) => a.impuestoCatalogoId));
      })
      .catch(() => undefined)
      .finally(() => !cancelled && setCargando(false));
    return () => {
      cancelled = true;
    };
  }, [productoId]);

  const toggle = (id: string) => {
    setSeleccionados((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const dirty = React.useMemo(() => {
    const apliIds = aplicados.map((a) => a.impuestoCatalogoId).sort();
    const selIds = [...seleccionados].sort();
    return JSON.stringify(apliIds) !== JSON.stringify(selIds);
  }, [aplicados, seleccionados]);

  const totalPct = React.useMemo(() => {
    return catalogo
      .filter((c) => seleccionados.includes(c.id))
      .reduce((acc, c) => acc + c.porcentaje, 0);
  }, [catalogo, seleccionados]);

  const guardar = React.useCallback(async () => {
    setGuardando(true);
    const items = seleccionados.map((id, idx) => ({
      impuestoCatalogoId: id,
      orden: idx,
    }));
    try {
      const nuevos = await setImpuestosAplicados(productoId, items);
      setAplicados(nuevos);
      if (!onStateChange) toast.success("Impuestos del producto actualizados");
    } finally {
      setGuardando(false);
    }
  }, [onStateChange, productoId, seleccionados]);

  React.useEffect(() => {
    onStateChange?.({ dirty: !cargando && dirty, loaded: !cargando, saving: guardando, save: guardar });
  }, [cargando, dirty, guardando, guardar, onStateChange]);

  return (
    <Card className="wiz-section pricing-section">
      <CardHeader className="wiz-section-head pricing-section-head">
        <div className="body">
          <CardTitle>Impuestos</CardTitle>
          <CardDescription>
            Esquemas impositivos del catálogo del tenant que se aplican al cotizar este producto.
          </CardDescription>
        </div>
        <CardAction className="pricing-section-action">
          <Link href="/configuracion/impuestos"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "btn")}
          >
            <ExternalLinkIcon className="mr-2 size-3" />
            Administrar catálogo
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent className="pricing-section-content">
        {cargando ? (
          <p className="text-muted-foreground text-sm italic">Cargando...</p>
        ) : catalogo.length === 0 ? (
          <EstadoVacio
            variant="compacto"
            titulo="Sin impuestos en el catálogo"
            descripcion="Antes de aplicar impuestos a este producto, creá al menos uno en el catálogo del tenant."
            cta={{
              label: "Ir al catálogo",
              href: "/configuracion/impuestos",
              icon: ExternalLinkIcon,
            }}
          />
        ) : (
          <>
            <div className="checkpill-row">
              {catalogo.map((c) => {
                const checked = seleccionados.includes(c.id);
                return (
                  <label key={c.id} className={`checkpill ${checked ? "on" : ""}`}>
                    <span className="cb">{checked ? "✓" : ""}</span>
                    <input type="checkbox" checked={checked} onChange={() => toggle(c.id)} />
                    <div className="body">
                      <div className="name">{c.nombre}</div>
                      <div className="sub">{c.codigo}</div>
                    </div>
                    <Badge variant="outline" className="pct">
                      {c.porcentaje.toFixed(2)}%
                    </Badge>
                  </label>
                );
              })}
            </div>
            <div className="pricing-total-row">
              <div className="text-sm">
                <span className="text-muted-foreground">Total impuestos seleccionados:</span>{" "}
                <span className="font-mono font-semibold">{totalPct.toFixed(2)}%</span>
              </div>
              {!onStateChange && (
                <Button
                  className="btn btn-primary"
                  onClick={() => {
                    guardar().catch((err) =>
                      toast.error(err instanceof Error ? err.message : "Error guardando"),
                    );
                  }}
                  disabled={!dirty || guardando}
                  size="sm"
                >
                  {guardando ? "Guardando..." : "Guardar selección"}
                </Button>
              )}
            </div>
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

  const totalPct = React.useMemo(() => {
    return catalogo
      .filter((c) => seleccionadas.includes(c.id))
      .reduce((acc, c) => acc + c.porcentaje, 0);
  }, [catalogo, seleccionadas]);

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
    <Card className="wiz-section pricing-section">
      <CardHeader className="wiz-section-head pricing-section-head">
        <div className="body">
          <CardTitle>Comisiones</CardTitle>
          <CardDescription>
            Esquemas reusables de comisiones (vendedor, financiera, etc.) que se cobran al cotizar
            este producto.
          </CardDescription>
        </div>
        <CardAction className="pricing-section-action">
          <Link href="/configuracion/comisiones"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "btn")}
          >
            <ExternalLinkIcon className="mr-2 size-3" />
            Administrar catálogo
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent className="pricing-section-content">
        {cargando ? (
          <p className="text-muted-foreground text-sm italic">Cargando...</p>
        ) : catalogo.length === 0 ? (
          <EstadoVacio
            variant="compacto"
            titulo="Sin comisiones en el catálogo"
            descripcion="Antes de aplicar comisiones a este producto, creá al menos una en el catálogo del tenant."
            cta={{
              label: "Ir al catálogo",
              href: "/configuracion/comisiones",
              icon: ExternalLinkIcon,
            }}
          />
        ) : (
          <>
            <div className="checkpill-row">
              {catalogo.map((c) => {
                const checked = seleccionadas.includes(c.id);
                return (
                  <label key={c.id} className={`checkpill ${checked ? "on" : ""}`}>
                    <span className="cb">{checked ? "✓" : ""}</span>
                    <input type="checkbox" checked={checked} onChange={() => toggle(c.id)} />
                    <div className="body">
                      <div className="name">{c.nombre}</div>
                      <div className="sub">{c.codigo}</div>
                    </div>
                    <Badge variant="outline" className="pct">
                      {c.porcentaje.toFixed(2)}%
                    </Badge>
                  </label>
                );
              })}
            </div>
            <div className="pricing-total-row">
              <div className="text-sm">
                <span className="text-muted-foreground">Total comisiones seleccionadas:</span>{" "}
                <span className="font-mono font-semibold">{totalPct.toFixed(2)}%</span>
              </div>
              {!onStateChange && (
                <Button
                  className="btn btn-primary"
                  onClick={() => {
                    guardar().catch((err) =>
                      toast.error(err instanceof Error ? err.message : "Error guardando"),
                    );
                  }}
                  disabled={!dirty || guardando}
                  size="sm"
                >
                  {guardando ? "Guardando..." : "Guardar selección"}
                </Button>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ════════════════════════════════════════════════════════════════════════
// SECCIÓN 4 — Precios especiales por cliente
// ════════════════════════════════════════════════════════════════════════

function SeccionPreciosEspeciales({
  productoId,
  unidadComercial,
}: {
  productoId: string;
  unidadComercial?: string;
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
    <Card className="wiz-section pricing-section">
      <CardHeader className="wiz-section-head pricing-section-head">
        <div className="body">
          <CardTitle>Precios especiales por cliente</CardTitle>
          <CardDescription>
            Override del precio standard cuando el cliente X compra este producto. Cada precio
            especial usa su propio método de cálculo.
          </CardDescription>
        </div>
        <CardAction className="pricing-section-action">
          <Button
            size="sm"
            onClick={abrirNuevo}
            disabled={creandoNuevo || clientesDisponibles.length === 0}
          >
            <PlusIcon className="mr-2 size-3" />
            Agregar
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="pricing-section-content">
        {cargando ? (
          <p className="text-muted-foreground text-sm italic">Cargando...</p>
        ) : items.length === 0 && !creandoNuevo ? (
          <EstadoVacio
            variant="compacto"
            titulo="Sin precios especiales configurados"
            descripcion="Por default todos los clientes pagan el precio standard. Si querés cobrar distinto a algún cliente puntual, agregalo acá."
          />
        ) : items.length > 0 ? (
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
                      <Badge variant="outline" className="text-xs">
                        {cfg.metodoCalculo.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={item.activo}
                        onCheckedChange={(c) => togglearActivo(item, c)}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => abrirEditar(item)}>
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
                );
              })}
            </TableBody>
          </Table>
        ) : null}

        {creandoNuevo && (
          <Card className="bg-muted/30 border-dashed">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">
                {editando ? "Editar precio especial" : "Nuevo precio especial"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
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
                  <p className="text-muted-foreground text-xs">
                    El cliente no se puede cambiar. Si querés cambiarlo, eliminá este y creá otro.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Método de cálculo del precio especial</Label>
                <TabPrecioEditor
                  value={config}
                  onChange={setConfig}
                  unidadComercial={unidadComercial}
                />
              </div>

              <div className="flex items-center justify-end gap-2 border-t pt-3">
                <Button variant="outline" size="sm" onClick={cancelar} disabled={guardando}>
                  Cancelar
                </Button>
                <Button size="sm" onClick={guardar} disabled={guardando || !clienteId}>
                  {guardando ? "Guardando..." : editando ? "Guardar cambios" : "Crear"}
                </Button>
              </div>
            </CardContent>
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
