"use client";
import styles from "../maquinaria.module.css";
import { useId } from "react";
import { Info } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card } from "@heroui/react";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { SegmentedControl } from "@/components/design-system/choice-controls";
import { leerModoOperacionMaquina } from "@/lib/demanda-humana";
import type { MaquinaEditorState } from "./use-maquina-editor";

export function OperacionMaquinaEditor({
  editor,
}: {
  editor: MaquinaEditorState;
}) {
  const id = useId();
  const modo = leerModoOperacionMaquina(
    editor.form.parametrosTecnicos?.operacionMaquina,
  );
  return (
    <Card className={styles.card}>
      <Card.Header>
        <Card.Title>Operación de máquina</Card.Title>
        <Card.Description>
          Definí si el equipo puede atender otro trabajo mientras esta máquina
          está funcionando.
        </Card.Description>
      </Card.Header>
      <Card.Content>
        <FieldGroup>
          <Field>
            <FieldLabel id={id}>Funcionamiento</FieldLabel>
            <SegmentedControl
              aria-labelledby={id}
              aria-describedby={`${id}-descripcion`}
              value={modo ?? ""}
              options={[
                { value: "con_operario", label: "Con operario", icon: null },
                { value: "autonoma", label: "Autónoma", icon: null },
              ]}
              onChange={(value) => {
                const siguiente = leerModoOperacionMaquina(value);
                if (!siguiente) return;
                editor.setForm((actual) => ({
                  ...actual,
                  parametrosTecnicos: {
                    ...actual.parametrosTecnicos,
                    operacionMaquina: siguiente,
                  },
                }));
              }}
            />
            <FieldDescription id={`${id}-descripcion`}>
              {modo === "con_operario"
                ? "La máquina y la dotación de operarios quedan ocupadas durante toda la operación, además de la preparación, las cargas y el cierre."
                : modo === "autonoma"
                  ? "Durante la operación automática se libera al equipo. Preparación, cargas, recargas y cierre siguen requiriendo operarios."
                  : "Elegí cómo funciona esta máquina. Mientras esté sin confirmar, la planificación reserva al equipo durante toda la operación y muestra una estimación orientativa."}
            </FieldDescription>
          </Field>
          <Alert>
            <Info />
            <AlertTitle>Se aplica al trabajo pendiente</AlertTitle>
            <AlertDescription>
              Al guardar se recalcula la ocupación del equipo en las próximas
              proyecciones, incluidas las OT pendientes. Los tiempos y precios
              cotizados y las fechas comprometidas se conservan.
            </AlertDescription>
          </Alert>
        </FieldGroup>
      </Card.Content>
    </Card>
  );
}
