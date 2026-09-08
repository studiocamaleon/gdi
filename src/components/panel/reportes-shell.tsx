"use client";

/**
 * El cromo de Reportes: título del reporte activo, selector de período y el
 * menú para saltar de un reporte a otro.
 *
 * Vive en el layout, así que sobrevive a la navegación entre reportes — el
 * cuerpo lo trae cada página. Todo lo navegable son ANCLAS de verdad
 * (`<Link>`), no estado local: el período viaja en la URL, así
 * que un reporte se puede linkear, marcar y compartir con su rango puesto, que
 * es justo lo que no se podía cuando esto eran tabs en `useState`.
 */

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CheckIcon, ChevronDownIcon, ChevronRightIcon, LayoutGridIcon } from "lucide-react";

import { usePuedeFn } from "@/components/navigation/permisos-provider";
import { RangoReporteDialog } from "@/components/panel/rango-reporte-dialog";
import { ReporteExportButton } from "@/components/panel/reporte-export-button";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PERIODOS, leerPeriodo, leerRangoPersonalizado } from "@/lib/panel-periodo";
import {
  CATEGORIAS_REPORTES,
  reportesVisibles,
} from "@/lib/reportes-config";

import styles from "./reportes-shell.module.css";

export { REPORTES, reportesVisibles } from "@/lib/reportes-config";

export function ReportesShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const periodo = leerPeriodo(searchParams.get("periodo") ?? undefined);
  const desde = searchParams.get("desde") ?? undefined;
  const hasta = searchParams.get("hasta") ?? undefined;
  const rangoPersonalizado = leerRangoPersonalizado(desde, hasta);

  const puede = usePuedeFn();
  const visibles = React.useMemo(() => reportesVisibles(puede), [puede]);
  const esIndice = pathname === "/reportes";
  const activo = visibles.find((r) => pathname === r.href);

  // "Este mes" es el default: se va de la URL en vez de escribirse, para que el
  // link que compartís no clave un período que el otro no pidió.
  const conPeriodo = (href: string, p: string) =>
    p === "mes" ? href : `${href}?periodo=${p}`;
  const conFiltroActual = (href: string) =>
    rangoPersonalizado
      ? `${href}?desde=${encodeURIComponent(rangoPersonalizado.desde)}&hasta=${encodeURIComponent(rangoPersonalizado.hasta)}`
      : conPeriodo(href, periodo);

  return (
    <div className="dash-scroll" style={{ padding: "26px 30px 44px" }}>
      <div className="dash">
        <div className={`dash-head ${esIndice ? styles.indiceHead : ""}`}>
          <div className="title-block">
            {!esIndice ? (
              <div className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
                <Link href="/reportes" className="hover:text-foreground">Reportes</Link>
                <ChevronRightIcon className="size-3" aria-hidden="true" />
                <span>{activo?.categoria}</span>
              </div>
            ) : null}
            <h1>{esIndice ? "Centro de análisis" : activo?.label ?? "Reporte"}</h1>
            <div className="sub">
              {esIndice
                ? `${visibles.length} vistas para analizar ventas, finanzas y operación.`
                : activo?.descripcion ?? "Inteligencia de negocio de tu taller."}
            </div>
          </div>
          {!esIndice ? <div className="actions">
            <div className="dash-period">
              {PERIODOS.map((p) => (
                <Link
                  key={p.key}
                  href={conPeriodo(pathname, p.key)}
                  className={!rangoPersonalizado && periodo === p.key ? "on" : ""}
                  aria-current={!rangoPersonalizado && periodo === p.key ? "page" : undefined}
                  scroll={false}
                >
                  {p.label}
                </Link>
              ))}
            </div>
            <RangoReporteDialog
              pathname={pathname}
              desdeActual={rangoPersonalizado?.desde}
              hastaActual={rangoPersonalizado?.hasta}
            />
            <ReporteExportButton reporte={activo?.label ?? "Reporte"} />
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="outline" />}>
                <LayoutGridIcon data-icon="inline-start" />
                Cambiar reporte
                <ChevronDownIcon data-icon="inline-end" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72">
                {CATEGORIAS_REPORTES.map((categoria) => {
                  const reportes = visibles.filter((reporte) => reporte.categoria === categoria);
                  if (reportes.length === 0) return null;
                  return (
                    <DropdownMenuGroup key={categoria}>
                      <DropdownMenuLabel>{categoria}</DropdownMenuLabel>
                      {reportes.map((reporte) => (
                        <DropdownMenuItem
                          key={reporte.href}
                          onClick={() => router.push(conFiltroActual(reporte.href))}
                        >
                          <reporte.Icon aria-hidden="true" />
                          <span className="flex-1">{reporte.label}</span>
                          {pathname === reporte.href ? <CheckIcon aria-hidden="true" /> : null}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuGroup>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </div> : null}
        </div>

        <div data-reporte-cuerpo className="contents">
          {children}
        </div>
      </div>
    </div>
  );
}
