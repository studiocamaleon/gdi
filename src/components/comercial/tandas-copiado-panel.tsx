"use client";
import { FileText, TriangleAlert } from "lucide-react";
import { useLegacyDesignScope } from "@/components/design-system/appearance";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { tandasDeOrden } from "@/lib/tandas-copiado";
import { cn } from "@/lib/utils";
import type { CentroCopiadoMeta } from "@/lib/centro-copiado-api";
import { TomoPdfPreview } from "./tomo-pdf-preview";

export function TandasCopiadoPanel({
  items,
  metas,
}: {
  items: { itemId: string; archivosPendientes?: File[] }[];
  metas: Record<string, CentroCopiadoMeta | null>;
}) {
  const scope = useLegacyDesignScope();
  const tandas = tandasDeOrden(items, metas);
  if (!tandas.length) return null;

  return (
    <div {...scope} className={cn(scope.className, "mb-6 flex min-w-0 flex-col gap-4")}>
      {tandas.map((tanda, n) => (
        <Card key={tanda.id} role="region" aria-label={`Tanda de impresión ${n + 1}`}>
          <CardHeader>
            <CardTitle role="heading" aria-level={3}>
              Tanda de impresión {n + 1}
            </CardTitle>
            <CardDescription>
              {tanda.segmentos.length}{" "}
              {tanda.segmentos.length === 1 ? "archivo" : "archivos"} · Preparación compartida
            </CardDescription>
          </CardHeader>
          <CardContent className="flex min-w-0 flex-col gap-4">
            <div className="flex min-w-0 flex-col gap-2">
              <p className="break-words">
                <strong>Papel:</strong> {tanda.meta.papelLabel}
              </p>
              <div className="flex flex-wrap gap-2" aria-label="Configuración de impresión">
                <Badge variant="outline">{tanda.meta.tamano}</Badge>
                <Badge variant="outline">{tanda.meta.color === "BN" ? "B/N" : "Color"}</Badge>
                <Badge variant="outline">{tanda.meta.faz === 2 ? "Doble faz" : "Simple faz"}</Badge>
                <Badge variant="outline">Cobertura {tanda.meta.cobertura ?? "alta"}</Badge>
              </div>
            </div>
            <ul className="flex min-w-0 flex-col gap-2" aria-label="Archivos incluidos">
              {tanda.segmentos.map((s) => (
                <li key={s.origenItemIds![0]} className="flex min-w-0 items-start gap-2">
                  <FileText className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  <span className="min-w-0 flex-1 break-words">{s.nombre}</span>
                  <Badge variant="secondary">
                    {s.copias} {s.copias === 1 ? "copia" : "copias"}
                  </Badge>
                </li>
              ))}
            </ul>
          </CardContent>
          <CardFooter className="flex-col items-stretch gap-2">
            {tanda.completa ? (
              <>
                <p>
                  <strong>Imprimí 1 copia del PDF de la tanda.</strong>{" "}
                  Ya incluye todas las copias solicitadas.
                </p>
                <TomoPdfPreview
                  nombre={`Tanda ${n + 1}`}
                  segmentos={tanda.segmentos}
                  tanda
                />
              </>
            ) : (
              <Alert>
                <TriangleAlert aria-hidden="true" />
                <AlertTitle>Esta tanda cambió</AlertTitle>
                <AlertDescription>
                  Volvé a cotizar y guardar la orden antes de imprimir.
                </AlertDescription>
              </Alert>
            )}
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}
