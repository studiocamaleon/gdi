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

export function TabPrecioEditor({ value, onChange }: Props) {
  const metodo = value.metodoCalculo;
  const detalle = value.detalle ?? {};

  const usaTiers =
    metodo === "margen_variable" ||
    metodo === "variable_por_cantidad" ||
    metodo === "fijado_por_cantidad" ||
    metodo === "fijo_con_margen_variable";

  const [tiers, setTiers] = React.useState<TierBase[]>(() => tiersFromDetalle(metodo, detalle));

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
    if (m === "por_margen") newDetalle = { marginPct: 100, minimumMarginPct: 50 };
    else if (m === "precio_fijo") newDetalle = { price: 0, minimumPrice: 0 };
    else if (m === "precio_fijo_para_margen_minimo")
      newDetalle = { price: 0, minimumPrice: 0, minimumMarginPct: 50 };
    else if (m === "margen_variable")
      newDetalle = { tiers: [{ quantityUntil: 100, marginPct: 100 }] };
    else if (m === "variable_por_cantidad")
      newDetalle = { tiers: [{ quantityUntil: 100, price: 0 }] };
    else if (m === "fijado_por_cantidad")
      newDetalle = { tiers: [{ quantity: 100, price: 0 }] };
    else if (m === "fijo_con_margen_variable")
      newDetalle = { tiers: [{ quantity: 100, marginPct: 100 }] };
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
          <Label>Margen (%)</Label>
          <Input
            type="number"
            value={(detalle.marginPct as number) ?? 0}
            onChange={(e) => updateDetalleField("marginPct", Number(e.target.value))}
          />
          <p className="text-muted-foreground text-xs">
            Precio = costo × (1 + margen/100). Margen 100% → precio = costo × 2.
          </p>
        </div>
      )}

      {metodo === "precio_fijo" && (
        <div className="space-y-2">
          <Label>Precio fijo (por unidad comercial)</Label>
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
            <Label>Margen mínimo (%)</Label>
            <Input
              type="number"
              value={(detalle.minimumMarginPct as number) ?? 0}
              onChange={(e) => updateDetalleField("minimumMarginPct", Number(e.target.value))}
            />
          </div>
          <p className="text-muted-foreground col-span-2 text-xs">
            Si el precio base no alcanza el margen mínimo sobre el costo, se ajusta hacia arriba
            automáticamente.
          </p>
        </div>
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
                      <span className="text-xs">unidades →</span>
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
                      <span className="text-xs">% margen</span>
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
                      <span className="text-xs">por unidad</span>
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
                "Cada tramo aplica si la cantidad es ≤ al límite. El último tramo cubre cantidades mayores."}
              {metodo === "variable_por_cantidad" &&
                "Idem rangos por cantidad pero con precio fijo en vez de margen."}
              {metodo === "fijado_por_cantidad" &&
                "Solo se permiten las cantidades exactas listadas. Si el comercial pide otra, error."}
              {metodo === "fijo_con_margen_variable" &&
                "Cantidades exactas con su margen. Mismo comportamiento que fijado_por_cantidad pero el precio se calcula desde el costo."}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
