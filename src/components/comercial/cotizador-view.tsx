"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  CalculatorIcon,
  CheckCircle2Icon,
  CircleIcon,
  PlusIcon,
  SaveIcon,
  Trash2Icon,
  XCircleIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { NestingViewer } from "@/components/nesting/nesting-viewer";
import { LabelConTooltip } from "@/components/ui/label-con-tooltip";
import { getCatalogoFamilias } from "@/lib/productos-servicios-api";
import { categoriaFamiliaLabels, getLabel } from "@/lib/labels-humanos";
import {
  cotizar,
  cotizarYGuardar,
  getProductoById,
  type CotizarResponse,
} from "@/lib/productos-servicios-api";
import type { ProductoDetalle, ProductoListItem } from "@/lib/productos-servicios";

function formatARS(n: number): string {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(n);
}

interface PiezaInput {
  uiKey: string;
  cantidad: number;
  anchoMm: number;
  altoMm: number;
}

const ZONAS_VIATICO = [
  { value: "CABA", label: "CABA ($3.000)" },
  { value: "GBA_NORTE", label: "GBA Norte ($5.000)" },
  { value: "GBA_OESTE", label: "GBA Oeste ($5.000)" },
  { value: "GBA_SUR", label: "GBA Sur ($5.000)" },
  { value: "FUERA_AMBA", label: "Fuera AMBA ($12.000)" },
];

