"use client";

import * as React from "react";
import { toast } from "sonner";

import {
  activarAfip,
  desactivarAfip,
  getAfip,
  verificarAfip,
  type AfipIntegracion,
} from "@/lib/integraciones-api";
import { fechaCorta } from "@/lib/integraciones";

/**
 * La integración AFIP: NO es "conectar con credenciales", es delegación. El
 * cliente no sube certificado — delega su facturación a Grafo desde ARCA, y acá
 * verifica que esa delegación se hizo y enciende el botón Facturar.
 * Ver docs/integracion-afip-delegacion-diseno.md
 */
export function AfipDetalle({
  inicial,
  onVolver,
}: {
  inicial: AfipIntegracion;
  onVolver: () => void;
}) {
  const [datos, setDatos] = React.useState(inicial);
  const [verificando, setVerificando] = React.useState(false);
  const [cambiando, setCambiando] = React.useState(false);

  const activa = datos.estado === "CONECTADA";
  const emisor = datos.emisor;
  const faltanDatos = !emisor.cuit || emisor.puntosVenta.length === 0;

  const verificar = async () => {
    if (verificando) return;
    setVerificando(true);
    try {
      const r = await verificarAfip();
      setDatos(await getAfip());
      if (r.ok) {
        toast.success("Delegación verificada: ARCA nos deja facturar con tu CUIT.");
      } else {
        toast.error(r.motivo ?? "No se pudo verificar la delegación.");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo verificar.");
    } finally {
      setVerificando(false);
    }
  };

  const toggle = async () => {
    if (cambiando) return;
    setCambiando(true);
    try {
      const d = activa ? await desactivarAfip() : await activarAfip();
      setDatos(d);
      if (!activa && d.estado !== "CONECTADA") {
        toast.error(
          d.ultimoErrorTexto ?? "No se pudo activar: revisá la delegación.",
        );
      } else if (!activa) {
        toast.success("Facturación electrónica activada.");
      } else {
        toast.success("Facturación electrónica desactivada.");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo cambiar el estado.");
    } finally {
      setCambiando(false);
    }
  };

  const estadoPill = (() => {
    if (activa) return { dot: "ok", txt: "Delegación verificada", tono: "ok" };
    if (datos.estado === "ERROR")
      return { dot: "warn", txt: "La verificación falló", tono: "warn" };
    return { dot: "off", txt: "Sin verificar", tono: "off" };
  })();

  return (
    <div className="int-detail">
      <div className="int-detail-top">
        <button className="btn ghost" onClick={onVolver}>
          ← Integraciones
        </button>
      </div>

      <div className="int-hero">
        <span className="afip-logo">ARCA</span>
        <div className="int-hero-body">
          <div className="eyebrow">
            <span>Facturación</span>
            <span className="sep">·</span>
            <span>Por ARCA (ex AFIP)</span>
          </div>
          <h1>
            AFIP{" "}
            <span style={{ color: "var(--muted-text)", fontWeight: 500 }}>
              · facturación electrónica
            </span>
          </h1>
          <div className="sub">
            Emití facturas directamente desde Grafoprint. No subís ningún
            certificado: delegás tu facturación a Grafo desde ARCA, una sola vez.
          </div>
        </div>
        <div className="int-hero-side">
          <div className="connection-card">
            <div className="cc-row">
              <span className={`dot ${estadoPill.dot}`} />
              <span className="status">{estadoPill.txt}</span>
            </div>
            <div className="afip-cc-cuit">
              <div className="c">CUIT {emisor.cuit ?? "—"}</div>
              <div className="r">{emisor.razonSocial ?? "Cargá tus datos fiscales"}</div>
            </div>
            <button
              className="btn btn-primary"
              style={{ width: "100%", justifyContent: "center" }}
              onClick={() => void verificar()}
              disabled={verificando || faltanDatos}
            >
              {verificando ? "Verificando…" : "Verificar delegación"}
            </button>
          </div>
        </div>
      </div>

      <div className={`afip-env-switch ${datos.ambiente === "prod" ? "prod" : "homo"}`}>
        <div className="afip-env-info">
          <span className="afip-env-label">Ambiente activo</span>
          <div className="afip-env-state">
            <span className={`dot ${datos.ambiente === "prod" ? "ok" : "warn"}`} />
            <strong>{datos.ambiente === "prod" ? "Producción" : "Homologación"}</strong>
            <span className="meta">
              {datos.ambiente === "prod"
                ? "— los comprobantes generan CAE real y son fiscalmente válidos."
                : "— modo de pruebas, los CAE son ficticios."}
            </span>
          </div>
        </div>
      </div>

      <div className="int-content">
        {faltanDatos && (
          <div className="int-info-box" style={{ marginBottom: 18 }}>
            <span className="afip-i">i</span>
            <div>
              <strong>Faltan datos fiscales.</strong> Cargá el CUIT del emisor y
              al menos un punto de venta en Administración → Configuración fiscal
              antes de verificar la delegación.
            </div>
          </div>
        )}

        <div className="afip-cols">
          <div>
            <div className="int-section-intro">
              <h3>Datos fiscales del emisor</h3>
              <p>
                Salen de tu padrón en ARCA y se imprimen en cada comprobante. Se
                editan en Configuración fiscal.
              </p>
            </div>
            <div className="cred-card">
              <div className="cred-row" style={{ gridTemplateColumns: "150px 1fr" }}>
                <div className="cred-label">
                  <span className="lbl">CUIT</span>
                  <span className="hint">lo que se delega</span>
                </div>
                <div className="cred-value">
                  <code>{emisor.cuit ?? "—"}</code>
                </div>
              </div>
              <div className="cred-row" style={{ gridTemplateColumns: "150px 1fr" }}>
                <div className="cred-label">
                  <span className="lbl">Razón social</span>
                </div>
                <div className="cred-value afip-plain">
                  {emisor.razonSocial ?? "—"}
                </div>
              </div>
              <div className="cred-row" style={{ gridTemplateColumns: "150px 1fr" }}>
                <div className="cred-label">
                  <span className="lbl">Condición IVA</span>
                </div>
                <div className="cred-value afip-plain">
                  {emisor.condicionFiscal ?? "—"}
                </div>
              </div>
              <div className="cred-row" style={{ gridTemplateColumns: "150px 1fr" }}>
                <div className="cred-label">
                  <span className="lbl">Puntos de venta</span>
                </div>
                <div className="cred-value afip-plain">
                  {emisor.puntosVenta.length > 0
                    ? emisor.puntosVenta.map((p) => p.numeroFormateado).join(" · ")
                    : "—"}
                </div>
              </div>
            </div>
          </div>

          <div>
            <div className="int-section-intro">
              <h3>Delegación de webservices</h3>
              <p>
                {datos.esCuitPropio
                  ? "Facturás con el mismo CUIT que el certificado, así que no hay delegación: verificás que ARCA responda y activás."
                  : "No subís ningún certificado: el certificado es de Grafo. Delegás tu facturación a nuestro CUIT desde ARCA."}
              </p>
            </div>
            <div className={`afip-deleg ${estadoPill.tono}`}>
              <div className="afip-deleg-head">
                <span className={`dot ${estadoPill.dot}`} />
                <div className="b">
                  <div className="t">{estadoPill.txt}</div>
                  <div className="m">
                    {datos.ultimoChequeoEl
                      ? `última verificación ${fechaCorta(datos.ultimoChequeoEl)}`
                      : "todavía sin verificar"}
                  </div>
                </div>
              </div>
              {datos.estado === "ERROR" && datos.ultimoErrorTexto && (
                <div className="afip-deleg-err">{datos.ultimoErrorTexto}</div>
              )}
              {datos.esCuitPropio ? (
                // Facturás con el mismo CUIT que el certificado (Grupo Idea como
                // Corporearte): a uno mismo no se delega y no hace falta.
                <div className="afip-deleg-body">
                  <div className="afip-deleg-propio">
                    Sos el titular del certificado. No hay nada que delegar:
                    facturás con el CUIT propietario de la plataforma. Verificá y
                    activá.
                  </div>
                </div>
              ) : (
                <div className="afip-deleg-body">
                  <div className="k">Qué delegar en ARCA</div>
                  <div className="afip-deleg-row">
                    <span className="l">Representante</span>
                    <code>{datos.representanteCuit ?? "—"} · Grafo</code>
                  </div>
                  <div className="afip-deleg-row">
                    <span className="l">Servicio</span>
                    <code>Facturación Electrónica · wsfe</code>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="afip-activar">
          <div className="afip-activar-txt">
            <div className="t">Facturación electrónica activa</div>
            <div className="m">
              Con esto encendido aparece el botón <strong>Facturar</strong> en
              órdenes y comprobantes. Sólo se activa con{" "}
              {datos.esCuitPropio ? "la conexión verificada" : "la delegación verificada"}.
            </div>
          </div>
          <button
            type="button"
            className={`afip-toggle ${activa ? "on" : ""}`}
            role="switch"
            aria-checked={activa}
            aria-label="Activar facturación electrónica"
            onClick={() => void toggle()}
            disabled={cambiando}
          >
            <span className="knob" />
          </button>
        </div>

        <div className="int-info-box" style={{ marginTop: 12 }}>
          <span className="afip-i">i</span>
          <div>
            <strong>No necesitás subir tu certificado ni generar un CSR.</strong>{" "}
            {datos.esCuitPropio
              ? "Facturás con el certificado propietario de la plataforma, ya asociado a tu CUIT. No hay ningún paso en ARCA."
              : "Grafo factura con su propio certificado en representación de tu CUIT. Lo único que hacés es la delegación en ARCA, una sola vez."}
          </div>
        </div>
      </div>
    </div>
  );
}
