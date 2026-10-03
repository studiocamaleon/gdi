"use client";

import { useReportarError } from "@/hooks/use-reportar-error";

import { AlertCircleIcon, RefreshCwIcon } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useLegacyDesignScope } from "@/components/design-system/appearance";
import styles from "@/components/administracion/tesoreria-view.module.css";

import { Button } from "@/components/ui/button";

export default function TesoreriaError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  useReportarError(error);
  const scope = useLegacyDesignScope();
  return (
    <main
      {...scope}
      className={[scope.className, styles.pagina].filter(Boolean).join(" ")}
    >
      <Alert variant="destructive">
        <AlertCircleIcon />
        <AlertTitle>No pudimos cargar Tesorería</AlertTitle>
        <AlertDescription>
          Los saldos no se reemplazaron por cero. Reintentá para consultar la
          información real antes de operar.
        </AlertDescription>
      </Alert>
      <Button className="w-fit" onClick={reset}>
        <RefreshCwIcon data-icon="inline-start" />
        Reintentar
      </Button>
    </main>
  );
}
