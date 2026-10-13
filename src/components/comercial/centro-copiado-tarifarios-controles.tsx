"use client";
import { Input } from "./centro-copiado-ui";
import { useEffect, useId } from "react";
import styles from "./centro-copiado-tarifarios.module.css";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Field, FieldLabel, FieldDescription } from "@/components/ui/field";
import { SelectField } from "@/components/design-system/select-field";

export function Elegir<T extends string>({
  etiqueta,
  valor,
  opciones,
  onChange,
  disabled,
  ayuda,
}: {
  etiqueta: string;
  valor: T;
  opciones: readonly { value: T; label: string }[];
  onChange: (valor: T) => void;
  disabled?: boolean;
  ayuda?: string;
}) {
  const id = useId();
  return (
    <Field>
      <FieldLabel htmlFor={id}>{etiqueta}</FieldLabel>
      <SelectField
        id={id}
        aria-label={etiqueta}
        value={valor}
        options={opciones}
        disabled={disabled}
        onChange={(v) => {
          const elegida = opciones.find((o) => o.value === v);
          if (elegida) onChange(elegida.value);
        }}
      />
      {ayuda && <FieldDescription>{ayuda}</FieldDescription>}
    </Field>
  );
}
export function TextoTarifa({
  etiqueta,
  valor,
  onChange,
  disabled,
  ayuda,
  ...props
}: {
  etiqueta: string;
  valor: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  ayuda?: string;
} & Omit<React.ComponentProps<typeof Input>, "value" | "onChange">) {
  const id = useId();
  return (
    <Field>
      <FieldLabel htmlFor={id}>{etiqueta}</FieldLabel>
      <Input
        id={id}
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        {...props}
      />
      {ayuda && <FieldDescription>{ayuda}</FieldDescription>}
    </Field>
  );
}
export function ErrorTarifa({ error }: { error: string | null }) {
  return error ? (
    <Alert variant="destructive">
      <AlertTitle>No se pudo completar</AlertTitle>
      <AlertDescription>{error}</AlertDescription>
    </Alert>
  ) : null;
}
export function AvisoPreparacion() {
  return (
    <ol className={styles.workflow} aria-label="Pasos del tarifario">
      <li>
        <span>01</span>Combinaciones y precios
      </li>
      <li>
        <span>02</span>Costos y contribución
      </li>
      <li>
        <span>03</span>Publicar versión
      </li>
      <li>
        <span>04</span>Asignar en Canales
      </li>
    </ol>
  );
}
export function useAvisoCambios(cambios: boolean) {
  useEffect(() => {
    if (!cambios) return;
    const avisar = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [cambios]);
}
export const mensajeErrorTarifa = (e: unknown) => {
  if (e && typeof e === "object" && "status" in e && e.status === 409)
    return "Otra sesión modificó este borrador. Tus cambios siguen en pantalla. Revisá lo cargado antes de recargar la versión guardada.";
  return e instanceof Error ? e.message : "Ocurrió un error. Volvé a intentar.";
};
