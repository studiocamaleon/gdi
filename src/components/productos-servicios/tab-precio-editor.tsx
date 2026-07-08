"use client";

import * as React from "react";
import { PlusIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { HumanSelect, optionFromLabel } from "@/components/ui/human-select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LabelConTooltip } from "@/components/ui/label-con-tooltip";
import { getLabel, metodoPrecioLabels } from "@/lib/labels-humanos";

export type MetodoPrecio =
  | "por_margen"
  | "precio_fijo"
  | "precio_fijo_para_margen_minimo"
  | "margen_variable"
  | "fijado_por_cantidad"
  | "fijo_con_margen_variable"
  | "variable_por_cantidad";

export interface TabPrecioConfig {
  metodoCalculo: MetodoPrecio;
  detalle: Record<string, unknown>;
}

interface Props {
  value: TabPrecioConfig;
  onChange: (config: TabPrecioConfig) => void;
  unidadComercial?: string;
}

const METODOS: ReadonlyArray<{ value: MetodoPrecio }> = [
  { value: "por_margen" },
  { value: "precio_fijo" },
  { value: "precio_fijo_para_margen_minimo" },
  { value: "margen_variable" },
  { value: "fijado_por_cantidad" },
  { value: "fijo_con_margen_variable" },
  { value: "variable_por_cantidad" },
];

interface TierBase {
  uiKey: string;
  // según método:
  quantityUntil?: number;
  quantity?: number;
  price?: number;
  marginPct?: number;
}

function newKey() {
  return `tier-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function tiersFromDetalle(metodo: MetodoPrecio, detalle: Record<string, unknown>): TierBase[] {
  const arr = Array.isArray(detalle.tiers) ? (detalle.tiers as Array<Record<string, unknown>>) : [];
  return arr.map((t) => ({
    uiKey: newKey(),
    quantityUntil: typeof t.quantityUntil === "number" ? t.quantityUntil : undefined,
    quantity: typeof t.quantity === "number" ? t.quantity : undefined,
    price: typeof t.price === "number" ? t.price : undefined,
    marginPct: typeof t.marginPct === "number" ? t.marginPct : undefined,
  }));
}

function tiersToPayload(metodo: MetodoPrecio, tiers: TierBase[]): Array<Record<string, unknown>> {
  return tiers.map((t) => {
    if (metodo === "margen_variable") {
      return { quantityUntil: t.quantityUntil ?? 0, marginPct: t.marginPct ?? 0 };
    }
    if (metodo === "variable_por_cantidad") {
      return { quantityUntil: t.quantityUntil ?? 0, price: t.price ?? 0 };
    }
    if (metodo === "fijado_por_cantidad") {
      return { quantity: t.quantity ?? 0, price: t.price ?? 0 };
    }
    if (metodo === "fijo_con_margen_variable") {
      return { quantity: t.quantity ?? 0, marginPct: t.marginPct ?? 0 };
    }
    return {};
  });
}

function cleanForCompare(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(cleanForCompare);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, entry]) => [key, cleanForCompare(entry)]),
  );
}

export function normalizePrecioConfig(config: TabPrecioConfig | null | undefined): TabPrecioConfig {
  const metodo = config?.metodoCalculo ?? "por_margen";
  const detalle = config?.detalle ?? {};
  const usaTiers =
    metodo === "margen_variable" ||
    metodo === "variable_por_cantidad" ||
    metodo === "fijado_por_cantidad" ||
    metodo === "fijo_con_margen_variable";

  if (usaTiers) {
    return {
      metodoCalculo: metodo,
      detalle: {
        tiers: tiersToPayload(metodo, tiersFromDetalle(metodo, detalle)),
      },
    };
  }

  return {
    metodoCalculo: metodo,
    detalle: cleanForCompare(detalle) as Record<string, unknown>,
  };
}

export function precioConfigKey(config: TabPrecioConfig | null | undefined) {
  return JSON.stringify(cleanForCompare(normalizePrecioConfig(config)));
}

function labelUnidad(unidadComercial?: string) {
  if (unidadComercial === "m2") return "m²";
  if (unidadComercial === "metro_lineal") return "metros lineales";
  return "unidades";
}

function labelPrecioPorUnidad(unidadComercial?: string) {
  if (unidadComercial === "m2") return "por m²";
  if (unidadComercial === "metro_lineal") return "por metro lineal";
  return "por unidad";
}

export function TabPrecioEditor({ value, onChange, unidadComercial }: Props) {
  const metodo = value.metodoCalculo;
  const detalle = value.detalle ?? {};
  const unidadLabel = labelUnidad(unidadComercial);
  const precioPorUnidadLabel = labelPrecioPorUnidad(unidadComercial);

  const usaTiers =
    metodo === "margen_variable" ||
    metodo === "variable_por_cantidad" ||
    metodo === "fijado_por_cantidad" ||
    metodo === "fijo_con_margen_variable";

  // Métodos donde el usuario escribe un PRECIO (no un margen): ahí importa si
  // ese precio es final con IVA incluido o neto sin IVA.
  const usaPrecioConfigurado =
    metodo === "precio_fijo" ||
    metodo === "precio_fijo_para_margen_minimo" ||
    metodo === "variable_por_cantidad" ||
    metodo === "fijado_por_cantidad";

  const [tiers, setTiers] = React.useState<TierBase[]>(() => tiersFromDetalle(metodo, detalle));
  const didMountTiers = React.useRef(false);

  // Si cambia el método, sincronizar tiers (limpiar si pasamos a no-tier)
  const lastMetodo = React.useRef(metodo);
  React.useEffect(() => {
    if (lastMetodo.current !== metodo) {
      setTiers(tiersFromDetalle(metodo, value.detalle ?? {}));
      lastMetodo.current = metodo;
    }
  }, [metodo, value.detalle]);

  // Cuando cambian los tiers, propagar al padre
  React.useEffect(() => {
    if (!didMountTiers.current) {
      didMountTiers.current = true;
      return;
    }
    if (usaTiers) {
      onChange({
        metodoCalculo: metodo,
        detalle: { ...detalle, tiers: tiersToPayload(metodo, tiers) },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tiers]);

  const setMetodo = (m: MetodoPrecio) => {
    let newDetalle: Record<string, unknown> = {};
    if (m === "por_margen") newDetalle = { marginPct: 40, minimumMarginPct: 25 };
    else if (m === "precio_fijo") newDetalle = { price: 0, minimumPrice: 0 };
    else if (m === "precio_fijo_para_margen_minimo")
      newDetalle = { price: 0, minimumPrice: 0, minimumMarginPct: 25 };
    else if (m === "margen_variable")
      newDetalle = { tiers: [{ quantityUntil: 100, marginPct: 40 }] };
    else if (m === "variable_por_cantidad")
      newDetalle = { tiers: [{ quantityUntil: 100, price: 0 }] };
    else if (m === "fijado_por_cantidad")
      newDetalle = { tiers: [{ quantity: 100, price: 0 }] };
    else if (m === "fijo_con_margen_variable")
      newDetalle = { tiers: [{ quantity: 100, marginPct: 40 }] };
    onChange({ metodoCalculo: m, detalle: newDetalle });
  };

  const updateDetalleField = (campo: string, val: number) => {
    onChange({
      metodoCalculo: metodo,
      detalle: { ...detalle, [campo]: val },
    });
  };

  const addTier = () => {
    setTiers((prev) => [
      ...prev,
      {
        uiKey: newKey(),
        quantityUntil: 1000,
        quantity: 100,
        price: 0,
        marginPct: 50,
      },
    ]);
  };

  const updateTier = (idx: number, patch: Partial<TierBase>) => {
    setTiers((prev) => prev.map((t, i) => (i === idx ? { ...t, ...patch } : t)));
  };

  const removeTier = (idx: number) => {
    setTiers((prev) => prev.filter((_, i) => i !== idx));
  };

  const metodoLabel = getLabel(metodoPrecioLabels, metodo);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <LabelConTooltip
          label="Método de cálculo"
          tooltip={metodoLabel.descripcion}
          ejemplo={metodoLabel.ejemplo}
        />
        <HumanSelect
          value={metodo}
          onValueChange={(v) => setMetodo((v || "por_margen") as MetodoPrecio)}
          options={METODOS.map((m) => optionFromLabel(m.value, metodoPrecioLabels))}
        />
        <p className="text-muted-foreground text-xs">{metodoLabel.descripcion}</p>
      </div>

      {/* MÉTODOS SIMPLES */}
      {metodo === "por_margen" && (
        <div className="space-y-2">
          <Label>Margen objetivo (%)</Label>
          <Input
            type="number"
            value={(detalle.marginPct as number) ?? 0}
            onChange={(e) => updateDetalleField("marginPct", Number(e.target.value))}
          />
          <p className="text-muted-foreground text-xs">
            Calcula el precio neto (sin IVA) necesario para preservar ese margen,
            descontando los costos impositivos internos y comisiones.
          </p>
        </div>
      )}

      {metodo === "precio_fijo" && (
        <div className="space-y-2">
          <Label>Precio fijo ({precioPorUnidadLabel})</Label>
          <Input
            type="number"
            value={(detalle.price as number) ?? 0}
            onChange={(e) => updateDetalleField("price", Number(e.target.value))}
          />
        </div>
      )}

      {metodo === "precio_fijo_para_margen_minimo" && (
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-2">
            <Label>Precio base</Label>
            <Input
              type="number"
              value={(detalle.price as number) ?? 0}
              onChange={(e) => updateDetalleField("price", Number(e.target.value))}
            />
          </div>
          <div className="space-y-2">
            <Label>Margen mínimo objetivo (%)</Label>
            <Input
              type="number"
              value={(detalle.minimumMarginPct as number) ?? 0}
              onChange={(e) => updateDetalleField("minimumMarginPct", Number(e.target.value))}
            />
          </div>
          <p className="text-muted-foreground col-span-2 text-xs">
            Si el precio base no preserva el margen objetivo mínimo, se ajusta hacia arriba
            automáticamente.
          </p>
        </div>
      )}

      {usaPrecioConfigurado && (
        <label className="flex items-start gap-3 rounded-md border p-3 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={(detalle.precioIncluyeIva ?? true) !== false}
            onChange={(e) =>
              onChange({
                metodoCalculo: metodo,
                detalle: { ...detalle, precioIncluyeIva: e.target.checked },
              })
            }
          />
          <span className="space-y-1">
            <span className="block font-medium">El precio incluye IVA</span>
            <span className="text-muted-foreground block text-xs">
              Activado: el precio cargado es el total final (el neto se obtiene
              dividiendo por 1 + IVA). Desactivado: el precio cargado es el neto
              sin IVA y el IVA se suma aparte.
            </span>
          </span>
        </label>
      )}

      {/* MÉTODOS POR TRAMOS */}
      {usaTiers && (
        <Card className="bg-muted/30">
          <CardContent className="pt-4">
            <div className="mb-3 flex items-center justify-between">
              <Label>Tramos</Label>
              <Button onClick={addTier} variant="outline" size="sm">
                <PlusIcon className="mr-1 size-3" />
                Agregar tramo
              </Button>
            </div>

            {tiers.length === 0 && (
              <p className="text-muted-foreground py-4 text-center text-xs">
                Sin tramos. Agregá uno.
              </p>
            )}

            <div className="space-y-2">
              {tiers.map((tier, idx) => (
                <div key={tier.uiKey} className="bg-background flex items-center gap-2 rounded border p-2">
                  <span className="text-muted-foreground text-xs">#{idx + 1}</span>

                  {(metodo === "margen_variable" || metodo === "variable_por_cantidad") && (
                    <>
                      <span className="text-xs">Hasta</span>
                      <Input
                        type="number"
                        value={tier.quantityUntil ?? 0}
                        onChange={(e) =>
                          updateTier(idx, { quantityUntil: Number(e.target.value) })
                        }
                        className="h-8 w-24 text-xs"
                      />
                      <span className="text-xs">{unidadLabel} →</span>
                    </>
                  )}

                  {(metodo === "fijado_por_cantidad" || metodo === "fijo_con_margen_variable") && (
                    <>
                      <span className="text-xs">Cantidad</span>
                      <Input
                        type="number"
                        value={tier.quantity ?? 0}
                        onChange={(e) => updateTier(idx, { quantity: Number(e.target.value) })}
                        className="h-8 w-24 text-xs"
                      />
                      <span className="text-xs">→</span>
                    </>
                  )}

                  {(metodo === "margen_variable" || metodo === "fijo_con_margen_variable") && (
                    <>
                      <Input
                        type="number"
                        value={tier.marginPct ?? 0}
                        onChange={(e) => updateTier(idx, { marginPct: Number(e.target.value) })}
                        className="h-8 w-20 text-xs"
                      />
                      <span className="text-xs">% margen objetivo</span>
                    </>
                  )}

                  {(metodo === "variable_por_cantidad" || metodo === "fijado_por_cantidad") && (
                    <>
                      <span className="text-xs">$</span>
                      <Input
                        type="number"
                        value={tier.price ?? 0}
                        onChange={(e) => updateTier(idx, { price: Number(e.target.value) })}
                        className="h-8 w-24 text-xs"
                      />
                      <span className="text-xs">{precioPorUnidadLabel}</span>
                    </>
                  )}

                  <div className="flex-1" />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeTier(idx)}
                    className="h-7 w-7 p-0 text-red-600"
                  >
                    <XIcon className="size-3" />
                  </Button>
                </div>
              ))}
            </div>

            <p className="text-muted-foreground mt-3 text-xs">
              {metodo === "margen_variable" &&
                `Cada tramo aplica si la cantidad comercial en ${unidadLabel} es ≤ al límite. El último tramo cubre cantidades mayores.`}
              {metodo === "variable_por_cantidad" &&
                "Idem rangos por cantidad pero con precio fijo en vez de margen."}
              {metodo === "fijado_por_cantidad" &&
                "Solo se permiten las cantidades exactas listadas. Si el comercial pide otra, error."}
              {metodo === "fijo_con_margen_variable" &&
                "Cantidades exactas con margen objetivo. Mismo comportamiento que fijado_por_cantidad pero el precio se calcula desde el costo."}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
