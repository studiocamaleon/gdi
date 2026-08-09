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

import {
  altaClientePorDocumento,
  avisarClienteEscaneado,
  buscarClientePorDocumento,
} from "@/lib/clientes-api";
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

  // Se busca ANTES de ofrecer el alta: si el cliente ya está, el operador
  // tiene que verlo de entrada y no después de completar el formulario.
  // `undefined` = buscando todavía.
  const [existente, setExistente] = React.useState<
    ClienteDetalle | null | undefined
  >(undefined);
  React.useEffect(() => {
    let vivo = true;
    buscarClientePorDocumento(datos.documento)
      .then((r) => {
        if (!vivo) return;
        setExistente(r.cliente);
        // Si el que ya está no tiene teléfono, el celular que se cargue acá
        // sirve para completarlo: se deja el campo listo.
        if (r.cliente?.telefonoNumero) setNumero(r.cliente.telefonoNumero);
      })
      .catch(() => {
        // Sin respuesta se sigue como si no existiera: el alta es
        // idempotente en el backend, así que no se duplica igual.
        if (vivo) setExistente(null);
      });
    return () => {
      vivo = false;
    };
  }, [datos.documento]);

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
      // Aviso global: la ficha que el operador tenga abierta lo toma como
      // cliente de la orden. Sin esto el alta quedaba en la nada — había que
      // ir a buscarlo a mano en el selector.
      avisarClienteEscaneado(r.cliente);
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
            <h2>
              {existente ? "Cliente ya registrado" : "Documento escaneado"}
            </h2>
            <div className={s.sub}>
              {existente === undefined
                ? "Buscando si ya está cargado…"
                : existente
                  ? "Se usa el que ya está, no se crea otro."
                  : "Se da de alta como cliente."}
            </div>
          </div>
        </div>

        <dl className={s.datos}>
          {/* Con un cliente ya cargado manda SU nombre, no el del documento:
              puede haberlo corregido o completado alguien. */}
          <div className={s.nombre}>
            {existente?.nombre ?? datos.nombreCompleto}
          </div>
          <div className={s.fila}>
            <dt>Documento</dt>
            <dd>{conPuntos(datos.documento)}</dd>
          </div>
          {existente?.telefonoNumero ? (
            <div className={s.fila}>
              <dt>Celular</dt>
              <dd>
                {existente.telefonoCodigo} {existente.telefonoNumero}
              </dd>
            </div>
          ) : cuil ? (
            <div className={s.fila}>
              <dt>CUIL</dt>
              <dd>{cuil}</dd>
            </div>
          ) : null}
        </dl>

        {/* Con teléfono ya cargado no hay nada que pedir. Si el cliente
            existe pero le falta, es la oportunidad de completarlo: lo tenés
            enfrente. */}
        {existente?.telefonoNumero ? null : (
        <div className={s.field}>
          <label htmlFor="alta-dni-tel">
            {existente ? "Celular que falta (opcional)" : "Celular (opcional)"}
          </label>
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
        )}

        {existente ? (
          <div className={s.existe}>
            <InfoIcon />
            <span>
              Ya estaba cargado
              {existente.origenAlta === "mostrador"
                ? " desde el mostrador"
                : ""}
              . Se usa ese cliente y no se crea uno repetido.
            </span>
          </div>
        ) : null}

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
            disabled={guardando || existente === undefined}
          >
            {guardando
              ? "Guardando…"
              : existente
                ? "Usar este cliente"
                : "Crear cliente"}
          </button>
        </div>
      </div>
    </div>
  );
}
