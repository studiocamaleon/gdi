"use client";

import type { ComponentType } from "react";
import type { ClienteDetalle } from "@/lib/clientes";
import type { MateriaPrima } from "@/lib/materias-primas";
import type { Maquina } from "@/lib/maquinaria";
import type { Proceso, ProcesoOperacionPlantilla } from "@/lib/procesos";
import type {
  FamiliaProducto,
  MotorCostoCatalogItem,
  ProductoComisionCatalogo,
  ProductoChecklist,
  ProductoImpuestoCatalogo,
  ProductoMotorConfig,
  ProductoServicio,
  ProductoVariante,
  SubfamiliaProducto,
} from "@/lib/productos-servicios";

export type ProductTabKey =
  | "general"
  | "variantes"
  | "imposicion"
  | "ruta_base"
  | "simular_costo"
  | "precio"
  | "simular_venta";

export type ProductDetailViewProps = {
  producto: ProductoServicio;
  initialVariantes: ProductoVariante[];
  initialClientes: ClienteDetalle[];
  initialImpuestosCatalogo: ProductoImpuestoCatalogo[];
  initialComisionesCatalogo: ProductoComisionCatalogo[];
  procesos: Proceso[];
  plantillasPaso: ProcesoOperacionPlantilla[];
  materiasPrimas: MateriaPrima[];
  familias: FamiliaProducto[];
  subfamilias: SubfamiliaProducto[];
  motores: MotorCostoCatalogItem[];
  checklist: ProductoChecklist;
  maquinas: Maquina[];
};

export type ProductTabProps = ProductDetailViewProps & {
  producto: ProductoServicio;
  variantes: ProductoVariante[];
  selectedVariantId: string;
  selectedVariant: ProductoVariante | null;
  setSelectedVariantId: (value: string) => void;
  motorConfig: ProductoMotorConfig | null;
  refreshProducto: () => Promise<ProductoServicio | null>;
  refreshVariantes: () => Promise<ProductoVariante[]>;
  refreshMotorConfig: () => Promise<ProductoMotorConfig | null>;
};

export type ProductMotorUiContract = {
  key: string;
  tabs: Partial<Record<ProductTabKey, ComponentType<ProductTabProps>>>;
  tabOrder?: Array<ProductTabKey | string>;
  hiddenTabs?: ProductTabKey[] | ((motorConfig: ProductoMotorConfig | null) => ProductTabKey[]);
  extraTabs?: Array<{
    key: string;
    label: string;
    render: ComponentType<ProductTabProps>;
  }>;
};
