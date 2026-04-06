"use client";

import * as React from "react";
import { toast } from "sonner";
import { Loader2Icon } from "lucide-react";

import type { ProductTabProps } from "@/components/productos-servicios/product-detail-types";
import { ProductoTabSection } from "@/components/productos-servicios/producto-tab-section";
import { GdiSpinner } from "@/components/brand/gdi-spinner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  getProductoMotorConfig,
  cotizarProductoVariante,
} from "@/lib/productos-servicios-api";

type RigidPrintedConfig = {
  tiposImpresion: string[];
  carasDisponibles: string[];
  carasDefault: string;
  [key: string]: unknown;
};

type QuoteResult = {
  total: number;
  unitario: number;
  subtotales: {
    procesos: number;
    material: number;
  };
  bloques: {
    procesos: Array<{ nombre: string; costo: number }>;
    materiales: Array<{
      nombre: string;
      cantidad: number;
      costoTotal: number;
    }>;
  };
  trazabilidad: {
    tipoImpresion: string;
    caras: string;
    multiplicadorCaras: number;
    estrategiaCosteo: string;
    costeoDetalle: {
      precioPlaca: number;
      precioM2: number;
      placasCompletas: number;
      costoPlacasCompletas: number;
      ultimaPlaca: {
        ocupacionPct: number;
        segmentoAplicado: number | null;
        costo: number;
      } | null;
    };
    resumenTecnico: {
      piezasPorPlaca: number;
      placasNecesarias: number;
      aprovechamientoPct: number;
      rotada: boolean;
      sobrantes: number;
    };
  };
};

const TIPO_IMPRESION_LABELS: Record<string, string> = {
  directa: "Impresión directa",
  flexible_montado: "Sustrato flexible montado",
};

const CARAS_LABELS: Record<string, string> = {
  simple_faz: "Simple faz",
  doble_faz: "Doble faz",
};

