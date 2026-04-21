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
import { ProductoImposicionTab } from "@/components/productos-servicios/producto-imposicion-tab";
import { ProductoRutaProduccionTab } from "@/components/productos-servicios/producto-ruta-produccion-tab";
import { ProductoSimularCostoTab } from "@/components/productos-servicios/producto-simular-costo-tab";
import { ProductoSimularVentaTab } from "@/components/productos-servicios/producto-simular-venta-tab";
import { ProductoStandardTabPlaceholder } from "@/components/productos-servicios/producto-standard-tab-placeholder";
import { ProductoVariantesTab } from "@/components/productos-servicios/producto-variantes-tab";
import { talonarioMotorUi } from "@/components/productos-servicios/motors/talonario.motor-ui";
import { vinylCutMotorUi } from "@/components/productos-servicios/motors/vinyl-cut.motor-ui";
import { rigidPrintedMotorUi } from "@/components/productos-servicios/motors/rigid-printed.motor-ui";
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
  { value: "ruta_produccion", label: "Ruta de producción", group: "configuracion", icon: RouteIcon },
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
  "talonario@1": talonarioMotorUi,
  "rigidos_impresos@1": rigidPrintedMotorUi,
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
  if (tab === "ruta_produccion") return ProductoRutaProduccionTab;
  if (tab === "imposicion") return ProductoImposicionTab;
  if (tab === "simular_costo") return ProductoSimularCostoTab;
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
  const hiddenTabsRaw = typeof motorUi?.hiddenTabs === "function"
    ? motorUi.hiddenTabs(motorConfig)
    : (motorUi?.hiddenTabs ?? []);
  const hiddenTabs = new Set(hiddenTabsRaw);
  // P3.a.2 — En modo LIBRE el producto no usa variantes (el cliente
  // ingresa medidas al cotizar). Esta regla vive en el shell ahora,
  // reemplazando los hardcodes motor-específicos.
  if (producto.modoMedidas === "LIBRE") {
    hiddenTabs.add("variantes");
  }
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

  const estadoMeta = (() => {
    const e = producto.estado as string;
    if (e === "ACTIVO" || e === "activo")
      return { label: "Activo", tone: "ok" as const };
    if (e === "BORRADOR" || e === "borrador")
      return { label: "Borrador", tone: "warn" as const };
    if (e === "ARCHIVADO" || e === "archivado")
      return { label: "Archivado", tone: "muted" as const };
    return { label: e, tone: "muted" as const };
  })();

  return (
    <div className="flex flex-col gap-5">
      {/* Pageback */}
      <Link
        href="/costos/productos"
        className="inline-flex w-fit items-center gap-2 rounded-full border border-line-hi px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.06em] text-ink-2 transition-colors hover:border-ink-3 hover:text-ink-0"
      >
        <ArrowLeftIcon className="size-3.5" />
        Volver a productos
      </Link>

      {/* Editorial header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="font-serif text-5xl font-normal leading-none tracking-[-0.02em] text-ink-0">
            {producto.nombre}
          </h1>
          <div className="mt-2.5 flex flex-wrap items-baseline gap-3 font-mono text-[11px] uppercase tracking-[0.08em] text-ink-3">
            <span>
              Código <span className="text-ink-1">{producto.codigo}</span>
            </span>
            <span className="text-line-hi">·</span>
            <span>
              Familia:{" "}
              <span className="text-ink-1">{producto.familiaProductoNombre}</span>
            </span>
            <span className="text-line-hi">·</span>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5",
                estadoMeta.tone === "ok"
                  ? "border-ok text-ok"
                  : estadoMeta.tone === "warn"
                    ? "border-warn text-warn"
                    : "border-line-hi text-ink-2",
              )}
            >
              <span
                className={cn(
                  "size-[5px] rounded-full",
                  estadoMeta.tone === "ok" &&
                    "bg-ok shadow-[0_0_8px_var(--ok)]",
                  estadoMeta.tone === "warn" && "bg-warn",
                  estadoMeta.tone === "muted" && "bg-ink-3",
                )}
              />
              {estadoMeta.label}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => toast.info("Duplicar producto — próximamente")}
          >
            Duplicar
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => toast.info("Archivar producto — próximamente")}
          >
            Archivar
          </Button>
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex flex-col gap-5"
      >
        <div className="sticky top-0 z-20 overflow-hidden rounded-[10px] border border-line bg-bg-1">
          <TabsList
            className="grid w-full gap-0 rounded-none bg-transparent p-0 !h-auto group-data-horizontal/tabs:h-auto"
            style={{
              gridTemplateColumns: `repeat(${orderedTabs.length}, minmax(0, 1fr))`,
            }}
          >
            {orderedTabs.map((tab, index) => {
              const Icon = tab.icon;
              const isLast = index === orderedTabs.length - 1;
              const num = String(index + 1).padStart(2, "0");
              return (
                <TabsTrigger
                  key={tab.key}
                  value={tab.key}
                  className={cn(
                    "group relative flex h-auto min-h-[68px] flex-col items-center justify-center gap-1 rounded-none px-2 py-3.5",
                    "border-0 bg-transparent text-ink-3 transition-colors",
                    !isLast && "border-r border-line",
                    "hover:bg-bg-2 hover:text-ink-1",
                    "data-[state=active]:bg-bg-2 data-[state=active]:text-ink-0",
                    "data-[state=active]:after:absolute data-[state=active]:after:bottom-0 data-[state=active]:after:left-0 data-[state=active]:after:right-0 data-[state=active]:after:h-[2px] data-[state=active]:after:bg-lime",
                  )}
                >
                  <Icon className="size-3.5 text-ink-3 transition-colors group-data-[state=active]:text-lime" />
                  <span className="text-xs leading-none tracking-[-0.01em]">
                    {tab.label}
                  </span>
                  <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-ink-4 group-data-[state=active]:text-lime">
                    {num}
                  </span>
                </TabsTrigger>
              );
            })}
          </TabsList>
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
