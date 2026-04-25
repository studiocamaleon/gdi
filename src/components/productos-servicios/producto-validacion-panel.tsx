"use client";

import * as React from "react";
import { AlertTriangleIcon, CheckCircle2Icon, RefreshCwIcon, XCircleIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { validarProducto, type ValidacionProducto } from "@/lib/productos-servicios-api";

export function ProductoValidacionPanel({ productoId }: { productoId: string }) {
  const [resultado, setResultado] = React.useState<ValidacionProducto | null>(null);
  const [cargando, setCargando] = React.useState(true);

  const ejecutar = React.useCallback(async () => {
    setCargando(true);
    try {
      const r = await validarProducto(productoId);
      setResultado(r);
    } catch {
      setResultado(null);
    } finally {
      setCargando(false);
    }
  }, [productoId]);

  React.useEffect(() => {
    void ejecutar();
  }, [ejecutar]);

  if (cargando) return null;
  if (!resultado) return null;

  const errores = resultado.errores.filter((e) => e.severidad === "ERROR");
  const warnings = resultado.errores.filter((e) => e.severidad === "WARNING");

  if (resultado.exitoso && warnings.length === 0) {
    return (
      <Card className="border-green-200 bg-green-50">
        <CardContent className="flex items-center gap-2 py-3">
          <CheckCircle2Icon className="size-5 text-green-600" />
          <span className="text-sm text-green-900">
            Producto válido. Listo para cotizar.
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={ejecutar}
            className="ml-auto h-7 px-2 text-green-900"
          >
            <RefreshCwIcon className="size-3" />
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className={
        errores.length > 0 ? "border-red-200 bg-red-50" : "border-yellow-200 bg-yellow-50"
      }
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            {errores.length > 0 ? (
              <XCircleIcon className="size-5 text-red-600" />
            ) : (
              <AlertTriangleIcon className="size-5 text-yellow-600" />
            )}
            <span className={errores.length > 0 ? "text-red-900" : "text-yellow-900"}>
              {errores.length > 0
                ? `${errores.length} error(es) que impiden cotizar`
                : `${warnings.length} advertencia(s)`}
            </span>
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={ejecutar} className="h-7 px-2">
            <RefreshCwIcon className="size-3" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2 text-sm">
          {errores.map((e, idx) => (
            <li key={`e-${idx}`} className="bg-white/60 rounded p-2">
              <div className="flex items-center gap-1">
                <Badge variant="destructive" className="text-[10px]">
                  ERROR
                </Badge>
                <span className="text-muted-foreground font-mono text-xs">{e.codigo}</span>
              </div>
              <div className="mt-1 text-red-900">{e.mensaje}</div>
            </li>
          ))}
          {warnings.map((w, idx) => (
            <li key={`w-${idx}`} className="bg-white/60 rounded p-2">
              <div className="flex items-center gap-1">
                <Badge variant="secondary" className="text-[10px]">
                  WARNING
                </Badge>
                <span className="text-muted-foreground font-mono text-xs">{w.codigo}</span>
              </div>
              <div className="mt-1 text-yellow-900">{w.mensaje}</div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
