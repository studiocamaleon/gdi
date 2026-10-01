"use client";
import * as React from "react";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { TesoreriaDialog } from "./tesoreria-dialog";
import { AGENTES_RETENCION } from "./retenciones-config-editor";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldDescription,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SelectField } from "@/components/design-system/select-field";
import {
  RETENCION_REGIMENES,
  RETENCION_REGIMEN_LABELS,
  type CobroPendienteAcreditacion,
} from "@/lib/administracion";
import type { AcreditarCobroPayload } from "@/lib/administracion-api";
import { formatearMoneda, monedaDe } from "@/lib/moneda";
import { redondearDinero } from "../../../apps/api/src/common/medios-pago";

export function CobroAcreditacionDialog({
  cobro,
  hoy,
  ocupado,
  onClose,
  onConfirmar,
}: {
  cobro: CobroPendienteAcreditacion;
  hoy: string;
  ocupado: boolean;
  onClose: () => void;
  onConfirmar: (payload: AcreditarCobroPayload) => void;
}) {
  const [fecha, setFecha] = React.useState(hoy);
  const [referencia, setReferencia] = React.useState("");
  const [comision, setComision] = React.useState(String(cobro.comisionMonto));
  const [iva, setIva] = React.useState(String(cobro.comisionIvaMonto));
  const [retenciones, setRetenciones] = React.useState(() =>
    cobro.retenciones.map((r) => ({
      regimen: r.regimen,
      jurisdiccion: r.jurisdiccion ?? "",
      agente: r.agente ?? "no_informado",
      reglaId: r.reglaId ?? undefined,
      base: String(r.base),
      alicuota: String(r.alicuota),
      monto: String(r.monto),
      nroComprobante: r.nroComprobante ?? "",
    })),
  );
  const [revisado, setRevisado] = React.useState(false);
  const fmt = (n: number) => formatearMoneda(n, monedaDe(cobro.moneda));
  const datos = retenciones.map((r) => ({
    ...r,
    base: Number(r.base),
    alicuota: Number(r.alicuota),
    monto: Number(r.monto),
    nroComprobante: r.nroComprobante.trim() || undefined,
  }));
  const disponible = redondearDinero(
    cobro.montoBruto -
      Number(comision) -
      Number(iva) -
      datos.reduce((s, r) => s + r.monto, 0),
  );
  const invalido =
    !fecha ||
    fecha > hoy ||
    !referencia.trim() ||
    !revisado ||
    !comision ||
    !iva ||
    !Number.isFinite(disponible) ||
    disponible <= 0 ||
    [
      Number(comision),
      Number(iva),
      ...datos.flatMap((r) => [r.base, r.alicuota, r.monto]),
    ].some((n) => !Number.isFinite(n) || n < 0);
  const cambiar = (i: number, campo: string, valor: string) => {
    setRevisado(false);
    setRetenciones((prev) =>
      prev.map((r, j) => (i === j ? { ...r, [campo]: valor } : r)),
    );
  };
  return (
    <TesoreriaDialog
      open
      onOpenChange={(v) => !v && !ocupado && onClose()}
      title="Confirmar liquidación"
      description={`${cobro.metodoNombre} · ${cobro.clienteNombre ?? "Cobro"} · ${fmt(cobro.montoBruto)}`}
    >
      <FieldGroup>
        <Alert>
          <AlertDescription>
            Contrastá estos importes con el comprobante del banco o procesador.
            Confirmar registra el ingreso de dinero; el importe pagado por el
            cliente se mantiene.
          </AlertDescription>
        </Alert>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="liquidacion-fecha">
              Fecha real de acreditación
            </FieldLabel>
            <Input
              id="liquidacion-fecha"
              type="date"
              max={hoy}
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="liquidacion-ref">
              Comprobante / referencia
            </FieldLabel>
            <Input
              id="liquidacion-ref"
              maxLength={100}
              value={referencia}
              onChange={(e) => setReferencia(e.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="liquidacion-comision">
              Comisión real
            </FieldLabel>
            <Input
              id="liquidacion-comision"
              type="number"
              min={0}
              step="0.01"
              value={comision}
              onChange={(e) => {
                setComision(e.target.value);
                setRevisado(false);
              }}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="liquidacion-iva">
              IVA de la comisión
            </FieldLabel>
            <Input
              id="liquidacion-iva"
              type="number"
              min={0}
              step="0.01"
              value={iva}
              onChange={(e) => {
                setIva(e.target.value);
                setRevisado(false);
              }}
            />
          </Field>
        </div>
        {retenciones.map((r, i) => (
          <FieldGroup key={i}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel>Régimen</FieldLabel>
                <SelectField
                  aria-label={`Régimen de retención ${i + 1}`}
                  value={r.regimen}
                  onChange={(v) => cambiar(i, "regimen", v)}
                  options={[...RETENCION_REGIMENES, "otro"].map((value) => ({
                    value,
                    label: RETENCION_REGIMEN_LABELS[value],
                  }))}
                />
              </Field>
              <Field>
                <FieldLabel>Quién retuvo</FieldLabel>
                <SelectField
                  aria-label={`Agente de retención ${i + 1}`}
                  value={r.agente}
                  onChange={(v) => cambiar(i, "agente", v)}
                  options={[
                    ...AGENTES_RETENCION,
                    {
                      value: "no_informado",
                      label: "Sin informar (histórico)",
                    },
                  ]}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor={`liq-jur-${i}`}>Jurisdicción</FieldLabel>
                <Input
                  id={`liq-jur-${i}`}
                  value={r.jurisdiccion}
                  maxLength={60}
                  onChange={(e) => cambiar(i, "jurisdiccion", e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor={`liq-base-${i}`}>
                  Base de la retención
                </FieldLabel>
                <Input
                  id={`liq-base-${i}`}
                  type="number"
                  min={0}
                  step="0.01"
                  value={r.base}
                  onChange={(e) => cambiar(i, "base", e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor={`liq-pct-${i}`}>Alícuota (%)</FieldLabel>
                <Input
                  id={`liq-pct-${i}`}
                  type="number"
                  min={0}
                  max={100}
                  step="0.001"
                  value={r.alicuota}
                  onChange={(e) => cambiar(i, "alicuota", e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor={`liq-monto-${i}`}>
                  Importe retenido real
                </FieldLabel>
                <Input
                  id={`liq-monto-${i}`}
                  type="number"
                  min={0}
                  step="0.01"
                  value={r.monto}
                  onChange={(e) => cambiar(i, "monto", e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor={`liq-comprobante-${i}`}>
                  Comprobante de retención
                </FieldLabel>
                <Input
                  id={`liq-comprobante-${i}`}
                  value={r.nroComprobante}
                  maxLength={40}
                  placeholder="Usar referencia de liquidación"
                  onChange={(e) => cambiar(i, "nroComprobante", e.target.value)}
                />
              </Field>
            </div>
            <Button
              variant="ghost"
              size="sm"
              disabled={ocupado}
              onClick={() => {
                setRetenciones((p) => p.filter((_, j) => j !== i));
                setRevisado(false);
              }}
            >
              <Trash2Icon data-icon="inline-start" />
              Quitar retención {i + 1}
            </Button>
          </FieldGroup>
        ))}
        <Button
          variant="outline"
          disabled={ocupado || retenciones.length >= 20}
          onClick={() => {
            setRetenciones((p) => [
              ...p,
              {
                regimen: "SIRTAC",
                agente: "procesador",
                reglaId: undefined,
                jurisdiccion: "",
                base: String(cobro.montoBruto),
                alicuota: "0",
                monto: "0",
                nroComprobante: "",
              },
            ]);
            setRevisado(false);
          }}
        >
          <PlusIcon data-icon="inline-start" />
          Agregar retención
        </Button>
        <FieldDescription>
          Previsto al registrar: {fmt(cobro.disponibleReal)}. Las retenciones
          son pagos a cuenta de impuestos y no vuelven a descontarse del margen
          del producto.
        </FieldDescription>
        <p className="text-lg font-semibold">
          Ingreso real a la cuenta: {fmt(disponible)}
        </p>
        <Field orientation="horizontal">
          <Checkbox
            id="liquidacion-revisada"
            checked={revisado}
            onCheckedChange={(checked) => setRevisado(checked)}
          />
          <FieldLabel htmlFor="liquidacion-revisada">
            Verifiqué fecha e importes contra la liquidación recibida.
          </FieldLabel>
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="outline" disabled={ocupado} onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={ocupado || invalido}
            onClick={() =>
              onConfirmar({
                fecha,
                referencia: referencia.trim(),
                comisionMonto: Number(comision),
                comisionIvaMonto: Number(iva),
                retenciones: datos,
              })
            }
          >
            {ocupado ? "Confirmando…" : "Confirmar acreditación"}
          </Button>
        </div>
      </FieldGroup>
    </TesoreriaDialog>
  );
}