export function CotizadorView({ productos }: { productos: ProductoListItem[] }) {
  const router = useRouter();
  const [productoId, setProductoId] = React.useState<string>("");
  const [productoDetalle, setProductoDetalle] = React.useState<ProductoDetalle | null>(null);
  // Catálogo de familias para mostrar nombres humanos en lugar de códigos.
  const [catalogoFamilias, setCatalogoFamilias] = React.useState<Map<string, string>>(new Map());
  React.useEffect(() => {
    void getCatalogoFamilias().then((cat) => {
      setCatalogoFamilias(new Map(cat.familias.map((f) => [f.codigo, f.nombre])));
    });
  }, []);
  const familiaLabel = React.useCallback(
    (codigo: string) => catalogoFamilias.get(codigo) ?? codigo,
    [catalogoFamilias],
  );
  const [rutaAlternativaId, setRutaAlternativaId] = React.useState<string>("");
  const [cantidad, setCantidad] = React.useState<number>(100);
  const [caras, setCaras] = React.useState<1 | 2>(1);
  const [tipoCopia, setTipoCopia] = React.useState<1 | 2 | 3>(1);
  const [opcionalesActivados, setOpcionalesActivados] = React.useState<Record<string, boolean>>({});
  const [seleccionMaterial, setSeleccionMaterial] = React.useState<Record<string, string>>({});
  // G-F2: máquina elegida por configPasoId cuando hay candidatas M-2.
  const [seleccionMaquina, setSeleccionMaquina] = React.useState<Record<string, string>>({});
  const [zonaInstalacion, setZonaInstalacion] = React.useState<string>("CABA");
  const [m2Instalados, setM2Instalados] = React.useState<number>(0);
  const [piezas, setPiezas] = React.useState<PiezaInput[]>([]);
  const [cargando, setCargando] = React.useState(false);
  const [guardando, setGuardando] = React.useState(false);
  const [resultado, setResultado] = React.useState<CotizarResponse | null>(null);

  React.useEffect(() => {
    if (!productoId) return;
    setProductoDetalle(null);
    setResultado(null);
    setOpcionalesActivados({});
    setSeleccionMaterial({});
    setSeleccionMaquina({});
    setPiezas([]);
    void getProductoById(productoId).then((d) => {
      setProductoDetalle(d);
      const preferida = d.rutasAlternativas.find((r) => r.esPreferida);
      setRutaAlternativaId(preferida?.id ?? d.rutasAlternativas[0]?.id ?? "");
      // Si LIBRE, agregar 1 pieza inicial; si FIJA, dejar vacío (se usa cantidad)
      if (d.modoMedidas === "LIBRE") {
        setPiezas([
          {
            uiKey: `pz-${Date.now()}`,
            cantidad: 1,
            anchoMm: 1000,
            altoMm: 500,
          },
        ]);
      }
    });
  }, [productoId]);

  const productoSel = productos.find((p) => p.id === productoId);
  const rutaSel = productoDetalle?.rutasAlternativas.find((r) => r.id === rutaAlternativaId);
  const pasosOpcionales =
    rutaSel?.configPasos.filter((cp) => cp.modoActivacion === "OPCIONAL") ?? [];
  const cargosOpcionales =
    productoDetalle?.cargosDirectosCotizacion.filter((c) => c.modoActivacion === "OPCIONAL") ?? [];

  // Slots COMERCIAL_ELIGE: extraer de los configPasos de la ruta seleccionada
  const slotsComercialElige =
    rutaSel?.configPasos.flatMap((cp) =>
      cp.slotsMateriales
        .filter((s) => s.modoSeleccion === "COMERCIAL_ELIGE")
        .map((s) => ({
          configPasoId: cp.id,
          familiaCodigo: cp.rutaPaso.familiaCodigo,
          slotCodigo: s.slotCodigo,
          candidatos: (s.materialesCandidatosJson as Array<{
            variantId: string;
            label?: string;
            default?: boolean;
          }>) ?? [],
        })),
    ) ?? [];

  // G-F2: pasos con máquinas candidatas M-2 (más de 1) → mostrar selector.
  const pasosConCandidatas =
    rutaSel?.configPasos
      .filter((cp) => (cp.maquinasCandidatas?.length ?? 0) > 1)
      .map((cp) => ({
        configPasoId: cp.id,
        familiaCodigo: cp.rutaPaso.familiaCodigo,
        candidatas: cp.maquinasCandidatas ?? [],
      })) ?? [];

  const necesitaInstalacion = productoDetalle?.cargosDirectosCotizacion.some(
    (c) => c.cargoDirectoCatalogo.codigo === "viatico",
  );

  const construirJobContext = () => {
    const ctx: Record<string, unknown> = {
      cantidad,
      caras,
      tipoCopia,
      opcionalesActivados,
    };
    if (productoDetalle?.modoMedidas === "LIBRE" && piezas.length > 0) {
      ctx.piezas = piezas.map((p) => ({
        cantidad: p.cantidad,
        anchoMm: p.anchoMm,
        altoMm: p.altoMm,
      }));
    }
    if (m2Instalados > 0) ctx.m2_instalados = m2Instalados;
    if (zonaInstalacion) ctx.zonaInstalacion = zonaInstalacion;
    // Inyectar selección de material por slot (key: slotMaterial_<slotCodigo>)
    for (const [slotCodigo, variantId] of Object.entries(seleccionMaterial)) {
      ctx[`slotMaterial_${slotCodigo}`] = variantId;
    }
    // G-F2: inyectar override de máquina M-2 por configPasoId.
    for (const [configPasoId, maquinaId] of Object.entries(seleccionMaquina)) {
      if (maquinaId) ctx[`maquinaSeleccionada_${configPasoId}`] = maquinaId;
    }
    return ctx;
  };

  const ejecutarCotizacion = async () => {
    setCargando(true);
    setResultado(null);
    try {
      const res = await cotizar({
        productoId,
        rutaAlternativaId,
        jobContext: construirJobContext() as never,
        periodo: "2026-03",
      });
      setResultado(res);
      if (!res.exitoso) {
        toast.error(`Cotización falló: ${res.errores[0]?.mensaje}`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setCargando(false);
    }
  };

  const guardarCotizacion = async () => {
    setGuardando(true);
    try {
      const res = await cotizarYGuardar({
        productoId,
        rutaAlternativaId,
        jobContext: construirJobContext() as never,
        periodo: "2026-03",
      });
      if (res.result.exitoso && res.cotizacionId) {
        toast.success(`Cotización guardada (ID: ${res.cotizacionId.slice(0, 8)}...)`);
        router.refresh();
      } else {
        toast.error("No se pudo guardar");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setGuardando(false);
    }
  };

  const agregarPieza = () => {
    setPiezas((prev) => [
      ...prev,
      {
        uiKey: `pz-${Date.now()}-${Math.random()}`,
        cantidad: 1,
        anchoMm: 1000,
        altoMm: 500,
      },
    ]);
  };

  const updatePieza = (idx: number, patch: Partial<PiezaInput>) => {
    setPiezas((prev) => prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  };

  const removePieza = (idx: number) => {
    setPiezas((prev) => prev.filter((_, i) => i !== idx));
  };

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Cotizador</h1>
        <p className="text-muted-foreground text-sm">
          Cotizar productos del Modelo Universal. Invoca el motor backend.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* COLUMNA IZQUIERDA: Formulario */}
        <Card>
          <CardHeader>
            <CardTitle>Configuración de la cotización</CardTitle>
            <CardDescription>
              Elegí el producto, la ruta alternativa, y los inputs del trabajo.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="producto">Producto</Label>
              <Select value={productoId} onValueChange={(v) => setProductoId(v ?? "")}>
                <SelectTrigger id="producto">
                  <SelectValue placeholder="Elegí un producto" />
                </SelectTrigger>
                <SelectContent>
                  {productos.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {productoDetalle && productoDetalle.rutasAlternativas.length > 1 && (
              <div className="space-y-2">
                <Label htmlFor="ruta">Ruta alternativa</Label>
                <Select
                  value={rutaAlternativaId}
                  onValueChange={(v) => setRutaAlternativaId(v ?? "")}
                >
                  <SelectTrigger id="ruta">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {productoDetalle.rutasAlternativas.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.nombre} {r.esPreferida && "★"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="cantidad">Cantidad</Label>
              <Input
                id="cantidad"
                type="number"
                min={1}
                value={cantidad}
                onChange={(e) => setCantidad(Number(e.target.value))}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="caras">Caras</Label>
                <Select value={String(caras)} onValueChange={(v) => setCaras(Number(v) as 1 | 2)}>
                  <SelectTrigger id="caras">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Simple faz</SelectItem>
                    <SelectItem value="2">Doble faz</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {productoSel?.codigo === "TALON-DUPL-A4" && (
                <div className="space-y-2">
                  <Label htmlFor="tipoCopia">Tipo copia</Label>
                  <Select
                    value={String(tipoCopia)}
                    onValueChange={(v) => setTipoCopia(Number(v) as 1 | 2 | 3)}
                  >
                    <SelectTrigger id="tipoCopia">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Simple</SelectItem>
                      <SelectItem value="2">Duplicado</SelectItem>
                      <SelectItem value="3">Triplicado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* PIEZAS multi-medida (solo si modoMedidas LIBRE) */}
            {productoDetalle?.modoMedidas === "LIBRE" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Piezas a producir (multi-medida)</Label>
                  <Button onClick={agregarPieza} variant="outline" size="sm">
                    <PlusIcon className="mr-1 size-3" />
                    Agregar pieza
                  </Button>
                </div>
                {piezas.map((p, idx) => (
                  <div key={p.uiKey} className="bg-muted/30 flex items-center gap-2 rounded p-2">
                    <Input
                      type="number"
                      value={p.cantidad}
                      onChange={(e) => updatePieza(idx, { cantidad: Number(e.target.value) })}
                      className="h-8 w-20 text-xs"
                      placeholder="cant"
                    />
                    <span className="text-xs">×</span>
                    <Input
                      type="number"
                      value={p.anchoMm}
                      onChange={(e) => updatePieza(idx, { anchoMm: Number(e.target.value) })}
                      className="h-8 w-20 text-xs"
                      placeholder="ancho"
                    />
                    <span className="text-xs">×</span>
                    <Input
                      type="number"
                      value={p.altoMm}
                      onChange={(e) => updatePieza(idx, { altoMm: Number(e.target.value) })}
                      className="h-8 w-20 text-xs"
                      placeholder="alto"
                    />
                    <span className="text-muted-foreground text-xs">mm</span>
                    <div className="flex-1" />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removePieza(idx)}
                      className="h-7 w-7 p-0 text-red-600"
                    >
                      <Trash2Icon className="size-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Slots COMERCIAL_ELIGE */}
            {slotsComercialElige.length > 0 && (
              <div className="space-y-2">
                <LabelConTooltip
                  label="Materiales a elegir"
                  tooltip="El producto te deja elegir el material para ciertos pasos (ej: tipo de film para laminado)."
                />
                {slotsComercialElige.map((slot) => (
                  <div key={`${slot.configPasoId}-${slot.slotCodigo}`} className="space-y-1">
                    <div className="text-muted-foreground text-xs">
                      {familiaLabel(slot.familiaCodigo)} — {slot.slotCodigo.replace(/_/g, " ")}
                    </div>
                    <Select
                      value={seleccionMaterial[slot.slotCodigo] ?? ""}
                      onValueChange={(v) =>
                        setSeleccionMaterial((prev) => ({ ...prev, [slot.slotCodigo]: v ?? "" }))
                      }
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Default..." />
                      </SelectTrigger>
                      <SelectContent>
                        {slot.candidatos.map((c) => (
                          <SelectItem key={c.variantId} value={c.variantId}>
                            {c.label ?? c.variantId} {c.default && "(default)"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            )}

            {/* G-F2: Override de máquina M-2 cuando hay candidatas */}
            {pasosConCandidatas.length > 0 && (
              <div className="space-y-2">
                <LabelConTooltip
                  label="Máquina por paso"
                  tooltip="Algunos pasos tienen máquinas alternativas. Podés elegir cuál usar para esta cotización; si no elegís, se usa la marcada como preferida."
                />
                {pasosConCandidatas.map((p) => (
                  <div key={p.configPasoId} className="space-y-1">
                    <Label
                      htmlFor={`maq-${p.configPasoId}`}
                      className="text-muted-foreground text-xs"
                    >
                      {familiaLabel(p.familiaCodigo)}
                    </Label>
                    <Select
                      value={seleccionMaquina[p.configPasoId] ?? ""}
                      onValueChange={(v) =>
                        setSeleccionMaquina((prev) => ({
                          ...prev,
                          [p.configPasoId]: v ?? "",
                        }))
                      }
                    >
                      <SelectTrigger id={`maq-${p.configPasoId}`}>
                        <SelectValue placeholder="(usar preferida)" />
                      </SelectTrigger>
                      <SelectContent>
                        {p.candidatas.map((c) => (
                          <SelectItem key={c.maquinaId} value={c.maquinaId}>
                            {c.maquina.nombre} {c.esPreferida ? "★" : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            )}

            {/* Pasos opcionales */}
            {pasosOpcionales.length > 0 && (
              <div className="space-y-2">
                <LabelConTooltip
                  label="Pasos opcionales"
                  tooltip="Pasos del producto que se incluyen solo si el cliente los elige (ej: laminado, redondeo)."
                />
                <div className="space-y-1.5">
                  {pasosOpcionales.map((cp) => (
                    <label
                      key={cp.id}
                      className="hover:bg-accent flex items-center gap-2 rounded p-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={!!opcionalesActivados[cp.id]}
                        onChange={(e) =>
                          setOpcionalesActivados((prev) => ({
                            ...prev,
                            [cp.id]: e.target.checked,
                          }))
                        }
                      />
                      <span className="font-medium">{familiaLabel(cp.rutaPaso.familiaCodigo)}</span>
                      {cp.maquinaM1 && (
                        <span className="text-muted-foreground text-xs">
                          ({cp.maquinaM1.nombre})
                        </span>
                      )}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Cargos directos opcionales */}
            {cargosOpcionales.length > 0 && (
              <div className="space-y-2">
                <Label>Cargos directos opcionales</Label>
                {cargosOpcionales.map((c) => (
                  <div key={c.id} className="space-y-1">
                    <label className="hover:bg-accent flex items-center gap-2 rounded p-2 text-sm">
                      <input
                        type="checkbox"
                        checked={!!opcionalesActivados[c.id]}
                        onChange={(e) =>
                          setOpcionalesActivados((prev) => ({ ...prev, [c.id]: e.target.checked }))
                        }
                      />
                      <span>{c.cargoDirectoCatalogo.nombre}</span>
                    </label>
                    {/* Si el cargo activo es viático, mostrar selector de zona */}
                    {c.cargoDirectoCatalogo.codigo === "viatico" &&
                      opcionalesActivados[c.id] && (
                        <div className="ml-6 space-y-1">
                          <Label className="text-xs">Zona</Label>
                          <Select
                            value={zonaInstalacion}
                            onValueChange={(v) => setZonaInstalacion(v ?? "CABA")}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ZONAS_VIATICO.map((z) => (
                                <SelectItem key={z.value} value={z.value}>
                                  {z.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                  </div>
                ))}
              </div>
            )}

            {/* Instalación m² (si necesita) */}
            {necesitaInstalacion && (
              <div className="space-y-2">
                <Label htmlFor="m2instalados">m² instalados (si aplica)</Label>
                <Input
                  id="m2instalados"
                  type="number"
                  value={m2Instalados}
                  onChange={(e) => setM2Instalados(Number(e.target.value))}
                  placeholder="0"
                />
              </div>
            )}

            <div className="flex gap-2">
              <Button
                onClick={ejecutarCotizacion}
                disabled={!productoId || cargando}
                className="flex-1"
                size="lg"
              >
                <CalculatorIcon className="mr-2 size-4" />
                {cargando ? "Calculando..." : "Cotizar"}
              </Button>
              <Button
                onClick={guardarCotizacion}
                disabled={!productoId || guardando || !resultado?.exitoso}
                variant="outline"
                size="lg"
              >
                <SaveIcon className="mr-2 size-4" />
                {guardando ? "..." : "Guardar"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* COLUMNA DERECHA: Resultado */}
        <Card>
          <CardHeader>
            <CardTitle>Resultado</CardTitle>
            <CardDescription>Costo + precio + trazabilidad por paso.</CardDescription>
          </CardHeader>
          <CardContent>
            {!resultado ? (
              <div className="text-muted-foreground py-8 text-center text-sm">
                Configurá el producto y presioná Cotizar
              </div>
            ) : !resultado.exitoso ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-red-600">
                  <XCircleIcon className="size-5" />
                  <span className="font-medium">Cotización falló</span>
                </div>
                <ul className="space-y-1 text-sm">
                  {resultado.errores.map((e, i) => (
                    <li key={i} className="bg-red-50 rounded p-2 text-red-900">
                      <div className="font-mono text-xs">{e.codigo}</div>
                      <div>{e.mensaje}</div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : resultado.cotizacion ? (
              <ResultadoCotizacion cotizacion={resultado.cotizacion} familiaLabel={familiaLabel} />
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ResultadoCotizacion({
  cotizacion,
  familiaLabel,
}: {
  cotizacion: NonNullable<CotizarResponse["cotizacion"]>;
  familiaLabel: (codigo: string) => string;
}) {
  const c = cotizacion;
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-green-600">
        <CheckCircle2Icon className="size-5" />
        <span className="font-medium">Cotización OK</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-muted rounded p-3">
          <div className="text-muted-foreground text-xs">Costo total</div>
          <div className="text-lg font-semibold">{formatARS(c.costos.total)}</div>
        </div>
        {c.desglosePrecio ? (
          <div className="bg-primary/10 rounded p-3">
            <div className="text-muted-foreground text-xs">Precio total (con IVA)</div>
            <div className="text-primary text-lg font-semibold">
              {formatARS(c.desglosePrecio.precioBrutoTotal)}
            </div>
            <div className="text-muted-foreground mt-1 text-xs">
              margen efectivo: {c.desglosePrecio.margenEfectivoPct.toFixed(1)}%
              {c.desglosePrecio.precioEspecialCliente && (
                <span className="text-amber-700 ml-1">
                  · precio especial aplicado
                </span>
              )}
            </div>
          </div>
        ) : c.precio ? (
          <div className="bg-primary/10 rounded p-3">
            <div className="text-muted-foreground text-xs">Precio total (Tab Precio)</div>
            <div className="text-primary text-lg font-semibold">
              {formatARS(c.precio.precioTotal)}
            </div>
            {c.precio.margenAplicadoPct !== undefined && (
              <div className="text-muted-foreground mt-1 text-xs">
                margen: {c.precio.margenAplicadoPct}%
              </div>
            )}
          </div>
        ) : null}
      </div>

      <div className="text-muted-foreground text-xs">
        Costo unitario: {formatARS(c.costos.unitario)}
        {c.desglosePrecio && (
          <> · Precio unitario bruto: {formatARS(c.desglosePrecio.precioBrutoUnitario)}</>
        )}
        {!c.desglosePrecio && c.precio && (
          <> · Precio unitario: {formatARS(c.precio.precioUnitario)}</>
        )}
      </div>

      <div className="space-y-1 text-sm">
        <div className="flex justify-between">
          <span>Tiempo total:</span>
          <span className="font-mono">{formatARS(c.costos.tiempoTotal)}</span>
        </div>
        <div className="flex justify-between">
          <span>Materiales total:</span>
          <span className="font-mono">{formatARS(c.costos.materialesTotal)}</span>
        </div>
        <div className="flex justify-between">
          <span>Cargos directos:</span>
          <span className="font-mono">{formatARS(c.costos.cargosDirectosTotal)}</span>
        </div>
      </div>

      {/* Sprint 5.a — Desglose comercial (precio base + comisiones + impuestos) */}
      {c.desglosePrecio && (
        <details className="text-sm">
          <summary className="hover:bg-accent cursor-pointer rounded p-2 font-medium">
            Desglose comercial del precio
          </summary>
          <div className="mt-2 space-y-2 rounded border bg-muted/30 p-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Precio base:</span>
              <span className="font-mono">
                {formatARS(c.desglosePrecio.precioBase)} / unidad
              </span>
            </div>

            {c.desglosePrecio.comisiones.length > 0 && (
              <div className="space-y-1 border-t pt-2">
                <div className="text-muted-foreground text-xs font-medium uppercase">
                  Comisiones
                </div>
                {c.desglosePrecio.comisiones.map((com) => (
                  <div key={com.catalogoId} className="flex justify-between text-xs">
                    <span>
                      {com.nombre}{" "}
                      <span className="text-muted-foreground font-mono">
                        ({com.porcentaje.toFixed(2)}%)
                      </span>
                    </span>
                  </div>
                ))}
                <div className="flex justify-between border-t pt-1 text-sm">
                  <span className="text-muted-foreground">Total comisiones:</span>
                  <span className="font-mono">
                    {formatARS(c.desglosePrecio.totalComisiones)} / unidad
                  </span>
                </div>
              </div>
            )}

            {c.desglosePrecio.impuestos.length > 0 && (
              <div className="space-y-1 border-t pt-2">
                <div className="text-muted-foreground text-xs font-medium uppercase">
                  Impuestos
                </div>
                {c.desglosePrecio.impuestos.map((imp) => (
                  <div key={imp.catalogoId} className="flex justify-between text-xs">
                    <span>
                      {imp.nombre}{" "}
                      <span className="text-muted-foreground font-mono">
                        ({imp.porcentaje.toFixed(2)}%)
                      </span>
                    </span>
                  </div>
                ))}
                <div className="flex justify-between border-t pt-1 text-sm">
                  <span className="text-muted-foreground">Total impuestos:</span>
                  <span className="font-mono">
                    {formatARS(c.desglosePrecio.totalImpuestos)} / unidad
                  </span>
                </div>
              </div>
            )}

            <div className="space-y-1 border-t pt-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Precio neto unitario:</span>
                <span className="font-mono">
                  {formatARS(c.desglosePrecio.precioNetoUnitario)}
                </span>
              </div>
              <div className="flex justify-between font-semibold">
                <span>Precio bruto unitario (con IVA):</span>
                <span className="font-mono">
                  {formatARS(c.desglosePrecio.precioBrutoUnitario)}
                </span>
              </div>
            </div>

            {c.desglosePrecio.precioEspecialCliente && (
              <div className="border-t pt-2 text-xs text-amber-700">
                ⚠ Se aplicó precio especial del cliente (override del standard).
              </div>
            )}
          </div>
        </details>
      )}

      <details className="text-sm">
        <summary className="hover:bg-accent cursor-pointer rounded p-2 font-medium">
          Trazabilidad por paso ({c.pasos.length})
        </summary>
        <Table className="mt-2">
          <TableHeader>
            <TableRow>
              <TableHead className="w-8"></TableHead>
              <TableHead>Paso</TableHead>
              <TableHead className="text-right">Tiempo</TableHead>
              <TableHead className="text-right">Costo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {c.pasos.map((p) => (
              <TableRow key={p.rutaPasoOrden}>
                <TableCell>
                  {p.activado ? (
                    <CheckCircle2Icon className="size-4 text-green-500" />
                  ) : (
                    <CircleIcon className="size-4 text-gray-300" />
                  )}
                </TableCell>
                <TableCell>
                  <div className="font-medium">
                    {p.rutaPasoOrden}. {familiaLabel(p.familiaCodigo)}
                  </div>
                  {!p.activado && p.razonNoActivado && (
                    <div className="text-muted-foreground text-xs">{p.razonNoActivado}</div>
                  )}
                </TableCell>
                <TableCell className="text-right font-mono text-xs">
                  {p.tiempo ? `${p.tiempo.totalMin}min` : "—"}
                </TableCell>
                <TableCell className="text-right font-mono text-xs">
                  {p.activado ? formatARS(p.costoTotal) : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </details>

      {c.cargosDirectosCotizacion.length > 0 && (
        <div className="space-y-1 text-sm">
          <div className="font-medium">Cargos directos cotización</div>
          {c.cargosDirectosCotizacion.map((cd, i) => (
            <div key={i} className="flex justify-between">
              <Badge variant="outline">{cd.cargoNombre}</Badge>
              <span className="font-mono">{formatARS(cd.monto)}</span>
            </div>
          ))}
        </div>
      )}

      {c.pasos.some((p) => p.nestingResult) && (
        <details className="text-sm">
          <summary className="hover:bg-accent cursor-pointer rounded p-2 font-medium">
            Cómo se acomodan las piezas (
            {c.pasos.filter((p) => p.nestingResult).length}{" "}
            {c.pasos.filter((p) => p.nestingResult).length === 1 ? "paso" : "pasos"})
          </summary>
          <div className="space-y-4 mt-2">
            {c.pasos
              .filter((p) => p.nestingResult)
              .map((p) => (
                <div key={p.rutaPasoOrden} className="space-y-2">
                  <div className="text-sm font-medium">
                    Paso {p.rutaPasoOrden}. {familiaLabel(p.familiaCodigo)}
                  </div>
                  <NestingViewer result={p.nestingResult!} />
                </div>
              ))}
          </div>
        </details>
      )}
    </div>
  );
}
