"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CalendarRangeIcon } from "lucide-react";

import { ActionButton } from "@/components/design-system/action-button";
import { FormDialog } from "@/components/design-system/form-dialog";
import styles from "./reportes-shell.module.css";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@heroui/react";
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
  const invalido =
    !esFechaCalendario(desde) || !esFechaCalendario(hasta) || desde > hasta;
  const personalizado =
    esFechaCalendario(desdeActual) && esFechaCalendario(hastaActual);

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
    router.push(
      `${pathname}?desde=${encodeURIComponent(desde)}&hasta=${encodeURIComponent(hasta)}`,
    );
    setAbierto(false);
  };

  return (
    <>
      <ActionButton
        variant={personalizado ? "secondary" : "outline"}
        onPress={() => cambiarApertura(true)}
      >
        <CalendarRangeIcon data-icon="inline-start" />
        {personalizado && desdeActual && hastaActual
          ? `${fechaBreve(desdeActual)} – ${fechaBreve(hastaActual)}`
          : "Personalizado"}
      </ActionButton>
      <FormDialog
        isOpen={abierto}
        onOpenChange={cambiarApertura}
        title="Elegir rango de fechas"
        description="Incluye ambos días. El reporte se recalcula usando la zona horaria de la empresa."
        className={styles.dateDialog}
      >
        <form onSubmit={aplicar} className={styles.dateForm}>
          <FieldGroup className={styles.dateFields}>
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
          {invalido ? (
            <FieldError>
              La fecha final debe ser igual o posterior a la inicial.
            </FieldError>
          ) : null}
          <div className={styles.dateActions}>
            <ActionButton
              type="button"
              variant="outline"
              onPress={() => cambiarApertura(false)}
            >
              Cancelar
            </ActionButton>
            <ActionButton type="submit" isDisabled={invalido}>
              Aplicar rango
            </ActionButton>
          </div>
        </form>
      </FormDialog>
    </>
  );
}
