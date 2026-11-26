"use client";

import { useId } from "react";
import { Truck } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import type { ClienteDireccion } from "@/lib/clientes";
import type { DespachoOrden } from "@/lib/ordenes-trabajo";

export function DespachoOrdenCampo({
  valor,
  editable,
  direcciones,
  onChange,
}: {
  valor: DespachoOrden | null;
  editable: boolean;
  direcciones?: ClienteDireccion[];
  onChange: (valor: DespachoOrden | null) => void;
}) {
  const id = useId();
  if (!editable)
    return (
      valor && (
        <div className="flex flex-col gap-1 text-sm">
          <strong className="inline-flex items-center gap-2">
            <Truck size={16} />
            Para despachar · {valor.localidad}
          </strong>
          <span>{valor.direccion}</span>
          {valor.transporte && <span>Transporte · {valor.transporte}</span>}
        </div>
      )
    );
  const destino =
    direcciones?.find((d) => d.tipo === "entrega" && d.principal) ??
    direcciones?.find((d) => d.tipo === "entrega") ??
    direcciones?.find(
      (d) =>
        d.tipo === "principal" || (d.principal && d.tipo !== "facturacion"),
    );
  return (
    <FieldGroup>
      <Field orientation="horizontal">
        <Checkbox
          id={id}
          checked={!!valor}
          onCheckedChange={(checked) =>
            onChange(
              checked
                ? {
                    localidad: destino?.ciudad ?? "",
                    direccion: [
                      destino?.direccion,
                      destino?.numero,
                      destino?.codigoPostal && `(CP ${destino.codigoPostal})`,
                    ]
                      .filter(Boolean)
                      .join(" "),
                    transporte: "",
                  }
                : null,
            )
          }
        />
        <FieldLabel htmlFor={id}>
          <Truck size={16} />
          Despachar por transporte
        </FieldLabel>
      </Field>
      {valor && (
        <>
          <Field>
            <FieldLabel htmlFor={id + "-localidad"}>
              Localidad de destino
            </FieldLabel>
            <Input
              id={id + "-localidad"}
              required
              maxLength={80}
              value={valor.localidad}
              onChange={(e) =>
                onChange({ ...valor, localidad: e.target.value })
              }
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={id + "-direccion"}>
              Domicilio o sucursal de destino
            </FieldLabel>
            <Input
              id={id + "-direccion"}
              required
              maxLength={160}
              value={valor.direccion}
              onChange={(e) =>
                onChange({ ...valor, direccion: e.target.value })
              }
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={id + "-transporte"}>
              Transporte (opcional)
            </FieldLabel>
            <Input
              id={id + "-transporte"}
              maxLength={80}
              value={valor.transporte}
              onChange={(e) =>
                onChange({ ...valor, transporte: e.target.value })
              }
            />
          </Field>
        </>
      )}
    </FieldGroup>
  );
}
