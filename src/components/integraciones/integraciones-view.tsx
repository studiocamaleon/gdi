"use client";

import * as React from "react";

import { toast } from "sonner";

import { useFecha } from "@/components/navigation/config-regional-provider";
import { ConfirmacionDestructiva } from "@/components/ui/confirmacion-destructiva";
import {
  CATALOGO,
  ETIQUETA_ESTADO,
  itemDe,
  type CatalogoItem,
  type EstadoIntegracion,
  type Integracion,
  type EstadoPlantillas,
  type PlantillaGestionada,
  type PlantillaPropia,
  type ProveedorIntegracion,
  DIAS_SEMANA,
  type ConfigNotificaciones,
  type EstadoNotificaciones,
  type LineaLog,
} from "@/lib/integraciones";
import { Switch } from "@/components/ui/switch";
import {
  conectarWati,
  desconectarIntegracion,
  getAfip,
  getIntegraciones,
  getPlantillasWati,
  probarIntegracion,
  someterPlantillaWati,
  cambiarEventoNotificacion,
  getLogNotificaciones,
  getNotificaciones,
  guardarConfigNotificaciones,
  type AfipIntegracion,
  type EstadoIntegraciones,
} from "@/lib/integraciones-api";
import { AfipDetalle } from "@/components/integraciones/afip-detalle";

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

export function IntegracionesView({
  inicial,
  extra,
}: {
  inicial: EstadoIntegraciones;
  /**
   * Secciones adicionales que viven DENTRO del mismo int-page, después del
   * catálogo (hoy: "Tu IA (MCP)"). Renderizadas sólo en la vista de grilla —
   * los detalles (Wati/AFIP) retornan antes y no las muestran.
   */
  extra?: React.ReactNode;
}) {
  const [datos, setDatos] = React.useState(inicial);
  const [abierta, setAbierta] = React.useState<ProveedorIntegracion | null>(null);
  const [afip, setAfip] = React.useState<AfipIntegracion | null>(null);

  // AFIP se carga on-demand al abrir (la lista no trae su detalle enriquecido);
  // el resto abre directo por estado.
  const abrir = React.useCallback((p: ProveedorIntegracion) => {
    if (p !== "AFIP") {
      setAbierta(p);
      return;
    }
    getAfip()
      .then((d) => {
        setAfip(d);
        setAbierta("AFIP");
      })
      .catch(() => {
        // El botón sigue disponible; no rompemos la grilla por esto.
      });
  }, []);

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

  if (abierta === "AFIP" && afip) {
    return (
      <AfipDetalle
        inicial={afip}
        onVolver={() => {
          setAbierta(null);
          setAfip(null);
          void recargar();
        }}
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
              onAbrir={abrir}
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
            onAbrir={abrir}
          />
        ))}
      </Seccion>

      {extra}
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
  const { fechaNumerica } = useFecha();
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
            ? `Desde el ${fechaNumerica(integracion.conectadaEl)}`
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
  const [tab, setTab] = React.useState<
    "credenciales" | "plantillas" | "notificaciones" | "mensajes"
  >("credenciales");
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

      <nav className="int-tabs">
        <button
          className={tab === "credenciales" ? "on" : ""}
          onClick={() => setTab("credenciales")}
        >
          Credenciales
        </button>
        <button
          className={tab === "plantillas" ? "on" : ""}
          onClick={() => setTab("plantillas")}
          disabled={!conectada}
          title={
            conectada ? undefined : "Conectá la integración para ver las plantillas"
          }
          style={conectada ? undefined : { opacity: 0.45, cursor: "not-allowed" }}
        >
          Plantillas
        </button>
        <button
          className={tab === "notificaciones" ? "on" : ""}
          onClick={() => setTab("notificaciones")}
          disabled={!conectada}
          title={
            conectada
              ? undefined
              : "Conectá la integración para configurar los avisos"
          }
          style={conectada ? undefined : { opacity: 0.45, cursor: "not-allowed" }}
        >
          Notificaciones
        </button>
        <button
          className={tab === "mensajes" ? "on" : ""}
          onClick={() => setTab("mensajes")}
          disabled={!conectada}
          title={
            conectada
              ? undefined
              : "Conectá la integración para ver los mensajes"
          }
          style={conectada ? undefined : { opacity: 0.45, cursor: "not-allowed" }}
        >
          Mensajes
        </button>
      </nav>

      {tab === "credenciales" ? (
        <CredencialesTab
          integracion={actual}
          cifradoDisponible={cifradoDisponible}
          conectada={conectada}
          onActualizada={async (i) => {
            setActual(i);
            await onCambio();
          }}
        />
      ) : tab === "plantillas" ? (
        <PlantillasTab />
      ) : tab === "notificaciones" ? (
        <NotificacionesTab />
      ) : (
        <MensajesTab />
      )}
    </div>
  );
}

