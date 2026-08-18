import type * as React from "react";
import {
  ActivityIcon,
  BriefcaseIcon,
  CircleDollarSignIcon,
  FactoryIcon,
  FilterIcon,
  HardHatIcon,
  LayoutGridIcon,
  PackageIcon,
  UsersIcon,
} from "lucide-react";

import type { PermisoClave } from "@/lib/permisos";

export type ReporteCategoria = "Ejecutivo" | "Comercial" | "Operaciones" | "Finanzas" | "Producto";

export type Reporte = {
  href: string;
  label: string;
  descripcion: string;
  categoria: ReporteCategoria;
  Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  /** Permiso extra sobre `reportes.ver`. Sin él, el reporte no se ofrece. */
  permiso?: PermisoClave;
};

export const CATEGORIAS_REPORTES: ReporteCategoria[] = [
  "Ejecutivo",
  "Comercial",
  "Operaciones",
  "Finanzas",
  "Producto",
];

export const REPORTES: Reporte[] = [
  {
    href: "/reportes/resumen",
    label: "Resumen ejecutivo",
    descripcion: "Ventas, rentabilidad, punto de equilibrio y alertas clave.",
    categoria: "Ejecutivo",
    Icon: LayoutGridIcon,
    permiso: "reportes.ver_resumen",
  },
  {
    href: "/reportes/comercial",
    label: "Comercial",
    descripcion: "Ventas, ticket, clientes principales y mix comercial.",
    categoria: "Comercial",
    Icon: BriefcaseIcon,
  },
  {
    href: "/reportes/embudo",
    label: "Embudo",
    descripcion: "Conversión desde el presupuesto hasta la entrega.",
    categoria: "Comercial",
    Icon: FilterIcon,
  },
  {
    href: "/reportes/clientes",
    label: "Clientes",
    descripcion: "Retención, recurrencia, concentración y clientes en riesgo.",
    categoria: "Comercial",
    Icon: UsersIcon,
  },
  {
    href: "/reportes/produccion",
    label: "Producción",
    descripcion: "Entregas, tiempos, utilización y estado operativo del taller.",
    categoria: "Operaciones",
    Icon: FactoryIcon,
  },
  {
    href: "/reportes/salud-eta",
    label: "Salud del ETA",
    descripcion: "Precisión de promesas y calibración de duraciones.",
    categoria: "Operaciones",
    Icon: ActivityIcon,
  },
  {
    href: "/reportes/equipo",
    label: "Equipo",
    descripcion: "Trabajo registrado, eficiencia y cobertura por persona.",
    categoria: "Operaciones",
    Icon: HardHatIcon,
  },
  {
    href: "/reportes/finanzas",
    label: "Finanzas",
    descripcion: "Rentabilidad, cobranza, deuda y costos de estructura.",
    categoria: "Finanzas",
    Icon: CircleDollarSignIcon,
    permiso: "finanzas.ver_margenes",
  },
  {
    href: "/reportes/producto",
    label: "Ventas y producto",
    descripcion: "Mix, materiales, medidas y comportamiento del catálogo.",
    categoria: "Producto",
    Icon: PackageIcon,
  },
];

export function reportesVisibles(
  puede: (permiso: PermisoClave) => boolean,
): Reporte[] {
  return REPORTES.filter((reporte) => !reporte.permiso || puede(reporte.permiso));
}
