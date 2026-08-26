"use client";
import * as React from "react";
import { StarIcon } from "lucide-react";
import {
  simularFidelizacion,
  type FidelizacionSimulacion,
} from "@/lib/fidelizacion-api";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { formatearMoneda, type Moneda } from "@/lib/moneda";

export function FidelizacionCotizador({
  clienteId,
  margen,
  total,
  moneda,
  value,
  onChange,
  onSimulation,
}: {
  clienteId: string;
  margen: number;
  total: number;
  moneda: Moneda;
  value: number;
  onChange: (puntos: number) => void;
  onSimulation?: (simulacion: FidelizacionSimulacion | null) => void;
}) {
  const [sim, setSim] = React.useState<FidelizacionSimulacion | null>(null);
  React.useEffect(() => {
    if (!clienteId) return;
    const timer = window.setTimeout(() => {
      void simularFidelizacion(clienteId, { margen, total, canjePuntos: value })
        .then((resultado) => {
          setSim(resultado);
          onSimulation?.(resultado);
        })
        .catch(() => {
          setSim(null);
          onSimulation?.(null);
        });
    }, 200);
    return () => window.clearTimeout(timer);
  }, [clienteId, margen, total, value, onChange, onSimulation]);
  if (!clienteId) return null;
  if (!sim || (!sim.acumulacionActiva && sim.saldoDisponible <= 0)) return null;
  const money = (amount: number) => formatearMoneda(amount, moneda);
  const tieneSaldo = sim.saldoDisponible > 0;
  const puedeCanjear = tieneSaldo && sim.maximoCanjeable > 0;
  const marcas = Array.from(
    new Set(
      [0, 0.25, 0.5, 0.75, 1].map((ratio) =>
        Math.floor(sim.maximoCanjeable * ratio),
      ),
    ),
  );
  const puntosQueSuma = value > 0 ? 0 : sim.puntosEstimados;
  const montoQueSuma = value > 0 ? 0 : sim.puntosEstimadosMonto;
  const descripcionAcumulacion =
    value > 0
      ? "Esta orden no suma puntos al canjear"
      : sim.acumulacionActiva && puntosQueSuma > 0
        ? `Suma +${puntosQueSuma} ptos al completar y cobrar`
        : "Esta orden no suma puntos";
  return (
    <div className="pt-2">
      <Card size="sm" className="gap-0 py-0">
        <CardContent className="grid gap-4 py-4 md:grid-cols-[minmax(245px,auto)_1px_minmax(390px,1fr)_1px_minmax(150px,auto)] md:items-center md:gap-5">
          <div className="flex min-w-0 items-center gap-3">
            <Badge
              variant="outline"
              className="size-9 rounded-lg border-emerald-200 bg-emerald-50 p-0 text-emerald-700 [&>svg]:size-4!"
              aria-hidden="true"
            >
              <StarIcon />
            </Badge>
            <div className="flex min-w-0 flex-col gap-1">
              <h2 className="text-sm font-semibold">
                Fidelización ·{" "}
                {tieneSaldo
                  ? `${sim.saldoDisponible} ptos · ${money(sim.saldoDisponibleMonto)}`
                  : "sin saldo todavía"}
              </h2>
              <p className="text-xs text-muted-foreground">
                {tieneSaldo
                  ? descripcionAcumulacion
                  : "Esta orden es la primera que acumula"}
              </p>
            </div>
          </div>

          <Separator orientation="vertical" className="hidden md:block" />

          {tieneSaldo ? (
            <Field className="gap-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <FieldLabel htmlFor="canje-puntos">
                  Canjear {sim.canjePuntos} ptos de {sim.saldoDisponible}{" "}
                  disponibles
                </FieldLabel>
                <span className="text-xs text-muted-foreground">
                  Máximo canjeable · {sim.maximoCanjeable} ptos
                </span>
              </div>
              <Slider
                id="canje-puntos"
                aria-label="Puntos a canjear"
                min={0}
                max={Math.max(1, sim.maximoCanjeable)}
                step={1}
                value={[Math.min(value, sim.maximoCanjeable)]}
                disabled={!puedeCanjear}
                onValueChange={(next) =>
                  onChange(typeof next === "number" ? next : (next[0] ?? 0))
                }
              />
              <FieldDescription className="flex justify-between font-mono text-[10px]">
                {marcas.map((marca) => (
                  <span key={marca}>{marca}</span>
                ))}
              </FieldDescription>
            </Field>
          ) : (
            <div className="flex items-baseline gap-2" aria-live="polite">
              <strong className="text-lg text-emerald-700">
                +{puntosQueSuma} ptos
              </strong>
              <span className="text-sm">
                equivalen a {money(montoQueSuma)} en la próxima orden
              </span>
            </div>
          )}

          <Separator orientation="vertical" className="hidden md:block" />

          {tieneSaldo ? (
            <div className="flex flex-col items-end gap-1 text-right">
              <strong
                className="font-mono text-2xl text-emerald-700"
                aria-live="polite"
              >
                −{money(sim.canjeMonto)}
              </strong>
              <span className="text-xs text-muted-foreground">
                Total: {money(total)} →{" "}
                <strong className="text-foreground">
                  {money(Math.max(0, total - sim.canjeMonto))}
                </strong>
              </span>
            </div>
          ) : (
            <Badge variant="outline" className="justify-self-end">
              Nada para canjear
            </Badge>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
