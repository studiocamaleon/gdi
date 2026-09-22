"use client";
import { useFuncionesPlan } from "@/components/navigation/capacidades-provider";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ChartNoAxesCombinedIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  LayoutGridIcon,
} from "lucide-react";
import { usePuedeFn } from "@/components/navigation/permisos-provider";
import {
  useDesignScope,
  useDesignTheme,
  useLegacyDesignScope,
} from "@/components/design-system/appearance";
import { ActionButton } from "@/components/design-system/action-button";
import { RangoReporteDialog } from "./rango-reporte-dialog";
import { ReporteExportButton } from "./reporte-export-button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  PERIODOS,
  leerPeriodo,
  leerRangoPersonalizado,
} from "@/lib/panel-periodo";
import { CATEGORIAS_REPORTES, reportesVisibles } from "@/lib/reportes-config";
import { cn } from "@/lib/utils";
import styles from "./reportes-shell.module.css";

export { REPORTES, reportesVisibles } from "@/lib/reportes-config";

/** La navegación conserva períodos en la URL y los permisos de cada reporte. */
export function ReportesShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const periodo = leerPeriodo(searchParams.get("periodo") ?? undefined);
  const rangoPersonalizado = leerRangoPersonalizado(
    searchParams.get("desde") ?? undefined,
    searchParams.get("hasta") ?? undefined,
  );
  const puede = usePuedeFn();
  const funciones = useFuncionesPlan();
  const visibles = React.useMemo(
    () => reportesVisibles(puede, funciones),
    [puede, funciones],
  );
  const esIndice = pathname === "/reportes";
  const activo = visibles.find((r) => pathname === r.href);
  const scope = useDesignScope();
  const theme = useDesignTheme();
  const legacyScope = useLegacyDesignScope();
  const conPeriodo = (href: string, p: string) =>
    p === "mes" ? href : `${href}?periodo=${p}`;
  const conFiltroActual = (href: string) =>
    rangoPersonalizado
      ? `${href}?desde=${encodeURIComponent(rangoPersonalizado.desde)}&hasta=${encodeURIComponent(rangoPersonalizado.hasta)}`
      : conPeriodo(href, periodo);

  return (
    <div {...scope} className={cn(theme, styles.workspace)}>
      <div className={styles.inner}>
        <header className={styles.header}>
          <div>
            <nav className={styles.breadcrumb} aria-label="Ubicación">
              {esIndice ? (
                <>
                  <ChartNoAxesCombinedIcon aria-hidden="true" />
                  <span>Inteligencia de negocio</span>
                </>
              ) : (
                <>
                  <Link href="/reportes">Centro de análisis</Link>
                  <ChevronRightIcon aria-hidden="true" />
                  <span>{activo?.categoria}</span>
                </>
              )}
            </nav>
            <h1>
              {esIndice ? "Centro de análisis" : (activo?.label ?? "Reporte")}
              <span>.</span>
            </h1>
            <p>
              {esIndice
                ? "Una visión más clara de tu negocio, de la venta a la producción."
                : (activo?.descripcion ??
                  "Inteligencia de negocio de tu taller.")}
            </p>
          </div>
          {esIndice ? (
            <div className={styles.catalogCount}>
              <strong>{String(visibles.length).padStart(2, "0")}</strong>
              <span>reportes disponibles</span>
            </div>
          ) : (
            <div className={styles.headerActions}>
              <ReporteExportButton reporte={activo?.label ?? "Reporte"} />
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={<ActionButton variant="outline" />}
                >
                  <LayoutGridIcon data-icon="inline-start" /> Cambiar reporte{" "}
                  <ChevronDownIcon data-icon="inline-end" />
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  {...legacyScope}
                  align="end"
                  className={cn(legacyScope.className, styles.reportMenu)}
                >
                  {CATEGORIAS_REPORTES.map((categoria) => {
                    const reportes = visibles.filter(
                      (reporte) => reporte.categoria === categoria,
                    );
                    if (reportes.length === 0) return null;
                    return (
                      <DropdownMenuGroup key={categoria}>
                        <DropdownMenuLabel>{categoria}</DropdownMenuLabel>
                        {reportes.map((reporte) => (
                          <DropdownMenuItem
                            key={reporte.href}
                            onClick={() =>
                              router.push(conFiltroActual(reporte.href))
                            }
                          >
                            <reporte.Icon aria-hidden="true" />
                            <span className="flex-1">{reporte.label}</span>
                            {pathname === reporte.href ? (
                              <CheckIcon aria-hidden="true" />
                            ) : null}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuGroup>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </header>
        {!esIndice ? (
          <div className={styles.toolbar}>
            <div className={styles.periodGroup}>
              <span className={styles.periodLabel}>Período</span>
              <nav className={styles.periods} aria-label="Período del reporte">
                {PERIODOS.map((p) => (
                  <Link
                    key={p.key}
                    href={conPeriodo(pathname, p.key)}
                    aria-current={
                      !rangoPersonalizado && periodo === p.key
                        ? "page"
                        : undefined
                    }
                    scroll={false}
                  >
                    {p.label}
                  </Link>
                ))}
              </nav>
            </div>
            <RangoReporteDialog
              pathname={pathname}
              desdeActual={rangoPersonalizado?.desde}
              hastaActual={rangoPersonalizado?.hasta}
            />
          </div>
        ) : null}
        <div
          data-reporte-cuerpo
          className={cn(styles.content, styles.reportBody)}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
