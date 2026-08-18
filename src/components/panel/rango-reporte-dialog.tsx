"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CalendarRangeIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { esFechaCalendario } from "@/lib/panel-periodo";

function fechaLocal(fecha: Date): string {
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");
  return `${anio}-${mes}-${dia}`;
}

function fechaBreve(clave: string): string {
  const [anio, mes, dia] = clave.split("-");
  return `${dia}/${mes}/${anio.slice(2)}`;
}

function valoresIniciales(desde?: string, hasta?: string) {
  const hoy = new Date();
  return {
    desde: esFechaCalendario(desde)
      ? desde
      : fechaLocal(new Date(hoy.getFullYear(), hoy.getMonth(), 1)),
    hasta: esFechaCalendario(hasta) ? hasta : fechaLocal(hoy),
  };
}

export function RangoReporteDialog({
  pathname,
  desdeActual,
  hastaActual,
}: {
  pathname: string;
  desdeActual?: string;
  hastaActual?: string;
}) {
  const router = useRouter();
  const inicial = valoresIniciales(desdeActual, hastaActual);
  const [abierto, setAbierto] = React.useState(false);
  const [desde, setDesde] = React.useState(inicial.desde);
  const [hasta, setHasta] = React.useState(inicial.hasta);
  const invalido = !esFechaCalendario(desde) || !esFechaCalendario(hasta) || desde > hasta;
  const personalizado = esFechaCalendario(desdeActual) && esFechaCalendario(hastaActual);

  const cambiarApertura = (proximo: boolean) => {
    if (proximo) {
      const valores = valoresIniciales(desdeActual, hastaActual);
      setDesde(valores.desde);
      setHasta(valores.hasta);
    }
    setAbierto(proximo);
  };

  const aplicar = (evento: React.FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    if (invalido) return;
    router.push(`${pathname}?desde=${encodeURIComponent(desde)}&hasta=${encodeURIComponent(hasta)}`);
    setAbierto(false);
  };

  return (
    <Dialog open={abierto} onOpenChange={cambiarApertura}>
      <DialogTrigger render={<Button variant="outline" />}>
        <CalendarRangeIcon data-icon="inline-start" />
        {personalizado && desdeActual && hastaActual
          ? `${fechaBreve(desdeActual)} – ${fechaBreve(hastaActual)}`
          : "Personalizado"}
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={aplicar} className="contents">
          <DialogHeader>
            <DialogTitle>Elegir rango de fechas</DialogTitle>
            <DialogDescription>
              Incluye ambos días. El reporte se recalcula usando la zona horaria de la empresa.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field data-invalid={invalido || undefined}>
              <FieldLabel htmlFor="reporte-desde">Desde</FieldLabel>
              <Input
                id="reporte-desde"
                type="date"
                value={desde}
                max={hasta || undefined}
                aria-invalid={invalido || undefined}
                onChange={(evento) => setDesde(evento.target.value)}
              />
            </Field>
            <Field data-invalid={invalido || undefined}>
              <FieldLabel htmlFor="reporte-hasta">Hasta</FieldLabel>
              <Input
                id="reporte-hasta"
                type="date"
                value={hasta}
                min={desde || undefined}
                aria-invalid={invalido || undefined}
                onChange={(evento) => setHasta(evento.target.value)}
              />
            </Field>
          </FieldGroup>
          {invalido ? <FieldError>La fecha final debe ser igual o posterior a la inicial.</FieldError> : null}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancelar</DialogClose>
            <Button type="submit" disabled={invalido}>Aplicar rango</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
