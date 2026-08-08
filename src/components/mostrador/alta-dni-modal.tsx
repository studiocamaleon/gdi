"use client";

/**
 * Alta de cliente escaneando el DNI (docs/entrega-por-escaneo-diseno.md).
 *
 * Existe para que un pedido de mostrador deje de cargarse como "Mostrador" y
 * se pierda de quién era. Con el documento en la mano hay nombre y número:
 * el alta no le hace tipear nada al operador y no frena la atención. El
 * celular es lo único que se pide, y se puede saltear.
 *
 * Los datos del documento se muestran pero no se editan: si están mal, está
 * mal el documento. Lo editable vive en la ficha del cliente.
 */

import * as React from "react";
import { IdCardIcon, InfoIcon, XIcon } from "lucide-react";
import { toast } from "sonner";

import { altaClientePorDocumento } from "@/lib/clientes-api";
import type { ClienteDetalle } from "@/lib/clientes";
import {
  cuilDesdeDocumento,
  type DatosDocumento,
} from "@/lib/dni-argentino";
import s from "./alta-dni-modal.module.css";

/** "37555536" → "37.555.536" */
function conPuntos(documento: string) {
  return documento.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export function AltaDniModal({
  datos,
  onClose,
  onCreado,
}: {
  datos: DatosDocumento;
  onClose: () => void;
  /** El cliente listo para usar; `yaExistia` si el DNI ya estaba cargado. */
  onCreado?: (cliente: ClienteDetalle, yaExistia: boolean) => void;
}) {
  const [codigo, setCodigo] = React.useState("+54");
  const [numero, setNumero] = React.useState("");
  const [guardando, setGuardando] = React.useState(false);
  const cuil = cuilDesdeDocumento(datos.documento, datos.sexo);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !guardando) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, guardando]);

  const crear = async () => {
    setGuardando(true);
    try {
      const r = await altaClientePorDocumento({
        nombre: datos.nombreCompleto,
        documento: datos.documento,
        ...(cuil ? { cuit: cuil } : {}),
        ...(numero.trim()
          ? { telefonoCodigo: codigo.trim(), telefonoNumero: numero.trim() }
          : {}),
      });
      toast.success(
        r.yaExistia
          ? `${r.cliente.nombre} ya estaba cargado: se usa ese.`
          : `Cliente ${r.cliente.nombre} creado.`,
      );
      onCreado?.(r.cliente, r.yaExistia);
      onClose();
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "No se pudo crear el cliente.",
      );
      setGuardando(false);
    }
  };

  return (
    <div className={s.overlay} onClick={() => !guardando && onClose()}>
      <div
        className={s.modal}
        role="dialog"
        aria-modal="true"
        aria-label="Alta de cliente por documento"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className={s.close}
          onClick={onClose}
          aria-label="Cerrar"
          disabled={guardando}
        >
          <XIcon />
        </button>

        <div className={s.head}>
          <span className={s.ico}>
            <IdCardIcon />
          </span>
          <div>
            <h2>Documento escaneado</h2>
            <div className={s.sub}>Se da de alta como cliente.</div>
          </div>
        </div>

        <dl className={s.datos}>
          <div className={s.nombre}>{datos.nombreCompleto}</div>
          <div className={s.fila}>
            <dt>Documento</dt>
            <dd>{conPuntos(datos.documento)}</dd>
          </div>
          {cuil ? (
            <div className={s.fila}>
              <dt>CUIL</dt>
              <dd>{cuil}</dd>
            </div>
          ) : null}
        </dl>

        <div className={s.field}>
          <label htmlFor="alta-dni-tel">Celular (opcional)</label>
          <div className={s.tel}>
            <input
              className={s.cod}
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              aria-label="Código de país"
            />
            <input
              id="alta-dni-tel"
              className={s.num}
              value={numero}
              inputMode="tel"
              placeholder="11 5555 5555"
              onChange={(e) => setNumero(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !guardando) void crear();
              }}
            />
          </div>
          <span className={s.hint}>
            Sin celular no se le puede avisar por WhatsApp cuando el trabajo
            esté listo. Se puede cargar después.
          </span>
        </div>

        <div className={s.existe}>
          <InfoIcon />
          <span>
            Si este documento ya estaba cargado, se usa ese cliente en vez de
            crear uno repetido.
          </span>
        </div>

        <div className={s.foot}>
          <button
            type="button"
            className="btn"
            onClick={onClose}
            disabled={guardando}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void crear()}
            disabled={guardando}
          >
            {guardando ? "Creando…" : "Crear cliente"}
          </button>
        </div>
      </div>
    </div>
  );
}
