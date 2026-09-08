"use client";

import * as React from "react";
import type { BindingParametroComponente } from "@/lib/productos-servicios-api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** Atajo sobre la misma BOM: no guarda una segunda cantidad en el archivo. */
export function PiezaProductoComponente({
  bindings,
  fuentes,
  onChange,
}: {
  bindings: BindingParametroComponente[];
  fuentes: Array<{ clave: string; etiqueta: string }>;
  onChange: (bindings: BindingParametroComponente[]) => void;
}) {
  const vector = bindings.find((b) => b.clave === "disenoVectorialFuente");
  const cantidad = bindings.find((b) => b.clave === "cantidad");
  const regla = cantidad?.regla;
  const unidades =
    regla?.campoPadre === "cantidad" && regla.operador === "MULTIPLICAR"
      ? regla.valor
      : cantidad?.origen === "PADRE" &&
          (cantidad.padreClave === "cantidad" ||
            regla?.campoPadre === "cantidad") &&
          (!regla || regla.operador === "COPIAR")
        ? 1
        : null;
  const [texto, setTexto] = React.useState(
    unidades == null ? "" : String(unidades),
  );
  React.useEffect(
    () => setTexto(unidades == null ? "" : String(unidades)),
    [unidades],
  );
  if (!vector || !cantidad || !fuentes.length) return null;
  const fuenteActual =
    vector.origen === "PADRE"
      ? (vector.regla?.fuente?.campo ??
        vector.regla?.campoPadre ??
        vector.padreClave)
      : undefined;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Pieza del producto</CardTitle>
        <CardDescription>
          Vinculá el diseño guardado y cuántas piezas lleva cada unidad
          terminada.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="pieza-componente-fuente">
              Diseño del producto
            </FieldLabel>
            <Select
              items={fuentes.map((f) => ({
                value: f.clave,
                label: f.etiqueta.replace("Geometría del padre · ", ""),
              }))}
              value={
                fuentes.some((f) => f.clave === fuenteActual)
                  ? fuenteActual
                  : null
              }
              onValueChange={(clave) => {
                if (!clave) return;
                onChange(
                  bindings.map((b) =>
                    b.clave === vector.clave
                      ? {
                          ...b,
                          origen: "PADRE",
                          padreClave: clave,
                          valor: undefined,
                          regla: {
                            campoPadre: clave,
                            operador: "COPIAR",
                            fuente: { tipo: "PADRE", campo: clave },
                          },
                        }
                      : b,
                  ),
                );
              }}
            >
              <SelectTrigger id="pieza-componente-fuente">
                <SelectValue placeholder="Elegir pieza…" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {fuentes.map((f) => (
                    <SelectItem key={f.clave} value={f.clave}>
                      {f.etiqueta.replace("Geometría del padre · ", "")}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <FieldDescription>
              Hereda el archivo, su escala y sus operaciones.
            </FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="pieza-componente-unidades">
              Piezas por producto
            </FieldLabel>
            <Input
              id="pieza-componente-unidades"
              type="number"
              min={1}
              step={1}
              value={texto}
              placeholder="Cantidad por unidad"
              onChange={(e) => {
                setTexto(e.target.value);
                const n = Number(e.target.value);
                if (!Number.isSafeInteger(n) || n < 1) return;
                onChange(
                  bindings.map((b) =>
                    b.clave === "cantidad"
                      ? {
                          ...b,
                          origen: "FORMULA",
                          padreClave: "cantidad",
                          valor: undefined,
                          regla: {
                            campoPadre: "cantidad",
                            operador: "MULTIPLICAR",
                            valor: n,
                            fuente: { tipo: "PADRE", campo: "cantidad" },
                          },
                        }
                      : b,
                  ),
                );
              }}
              onBlur={() => setTexto(unidades == null ? "" : String(unidades))}
            />
            <FieldDescription>
              {unidades != null
                ? `50 productos × ${unidades} = ${50 * unidades} piezas. La cantidad se aplica una sola vez.`
                : "Al indicar una cantidad se actualiza la regla de cantidad del componente."}
            </FieldDescription>
          </Field>
        </FieldGroup>
      </CardContent>
    </Card>
  );
}
