"use client";

import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";

import { usePuedeFn } from "@/components/navigation/permisos-provider";
import {
  Card,
  CardAction,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  CATEGORIAS_REPORTES,
  reportesVisibles,
} from "@/lib/reportes-config";

export function ReportesCatalogo() {
  const puede = usePuedeFn();
  const visibles = reportesVisibles(puede);

  return (
    <div className="flex flex-col gap-8">
      {CATEGORIAS_REPORTES.map((categoria) => {
        const reportes = visibles.filter((reporte) => reporte.categoria === categoria);
        if (reportes.length === 0) return null;

        return (
          <section key={categoria} aria-labelledby={`reportes-${categoria}`} className="flex flex-col gap-3">
            <div>
              <h2 id={`reportes-${categoria}`} className="text-sm font-semibold text-foreground">
                {categoria}
              </h2>
              <p className="text-xs text-muted-foreground">
                {categoria === "Ejecutivo"
                  ? "La lectura general del negocio."
                  : categoria === "Comercial"
                    ? "Qué vendemos, a quién y cuánto convierte."
                    : categoria === "Operaciones"
                      ? "Cómo está funcionando el taller y su equipo."
                      : categoria === "Finanzas"
                        ? "Rentabilidad, caja y cobranza."
                        : "Qué productos, materiales y medidas explican la venta."}
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {reportes.map((reporte) => (
                <Link
                  key={reporte.href}
                  href={reporte.href}
                  className="group block h-full rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <Card className="h-full transition-colors group-hover:bg-muted/40 group-focus-visible:bg-muted/40">
                    <CardHeader>
                      <CardTitle>{reporte.label}</CardTitle>
                      <CardDescription>{reporte.descripcion}</CardDescription>
                      <CardAction className="flex items-center gap-2 text-muted-foreground transition-colors group-hover:text-foreground">
                        <reporte.Icon className="size-5" aria-hidden="true" />
                        <ArrowRightIcon className="size-4" aria-hidden="true" />
                      </CardAction>
                    </CardHeader>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
