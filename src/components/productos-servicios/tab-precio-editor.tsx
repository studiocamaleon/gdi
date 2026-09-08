"use client";

import * as React from "react";
import { useConfigRegional } from "@/components/navigation/config-regional-provider";
import { PlusIcon, Trash2Icon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { HumanSelect, optionFromLabel } from "@/components/ui/human-select";
import { Input } from "@/components/ui/input";
import { LabelConTooltip } from "@/components/ui/label-con-tooltip";
import { Switch } from "@/components/ui/switch";
import { getLabel, metodoPrecioLabels } from "@/lib/labels-humanos";
import pricingStyles from "./pricing-visual.module.css";

export type MetodoPrecio =
  | "por_margen"
  | "precio_fijo"
  | "precio_fijo_para_margen_minimo"
  | "margen_variable"
  | "fijado_por_cantidad"
  | "fijo_con_margen_variable"
  | "variable_por_cantidad";

export type EstrategiaPricingCompuesto =
  | "GENERAL"
  | "POR_COMPONENTE"
  | "MIXTO";

export interface TabPrecioConfig {
  metodoCalculo: MetodoPrecio;
  detalle: Record<string, unknown>;
  compuesto?: {
    version: 1;
    estrategia: EstrategiaPricingCompuesto;
  };
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
  const compuesto = config?.compuesto;
  const metadataCompuesto =
    compuesto?.version === 1 &&
    (["GENERAL", "POR_COMPONENTE", "MIXTO"] as const).includes(
      compuesto.estrategia,
    )
      ? { compuesto }
      : {};
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
      ...metadataCompuesto,
    };
  }

  return {
    metodoCalculo: metodo,
    detalle: cleanForCompare(detalle) as Record<string, unknown>,
    ...metadataCompuesto,
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
  const { moneda } = useConfigRegional();
  const fieldId = React.useId();
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
    <div className={pricingStyles.methodShell}>
      <FieldGroup className={pricingStyles.methodSelector}>
        <Field>
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
          <FieldDescription>{metodoLabel.descripcion}</FieldDescription>
        </Field>
      </FieldGroup>

      <FieldGroup className={pricingStyles.methodFields}>
        {metodo === "por_margen" && (
          <Field>
            <FieldLabel htmlFor={`${fieldId}-margen-objetivo`}>Margen objetivo (%)</FieldLabel>
            <Input
              id={`${fieldId}-margen-objetivo`}
              type="number"
              value={(detalle.marginPct as number) ?? 0}
              onChange={(e) => updateDetalleField("marginPct", Number(e.target.value))}
            />
            <FieldDescription>
              Preserva este margen sobre el precio neto después de costos internos y comisiones.
            </FieldDescription>
          </Field>
        )}

        {metodo === "precio_fijo" && (
          <Field>
            <FieldLabel htmlFor={`${fieldId}-precio-fijo`}>
              Precio fijo ({precioPorUnidadLabel})
            </FieldLabel>
            <Input
              id={`${fieldId}-precio-fijo`}
              type="number"
              value={(detalle.price as number) ?? 0}
              onChange={(e) => updateDetalleField("price", Number(e.target.value))}
            />
          </Field>
        )}

        {metodo === "precio_fijo_para_margen_minimo" && (
          <FieldGroup className={pricingStyles.fieldGrid}>
            <Field>
              <FieldLabel htmlFor={`${fieldId}-precio-base`}>Precio base</FieldLabel>
              <Input
                id={`${fieldId}-precio-base`}
                type="number"
                value={(detalle.price as number) ?? 0}
                onChange={(e) => updateDetalleField("price", Number(e.target.value))}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={`${fieldId}-margen-minimo`}>
                Margen mínimo objetivo (%)
              </FieldLabel>
              <Input
                id={`${fieldId}-margen-minimo`}
                type="number"
                value={(detalle.minimumMarginPct as number) ?? 0}
                onChange={(e) =>
                  updateDetalleField("minimumMarginPct", Number(e.target.value))
                }
              />
            </Field>
            <FieldDescription className="col-span-full">
              Si el precio base no preserva el mínimo, el sistema lo ajusta hacia arriba.
            </FieldDescription>
          </FieldGroup>
        )}

        {usaPrecioConfigurado && (
          <Field orientation="horizontal" className={pricingStyles.switchField}>
            <Switch
              id={`${fieldId}-incluye-iva`}
              checked={(detalle.precioIncluyeIva ?? true) !== false}
              onCheckedChange={(checked) =>
                onChange({
                  metodoCalculo: metodo,
                  detalle: { ...detalle, precioIncluyeIva: checked },
                })
              }
            />
            <FieldContent>
              <FieldLabel htmlFor={`${fieldId}-incluye-iva`}>El precio incluye IVA</FieldLabel>
              <FieldDescription>
                Activado: el importe cargado es final. Desactivado: es neto y el IVA se suma.
              </FieldDescription>
            </FieldContent>
          </Field>
        )}

        {usaTiers && (
          <Card className={pricingStyles.tierCard}>
            <CardHeader className={pricingStyles.tierHeader}>
              <CardTitle>Tramos comerciales</CardTitle>
              <CardDescription>
                Ordená la regla que se aplicará según la cantidad solicitada.
              </CardDescription>
              <CardAction>
                <Button onClick={addTier} variant="outline" size="sm">
                  <PlusIcon data-icon="inline-start" />
                  Agregar tramo
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent className={pricingStyles.tierContent}>
              {tiers.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  Agregá el primer tramo para completar esta regla.
                </p>
              ) : null}

              <div className={pricingStyles.tierRows}>
                {tiers.map((tier, idx) => (
                  <div key={tier.uiKey} className={pricingStyles.tierRow}>
                    <Badge variant="secondary">#{idx + 1}</Badge>

                    {(metodo === "margen_variable" ||
                      metodo === "variable_por_cantidad") && (
                      <>
                        <span className={pricingStyles.tierText}>Hasta</span>
                        <Input
                          aria-label={`Límite del tramo ${idx + 1}`}
                          type="number"
                          value={tier.quantityUntil ?? 0}
                          onChange={(e) =>
                            updateTier(idx, { quantityUntil: Number(e.target.value) })
                          }
                        />
                        <span className={pricingStyles.tierText}>{unidadLabel} →</span>
                      </>
                    )}

                    {(metodo === "fijado_por_cantidad" ||
                      metodo === "fijo_con_margen_variable") && (
                      <>
                        <span className={pricingStyles.tierText}>Cantidad</span>
                        <Input
                          aria-label={`Cantidad del tramo ${idx + 1}`}
                          type="number"
                          value={tier.quantity ?? 0}
                          onChange={(e) =>
                            updateTier(idx, { quantity: Number(e.target.value) })
                          }
                        />
                        <span className={pricingStyles.tierText}>→</span>
                      </>
                    )}

                    {(metodo === "margen_variable" ||
                      metodo === "fijo_con_margen_variable") && (
                      <>
                        <Input
                          aria-label={`Margen del tramo ${idx + 1}`}
                          type="number"
                          value={tier.marginPct ?? 0}
                          onChange={(e) =>
                            updateTier(idx, { marginPct: Number(e.target.value) })
                          }
                        />
                        <span className={pricingStyles.tierText}>% margen objetivo</span>
                      </>
                    )}

                    {(metodo === "variable_por_cantidad" ||
                      metodo === "fijado_por_cantidad") && (
                      <>
                        <span className={pricingStyles.tierText}>{moneda.simbolo}</span>
                        <Input
                          aria-label={`Precio del tramo ${idx + 1}`}
                          type="number"
                          value={tier.price ?? 0}
                          onChange={(e) =>
                            updateTier(idx, { price: Number(e.target.value) })
                          }
                        />
                        <span className={pricingStyles.tierText}>{precioPorUnidadLabel}</span>
                      </>
                    )}

                    <span className={pricingStyles.tierGrow} />
                    <Button
                      aria-label={`Eliminar tramo ${idx + 1}`}
                      variant="destructive"
                      size="icon-sm"
                      onClick={() => removeTier(idx)}
                    >
                      <Trash2Icon />
                    </Button>
                  </div>
                ))}
              </div>

              <p className="mt-3 text-xs text-muted-foreground">
                {metodo === "margen_variable" &&
                  `Cada tramo aplica si la cantidad en ${unidadLabel} es menor o igual al límite.`}
                {metodo === "variable_por_cantidad" &&
                  "Cada rango de cantidad define un precio fijo distinto."}
                {metodo === "fijado_por_cantidad" &&
                  "Sólo se permiten las cantidades exactas listadas."}
                {metodo === "fijo_con_margen_variable" &&
                  "Cada cantidad exacta conserva su propio margen objetivo."}
              </p>
            </CardContent>
          </Card>
        )}
      </FieldGroup>
    </div>
  );
}
