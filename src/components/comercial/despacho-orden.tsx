"use client";

import { useEffect, useId, useState } from "react";
import { MapPin, Store, Truck } from "lucide-react";
import { ActionButton } from "@/components/design-system/action-button";
import { IconChoiceGroup } from "@/components/design-system/choice-controls";
import { FormDialog } from "@/components/design-system/form-dialog";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
import { getClientes } from "@/lib/clientes-api";
import type { DespachoOrden } from "@/lib/ordenes-trabajo";
import type { ClienteOpcion } from "./cliente-selector-orden";
import { OrdenCampoLabel } from "./orden-workspace";
import styles from "./orden-financial-forms.module.css";

const puntos = [
  { value: "local", label: "Retiro en el local", icon: <Store aria-hidden /> },
  {
    value: "despacho",
    label: "Despacho por transporte",
    icon: <Truck aria-hidden />,
  },
];

type ClienteDestino = Pick<ClienteOpcion, "id" | "ciudad" | "direcciones">;

function destinoCliente(cliente?: ClienteDestino): DespachoOrden {
  const direcciones = cliente?.direcciones ?? [];
  const destino =
    direcciones.find((d) => d.tipo === "entrega" && d.principal) ??
    direcciones.find((d) => d.tipo === "entrega") ??
    direcciones.find((d) => d.tipo === "principal");
  return {
    localidad:
      destino?.ciudad?.trim() ||
      cliente?.ciudad?.trim() ||
      direcciones.find((d) => d.principal)?.ciudad?.trim() ||
      "",
    direccion: [
      destino?.direccion,
      destino?.numero,
      destino?.codigoPostal && `(CP ${destino.codigoPostal})`,
    ]
      .filter(Boolean)
      .join(" "),
    transporte: "",
  };
}

const campos = [
  { clave: "localidad", label: "Localidad de destino", maxLength: 80 },
  { clave: "direccion", label: "Domicilio o sucursal", maxLength: 160 },
  { clave: "transporte", label: "Transporte", maxLength: 80 },
] as const;

function DatosDespachoDialog({
  valor,
  cliente,
  editable,
  cerrar,
  guardar,
}: {
  valor: DespachoOrden | null;
  cliente?: ClienteDestino;
  editable: boolean;
  cerrar: () => void;
  guardar: (destino: DespachoOrden) => void;
}) {
  const id = useId();
  const [ficha, setFicha] = useState<ClienteDestino>();
  const [cambios, setCambios] = useState<Partial<DespachoOrden>>({});
  // Algunas OT antiguas sólo traen la referencia al cliente. Consultar al abrir
  // el modal y priorizar siempre el destino acordado o lo que se esté editando.
  const idPendiente =
    !valor && cliente?.direcciones === undefined ? cliente?.id : undefined;
  useEffect(() => {
    if (!idPendiente) return;
    let vigente = true;
    getClientes({ id: idPendiente, limit: 1, incluirInactivos: true }, true)
      .then(([detalle]) => {
        if (vigente) setFicha(detalle);
      })
      .catch(() => {
        /* Si la ficha no está disponible, se puede escribir el destino. */
      });
    return () => {
      vigente = false;
    };
  }, [idPendiente]);
  const datos = { ...(valor ?? destinoCliente(ficha ?? cliente)), ...cambios };
  return (
    <FormDialog
      isOpen
      onOpenChange={(open) => {
        if (!open) cerrar();
      }}
      className={styles.despachoDialog}
      title="Datos del despacho"
      description={
        editable
          ? "Indicá a dónde se envía esta orden."
          : "Destino acordado para esta orden."
      }
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          if (!editable || !datos.localidad.trim()) return;
          guardar({
            localidad: datos.localidad.trim(),
            direccion: datos.direccion.trim(),
            transporte: datos.transporte.trim(),
          });
        }}
      >
        <div className={styles.body}>
          {campos.map(({ clave, label, maxLength }) => (
            <Field key={clave}>
              <FieldLabel htmlFor={id + clave}>
                {label}
                {editable && clave !== "localidad" && (
                  <span className="text-muted-foreground">(opcional)</span>
                )}
              </FieldLabel>
              {editable ? (
                <Input
                  id={id + clave}
                  maxLength={maxLength}
                  required={clave === "localidad"}
                  value={datos[clave]}
                  onChange={(event) => {
                    const texto = event.target.value;
                    setCambios((previo) => ({ ...previo, [clave]: texto }));
                  }}
                />
              ) : (
                <span id={id + clave} className="text-sm">
                  {datos[clave] || "Sin especificar"}
                </span>
              )}
            </Field>
          ))}
        </div>
        <div className={styles.footer}>
          <ActionButton type="button" variant="outline" onPress={cerrar}>
            {editable ? "Cancelar" : "Cerrar"}
          </ActionButton>
          {editable && (
            <ActionButton type="submit" isDisabled={!datos.localidad.trim()}>
              Guardar despacho
            </ActionButton>
          )}
        </div>
      </form>
    </FormDialog>
  );
}

export function DespachoOrdenCampo({
  valor,
  editable,
  cliente,
  onChange,
}: {
  valor: DespachoOrden | null;
  editable: boolean;
  cliente?: ClienteDestino;
  onChange: (valor: DespachoOrden | null) => void;
}) {
  const id = useId();
  const [abierto, setAbierto] = useState(false);
  return (
    <div className="flex min-w-0 flex-col items-start gap-2">
      <OrdenCampoLabel id={id + "-label"} icon={<MapPin />}>
        Punto de entrega
      </OrdenCampoLabel>
      {editable && (
        <IconChoiceGroup
          aria-labelledby={id + "-label"}
          aria-describedby={id + "-detalle"}
          value={valor || abierto ? "despacho" : "local"}
          options={puntos}
          onChange={(punto) => {
            if (punto === "despacho") setAbierto(true);
            else onChange(null);
          }}
        />
      )}
      <div
        id={id + "-detalle"}
        className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-xs text-muted-foreground"
      >
        <span>
          {valor ? `Despacho a ${valor.localidad}` : "Retiro en el local"}
        </span>
        {valor && (
          <button
            type="button"
            className="text-foreground underline underline-offset-2"
            onClick={() => setAbierto(true)}
          >
            {editable ? "Editar despacho" : "Ver despacho"}
          </button>
        )}
      </div>
      {abierto && (
        <DatosDespachoDialog
          valor={valor}
          cliente={cliente}
          editable={editable}
          cerrar={() => setAbierto(false)}
          guardar={(datos) => {
            onChange(datos);
            setAbierto(false);
          }}
        />
      )}
    </div>
  );
}
