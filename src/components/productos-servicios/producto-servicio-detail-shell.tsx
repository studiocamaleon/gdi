"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { toast } from "sonner";

import type {
  ProductDetailViewProps,
  ProductMotorUiContract,
  ProductTabKey,
  ProductTabProps,
} from "@/components/productos-servicios/product-detail-types";
import { digitalMotorUi } from "@/components/productos-servicios/motors/digital.motor-ui";
import { ProductoGeneralTab } from "@/components/productos-servicios/producto-general-tab";
import { ProductoPrecioTab } from "@/components/productos-servicios/producto-precio-tab";
import { ProductoRutaBaseTab } from "@/components/productos-servicios/producto-ruta-base-tab";
import { ProductoSimularVentaTab } from "@/components/productos-servicios/producto-simular-venta-tab";
import { ProductoRutaOpcionalesPlaceholder, ProductoStandardTabPlaceholder } from "@/components/productos-servicios/producto-standard-tab-placeholder";
import { ProductoVariantesTab } from "@/components/productos-servicios/producto-variantes-tab";
import { vinylCutMotorUi } from "@/components/productos-servicios/motors/vinyl-cut.motor-ui";
import { wideFormatMotorUi } from "@/components/productos-servicios/motors/wide-format.motor-ui";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getProductoMotorConfig,
  getProductoServicio,
  getProductoVariantes,
} from "@/lib/productos-servicios-api";
import type { ProductoMotorConfig, ProductoServicio, ProductoVariante } from "@/lib/productos-servicios";

const STANDARD_TABS: Array<{ value: ProductTabKey; label: string }> = [
  { value: "general", label: "General" },
  { value: "variantes", label: "Variantes" },
  { value: "ruta_base", label: "Ruta base" },
  { value: "ruta_opcionales", label: "Ruta de opcionales" },
  { value: "imposicion", label: "Imposición" },
  { value: "simular_costo", label: "Simular costo" },
  { value: "precio", label: "Precio" },
  { value: "simular_venta", label: "Simular venta" },
];

const STANDARD_TABS_BY_KEY = new Map(STANDARD_TABS.map((tab) => [tab.value, tab]));

const productUiRegistry: Record<string, ProductMotorUiContract> = {
  "impresion_digital_laser@1": digitalMotorUi,
  "gran_formato@1": wideFormatMotorUi,
  "vinilo_de_corte@1": vinylCutMotorUi,
};

function ProductTabFallback({ title }: { title: string }) {
  return (
    <ProductoStandardTabPlaceholder
      title={title}
      description="Este motor todavía no expone una implementación propia para este tab en el shell unificado."
    />
  );
}

function buildCommonTabRenderer(tab: ProductTabKey): React.ComponentType<ProductTabProps> {
  if (tab === "general") return ProductoGeneralTab;
  if (tab === "variantes") return ProductoVariantesTab;
  if (tab === "ruta_base") return ProductoRutaBaseTab;
  if (tab === "ruta_opcionales") return ProductoRutaOpcionalesPlaceholder;
  if (tab === "precio") return ProductoPrecioTab;
  if (tab === "simular_venta") return ProductoSimularVentaTab;
  return () => <ProductTabFallback title={STANDARD_TABS.find((item) => item.value === tab)?.label ?? "Tab"} />;
}

