"use client";

import { useId } from "react";
import { Info } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { leerModoOperacionMaquina } from "@/lib/demanda-humana";
import type { MaquinaEditorState } from "./use-maquina-editor";

export function OperacionMaquinaEditor({ editor }: { editor: MaquinaEditorState }) {
  const id = useId();
  const modo = leerModoOperacionMaquina(editor.form.parametrosTecnicos?.operacionMaquina);
  return <Card>
    <CardHeader>
      <CardTitle>Operación de máquina</CardTitle>
      <CardDescription>Definí si el equipo puede atender otro trabajo mientras esta máquina está funcionando.</CardDescription>
    </CardHeader>
    <CardContent>
      <FieldGroup>
        <Field>
          <FieldLabel id={id}>Funcionamiento</FieldLabel>
          <ToggleGroup aria-labelledby={id} aria-describedby={`${id}-descripcion`} variant="outline" value={modo ? [modo] : []}
            onValueChange={(valores) => {
              const siguiente = leerModoOperacionMaquina(valores[0]);
              if (!siguiente) return;
              editor.setForm(actual => ({ ...actual, parametrosTecnicos: { ...actual.parametrosTecnicos, operacionMaquina: siguiente } }));
            }}>
            <ToggleGroupItem value="con_operario">Con operario</ToggleGroupItem>
            <ToggleGroupItem value="autonoma">Autónoma</ToggleGroupItem>
          </ToggleGroup>
          <FieldDescription id={`${id}-descripcion`}>
            {modo === "con_operario" ? "La máquina y la dotación de operarios quedan ocupadas durante toda la operación, además de la preparación, las cargas y el cierre."
              : modo === "autonoma" ? "Durante la operación automática se libera al equipo. Preparación, cargas, recargas y cierre siguen requiriendo operarios."
                : "Elegí cómo funciona esta máquina. Mientras esté sin confirmar, la planificación reserva al equipo durante toda la operación y muestra una estimación orientativa."}
          </FieldDescription>
        </Field>
        <Alert><Info /><AlertTitle>Se aplica al trabajo pendiente</AlertTitle><AlertDescription>Al guardar se recalcula la ocupación del equipo en las próximas proyecciones, incluidas las OT pendientes. Los tiempos y precios cotizados y las fechas comprometidas se conservan.</AlertDescription></Alert>
      </FieldGroup>
    </CardContent>
  </Card>;
}
