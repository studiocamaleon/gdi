"use client";

/**
 * El cromo de Reportes: título del reporte activo, selector de período y la
 * tira para saltar de un reporte a otro.
 *
 * Vive en el layout, así que sobrevive a la navegación entre reportes — el
 * cuerpo lo trae cada página. Todo lo navegable son ANCLAS de verdad
 * (`<Link>`), no botones con `onClick`: el período viaja en `?periodo=`, así
 * que un reporte se puede linkear, marcar y compartir con su rango puesto, que
 * es justo lo que no se podía cuando esto eran tabs en `useState`.
 */

import * as React from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  BriefcaseIcon,
  CircleDollarSignIcon,
  FactoryIcon,
  FilterIcon,
  HardHatIcon,
  LayoutGridIcon,
  PackageIcon,
  UsersIcon,
} from "lucide-react";

import { usePuedeFn } from "@/components/navigation/permisos-provider";
import type { PermisoClave } from "@/lib/permisos";
import { PERIODOS, leerPeriodo } from "@/lib/panel-periodo";

type Reporte = {
  href: string;
  label: string;
  Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  /** Permiso extra sobre `reportes.ver`. Sin él, el reporte no se ofrece. */
  permiso?: PermisoClave;
};

/**
 * El orden de la tira, y la única lista de reportes que existe: el sidebar
 * muestra "Reportes" como una sola entrada, así que acá no hay hijos filtrados
 * por permiso que hagan de red. Lo que se saque de esta lista deja de ofrecerse.
 */
export const REPORTES: Reporte[] = [
  {
    href: "/reportes/resumen",
    label: "Resumen ejecutivo",
    Icon: LayoutGridIcon,
    permiso: "reportes.ver_resumen",
  },
  { href: "/reportes/comercial", label: "Comercial", Icon: BriefcaseIcon },
  { href: "/reportes/embudo", label: "Embudo", Icon: FilterIcon },
  { href: "/reportes/clientes", label: "Clientes", Icon: UsersIcon },
  { href: "/reportes/produccion", label: "Producción", Icon: FactoryIcon },
  { href: "/reportes/equipo", label: "Equipo", Icon: HardHatIcon },
  {
    href: "/reportes/finanzas",
    label: "Finanzas",
    Icon: CircleDollarSignIcon,
    permiso: "finanzas.ver_margenes",
  },
  { href: "/reportes/producto", label: "Ventas & Producto", Icon: PackageIcon },
];

/**
 * Los reportes que esta persona puede abrir. El permiso del reporte NO se suma
 * al del módulo: lo reemplaza. Tener Reportes no abre el Resumen ejecutivo, y
 * Costo laboral pide la llave de remuneraciones porque muestra sueldos.
 */
export function reportesVisibles(
  puede: (permiso: PermisoClave) => boolean,
): Reporte[] {
  return REPORTES.filter((r) => !r.permiso || puede(r.permiso));
}

export function ReportesShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const periodo = leerPeriodo(searchParams.get("periodo") ?? undefined);

  const puede = usePuedeFn();
  const visibles = React.useMemo(() => reportesVisibles(puede), [puede]);
  const activo = visibles.find((r) => pathname === r.href) ?? visibles[0];

  // "Este mes" es el default: se va de la URL en vez de escribirse, para que el
  // link que compartís no clave un período que el otro no pidió.
  const conPeriodo = (href: string, p: string) =>
    p === "mes" ? href : `${href}?periodo=${p}`;

  return (
    <div className="dash-scroll" style={{ padding: "26px 30px 44px" }}>
      <div className="dash">
        <div className="dash-head">
          <div className="title-block">
            <h1>{activo?.label ?? "Reportes"}</h1>
            <div className="sub">
              Inteligencia de negocio de tu taller, con datos reales.
            </div>
          </div>
          <div className="actions">
            <div className="dash-period">
              {PERIODOS.map((p) => (
                <Link
                  key={p.key}
                  href={conPeriodo(pathname, p.key)}
                  className={periodo === p.key ? "on" : ""}
                  aria-current={periodo === p.key ? "true" : undefined}
                  scroll={false}
                >
                  {p.label}
                </Link>
              ))}
            </div>
          </div>
        </div>

        <nav className="dash-tabs" aria-label="Reportes">
          {visibles.map((r) => {
            const on = pathname === r.href;
            return (
              <Link
                key={r.href}
                href={conPeriodo(r.href, periodo)}
                className={`dash-tab ${on ? "on" : ""}`}
                aria-current={on ? "page" : undefined}
              >
                <span className="ico">
                  <r.Icon width={15} height={15} />
                </span>
                <span>{r.label}</span>
              </Link>
            );
          })}
        </nav>

        {children}
      </div>
    </div>
  );
}
