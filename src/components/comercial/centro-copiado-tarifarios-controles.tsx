"use client";
import { useEffect, useId } from "react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Field, FieldLabel, FieldDescription } from "@/components/ui/field";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectGroup,
  SelectItem,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";

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
      <Select
        value={valor}
        items={opciones}
        disabled={disabled}
        onValueChange={(v) => {
          if (v !== null) onChange(v);
        }}
      >
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {opciones.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
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
    <Alert>
      <AlertTitle>Tarifarios en preparación</AlertTitle>
      <AlertDescription>
        Podés cargar precios, publicar versiones y preparar su asignación por
        canal. La conexión de estas matrices con los pedidos todavía está
        pendiente: hoy se sigue cotizando con el motor.
      </AlertDescription>
    </Alert>
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
