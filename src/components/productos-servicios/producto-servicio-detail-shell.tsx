"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeftIcon,
  BanknoteIcon,
  BlocksIcon,
  CogIcon,
  FileTextIcon,
  Layers3Icon,
  NetworkIcon,
  RouteIcon,
  ScanSearchIcon,
  WrenchIcon,
} from "lucide-react";
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
import { cn } from "@/lib/utils";

type DetailTabGroup = "configuracion" | "comercial";
type DetailShellTab = {
  key: string;
  label: string;
  group: DetailTabGroup;
  icon: React.ComponentType<{ className?: string }>;
  isStandard: boolean;
};

const STANDARD_TABS: Array<{
  value: ProductTabKey;
  label: string;
  group: DetailTabGroup;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { value: "general", label: "General", group: "configuracion", icon: FileTextIcon },
  { value: "variantes", label: "Variantes", group: "configuracion", icon: Layers3Icon },
  { value: "ruta_base", label: "Ruta base", group: "configuracion", icon: RouteIcon },
  { value: "ruta_opcionales", label: "Ruta de opcionales", group: "configuracion", icon: NetworkIcon },
  { value: "imposicion", label: "Imposición", group: "configuracion", icon: BlocksIcon },
  { value: "simular_costo", label: "Simular costo", group: "comercial", icon: ScanSearchIcon },
  { value: "precio", label: "Precio", group: "comercial", icon: BanknoteIcon },
  { value: "simular_venta", label: "Simular venta", group: "comercial", icon: CogIcon },
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
  const [activeTab, setActiveTab] = React.useState("general");

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
  const orderedTabs: DetailShellTab[] = (() => {
    const order = motorUi?.tabOrder;
    if (!order?.length) {
      return [
        ...defaultVisibleStandardTabs.map((tab) => ({
          key: tab.value,
          label: tab.label,
          group: tab.group,
          icon: tab.icon,
          isStandard: true as const,
        })),
        ...extraTabs.map((tab) => ({
          key: tab.key,
          label: tab.label,
          group: "configuracion" as const,
          icon: WrenchIcon,
          isStandard: false as const,
        })),
      ];
    }

    const extraTabsByKey = new Map(extraTabs.map((tab) => [tab.key, tab]));
    const resolved: DetailShellTab[] = [];
    for (const key of order) {
      const standard = STANDARD_TABS_BY_KEY.get(key as ProductTabKey);
      if (standard && !hiddenTabs.has(standard.value)) {
        resolved.push({
          key: standard.value,
          label: standard.label,
          group: standard.group,
          icon: standard.icon,
          isStandard: true,
        });
        continue;
      }
      const extra = extraTabsByKey.get(key);
      if (extra) {
        resolved.push({
          key: extra.key,
          label: extra.label,
          group: "configuracion",
          icon: WrenchIcon,
          isStandard: false,
        });
      }
    }
    for (const tab of defaultVisibleStandardTabs) {
      if (!resolved.some((item) => item.key === tab.value)) {
        resolved.push({
          key: tab.value,
          label: tab.label,
          group: tab.group,
          icon: tab.icon,
          isStandard: true,
        });
      }
    }
    for (const tab of extraTabs) {
      if (!resolved.some((item) => item.key === tab.key)) {
        resolved.push({
          key: tab.key,
          label: tab.label,
          group: "configuracion",
          icon: WrenchIcon,
          isStandard: false,
        });
      }
    }
    return resolved;
  })();

  React.useEffect(() => {
    if (!orderedTabs.some((tab) => tab.key === activeTab)) {
      setActiveTab(orderedTabs[0]?.key ?? "general");
    }
  }, [activeTab, orderedTabs]);

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

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col gap-4">
      <div className="sticky top-0 z-20 overflow-hidden rounded-2xl border border-border/60 bg-[linear-gradient(135deg,rgba(234,241,248,0.92),rgba(247,250,253,0.98)_42%,rgba(255,255,255,0.98))] shadow-[0_14px_36px_-28px_rgba(15,23,42,0.45)] backdrop-blur supports-[backdrop-filter]:bg-[linear-gradient(135deg,rgba(234,241,248,0.8),rgba(247,250,253,0.92)_42%,rgba(255,255,255,0.94))]">
        <div className="absolute inset-y-0 left-0 w-24 bg-[linear-gradient(90deg,rgba(0,178,255,0.12),transparent)]" />
        <div className="absolute inset-y-0 right-0 w-28 bg-[linear-gradient(270deg,rgba(255,163,26,0.16),transparent)]" />
        <div className="relative flex min-h-16 items-center overflow-x-auto px-2 py-2 lg:min-h-[4.5rem] lg:overflow-visible lg:px-3 lg:py-3">
          <TabsList className="flex h-auto min-w-max items-center gap-1.5 rounded-none bg-transparent p-0 lg:w-full lg:min-w-0 lg:flex-wrap lg:content-center">
            {orderedTabs.map((tab, index) => {
              const Icon = tab.icon;
              const previousTab = orderedTabs[index - 1];
              const startsCommercialGroup =
                index > 0 && previousTab?.group !== tab.group && tab.group === "comercial";

              return (
                <React.Fragment key={tab.key}>
                  {startsCommercialGroup ? (
                    <div className="mx-1 hidden h-9 w-px self-center bg-gradient-to-b from-transparent via-border/80 to-transparent lg:block" />
                  ) : null}
                  <TabsTrigger
                    value={tab.key}
                    className={cn(
                      "h-auto min-h-10 shrink-0 rounded-xl border px-2.5 py-2 text-left lg:px-3",
                      "bg-white/62 text-foreground/72 transition-all duration-200",
                      "border-white/55 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]",
                      "hover:border-border/60 hover:bg-white/82 hover:text-foreground",
                      tab.group === "configuracion"
                        ? "data-active:border-sky-200/80"
                        : "data-active:border-amber-200/90",
                      "data-active:bg-white data-active:text-foreground",
                      "data-active:shadow-[0_10px_24px_-18px_rgba(15,23,42,0.7)]",
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className={cn(
                          "inline-flex size-6 items-center justify-center rounded-full border text-muted-foreground transition-colors",
                          tab.group === "configuracion"
                            ? "border-sky-200/80 bg-sky-50/80"
                            : "border-amber-200/80 bg-amber-50/80",
                          "group-data-[active]/tabs-trigger:border-transparent",
                        )}
                      >
                        <Icon className="size-3.5" />
                      </span>
                      <span className="text-[13px] font-medium leading-none lg:text-sm">{tab.label}</span>
                    </span>
                  </TabsTrigger>
                </React.Fragment>
              );
            })}
          </TabsList>
        </div>
      </div>

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