function UnifiedProductDetailShell(props: ProductDetailViewProps) {
  const [producto, setProducto] = React.useState<ProductoServicio>(props.producto);
  const [variantes, setVariantes] = React.useState<ProductoVariante[]>(props.initialVariantes);
  const [motorConfig, setMotorConfig] = React.useState<ProductoMotorConfig | null>(null);
  const activeVariant = variantes.find((item) => item.activo) ?? variantes[0] ?? null;
  const [selectedVariantId, setSelectedVariantId] = React.useState(activeVariant?.id ?? "");

  React.useEffect(() => {
    setProducto(props.producto);
  }, [props.producto]);

  React.useEffect(() => {
    setVariantes(props.initialVariantes);
  }, [props.initialVariantes]);

  React.useEffect(() => {
    if (!selectedVariantId && activeVariant?.id) {
      setSelectedVariantId(activeVariant.id);
    }
  }, [activeVariant?.id, selectedVariantId]);

  React.useEffect(() => {
    let cancelled = false;
    getProductoMotorConfig(props.producto.id)
      .then((result) => {
        if (!cancelled) setMotorConfig(result);
      })
      .catch((error) => {
        console.error(error);
      });
    return () => {
      cancelled = true;
    };
  }, [props.producto.id]);

  const refreshProducto = React.useCallback(async () => {
    try {
      const result = await getProductoServicio(props.producto.id);
      setProducto(result);
      return result;
    } catch (error) {
      console.error(error);
      toast.error("No se pudo refrescar el producto.");
      return null;
    }
  }, [props.producto.id]);

  const refreshVariantes = React.useCallback(async () => {
    try {
      const result = await getProductoVariantes(props.producto.id);
      setVariantes(result);
      return result;
    } catch (error) {
      console.error(error);
      toast.error("No se pudieron refrescar las variantes.");
      return [];
    }
  }, [props.producto.id]);

  const refreshMotorConfig = React.useCallback(async () => {
    try {
      const result = await getProductoMotorConfig(props.producto.id);
      setMotorConfig(result);
      return result;
    } catch (error) {
      console.error(error);
      toast.error("No se pudo refrescar la configuración del motor.");
      return null;
    }
  }, [props.producto.id]);

  const selectedVariant = variantes.find((item) => item.id === selectedVariantId) ?? activeVariant ?? null;
  const motorKey = `${producto.motorCodigo}@${producto.motorVersion}`;
  const motorUi = productUiRegistry[motorKey] ?? null;
  const extraTabs = motorUi?.extraTabs ?? [];
  const hiddenTabs = new Set(motorUi?.hiddenTabs ?? []);
  const defaultVisibleStandardTabs = STANDARD_TABS.filter((tab) => !hiddenTabs.has(tab.value));
  const orderedTabs = (() => {
    const order = motorUi?.tabOrder;
    if (!order?.length) {
      return [
        ...defaultVisibleStandardTabs.map((tab) => ({
          key: tab.value,
          label: tab.label,
          isStandard: true as const,
        })),
        ...extraTabs.map((tab) => ({
          key: tab.key,
          label: tab.label,
          isStandard: false as const,
        })),
      ];
    }

    const extraTabsByKey = new Map(extraTabs.map((tab) => [tab.key, tab]));
    const resolved: Array<{ key: string; label: string; isStandard: boolean }> = [];
    for (const key of order) {
      const standard = STANDARD_TABS_BY_KEY.get(key as ProductTabKey);
      if (standard && !hiddenTabs.has(standard.value)) {
        resolved.push({ key: standard.value, label: standard.label, isStandard: true });
        continue;
      }
      const extra = extraTabsByKey.get(key);
      if (extra) {
        resolved.push({ key: extra.key, label: extra.label, isStandard: false });
      }
    }
    for (const tab of defaultVisibleStandardTabs) {
      if (!resolved.some((item) => item.key === tab.value)) {
        resolved.push({ key: tab.value, label: tab.label, isStandard: true });
      }
    }
    for (const tab of extraTabs) {
      if (!resolved.some((item) => item.key === tab.key)) {
        resolved.push({ key: tab.key, label: tab.label, isStandard: false });
      }
    }
    return resolved;
  })();

  const commonTabProps: ProductTabProps = {
    ...props,
    producto,
    variantes,
    selectedVariantId,
    selectedVariant,
    setSelectedVariantId,
    motorConfig,
    refreshProducto,
    refreshVariantes,
    refreshMotorConfig,
  };

  return (
    <div className="flex flex-col gap-4">
      <Button
        variant="sidebar"
        nativeButton={false}
        size="sm"
        className="w-fit"
        render={<Link href="/costos/productos-servicios" />}
      >
        <ArrowLeftIcon data-icon="inline-start" />
        Volver a productos
      </Button>

      <Tabs defaultValue="general" className="flex flex-col gap-4">
      <TabsList className="h-auto gap-1 rounded-lg bg-muted/70 p-1.5">
        {orderedTabs.map((tab) => (
          <TabsTrigger key={tab.key} value={tab.key}>
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>

      {orderedTabs.map((tab) => {
        if (tab.isStandard) {
          const key = tab.key as ProductTabKey;
          const Renderer = motorUi?.tabs[key] ?? buildCommonTabRenderer(key);
          return (
            <TabsContent key={tab.key} value={tab.key}>
              <Renderer {...commonTabProps} />
            </TabsContent>
          );
        }
        const extraTab = extraTabs.find((item) => item.key === tab.key);
        if (!extraTab) return null;
        const Renderer = extraTab.render;
        return (
          <TabsContent key={tab.key} value={tab.key}>
            <Renderer {...commonTabProps} />
          </TabsContent>
        );
      })}
      </Tabs>
    </div>
  );
}

export function ProductoServicioDetailShell(props: ProductDetailViewProps) {
  const motorKey = `${props.producto.motorCodigo}@${props.producto.motorVersion}`;

  if (productUiRegistry[motorKey]) {
    return <UnifiedProductDetailShell {...props} />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Motor no disponible en la UI</CardTitle>
        <CardDescription>
          El producto tiene asignado un motor que todavía no cuenta con una vista de detalle específica.
        </CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        Motor detectado: {motorKey}
      </CardContent>
    </Card>
  );
}
