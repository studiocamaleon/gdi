"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  medidasDxfEnUnidad,
  UNIDADES_IMPORTACION_DXF,
  type ImportacionDxf,
} from "@/lib/escala-dxf";

type Medidas = {
  anchoFinalMm: number;
  altoFinalMm: number;
  unidadOrigen: string;
};

export function EscalaDxf({
  value,
  onChange,
}: {
  value: {
    formatoOrigen?: string;
    unidadOrigen?: string | null;
    importacionDxf?: ImportacionDxf;
  };
  onChange: (medidas: Medidas) => void;
}) {
  if (value.formatoOrigen !== "DXF") return null;
  const datos = value.importacionDxf;
  const pendiente = !value.unidadOrigen;
  const opciones = UNIDADES_IMPORTACION_DXF.map(({ value, label }) => ({
    value,
    label,
  }));
  const seleccion = opciones.some((item) => item.value === value.unidadOrigen)
    ? value.unidadOrigen
    : null;
  return (
    <div className="flex flex-col gap-3">
      {pendiente ? (
        <Alert>
          <AlertTitle>El DXF no declara su unidad</AlertTitle>
          <AlertDescription>
            Elegí la unidad usada al exportar o ingresá una medida final
            conocida. La escala física no se puede detectar automáticamente en
            este archivo.
          </AlertDescription>
        </Alert>
      ) : (
        <p className="text-sm text-muted-foreground">
          Unidad{" "}
          {datos?.unidadDetectada === value.unidadOrigen
            ? "detectada"
            : "seleccionada"}
          : {value.unidadOrigen}. Las medidas corresponden a los contornos
          visibles del archivo.
        </p>
      )}
      {datos ? (
        <Field>
          <FieldLabel>Unidad de las coordenadas del DXF</FieldLabel>
          <Select
            items={opciones}
            value={seleccion ?? null}
            onValueChange={(unidad) => {
              const medidas = unidad ? medidasDxfEnUnidad(datos, unidad) : null;
              if (medidas) onChange(medidas);
            }}
          >
            <SelectTrigger aria-label="Unidad de las coordenadas del DXF">
              <SelectValue placeholder="Elegir unidad" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {opciones.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
      ) : null}
      {datos?.mensajes.map((mensaje, index) => (
        <p key={index} className="text-sm text-muted-foreground">
          {mensaje}
        </p>
      ))}
    </div>
  );
}
