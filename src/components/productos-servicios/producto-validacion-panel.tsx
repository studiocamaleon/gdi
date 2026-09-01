"use client";

import * as React from "react";
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  ChevronDownIcon,
  RefreshCwIcon,
  XCircleIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import {
  validarProducto,
  type ValidacionProducto,
} from "@/lib/productos-servicios-api";

type ProductoValidacionPanelProps = {
  productoId: string;
  variante?: "panel" | "compacta";
};

export function ProductoValidacionPanel({
  productoId,
  variante = "panel",
}: ProductoValidacionPanelProps) {
  const [resultado, setResultado] = React.useState<ValidacionProducto | null>(
    null,
  );
  const [cargando, setCargando] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [detallesAbiertos, setDetallesAbiertos] = React.useState(false);

  const ejecutar = React.useCallback(async () => {
    setCargando(true);
    setError(null);
    setDetallesAbiertos(false);
    try {
      const r = await validarProducto(productoId);
      setResultado(r);
    } catch (err) {
      setResultado(null);
      setError(
        err instanceof Error ? err.message : "No se pudo validar el producto.",
      );
    } finally {
      setCargando(false);
    }
  }, [productoId]);

  React.useEffect(() => {
    void ejecutar();
  }, [ejecutar]);

  if (variante === "compacta") {
    if (cargando) return null;

    const errores =
      resultado?.errores.filter((item) => item.severidad === "ERROR") ?? [];
    const warnings =
      resultado?.errores.filter((item) => item.severidad === "WARNING") ?? [];
    const problemas = [...errores, ...warnings];

    if (!error && resultado?.exitoso && warnings.length === 0) return null;

    const cantidadPendiente = problemas.length;
    const tieneErrores = Boolean(error) || errores.length > 0;

    return (
      <div className="relative ml-auto shrink-0">
        <Popover open={detallesAbiertos} onOpenChange={setDetallesAbiertos}>
          <PopoverTrigger
            render={
              <Button
                variant="outline"
                size="sm"
                className={
                  tieneErrores
                    ? "border-destructive/30 bg-destructive/5 text-destructive hover:bg-destructive/10"
                    : "border-amber-300/70 bg-amber-50 text-amber-800 hover:bg-amber-100"
                }
                aria-label="Ver estado de configuración"
              />
            }
          >
            {tieneErrores ? <XCircleIcon /> : <AlertTriangleIcon />}
            {error
              ? "Validación no disponible"
              : `${cantidadPendiente} ${cantidadPendiente === 1 ? "pendiente" : "pendientes"}`}
            <ChevronDownIcon
              className={`transition-transform ${detallesAbiertos ? "rotate-180" : ""}`}
            />
          </PopoverTrigger>

          <PopoverContent
            align="end"
            side="bottom"
            sideOffset={8}
            className="w-[min(420px,calc(100vw-52px))] rounded-2xl border border-border bg-background p-4 text-left shadow-xl"
          >
            <div className="flex items-start justify-between gap-3">
              <PopoverHeader>
                <PopoverTitle className="text-sm font-semibold text-foreground">
                  {error
                    ? "No se pudo validar el producto"
                    : tieneErrores
                      ? "Configuración incompleta"
                      : "Configuración para revisar"}
                </PopoverTitle>
                <PopoverDescription className="mt-1 text-xs leading-5 text-muted-foreground">
                  {error
                    ? error
                    : tieneErrores
                      ? "Completá estos ajustes antes de utilizar el producto en una cotización."
                      : "El producto puede cotizarse, pero tiene recomendaciones pendientes."}
                </PopoverDescription>
              </PopoverHeader>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={ejecutar}
                aria-label="Revalidar producto"
              >
                <RefreshCwIcon />
              </Button>
            </div>
            {problemas.length > 0 ? (
              <ul className="mt-3 flex list-disc flex-col gap-1.5 border-t border-border pt-3 pl-5 text-xs leading-5 text-foreground">
                {problemas.map((problema, idx) => (
                  <li key={`${problema.severidad}-${idx}`}>
                    {problema.mensaje}
                  </li>
                ))}
              </ul>
            ) : null}
          </PopoverContent>
        </Popover>
      </div>
    );
  }

  if (cargando) return <Skeleton className="mb-4 h-14 w-full" />;
  if (error || !resultado) {
    return (
      <Alert variant="destructive" className="mb-4">
        <XCircleIcon />
        <AlertTitle>No se pudo validar el producto</AlertTitle>
        <AlertDescription>{error ?? "Intentá nuevamente."}</AlertDescription>
        <AlertAction>
          <Button variant="outline" size="sm" onClick={ejecutar}>
            Reintentar
          </Button>
        </AlertAction>
      </Alert>
    );
  }

  const errores = resultado.errores.filter((e) => e.severidad === "ERROR");
  const warnings = resultado.errores.filter((e) => e.severidad === "WARNING");

  if (resultado.exitoso && warnings.length === 0) {
    return (
      <Alert className="mb-4">
        <CheckCircle2Icon />
        <AlertTitle>Listo para cotizar</AlertTitle>
        <AlertDescription>
          La configuración del producto está completa.
        </AlertDescription>
        <AlertAction>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={ejecutar}
            aria-label="Revalidar producto"
          >
            <RefreshCwIcon />
          </Button>
        </AlertAction>
      </Alert>
    );
  }

  const cantidadPendiente =
    errores.length > 0 ? errores.length : warnings.length;
  const problemas = [...errores, ...warnings];

  return (
    <Collapsible open={detallesAbiertos} onOpenChange={setDetallesAbiertos}>
      <Alert className="mb-4">
        {errores.length > 0 ? (
          <XCircleIcon className="text-destructive" />
        ) : (
          <AlertTriangleIcon className="text-muted-foreground" />
        )}
        <AlertTitle>
          <span className="flex flex-wrap items-center gap-2">
            {errores.length > 0
              ? "Configuración incompleta"
              : "Configuración para revisar"}
            <Badge variant={errores.length > 0 ? "destructive" : "secondary"}>
              {cantidadPendiente}{" "}
              {cantidadPendiente === 1 ? "pendiente" : "pendientes"}
            </Badge>
          </span>
        </AlertTitle>
        <AlertDescription>
          <p>
            {errores.length > 0
              ? "Completá los ajustes pendientes antes de usar este producto en una cotización."
              : "El producto puede cotizarse, pero conviene revisar estas recomendaciones."}
          </p>
          <CollapsibleTrigger
            render={<Button variant="ghost" size="sm" className="mt-1 -ml-2" />}
          >
            <ChevronDownIcon data-icon="inline-start" />
            {detallesAbiertos ? "Ocultar detalles" : "Ver detalles"}
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">
            <ul className="flex list-disc flex-col gap-1.5 pl-5 text-foreground">
              {problemas.map((problema, idx) => (
                <li key={`${problema.severidad}-${idx}`}>{problema.mensaje}</li>
              ))}
            </ul>
            {errores.length > 0 && warnings.length > 0 ? (
              <p className="mt-2 text-xs">
                También hay {warnings.length}{" "}
                {warnings.length === 1 ? "recomendación" : "recomendaciones"}{" "}
                para revisar.
              </p>
            ) : null}
          </CollapsibleContent>
        </AlertDescription>
        <AlertAction>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={ejecutar}
            aria-label="Revalidar producto"
          >
            <RefreshCwIcon />
          </Button>
        </AlertAction>
      </Alert>
    </Collapsible>
  );
}