/**
 * Las plantillas del tenant: las 13 del catálogo de Grafo con su estado real
 * en Meta, y las que ya tenía escritas a mano.
 *
 * Se pide al abrir el tab y no con la vista: es una llamada a un tercero con
 * timeout de 10 s, y la mayoría de las visitas a esta pantalla son para tocar
 * las credenciales.
 */
function PlantillasTab() {
  const [datos, setDatos] = React.useState<EstadoPlantillas | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [cargando, setCargando] = React.useState(true);

  const cargar = React.useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      setDatos(await getPlantillasWati());
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron leer las plantillas.");
    } finally {
      setCargando(false);
    }
  }, []);

  React.useEffect(() => {
    void cargar();
  }, [cargar]);

  if (cargando) {
    return <p style={{ color: "var(--muted-text)", fontSize: 13 }}>Consultando Wati…</p>;
  }
  if (error || !datos) {
    return (
      <div className="int-section">
        <p style={{ color: "var(--danger, #b91c1c)", fontSize: 13 }}>{error}</p>
        <button className="btn ghost" onClick={() => void cargar()}>
          Reintentar
        </button>
      </div>
    );
  }

  const r = datos.resumen;
  return (
    <div className="int-content">
      {/*
        Los contadores cuentan SÓLO el catálogo de Grafo, y por eso viven
        adentro de esta sección y no arriba de todo: puestos al tope se leían
        como el estado de la cuenta entera, y un "Aprobadas 0" con seis
        plantillas propias aprobadas parece un error. Sumarlas tampoco sirve
        —"Aprobadas 6 · Sin enviar 13" no dice si el despliegue terminó—, así
        que lo que se arregla es el encuadre, no el número.
      */}
      <div className="int-section-intro">
        <h3>Plantillas de Grafo</h3>
        <p>
          Las escribe y mantiene Grafo. Son {r.total} y se envían a Meta para
          aprobación; los números de abajo son el estado de esas {r.total} en tu
          cuenta.
        </p>
      </div>

      <BotonCrear
        pendientes={datos.gestionadas.filter((g) => g.estado === "SIN_SOMETER")}
        onListo={cargar}
      />

      <div className="int-tpl-stats">
        <Stat v={r.aprobadas} k={`Aprobadas de ${r.total}`} />
        <Stat v={r.pendientes} k="En revisión" />
        <Stat v={r.conProblema} k="Con problema" alerta={r.conProblema > 0} />
        <Stat v={r.sinSometer} k="Sin enviar" />
        <Stat
          v={r.recategorizadas}
          k="Recategorizadas"
          alerta={r.recategorizadas > 0}
        />
      </div>

      {datos.gestionadas.some((g) => g.estado === "DRAFT") && (
        <div className="int-info-box" style={{ marginBottom: 16 }}>
          <Ico.Alerta />
          <div>
            <strong>Hay plantillas en borrador.</strong> Wati crea por API en
            borrador y no las manda a Meta. Para que sirvan hay que abrirlas en
            el dashboard de Wati y enviarlas a aprobación; el texto, las
            variables y la categoría ya están cargados.
          </div>
        </div>
      )}

      {r.recategorizadas > 0 && (
        <div className="int-info-box" style={{ marginBottom: 16 }}>
          <strong>Meta cambió la categoría de {r.recategorizadas} plantilla(s).</strong>{" "}
          Pedimos UTILITY y quedaron como MARKETING: significa que el texto se
          leyó como promocional. Siguen funcionando, pero cuestan más por
          conversación.
        </div>
      )}
      <div className="int-tpl-list" style={{ marginBottom: 26 }}>
        {datos.gestionadas.map((p) => (
          <FilaGestionada key={p.codigo} p={p} />
        ))}
      </div>

      <div className="int-section-intro">
        <h3>Tus plantillas ({datos.propias.length})</h3>
        <p>
          {datos.propias.length === 0
            ? "No hay plantillas propias en esta cuenta de Wati."
            : `Las creaste vos en el dashboard de Wati — ${
                datos.propias.filter((p) => p.estado === "APPROVED").length
              } aprobada(s). No entran en los números de arriba: Grafo no las administra ni las usa para notificar.`}
        </p>
      </div>
      {datos.propias.length > 0 && (
        <div className="int-tpl-list">
          {datos.propias.map((p) => (
            <FilaPropia key={p.codigo} p={p} />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Crea en Wati las plantillas del catálogo que faltan.
 *
 * Va de a una y no en un solo request: son N llamadas a un tercero con
 * timeout de 10 s, y agruparlas daría una pantalla congelada que además
 * pierde todo si se corta. Así se ve el avance y una que falle no se lleva
 * puestas a las demás.
 *
 * Pide confirmación porque escribe en una cuenta ajena a Grafo y **Wati no
 * expone borrado por API**: lo que se crea acá sólo se saca desde su
 * dashboard.
 */
function BotonCrear({
  pendientes,
  onListo,
}: {
  pendientes: PlantillaGestionada[];
  onListo: () => Promise<void>;
}) {
  const [confirmar, setConfirmar] = React.useState(false);
  const [progreso, setProgreso] = React.useState<string | null>(null);

  if (pendientes.length === 0) return null;

  const crear = async () => {
    let ok = 0;
    let seguidos = 0;
    let cortado = false;
    let espera: number | null = null;
    const fallos: string[] = [];

    for (const [i, p] of pendientes.entries()) {
      setProgreso(`Creando ${i + 1} de ${pendientes.length}: ${p.titulo}…`);
      try {
        const res = await someterPlantillaWati(p.codigo);
        if (res.ok) {
          ok++;
          seguidos = 0;
        } else if (res.esperaMinutos) {
          // Cupo de Meta: 10 plantillas por hora. Las que faltan van a
          // rebotar igual, así que no se intentan. Las que ya se crearon
          // quedan en borrador y el próximo intento las retoma.
          espera = res.esperaMinutos;
          break;
        } else {
          fallos.push(`${p.titulo}: ${res.motivo ?? "sin motivo"}`);
          seguidos++;
        }
      } catch (e) {
        fallos.push(`${p.titulo}: ${e instanceof Error ? e.message : "falló"}`);
        seguidos++;
      }
      // Tres seguidas fallando no es mala suerte: es el token, el límite de
      // llamadas o Wati caído. Cada intento son dos llamadas más a un
      // tercero, así que insistir con las que faltan sólo empeora las cosas.
      if (seguidos >= 3) {
        cortado = true;
        break;
      }
    }

    setProgreso(null);
    if (espera !== null) {
      toast.warning(
        `Wati permite 10 plantillas por hora. Se enviaron ${ok}; volvé en ${espera} minutos y dale de nuevo para las que faltan.`,
        { duration: 12000 },
      );
    } else if (cortado) {
      toast.error(
        "Se cortó: tres fallos seguidos. Revisá el motivo y volvé a intentar.",
      );
    }
    if (ok > 0) toast.success(`Se enviaron ${ok} plantilla(s) a revisión.`);
    // Se muestran hasta tres para no tapar la pantalla; el detalle de cada
    // una queda en su fila del listado.
    for (const f of fallos.slice(0, 3)) toast.error(f);
    if (fallos.length > 3) toast.error(`Y ${fallos.length - 3} más.`);
    await onListo();
  };

  return (
    <div className="int-actions-strip" style={{ marginBottom: 16 }}>
      <button
        className="btn"
        onClick={() => setConfirmar(true)}
        disabled={progreso !== null}
      >
        {progreso ?? `Crear en Wati las ${pendientes.length} que faltan`}
      </button>

      <ConfirmacionDestructiva
        open={confirmar}
        onOpenChange={setConfirmar}
        titulo={`Crear ${pendientes.length} plantillas en Wati`}
        descripcion="Se crean en tu cuenta de Wati con los textos de Grafo. Wati no permite borrarlas por API: si después querés sacarlas, hay que hacerlo desde su dashboard."
        requiereTipear={false}
        accionLabel="Crear"
        onConfirmar={() => {
          // Se cierra ACÁ y no al terminar: el diálogo no se cierra solo, y
          // el lote tarda un rato largo. Dejarlo abierto tapaba justo la
          // línea de progreso que dice por cuál va.
          setConfirmar(false);
          void crear();
        }}
      />
    </div>
  );
}

function Stat({ v, k, alerta }: { v: number; k: string; alerta?: boolean }) {
  return (
    <div className={`int-tpl-stat${alerta ? " int-tpl-stat-alerta" : ""}`}>
      <div className="int-tpl-stat-v">{v}</div>
      <div className="int-tpl-stat-k">{k}</div>
    </div>
  );
}

/** APPROVED → verde, PENDING → ámbar, el resto pide acción → rojo. */
function pillEstado(estado: string): { clase: string; texto: string } {
  const mapa: Record<string, { clase: string; texto: string }> = {
    APPROVED: { clase: "int-pill-ok", texto: "Aprobada" },
    PENDING: { clase: "int-pill-warn", texto: "En revisión" },
    REJECTED: { clase: "int-pill-bad", texto: "Rechazada" },
    PAUSED: { clase: "int-pill-bad", texto: "Pausada" },
    DISABLED: { clase: "int-pill-bad", texto: "Deshabilitada" },
    SIN_SOMETER: { clase: "", texto: "Sin enviar" },
    // Wati crea por API en borrador y NO lo manda a Meta. Parece hecha en el
    // listado y no sirve para notificar: se marca como pendiente de acción.
    DRAFT: { clase: "int-pill-warn", texto: "Borrador en Wati" },
  };
  // Un estado que Meta agregue mañana se muestra tal cual en vez de romper.
  return mapa[estado] ?? { clase: "", texto: estado };
}

function FilaGestionada({ p }: { p: PlantillaGestionada }) {
  const [abierta, setAbierta] = React.useState(false);
  const est = pillEstado(p.estado);
  const recategorizada =
    p.categoriaAsignada !== null && p.categoriaAsignada !== p.categoriaPedida;

  return (
    <div className="int-tpl-row">
      <div className="int-tpl-main">
        <div className="int-tpl-nm">{p.titulo}</div>
        <div className="int-tpl-cuando">{p.cuando}</div>
        <div className="int-tpl-cod">{p.codigo}</div>
        <button className="int-tpl-toggle" onClick={() => setAbierta((v) => !v)}>
          {abierta ? "Ocultar el mensaje" : "Ver el mensaje"}
        </button>
        {abierta && (
          <div className="int-tpl-cuerpo">
            {p.cuerpo.replace(/\{\{(\d+)\}\}/g, (_, n: string) => {
              const nombre = p.parametros[Number(n) - 1];
              return nombre ? `[${nombre}]` : `{{${n}}}`;
            })}
            <span className="int-tpl-footer">Tecnología desarrollada por Grafoprint</span>
          </div>
        )}
      </div>
      <div className="int-tpl-side">
        {recategorizada ? (
          <span
            className="int-pill int-pill-warn"
            title={`Pedimos ${p.categoriaPedida} y Meta asignó ${p.categoriaAsignada}`}
          >
            {p.categoriaAsignada} ≠ {p.categoriaPedida}
          </span>
        ) : (
          <span className="int-pill">{p.categoriaAsignada ?? p.categoriaPedida}</span>
        )}
        {p.calidad && <span className="int-pill">{p.calidad}</span>}
        <span className={`int-pill ${est.clase}`}>{est.texto}</span>
      </div>
    </div>
  );
}

function FilaPropia({ p }: { p: PlantillaPropia }) {
  const [abierta, setAbierta] = React.useState(false);
  const est = pillEstado(p.estado);
  return (
    <div className="int-tpl-row">
      <div className="int-tpl-main">
        <div className="int-tpl-nm int-tpl-mono">{p.codigo}</div>
        <div className="int-tpl-cuando">
          {p.parametros.length === 0
            ? "Sin parámetros"
            : `${p.parametros.length} parámetro(s): ${p.parametros.join(", ")}`}
        </div>
        {p.cuerpo && (
          <>
            <button className="int-tpl-toggle" onClick={() => setAbierta((v) => !v)}>
              {abierta ? "Ocultar el mensaje" : "Ver el mensaje"}
            </button>
            {abierta && (
              <div className="int-tpl-cuerpo">
                {p.cuerpo.replace(/\{\{(\d+)\}\}/g, (_, n: string) => {
                  const nombre = p.parametros[Number(n) - 1];
                  return nombre ? `[${nombre}]` : `{{${n}}}`;
                })}
                {p.footer && <span className="int-tpl-footer">{p.footer}</span>}
              </div>
            )}
          </>
        )}
      </div>
      <div className="int-tpl-side">
        {p.idioma && <span className="int-pill">{p.idioma}</span>}
        {p.categoria && <span className="int-pill">{p.categoria}</span>}
        <span className={`int-pill ${est.clase}`}>{est.texto}</span>
      </div>
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
  const { fechaNumerica, hora } = useFecha();
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
              <div className="cm-v mono">
                {integracion?.ultimoChequeoEl
                  ? `${fechaNumerica(integracion.ultimoChequeoEl)} ${hora(integracion.ultimoChequeoEl)}`
                  : "—"}
              </div>
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

/* ═══════════════ Notificaciones ═══════════════ */

/**
 * El tablero de control de los avisos: qué se manda y cuándo.
 *
 * La configuración global, los eventos y el consentimiento viven juntos a
 * propósito: son preguntas que se hacen de corrido —"¿está prendido?", "¿a qué
 * hora sale?", "¿quién aceptó?"— y repartirlas obliga a rebotar entre pantallas.
 * Lo que pasó con cada mensaje es otra pregunta y vive en su propio tab.
 */
function NotificacionesTab() {
  const [datos, setDatos] = React.useState<EstadoNotificaciones | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [cargando, setCargando] = React.useState(true);
  const [guardando, setGuardando] = React.useState(false);

  const cargar = React.useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      setDatos(await getNotificaciones());
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar.");
    } finally {
      setCargando(false);
    }
  }, []);

  React.useEffect(() => {
    void cargar();
  }, [cargar]);

  const guardar = async (cambios: Partial<ConfigNotificaciones>) => {
    if (!datos) return;
    // Optimista: el switch tiene que responder al toque. Si falla se revierte
    // recargando, que además trae lo que haya cambiado por otro lado.
    setDatos({ ...datos, configuracion: { ...datos.configuracion, ...cambios } });
    setGuardando(true);
    try {
      await guardarConfigNotificaciones(cambios);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar.");
      await cargar();
    } finally {
      setGuardando(false);
    }
  };

  const cambiarEvento = async (evento: string, activo: boolean) => {
    if (!datos) return;
    setDatos({
      ...datos,
      eventos: datos.eventos.map((e) =>
        e.evento === evento ? { ...e, activo, porDefecto: false } : e,
      ),
    });
    try {
      await cambiarEventoNotificacion(evento, activo);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar.");
      await cargar();
    }
  };

  if (cargando) {
    return <p style={{ color: "var(--muted-text)", fontSize: 13 }}>Cargando…</p>;
  }
  if (error || !datos) {
    return (
      <div className="int-section">
        <p style={{ color: "var(--danger, #b91c1c)", fontSize: 13 }}>{error}</p>
        <button className="btn ghost" onClick={() => void cargar()}>
          Reintentar
        </button>
      </div>
    );
  }

  const { configuracion: cfg, consentimiento: cons } = datos;
  const dias = new Set(
    cfg.diasAtencion.split(",").filter(Boolean).map(Number),
  );

  const alternarDia = (iso: number) => {
    const nuevo = new Set(dias);
    if (nuevo.has(iso)) nuevo.delete(iso);
    else nuevo.add(iso);
    void guardar({
      diasAtencion: [...nuevo].sort((a, b) => a - b).join(","),
    });
  };

  return (
    <div className="int-content">
      <div className={`int-nt-panel${cfg.pausado ? " alerta" : ""}`}>
        <div className="int-nt-fila">
          <div>
            <div className="int-nt-label">
              {cfg.pausado ? "Avisos pausados" : "Avisos activos"}
            </div>
            <div className="int-nt-hint">
              {cfg.pausado
                ? "No sale ningún mensaje. Lo que se genere mientras tanto queda en espera, no se pierde."
                : "El freno de mano corta todos los envíos de una sin perder la configuración ni desconectar Wati."}
            </div>
          </div>
          <Switch
            checked={!cfg.pausado}
            disabled={guardando}
            onCheckedChange={(v) => void guardar({ pausado: !v })}
          />
        </div>

        <div className="int-nt-fila">
          <div>
            <div className="int-nt-label">Horario de envío</div>
            <div className="int-nt-hint">
              Vale para todos los avisos. Lo que se genere fuera de esta franja
              espera al día siguiente en vez de despertar a nadie.
            </div>
          </div>
          <div className="int-nt-horas">
            <input
              className="int-nt-hora"
              type="time"
              value={cfg.horaDesde}
              onChange={(e) => void guardar({ horaDesde: e.target.value })}
            />
            <span style={{ color: "var(--muted-text)", fontSize: 12 }}>a</span>
            <input
              className="int-nt-hora"
              type="time"
              value={cfg.horaHasta}
              onChange={(e) => void guardar({ horaHasta: e.target.value })}
            />
          </div>
        </div>

        <div className="int-nt-fila">
          <div>
            <div className="int-nt-label">Días con el local abierto</div>
            <div className="int-nt-hint">
              Sólo lo usan los avisos de <strong>orden lista</strong>, que
              invitan al cliente a pasar a retirar. Si producís un sábado con el
              local cerrado, el aviso espera al lunes. Un pago o una factura
              salen cualquier día.
            </div>
          </div>
          <div className="int-nt-dias">
            {DIAS_SEMANA.map((d) => (
              <button
                key={d.iso}
                className={`int-nt-dia${dias.has(d.iso) ? " on" : ""}`}
                onClick={() => alternarDia(d.iso)}
                disabled={guardando}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        <div className="int-nt-fila">
          <div>
            <div className="int-nt-label">Cuándo pedir la reseña</div>
            <div className="int-nt-hint">
              Días después de entregar el trabajo. Ni el mismo día —el cliente
              todavía no lo usó— ni dos semanas después, cuando ya se olvidó. El
              pedido sale sólo si cargaste el link de reseñas en{" "}
              <strong>Configuración › Empresa</strong> y el aviso está
              encendido.
            </div>
          </div>
          <div className="int-nt-horas">
            <input
              className="int-nt-hora"
              type="number"
              min={0}
              max={30}
              style={{ width: 72 }}
              defaultValue={cfg.resenaDiasDespues}
              disabled={guardando}
              // onBlur y no onChange: con onChange, tipear "10" guarda primero
              // el 1 y después el 10, y el 1 alcanza para que el barrido de esa
              // noche salga con el plazo equivocado.
              onBlur={(e) => {
                const n = Number(e.target.value);
                if (Number.isInteger(n) && n >= 0 && n <= 30 && n !== cfg.resenaDiasDespues) {
                  void guardar({ resenaDiasDespues: n });
                }
              }}
            />
            <span style={{ color: "var(--muted-text)", fontSize: 12 }}>
              días
            </span>
          </div>
        </div>
      </div>

      <div className="int-section-intro">
        <h3>Qué se avisa</h3>
        <p>
          Los textos los escribe y mantiene Grafo. Acá elegís cuáles de tus
          clientes reciben.
        </p>
      </div>
      <div className="int-tpl-list" style={{ marginBottom: 26 }}>
        {datos.eventos.map((e) => (
          <div className="int-nt-evento" key={e.evento}>
            <div className="int-nt-evento-main">
              <div className="int-nt-evento-nm">{e.titulo}</div>
              <div className="int-nt-evento-cuando">
                {e.cableado
                  ? e.cuando
                  : "Todavía no está conectado a la operación: el sistema no lo dispara."}
              </div>
            </div>
            <div className="int-nt-evento-side">
              {e.categoria === "MARKETING" && (
                <span
                  className="int-pill"
                  title="Promocional: sólo lo reciben los clientes que lo aceptaron explícitamente."
                >
                  PROMO
                </span>
              )}
              {!e.cableado && <span className="int-pill">EN CAMINO</span>}
              {/*
                Un switch que se puede prender pero no hace nada es peor que no
                tenerlo: el usuario cree que configuró algo y espera mensajes
                que nunca van a salir.
              */}
              <Switch
                checked={e.activo && e.cableado}
                disabled={cfg.pausado || !e.cableado}
                onCheckedChange={(v) => void cambiarEvento(e.evento, v)}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="int-section-intro">
        <h3>Consentimiento de tus clientes</h3>
        <p>
          Los avisos de su propia operación —orden, pago, factura— llegan salvo
          que el cliente haya pedido lo contrario. Los promocionales necesitan
          que lo haya aceptado.
        </p>
      </div>
      <div className="int-tpl-stats">
        <Stat v={cons.total} k="Clientes" />
        <Stat v={cons.sinPreguntar} k="Sin preguntar" />
        <Stat v={cons.aceptaron} k="Aceptaron promociones" />
        <Stat
          v={cons.rechazaron}
          k="Pidieron no recibir"
          alerta={cons.rechazaron > 0}
        />
      </div>
    </div>
  );
}

/* ═══════════════ Mensajes ═══════════════ */

/**
 * Los estados que devuelve el backend, en el orden en que se leen: primero lo
 * que salió bien, después lo que todavía no salió, y al final lo que falló.
 * `enviando` es la reserva del despachador y dura segundos; se muestra igual
 * porque si una fila se queda ahí, eso mismo es el síntoma.
 */
const ESTADOS_MSJ = [
  { valor: "enviada", label: "Enviados" },
  { valor: "pendiente", label: "En espera" },
  { valor: "enviando", label: "Saliendo" },
  { valor: "fallida", label: "Fallaron" },
  { valor: "descartada", label: "Descartados" },
] as const;

const PASOS_LIMITE = [100, 250, 500];

/**
 * El historial de avisos: qué se mandó, qué no, y por qué.
 *
 * Tab propio y no un bloque al pie de Notificaciones: es la pantalla a la que
 * se entra con una pregunta puntual —"¿por qué a este cliente no le llegó?"— y
 * tenerla debajo de tres bloques de configuración obligaba a scrollear toda la
 * pantalla para llegar.
 */
function MensajesTab() {
  const { fechaHora } = useFecha();
  const [log, setLog] = React.useState<LineaLog[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [cargando, setCargando] = React.useState(true);
  const [limite, setLimite] = React.useState(PASOS_LIMITE[0]);
  const [filtro, setFiltro] = React.useState<string | null>(null);
  const [busqueda, setBusqueda] = React.useState("");

  const cargar = React.useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      setLog(await getLogNotificaciones(limite));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar.");
    } finally {
      setCargando(false);
    }
  }, [limite]);

  React.useEffect(() => {
    void cargar();
  }, [cargar]);

  // Los conteos se calculan sobre lo traído, no sobre toda la tabla: son la
  // lectura de "cómo viene saliendo últimamente", y por eso el rótulo dice
  // sobre cuántos mensajes está hecha la cuenta.
  const conteos = new Map<string, number>();
  for (const l of log) conteos.set(l.estado, (conteos.get(l.estado) ?? 0) + 1);

  const q = busqueda.trim().toLowerCase();
  const visibles = log.filter(
    (l) =>
      (!filtro || l.estado === filtro) &&
      (!q ||
        (l.cliente ?? "").toLowerCase().includes(q) ||
        l.telefono.toLowerCase().includes(q) ||
        l.titulo.toLowerCase().includes(q)),
  );

  if (cargando && log.length === 0) {
    return <p style={{ color: "var(--muted-text)", fontSize: 13 }}>Cargando…</p>;
  }
  if (error) {
    return (
      <div className="int-section">
        <p style={{ color: "var(--danger, #b91c1c)", fontSize: 13 }}>{error}</p>
        <button className="btn ghost" onClick={() => void cargar()}>
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="int-content">
      <div className="int-section-intro">
        <h3>Mensajes enviados</h3>
        <p>
          Todo lo que el sistema generó para WhatsApp, incluido lo que NO se
          mandó y por qué. Es donde se responde &ldquo;¿por qué a este cliente
          no le llegó nada?&rdquo;. Las cuentas son sobre los mensajes que ves
          acá, del más nuevo al más viejo.
        </p>
      </div>

      <div className="int-tpl-stats">
        <Stat v={log.length} k="Últimos mensajes" />
        {ESTADOS_MSJ.filter((e) => e.valor !== "enviando").map((e) => (
          <Stat
            key={e.valor}
            v={conteos.get(e.valor) ?? 0}
            k={e.label}
            alerta={e.valor === "fallida" && (conteos.get("fallida") ?? 0) > 0}
          />
        ))}
      </div>

      <div className="int-msg-barra">
        <div className="int-msg-chips">
          <button
            className={`int-nt-dia${filtro === null ? " on" : ""}`}
            onClick={() => setFiltro(null)}
          >
            Todos
          </button>
          {ESTADOS_MSJ.map((e) => (
            <button
              key={e.valor}
              className={`int-nt-dia${filtro === e.valor ? " on" : ""}`}
              onClick={() => setFiltro(filtro === e.valor ? null : e.valor)}
              disabled={!conteos.get(e.valor)}
              style={
                conteos.get(e.valor)
                  ? undefined
                  : { opacity: 0.4, cursor: "not-allowed" }
              }
            >
              {e.label}
              {conteos.get(e.valor) ? ` · ${conteos.get(e.valor)}` : ""}
            </button>
          ))}
        </div>
        <div className="int-msg-acciones">
          <input
            className="int-msg-buscar"
            placeholder="Buscar cliente, teléfono o aviso…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
          <button
            className="btn ghost"
            onClick={() => void cargar()}
            disabled={cargando}
          >
            {cargando ? "Actualizando…" : "Actualizar"}
          </button>
        </div>
      </div>

      <div className="int-tpl-list">
        {visibles.length === 0 ? (
          <div className="int-nt-vacio">
            {log.length === 0
              ? "Todavía no se generó ningún aviso."
              : "Ningún mensaje coincide con el filtro."}
          </div>
        ) : (
          visibles.map((l) => (
            <div className="int-nt-log-fila" key={l.id}>
              <span className="int-nt-log-fecha">
                {fechaHora(l.createdAt)}
              </span>
              <div>
                <div>
                  {l.titulo}
                  {l.cliente ? (
                    <span style={{ color: "var(--muted-text)" }}>
                      {" "}
                      · {l.cliente}
                    </span>
                  ) : null}
                </div>
                <div className="int-nt-log-motivo">
                  <span className="int-msg-tel">{l.telefono}</span>
                  {l.motivo ? ` · ${l.motivo}` : ""}
                  {l.intentos > 1 ? ` · ${l.intentos} intentos` : ""}
                  {l.estado === "pendiente" && l.programadaPara
                    ? ` · sale ${fechaHora(l.programadaPara)}`
                    : ""}
                </div>
              </div>
              <span className={`int-pill ${pillLog(l.estado)}`}>{l.estado}</span>
            </div>
          ))
        )}
      </div>

      {/* Sólo si la tanda vino completa: si trajo menos que el límite, ya no
          hay más para traer y el botón mentiría. */}
      {log.length >= limite && limite < PASOS_LIMITE[PASOS_LIMITE.length - 1] && (
        <div className="int-msg-mas">
          <button
            className="btn ghost"
            onClick={() =>
              setLimite(
                PASOS_LIMITE.find((n) => n > limite) ??
                  PASOS_LIMITE[PASOS_LIMITE.length - 1],
              )
            }
            disabled={cargando}
          >
            Ver más mensajes
          </button>
        </div>
      )}
    </div>
  );
}

/** Enviada verde, fallida roja, el resto neutro. */
function pillLog(estado: string): string {
  if (estado === "enviada") return "int-pill-ok";
  if (estado === "fallida") return "int-pill-bad";
  if (estado === "pendiente") return "int-pill-warn";
  return "";
}
