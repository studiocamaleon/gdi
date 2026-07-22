"use client";

import * as React from "react";
import { toast } from "sonner";

import { ConfirmacionDestructiva } from "@/components/ui/confirmacion-destructiva";
import {
  CATALOGO,
  ETIQUETA_ESTADO,
  fechaCorta,
  itemDe,
  type CatalogoItem,
  type EstadoIntegracion,
  type Integracion,
  type ProveedorIntegracion,
} from "@/lib/integraciones";
import {
  conectarWati,
  desconectarIntegracion,
  getIntegraciones,
  probarIntegracion,
  type EstadoIntegraciones,
} from "@/lib/integraciones-api";

/* ─────────── Iconos (calcados del diseño, sin dependencias) ─────────── */

const Ico = {
  Wa: () => (
    <svg viewBox="0 0 32 32" width="22" height="22" fill="#fff">
      <path d="M24.5 19.4c-.4-.2-2.3-1.1-2.7-1.3-.4-.1-.6-.2-.9.2-.3.4-1 1.3-1.2 1.5-.2.2-.4.3-.8.1-.4-.2-1.7-.6-3.3-2-.8-.7-1.5-1.6-1.8-2-.2-.4 0-.6.2-.8.2-.2.4-.5.5-.7.2-.2.2-.4.3-.6.1-.2 0-.5-.1-.7-.1-.2-.9-2.1-1.2-2.9-.3-.7-.6-.7-.9-.7l-.7 0c-.2 0-.6.1-1 .5-.4.4-1.3 1.3-1.3 3.2 0 1.9 1.4 3.7 1.6 4 .2.2 2.7 4.1 6.5 5.7.9.4 1.6.6 2.2.8.9.3 1.7.2 2.4.2.7-.1 2.3-.9 2.6-1.9.3-.9.3-1.7.2-1.9-.1-.2-.4-.3-.7-.5ZM16 4C9.4 4 4 9.4 4 16c0 2.2.6 4.4 1.7 6.2L4 28l5.9-1.6c1.8 1 3.9 1.5 6 1.5 6.6 0 12-5.4 12-12S22.6 4 16 4Z" />
    </svg>
  ),
  Arca: () => (
    <svg viewBox="0 0 32 32" width="22" height="22">
      <rect width="32" height="32" rx="6" fill="#fff" />
      <path
        d="M9 21V11l3-2 4 1.5L20 9l3 2v10"
        stroke="#0066b2"
        strokeWidth="2"
        fill="none"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <path d="M12 21v-7M20 21v-7" stroke="#0066b2" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  MP: () => (
    <svg viewBox="0 0 32 32" width="22" height="22">
      <circle cx="16" cy="16" r="12" fill="#fff" />
      <path
        d="M16 9c2.2 0 4 1.4 4.6 3.3.4 1.2.3 2.5-.2 3.7-.5 1.1-1.4 2-2.5 2.5 1.1-2.7-.5-4.6-1.9-4.6-1.5 0-3 1.9-1.9 4.6-1.1-.5-2-1.4-2.5-2.5-.5-1.2-.6-2.5-.2-3.7C12 10.4 13.8 9 16 9Z"
        fill="#009ee3"
      />
    </svg>
  ),
  Arr: () => (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  ),
  Back: () => (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12H5M11 6l-6 6 6 6" />
    </svg>
  ),
  Check: () => (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12l4 4 10-10" />
    </svg>
  ),
  Copy: () => (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h10" />
    </svg>
  ),
  Refresh: () => (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 0 1 15.7-6M21 5v5h-5M21 12a9 9 0 0 1-15.7 6M3 19v-5h5" />
    </svg>
  ),
  External: () => (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
      <path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" />
    </svg>
  ),
  Alerta: () => (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v5M12 16.5v.01" />
    </svg>
  ),
};

function Logo({ proveedor, size = 44 }: { proveedor: ProveedorIntegracion; size?: number }) {
  const item = itemDe(proveedor);
  const glifo = {
    WATI: <Ico.Wa />,
    AFIP: <Ico.Arca />,
    MERCADOPAGO: <Ico.MP />,
  }[proveedor];
  return (
    <div className="int-logo" style={{ width: size, height: size, background: item.color }}>
      {glifo}
    </div>
  );
}

/* ═══════════════ Índice ═══════════════ */

export function IntegracionesView({ inicial }: { inicial: EstadoIntegraciones }) {
  const [datos, setDatos] = React.useState(inicial);
  const [abierta, setAbierta] = React.useState<ProveedorIntegracion | null>(null);

  const recargar = React.useCallback(async () => {
    try {
      setDatos(await getIntegraciones());
    } catch {
      // El detalle ya avisa por toast; no vale romper la vista por esto.
    }
  }, []);

  const estadoDe = (p: ProveedorIntegracion): EstadoIntegracion =>
    datos.integraciones.find((i) => i.proveedor === p)?.estado ?? "DESCONECTADA";

  if (abierta === "WATI") {
    return (
      <WatiDetalle
        integracion={datos.integraciones.find((i) => i.proveedor === "WATI") ?? null}
        cifradoDisponible={datos.cifradoDisponible}
        onVolver={() => {
          setAbierta(null);
          void recargar();
        }}
        onCambio={recargar}
      />
    );
  }

  const conectadas = CATALOGO.filter((c) => estadoDe(c.proveedor) === "CONECTADA");
  const resto = CATALOGO.filter((c) => estadoDe(c.proveedor) !== "CONECTADA");

  return (
    <div className="int-page">
      <div className="page-head">
        <div className="title-block">
          <h1>Integraciones</h1>
          <div className="sub">
            Conectá Grafoprint con las herramientas que ya usás. Las credenciales
            son de tu empresa: cada una administra las suyas.
          </div>
        </div>
      </div>

      {!datos.cifradoDisponible && (
        <div className="int-info-box" style={{ marginBottom: 18 }}>
          <Ico.Alerta />
          <div>
            <strong>No se pueden guardar credenciales en este entorno.</strong>{" "}
            Falta configurar la clave de cifrado del servidor. Avisale a quien
            administra la instalación antes de cargar ningún token.
          </div>
        </div>
      )}

      {conectadas.length > 0 && (
        <Seccion titulo="Conectadas" cuenta={conectadas.length}>
          {conectadas.map((c) => (
            <Card
              key={c.proveedor}
              item={c}
              integracion={datos.integraciones.find((i) => i.proveedor === c.proveedor)}
              onAbrir={setAbierta}
            />
          ))}
        </Seccion>
      )}

      <Seccion titulo="Disponibles" cuenta={resto.length}>
        {resto.map((c) => (
          <Card
            key={c.proveedor}
            item={c}
            integracion={datos.integraciones.find((i) => i.proveedor === c.proveedor)}
            onAbrir={setAbierta}
          />
        ))}
      </Seccion>
    </div>
  );
}

function Seccion({
  titulo,
  cuenta,
  children,
}: {
  titulo: string;
  cuenta: number;
  children: React.ReactNode;
}) {
  return (
    <div className="int-section">
      <div className="int-section-head">
        <h3>{titulo}</h3>
        <span className="rule" />
        <span className="ct">{cuenta}</span>
      </div>
      <div className="int-grid">{children}</div>
    </div>
  );
}

function Card({
  item,
  integracion,
  onAbrir,
}: {
  item: CatalogoItem;
  integracion?: Integracion;
  onAbrir: (p: ProveedorIntegracion) => void;
}) {
  const estado = integracion?.estado ?? "DESCONECTADA";
  const clase = item.disponible
    ? estado === "CONECTADA"
      ? "status-connected"
      : "status-available"
    : "status-coming-soon";

  return (
    <div
      className={`int-card ${clase}`}
      onClick={() => item.disponible && onAbrir(item.proveedor)}
      role={item.disponible ? "button" : undefined}
      tabIndex={item.disponible ? 0 : undefined}
      onKeyDown={(e) => {
        if (item.disponible && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onAbrir(item.proveedor);
        }
      }}
    >
      <div className="int-card-head">
        <Logo proveedor={item.proveedor} />
        <div className="int-card-titles">
          <div className="nm">{item.nombre}</div>
          <div className="cat">{item.categoria}</div>
        </div>
        {estado === "CONECTADA" && (
          <span className="int-status ok">
            <span className="dot" />
            Conectada
          </span>
        )}
        {estado === "ERROR" && <span className="int-status muted">Con problemas</span>}
        {!item.disponible && <span className="int-status muted">Próximamente</span>}
      </div>
      <div className="int-card-desc">{item.descripcion}</div>
      <div className="int-card-foot">
        <span className="installs">
          {estado === "CONECTADA" && integracion?.conectadaEl
            ? `Desde el ${fechaCorta(integracion.conectadaEl).slice(0, 10)}`
            : ETIQUETA_ESTADO[estado]}
        </span>
        {item.disponible && (
          <span className="cta">
            {estado === "CONECTADA" ? "Administrar" : "Conectar"}
            <Ico.Arr />
          </span>
        )}
      </div>
    </div>
  );
}

/* ═══════════════ Detalle de Wati ═══════════════ */

function WatiDetalle({
  integracion,
  cifradoDisponible,
  onVolver,
  onCambio,
}: {
  integracion: Integracion | null;
  cifradoDisponible: boolean;
  onVolver: () => void;
  onCambio: () => Promise<void>;
}) {
  const [actual, setActual] = React.useState(integracion);
  const conectada = actual?.estado === "CONECTADA";

  return (
    <div className="int-detail">
      <div className="int-detail-top">
        <button className="btn ghost" onClick={onVolver}>
          <Ico.Back /> Integraciones
        </button>
      </div>

      <div className="int-hero">
        <Logo proveedor="WATI" size={64} />
        <div className="int-hero-body">
          <div className="eyebrow">
            <span>Mensajería</span>
            <span className="sep">·</span>
            <span>Por Wati Inc.</span>
            <span className="sep">·</span>
            <a
              className="docs"
              href="https://docs.wati.io"
              target="_blank"
              rel="noreferrer"
            >
              <Ico.External />
              docs.wati.io
            </a>
          </div>
          <h1>
            Wati{" "}
            <span style={{ color: "var(--muted-text)", fontWeight: 500 }}>
              · WhatsApp Business API
            </span>
          </h1>
          <div className="sub">
            Avisale automáticamente a tus clientes por WhatsApp, desde el número
            oficial de tu empresa, cuando su trabajo avanza en producción,
            facturación o despacho.
          </div>
        </div>
      </div>

      <CredencialesTab
        integracion={actual}
        cifradoDisponible={cifradoDisponible}
        conectada={conectada}
        onActualizada={async (i) => {
          setActual(i);
          await onCambio();
        }}
      />
    </div>
  );
}

function CredencialesTab({
  integracion,
  cifradoDisponible,
  conectada,
  onActualizada,
}: {
  integracion: Integracion | null;
  cifradoDisponible: boolean;
  conectada: boolean;
  onActualizada: (i: Integracion | null) => Promise<void>;
}) {
  const meta = (integracion?.metadata ?? {}) as {
    endpoint?: string;
    tenantId?: string;
  };
  const [form, setForm] = React.useState({
    endpoint: meta.endpoint ?? "https://live-mt-server.wati.io",
    tenantId: meta.tenantId ?? "",
    token: "",
  });
  const [guardando, setGuardando] = React.useState(false);
  const [probando, setProbando] = React.useState(false);
  const [confirmarDesconectar, setConfirmarDesconectar] = React.useState(false);
  const [copiado, setCopiado] = React.useState<string | null>(null);

  const copiar = (clave: string, valor: string) => {
    try {
      void navigator.clipboard?.writeText(valor);
    } catch {
      // Sin portapapeles el valor igual está a la vista.
    }
    setCopiado(clave);
    setTimeout(() => setCopiado(null), 1400);
  };

  const guardar = async () => {
    setGuardando(true);
    try {
      const r = await conectarWati({
        endpoint: form.endpoint.trim(),
        tenantId: form.tenantId.trim(),
        token: form.token.trim(),
      });
      await onActualizada(r);
      if (r.estado === "CONECTADA") {
        setForm((f) => ({ ...f, token: "" }));
        toast.success("Wati conectada.");
      } else {
        // El backend prueba ANTES de guardar: si llegó acá con error, el
        // motivo es de Wati y hay que mostrarlo tal cual.
        toast.error(r.ultimoErrorTexto ?? "No se pudo conectar.");
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo conectar con Wati.",
      );
    } finally {
      setGuardando(false);
    }
  };

  const probar = async () => {
    setProbando(true);
    try {
      const r = await probarIntegracion("WATI");
      await onActualizada(r);
      if (r.estado === "CONECTADA") toast.success("La conexión responde bien.");
      else toast.error(r.ultimoErrorTexto ?? "La conexión no responde.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo probar.");
    } finally {
      setProbando(false);
    }
  };

  const desconectar = async () => {
    try {
      await desconectarIntegracion("WATI");
      await onActualizada(null);
      setForm((f) => ({ ...f, token: "" }));
      toast.success("Wati desconectada. Las credenciales se borraron.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo desconectar.",
      );
    } finally {
      setConfirmarDesconectar(false);
    }
  };

  const puedeGuardar =
    cifradoDisponible &&
    form.endpoint.trim().length > 8 &&
    /^\d+$/.test(form.tenantId.trim()) &&
    form.token.trim().length >= 20;

  return (
    <div className="int-content">
      {integracion?.estado === "ERROR" && integracion.ultimoErrorTexto && (
        <div className="int-info-box" style={{ marginBottom: 18 }}>
          <Ico.Alerta />
          <div>
            <strong>La última conexión falló.</strong> {integracion.ultimoErrorTexto}
          </div>
        </div>
      )}

      <div className="int-section-intro">
        <h3>Credenciales de la API</h3>
        <p>
          Se generan en la página <strong>API Docs</strong> del dashboard de
          Wati. Grafoprint las guarda cifradas y las usa para autenticar cada
          llamada. No las compartas: cualquiera con el token puede enviarles
          mensajes a tus clientes desde tu número.
        </p>
      </div>

      <div className="cred-card">
        <div className="cred-row">
          <div className="cred-label">
            <span className="lbl">API Endpoint</span>
            <span className="hint">
              URL del servidor de Wati de tu región. Si la pegás con el Tenant ID
              incluido, también sirve.
            </span>
          </div>
          <div className="cred-value">
            <input
              value={form.endpoint}
              onChange={(e) => setForm((f) => ({ ...f, endpoint: e.target.value }))}
              placeholder="https://live-mt-server.wati.io"
              spellCheck={false}
            />
          </div>
        </div>

        <div className="cred-row">
          <div className="cred-label">
            <span className="lbl">Tenant ID</span>
            <span className="hint">Es el mismo que tu Client ID en Wati</span>
          </div>
          <div className="cred-value">
            <input
              value={form.tenantId}
              onChange={(e) => setForm((f) => ({ ...f, tenantId: e.target.value }))}
              placeholder="313754"
              inputMode="numeric"
              spellCheck={false}
            />
          </div>
        </div>

        <div className="cred-row">
          <div className="cred-label">
            <span className="lbl">Access Token</span>
            <span className="hint">
              Pegalo sin el prefijo &quot;Bearer &quot;. Se guarda cifrado y no se
              puede volver a leer desde acá.
            </span>
          </div>
          <div className="cred-value">
            <input
              type="password"
              value={form.token}
              onChange={(e) => setForm((f) => ({ ...f, token: e.target.value }))}
              placeholder={
                integracion?.pista
                  ? `Cargado (${integracion.pista}) · pegá uno nuevo para reemplazarlo`
                  : "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9…"
              }
              spellCheck={false}
              autoComplete="off"
            />
          </div>
        </div>

        {conectada && (
          <div className="cred-meta">
            <div className="cm">
              <div className="cm-k">Estado</div>
              <div className="cm-v">
                <span className="dot ok" />
                Conectada
              </div>
            </div>
            <div className="cm">
              <div className="cm-k">Último chequeo</div>
              <div className="cm-v mono">{fechaCorta(integracion?.ultimoChequeoEl ?? null)}</div>
            </div>
            <div className="cm">
              <div className="cm-k">Token</div>
              <div className="cm-v mono">{integracion?.pista ?? "—"}</div>
            </div>
          </div>
        )}
      </div>

      <div className="int-actions-strip">
        <button
          className="btn btn-primary"
          onClick={() => void guardar()}
          disabled={!puedeGuardar || guardando}
          title={
            cifradoDisponible
              ? undefined
              : "El servidor no tiene clave de cifrado configurada."
          }
        >
          {guardando
            ? "Probando y guardando…"
            : conectada
              ? "Reemplazar credenciales"
              : "Conectar"}
        </button>
        {conectada && (
          <button className="btn" onClick={() => void probar()} disabled={probando}>
            <Ico.Refresh /> {probando ? "Probando…" : "Probar conexión"}
          </button>
        )}
        {conectada && (
          <button
            className="btn"
            onClick={() =>
              copiar("ep", String((integracion?.metadata as { endpoint?: string })?.endpoint ?? ""))
            }
          >
            {copiado === "ep" ? <Ico.Check /> : <Ico.Copy />}
            {copiado === "ep" ? "Copiado" : "Copiar endpoint"}
          </button>
        )}
        {integracion && integracion.estado !== "DESCONECTADA" && (
          <button className="btn danger" onClick={() => setConfirmarDesconectar(true)}>
            Desconectar Wati
          </button>
        )}
      </div>

      <div className="int-info-box" style={{ marginTop: 20 }}>
        <Ico.External />
        <div>
          Al conectar, Grafoprint <strong>prueba las credenciales antes de
          guardarlas</strong>: si no funcionan, no se guarda nada. El siguiente
          paso —enviar automáticamente las plantillas de mensajes a aprobación de
          Meta— todavía no está disponible.
        </div>
      </div>

      <ConfirmacionDestructiva
        open={confirmarDesconectar}
        onOpenChange={setConfirmarDesconectar}
        titulo="Desconectar Wati"
        descripcion="Se borran las credenciales guardadas y dejan de enviarse mensajes automáticos. Para volver a conectar vas a tener que pegar el token de nuevo."
        requiereTipear={false}
        accionLabel="Desconectar"
        onConfirmar={() => void desconectar()}
      />
    </div>
  );
}
