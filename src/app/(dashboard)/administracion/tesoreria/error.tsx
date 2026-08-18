"use client";

import { AlertCircleIcon, RefreshCwIcon } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export default function TesoreriaError({ reset }: { reset: () => void }) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 p-6 lg:p-8">
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
