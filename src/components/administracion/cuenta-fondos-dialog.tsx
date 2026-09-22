"use client";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SelectField } from "@/components/design-system/select-field";
import { TesoreriaDialog } from "./tesoreria-dialog";
import type { CuentaFondos } from "@/lib/administracion";
import { monedas } from "@/lib/monedas";
import styles from "./tesoreria-view.module.css";

function selector(
  value: string,
  onValueChange: (value: string) => void,
  opciones: Array<{ value: string; label: string }>,
  ariaLabel: string,
) {
  return (
    <SelectField
      value={value}
      onChange={onValueChange}
      options={opciones}
      aria-label={ariaLabel}
    />
  );
}

export function CuentaDialog({
  open,
  cuenta,
  monedaLocal,
  ocupado,
  onOpenChange,
  onGuardar,
}: {
  open: boolean;
  cuenta?: CuentaFondos;
  monedaLocal: string;
  ocupado: boolean;
  onOpenChange: (open: boolean) => void;
  onGuardar: (payload: {
    tipo: string;
    nombre: string;
    banco?: string;
    cbuAlias?: string;
    moneda: string;
    saldoInicial?: number;
    permiteSaldoNegativo: boolean;
  }) => void;
}) {
  const [tipo, setTipo] = React.useState(cuenta?.tipo ?? "banco");
  const [nombre, setNombre] = React.useState(cuenta?.nombre ?? "");
  const [banco, setBanco] = React.useState(cuenta?.banco ?? "");
  const [alias, setAlias] = React.useState(cuenta?.cbuAlias ?? "");
  const [moneda, setMoneda] = React.useState(cuenta?.moneda ?? monedaLocal);
  const [saldoInicial, setSaldoInicial] = React.useState("");
  const [negativo, setNegativo] = React.useState(
    cuenta?.permiteSaldoNegativo ?? false,
  );
  const invalido = !nombre.trim();

  return (
    <TesoreriaDialog
      open={open}
      onOpenChange={onOpenChange}
      seccion="Administración · Cuentas de cobro"
      title={cuenta ? "Editar cuenta" : "Nueva cuenta"}
      description={
        <>
          {cuenta
            ? "Actualizá los datos operativos. La moneda no cambia después del primer movimiento."
            : "Registrá la cuenta con su moneda y, si corresponde, el saldo con el que comienza."}
        </>
      }
    >
      <FieldGroup className={styles.formBody}>
        <Field>
          <FieldLabel htmlFor="tes-cuenta-tipo">Tipo</FieldLabel>
          {selector(
            tipo,
            setTipo,
            [
              { value: "caja", label: "Caja de efectivo" },
              { value: "banco", label: "Cuenta bancaria" },
              { value: "billetera", label: "Billetera virtual" },
            ],
            "Tipo de cuenta",
          )}
        </Field>
        <Field data-invalid={invalido || undefined}>
          <FieldLabel htmlFor="tes-cuenta-nombre">Nombre</FieldLabel>
          <Input
            id="tes-cuenta-nombre"
            value={nombre}
            onChange={(event) => setNombre(event.target.value)}
            placeholder="Ej. Banco Galicia · cuenta corriente"
            aria-invalid={invalido || undefined}
          />
          {invalido ? <FieldError>Ingresá un nombre.</FieldError> : null}
        </Field>
        <div className={styles.formGrid}>
          <Field>
            <FieldLabel htmlFor="tes-cuenta-banco">Banco / detalle</FieldLabel>
            <Input
              id="tes-cuenta-banco"
              value={banco}
              onChange={(event) => setBanco(event.target.value)}
              placeholder="Opcional"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="tes-cuenta-alias">CBU / alias</FieldLabel>
            <Input
              id="tes-cuenta-alias"
              value={alias}
              onChange={(event) => setAlias(event.target.value)}
              placeholder="Opcional"
            />
          </Field>
        </div>
        <div className={styles.formGrid}>
          <Field>
            <FieldLabel htmlFor="tes-cuenta-moneda">Moneda</FieldLabel>
            {selector(
              moneda,
              setMoneda,
              monedas.map((item) => ({
                value: item.codigo,
                label: `${item.codigo} · ${item.nombre}`,
              })),
              "Moneda de la cuenta",
            )}
          </Field>
          {!cuenta ? (
            <Field>
              <FieldLabel htmlFor="tes-cuenta-saldo">Saldo inicial</FieldLabel>
              <Input
                id="tes-cuenta-saldo"
                type="number"
                min={0}
                value={saldoInicial}
                onChange={(event) => setSaldoInicial(event.target.value)}
                placeholder="0"
              />
              <FieldDescription>
                Se registra como movimiento conciliado.
              </FieldDescription>
            </Field>
          ) : null}
        </div>
        <Field orientation="horizontal" className={styles.formOption}>
          <Checkbox
            id="tes-cuenta-negativo"
            aria-label="Permitir saldo negativo"
            checked={negativo}
            onCheckedChange={(checked) => setNegativo(checked === true)}
          />
          <div>
            <FieldLabel htmlFor="tes-cuenta-negativo">
              Permitir saldo negativo
            </FieldLabel>
            <FieldDescription>
              Usalo únicamente si la cuenta tiene descubierto autorizado.
            </FieldDescription>
          </div>
        </Field>
      </FieldGroup>
      <footer className={styles.formFooter}>
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Cancelar
        </Button>
        <Button
          loading={ocupado}
          loadingText="Guardando…"
          disabled={invalido}
          onClick={() =>
            onGuardar({
              tipo,
              nombre: nombre.trim(),
              banco: banco.trim() || undefined,
              cbuAlias: alias.trim() || undefined,
              moneda,
              saldoInicial:
                saldoInicial && Number(saldoInicial) > 0
                  ? Number(saldoInicial)
                  : undefined,
              permiteSaldoNegativo: negativo,
            })
          }
        >
          Guardar cuenta
        </Button>
      </footer>
    </TesoreriaDialog>
  );
}
