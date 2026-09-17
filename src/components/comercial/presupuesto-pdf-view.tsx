"use client";

import { useEffect, useState } from "react";
import { FileTextIcon } from "lucide-react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { GdiSpinner } from "@/components/brand/gdi-spinner";
import {
  getEstadoPdfPresupuesto,
  reintentarPdfPresupuesto,
} from "@/lib/presupuestos-api";
import { esperarPdf } from "@/lib/esperar-pdf";

type Vista = {
  estado: "preparando" | "demorado" | "fallido" | "error" | "listo";
  mensaje?: string;
  url?: string;
};

export function PresupuestoPdfView({ id }: { id: string }) {
  const [vista, setVista] = useState<Vista>({ estado: "preparando" });
  const [solicitud, setSolicitud] = useState({ intento: 0, reintentar: false });

  useEffect(() => {
    const controller = new AbortController();
    async function abrir() {
      try {
        if (solicitud.reintentar)
          await reintentarPdfPresupuesto(
            id,
            AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]),
          );
        const respuesta = await esperarPdf(
          (signal) => getEstadoPdfPresupuesto(id, signal),
          controller.signal,
        );
        if (controller.signal.aborted) return;
        if (respuesta.estado === "listo") {
          setVista({ estado: "listo", url: respuesta.url });
          window.location.replace(respuesta.url);
        } else if (respuesta.estado === "fallido") {
          setVista({
            estado: "fallido",
            mensaje:
              respuesta.error ??
              "No se pudo preparar el PDF. Podés volver a intentarlo.",
          });
        } else setVista({ estado: "demorado" });
      } catch {
        if (!controller.signal.aborted) setVista({ estado: "error" });
      }
    }
    void abrir();
    return () => controller.abort();
  }, [id, solicitud]);

  const ocupado = vista.estado === "preparando";
  const titulo = ocupado
    ? "Preparando PDF"
    : vista.estado === "listo"
      ? "Tu PDF está listo"
      : vista.estado === "demorado"
        ? "El PDF sigue en preparación"
        : "No pudimos abrir el PDF";
  const mensaje = ocupado
    ? "Se abrirá automáticamente en esta pestaña cuando esté listo."
    : vista.estado === "listo"
      ? "Si la descarga no comenzó, podés abrir el archivo desde acá."
      : vista.estado === "demorado"
        ? "Está tardando más de lo habitual. Podés volver al presupuesto y consultarlo más tarde."
        : (vista.mensaje ??
          "Revisá tu conexión y volvé a consultar. El presupuesto sigue guardado.");

  return (
    <div className="mx-auto flex w-full max-w-lg items-start px-4 py-16">
      <Card className="w-full" aria-busy={ocupado}>
        <CardHeader>
          <CardTitle>
            <h1>{titulo}</h1>
          </CardTitle>
          <CardDescription>{mensaje}</CardDescription>
        </CardHeader>
        <CardContent>
          <div
            role="status"
            aria-live="polite"
            className="flex items-center gap-3"
          >
            {ocupado ? (
              <GdiSpinner className="size-8" />
            ) : (
              <FileTextIcon className="size-8" aria-hidden />
            )}
            <span>
              {ocupado
                ? "Podés seguir trabajando mientras se prepara."
                : "PDF del presupuesto"}
            </span>
          </div>
        </CardContent>
        <CardFooter className="flex-wrap gap-2">
          {!ocupado && vista.estado !== "listo" && (
            <Button
              onClick={() => {
                setVista({ estado: "preparando" });
                setSolicitud((anterior) => ({
                  intento: anterior.intento + 1,
                  reintentar: vista.estado === "fallido",
                }));
              }}
            >
              {vista.estado === "fallido" ? "Reintentar" : "Volver a consultar"}
            </Button>
          )}
          {vista.url && (
            <a className={buttonVariants()} href={vista.url}>
              Abrir PDF
            </a>
          )}
          <Link
            className={buttonVariants({ variant: "outline" })}
            href={`/comercial/presupuestos/${id}`}
          >
            Volver al presupuesto
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