export function RigidPrintedSimularCostoTab(props: ProductTabProps) {
  const [loading, setLoading] = React.useState(true);
  const [quoting, setQuoting] = React.useState(false);
  const [config, setConfig] = React.useState<RigidPrintedConfig | null>(null);
  const [quoteResult, setQuoteResult] = React.useState<QuoteResult | null>(null);

  const [anchoMm, setAnchoMm] = React.useState<number>(0);
  const [altoMm, setAltoMm] = React.useState<number>(0);
  const [cantidad, setCantidad] = React.useState<number>(10);
  const [tipoImpresion, setTipoImpresion] = React.useState<string>("directa");
  const [caras, setCaras] = React.useState<string>("simple_faz");

  const loadConfig = React.useCallback(async () => {
    try {
      setLoading(true);
      const result = await getProductoMotorConfig(props.producto.id);
      const params = (result?.parametros ?? {}) as RigidPrintedConfig;
      setConfig(params);
      setCaras(params.carasDefault ?? "simple_faz");
      const tipos = params.tiposImpresion ?? [];
      if (tipos.length > 0 && !tipos.includes(tipoImpresion)) {
        setTipoImpresion(tipos[0]);
      }
    } catch (err) {
      console.error(err);
      toast.error("Error al cargar configuración.");
    } finally {
      setLoading(false);
    }
  }, [props.producto.id]);

  React.useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  // Pre-fill from selected variant
  React.useEffect(() => {
    const v = props.selectedVariant;
    if (v && Number(v.anchoMm) > 0 && Number(v.altoMm) > 0) {
      setAnchoMm(Number(v.anchoMm));
      setAltoMm(Number(v.altoMm));
    }
  }, [props.selectedVariant]);

  const handleCotizar = React.useCallback(async () => {
    const activeVariant = props.selectedVariant ?? props.variantes.find((v) => v.activo) ?? props.variantes[0];
    if (!activeVariant) {
      toast.error("El producto no tiene una variante activa.");
      return;
    }
    if (anchoMm <= 0 || altoMm <= 0) {
      toast.error("Ingresá ancho y alto de pieza.");
      return;
    }

    try {
      setQuoting(true);
      const result = await cotizarProductoVariante(activeVariant.id, {
        cantidad,
        parametros: {
          anchoMm,
          altoMm,
          tipoImpresion,
          caras,
        },
      });
      setQuoteResult(result as unknown as QuoteResult);
      toast.success("Cotización calculada.");
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Error al cotizar.");
      setQuoteResult(null);
    } finally {
      setQuoting(false);
    }
  }, [props.selectedVariant, props.variantes, anchoMm, altoMm, cantidad, tipoImpresion, caras]);

  if (loading) {
    return <GdiSpinner />;
  }

  const tiposDisponibles = config?.tiposImpresion ?? [];
  const carasDisponibles = config?.carasDisponibles ?? ["simple_faz"];

  return (
    <div className="space-y-6">
      <ProductoTabSection
        title="Simular costo"
        description="Ingresá los parámetros para cotizar el producto."
      >
        <div className="space-y-4">
          <div className="flex gap-4 items-end flex-wrap">
            <div>
              <Label>Ancho pieza (cm)</Label>
              <Input type="number" className="mt-1 w-28"
                value={anchoMm ? anchoMm / 10 : ""}
                onChange={(e) => { setAnchoMm(Math.round((Number(e.target.value) || 0) * 10)); setQuoteResult(null); }} />
            </div>
            <div>
              <Label>Alto pieza (cm)</Label>
              <Input type="number" className="mt-1 w-28"
                value={altoMm ? altoMm / 10 : ""}
                onChange={(e) => { setAltoMm(Math.round((Number(e.target.value) || 0) * 10)); setQuoteResult(null); }} />
            </div>
            <div>
              <Label>Cantidad</Label>
              <Input type="number" className="mt-1 w-24" value={cantidad}
                onChange={(e) => { setCantidad(Math.max(1, Number(e.target.value) || 1)); setQuoteResult(null); }} />
            </div>
          </div>

          <div className="flex gap-4 items-end flex-wrap">
            {tiposDisponibles.length > 1 && (
              <div>
                <Label>Tipo de impresión</Label>
                <Select value={tipoImpresion} onValueChange={(v) => { if (v) setTipoImpresion(v); setQuoteResult(null); }}>
                  <SelectTrigger className="mt-1 w-56"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {tiposDisponibles.map((t) => (
                      <SelectItem key={t} value={t}>{TIPO_IMPRESION_LABELS[t] ?? t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {carasDisponibles.length > 1 && (
              <div>
                <Label>Caras</Label>
                <Select value={caras} onValueChange={(v) => { if (v) setCaras(v); setQuoteResult(null); }}>
                  <SelectTrigger className="mt-1 w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {carasDisponibles.map((c) => (
                      <SelectItem key={c} value={c}>{CARAS_LABELS[c] ?? c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <Button onClick={handleCotizar} disabled={quoting || anchoMm <= 0 || altoMm <= 0}>
              {quoting ? <><Loader2Icon className="h-4 w-4 animate-spin mr-1" /> Cotizando...</> : "Cotizar"}
            </Button>
          </div>
        </div>
      </ProductoTabSection>

      {quoteResult && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Material */}
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm">Material rígido</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 px-4 pb-3 space-y-1 text-sm">
              {quoteResult.bloques.materiales.map((mat, i) => (
                <div key={i} className="flex justify-between">
                  <span className="text-muted-foreground">{mat.nombre} ({mat.cantidad} placa{mat.cantidad !== 1 ? "s" : ""})</span>
                  <span className="font-medium">${mat.costoTotal.toLocaleString("es-AR", { minimumFractionDigits: 2 })}</span>
                </div>
              ))}
              {quoteResult.trazabilidad.resumenTecnico && (
                <>
                  <hr className="my-1" />
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Piezas/placa</span>
                    <span>{quoteResult.trazabilidad.resumenTecnico.piezasPorPlaca}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Aprovechamiento</span>
                    <span>{quoteResult.trazabilidad.resumenTecnico.aprovechamientoPct}%</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Estrategia</span>
                    <span>{ESTRATEGIA_LABELS[quoteResult.trazabilidad.estrategiaCosteo] ?? quoteResult.trazabilidad.estrategiaCosteo}</span>
                  </div>
                  {quoteResult.trazabilidad.costeoDetalle.ultimaPlaca && (
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Última placa</span>
                      <span>
                        {quoteResult.trazabilidad.costeoDetalle.ultimaPlaca.ocupacionPct}%
                        {quoteResult.trazabilidad.costeoDetalle.ultimaPlaca.segmentoAplicado != null &&
                          ` → cobra ${quoteResult.trazabilidad.costeoDetalle.ultimaPlaca.segmentoAplicado}%`}
                      </span>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Procesos */}
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm">Procesos</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 px-4 pb-3 space-y-1 text-sm">
              {quoteResult.bloques.procesos.length > 0 ? (
                quoteResult.bloques.procesos.map((p, i) => (
                  <div key={i} className="flex justify-between">
                    <span className="text-muted-foreground">{p.nombre}</span>
                    <span>${p.costo.toLocaleString("es-AR", { minimumFractionDigits: 2 })}</span>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground text-xs">Sin procesos configurados.</p>
              )}
              {quoteResult.trazabilidad.multiplicadorCaras > 1 && (
                <>
                  <hr className="my-1" />
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Multiplicador doble faz</span>
                    <span>×{quoteResult.trazabilidad.multiplicadorCaras}</span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Total */}
          <Card className="border-primary">
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm">Total</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 px-4 pb-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Material</span>
                <span>${quoteResult.subtotales.material.toLocaleString("es-AR", { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Procesos</span>
                <span>${quoteResult.subtotales.procesos.toLocaleString("es-AR", { minimumFractionDigits: 2 })}</span>
              </div>
              <hr className="my-1" />
              <div className="flex justify-between font-bold text-base">
                <span>Costo total</span>
                <span>${quoteResult.total.toLocaleString("es-AR", { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Unitario</span>
                <span>${quoteResult.unitario.toLocaleString("es-AR", { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex gap-1.5 mt-2 flex-wrap">
                <Badge variant="outline" className="text-[10px]">
                  {TIPO_IMPRESION_LABELS[quoteResult.trazabilidad.tipoImpresion] ?? quoteResult.trazabilidad.tipoImpresion}
                </Badge>
                <Badge variant="outline" className="text-[10px]">
                  {CARAS_LABELS[quoteResult.trazabilidad.caras] ?? quoteResult.trazabilidad.caras}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

const ESTRATEGIA_LABELS: Record<string, string> = {
  m2_exacto: "M² exacto",
  largo_consumido: "Largo consumido",
  segmentos_placa: "Segmentos de placa",
};
