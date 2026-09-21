"use client";

import fieldFocus from "@/components/design-system/field-focus.module.css";

import { Input, TextArea as Textarea } from "@heroui/react";

import { ActionButton } from "@/components/design-system/action-button";

import * as React from "react";

import { fechaHora } from "@/lib/fecha";
import Link from "next/link";

import { useRouter, useSearchParams } from "next/navigation";
import { EmpresasView } from "./empresas-view";
import { EquipoView } from "./equipo-view";
import { SuscripcionesView } from "./suscripciones-view";
import { PlanesView, type SalidaPlanes } from "./planes-view";
import { ConfirmacionSalida } from "@/components/ui/confirmacion-salida";
import { toast } from "sonner";
import { GrafoprintBrand } from "@/components/brand/grafoprint-brand";
import { DesignSystemProvider } from "@/components/design-system/appearance";
import { FormDialog } from "@/components/design-system/form-dialog";
import { SelectField } from "@/components/design-system/select-field";
import styles from "./plataforma.module.css";
import brandTheme from "@/components/design-system/brand-workspace-theme.module.css";
const platformTheme = `${brandTheme.theme} ${styles.theme}`;

import { logout } from "@/lib/auth";
import { clearSessionToken, setSessionToken } from "@/lib/session";
import {
  AreaChart,
  Bars,
  BIco,
  Donut,
  EstadoPill,
  Kpi,
  mk,
  PALETA,
  Panel,
  PLAN_COLORS,
  TLogo,
  fmtBytes,
  fmtN,
  riesgoDe,
} from "@/components/plataforma/kit";
import {
  cerrarImpersonacion,
  crearTenantPlataforma,
  getNegocioPlataforma,
  getPlanesPlataforma,
  describirPlan,
  vincularPlanPaddle,
  getSesionesImpersonacion,
  iniciarImpersonacion,
  type ConsolaPlataforma,
  type NegocioPlataforma,
  type PeriodoNegocio,
  type PlanCatalogo,
  type SesionImpersonacion,
  type StaffPlataforma,
  type TenantConsola,
  getConsolaPlataforma,
} from "@/lib/plataforma-api";

/**
 * La consola del equipo comparte la identidad visual de Grafo y presenta las
 * mediciones disponibles con su alcance. Empresas carga sus datos por separado.
 *
 * La sección "Facturación" (billing de suscripciones desde el tenant
 * plataforma) se retiró: con Paddle como Merchant of Record el comprobante al
 * tenant lo emite Paddle, y la Factura E a Paddle se hace a mano fuera del
 * sistema por decisión del negocio.
 * Ver docs/control-plane-diseno.md y docs/suscripciones-cobro-diseno.md
 */

type Vista =
  | "observabilidad"
  | "negocio"
  | "tenants"
  | "planes"
  | "impersonacion"
  | "equipo"
  | "suscripciones";

const NAV: Array<{
  grupo: string;
  items: Array<{ k: Vista; label: string; ic: keyof typeof BIco }>;
}> = [
  {
    grupo: "Plataforma",
    items: [
      { k: "observabilidad", label: "Observabilidad", ic: "gauge" },
      { k: "negocio", label: "Negocio", ic: "chart" },
      { k: "tenants", label: "Empresas", ic: "building" },
      { k: "suscripciones", label: "Suscripciones", ic: "card" },
      { k: "planes", label: "Planes", ic: "check" },
    ],
  },
  {
    grupo: "Operaciones",
    items: [
      { k: "impersonacion", label: "Impersonación", ic: "mask" },
      { k: "equipo", label: "Equipo y acceso", ic: "users" },
    ],
  },
];

const TITULOS: Record<Vista, { crumb: string; title: string }> = {
  suscripciones: { crumb: "Plataforma", title: "Suscripciones y cobros" },
  equipo: { crumb: "Operaciones", title: "Equipo y acceso" },
  observabilidad: { crumb: "Plataforma", title: "Observabilidad" },
  negocio: { crumb: "Plataforma", title: "Negocio del ecosistema" },
  tenants: { crumb: "Plataforma", title: "Empresas" },
  planes: { crumb: "Plataforma", title: "Planes y funciones" },
  impersonacion: { crumb: "Operaciones", title: "Impersonación y auditoría" },
};
const DESCRIPCIONES: Record<Vista, string> = {
  suscripciones:
    "Estado comercial, acceso y diagnóstico de la sincronización con Paddle.",
  equipo: "Personas, permisos y protección del backoffice de Grafo.",
  observabilidad:
    "Salud de la plataforma, actividad y señales que necesitan atención.",
  negocio: "Cómo crece y trabaja el ecosistema de gráficas.",
  tenants: "Empresas, suscripciones y uso de la plataforma.",
  planes: "Capacidades, límites y precios de cada plan.",
  impersonacion: "Accesos de soporte y registro de las acciones del equipo.",
};

export function ConsolaPlataformaView({
  staff,
  ambiente,
}: {
  staff: StaffPlataforma;
  ambiente: "produccion" | "desarrollo";
}) {
  const [datos, setDatos] = React.useState<ConsolaPlataforma | null>(null);
  const [errorConsola, setErrorConsola] = React.useState<string | null>(null);
  const [intento, setIntento] = React.useState(0);
  const params = useSearchParams();
  const candidata = params.get("vista");
  const vista: Vista =
    candidata && Object.prototype.hasOwnProperty.call(TITULOS, candidata)
      ? (candidata as Vista)
      : "observabilidad";
  const [cerrando, setCerrando] = React.useState(false);
  const router = useRouter();
  const esAdmin = staff.rol === "ADMIN";
  const esSesionPlataforma = staff.esSesionPlataforma;
  const salidaPlanes = React.useRef<SalidaPlanes | null>(null);
  const [salidaPendiente, setSalidaPendiente] = React.useState<
    (() => void) | null
  >(null);
  const [guardandoSalida, setGuardandoSalida] = React.useState(false);
  const actualizarSalidaPlanes = React.useCallback(
    (estado: SalidaPlanes | null) => {
      salidaPlanes.current = estado;
    },
    [],
  );
  const navegar = (accion: () => void) => {
    if (salidaPlanes.current?.cambios) setSalidaPendiente(() => accion);
    else accion();
  };

  React.useEffect(() => {
    if (vista !== "observabilidad" && vista !== "impersonacion") return;
    let vigente = true;
    getConsolaPlataforma()
      .then((c) => {
        if (vigente) {
          setDatos(c);
          setErrorConsola(null);
        }
      })
      .catch((e) => {
        if (vigente)
          setErrorConsola(
            e instanceof Error ? e.message : "No se pudo cargar la consola.",
          );
      });
    return () => {
      vigente = false;
    };
  }, [vista, intento]);

  const cerrarSesion = async () => {
    if (cerrando) return;
    setCerrando(true);
    try {
      await logout();
    } finally {
      await clearSessionToken();
      router.replace(esSesionPlataforma ? "/backoffice" : "/login");
      router.refresh();
    }
  };

  const meta = TITULOS[vista];
  const iniciales = (staff?.nombre ?? staff?.email ?? "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  return (
    <DesignSystemProvider theme="brand" appearance="light">
      <div
        className={`${platformTheme} ${styles.shell}`}
        data-appearance="light"
        data-ui="heroui"
      >
        <aside className="cpl-rail">
          <div className="cpl-rail-top">
            <div className="cpl-rail-brand">
              <div>
                <GrafoprintBrand />
                <div className="cpl-rail-sub">Administración de plataforma</div>
              </div>
            </div>
            <div className="cpl-env">
              <span className={`d ${ambiente === "produccion" ? "" : "dev"}`} />
              {ambiente === "produccion" ? "Producción" : "Desarrollo"}
              <span className="who">Equipo Grafo</span>
            </div>
          </div>
          <nav className="cpl-rail-nav" aria-label="Secciones de Plataforma">
            {NAV.map((g) => (
              <React.Fragment key={g.grupo}>
                <div className="cpl-rail-lbl">{g.grupo}</div>
                {g.items.map((it) => {
                  const Ni = BIco[it.ic];
                  return (
                    <button
                      key={it.k}
                      type="button"
                      className={`cpl-nav-i ${vista === it.k ? "on" : ""}`}
                      aria-current={vista === it.k ? "page" : undefined}
                      onClick={() => {
                        if (vista !== it.k)
                          navegar(() =>
                            router.push(`/plataforma?vista=${it.k}`),
                          );
                      }}
                    >
                      <Ni />
                      <span>{it.label}</span>
                    </button>
                  );
                })}
              </React.Fragment>
            ))}
            {esSesionPlataforma ? null : (
              <Link
                className="cpl-nav-i cpl-nav-volver"
                href="/"
                onClick={(e) => {
                  if (salidaPlanes.current?.cambios) {
                    e.preventDefault();
                    navegar(() => router.push("/"));
                  }
                }}
              >
                <BIco.arrowLeft />
                <span>Volver a la app</span>
              </Link>
            )}
            <button
              type="button"
              className="cpl-nav-i cpl-nav-salir"
              onClick={() => navegar(() => void cerrarSesion())}
              disabled={cerrando}
            >
              <BIco.logout />
              <span>{cerrando ? "Cerrando sesión…" : "Cerrar sesión"}</span>
            </button>
          </nav>
          <div className="cpl-rail-user">
            <span className="av">{iniciales}</span>
            <div>
              <div className="nm">{staff?.nombre ?? staff?.email}</div>
              <div className="rl">
                Staff · {staff?.rol === "ADMIN" ? "Admin" : "Soporte"} de
                plataforma
              </div>
            </div>
          </div>
        </aside>

        <main
          key={`${vista}:${params.get("empresa") ?? ""}:${params.get("suscripcion") ?? ""}`}
          className={`cpl-work ${vista === "planes" ? styles.plansWork : ""}`}
        >
          <div className="cpl-topbar">
            <div>
              <div className="crumb">{meta.crumb}</div>
              <h1>
                {meta.title}
                <span className="period">.</span>
              </h1>
              <p className="description">{DESCRIPCIONES[vista]}</p>
            </div>
            <span className="grow" />
          </div>

          {vista === "observabilidad" && datos ? (
            <Observabilidad
              datos={datos}
              onVerTenant={(id) =>
                router.push(`/plataforma?vista=tenants&empresa=${id}`)
              }
            />
          ) : null}
          {(vista === "observabilidad" || vista === "impersonacion") &&
          (!datos || errorConsola) ? (
            <div className="cpl-page" role="status">
              {errorConsola ?? "Cargando consola…"}
              {errorConsola ? (
                <ActionButton
                  type="button"
                  variant="outline"
                  onPress={() => setIntento((n) => n + 1)}
                >
                  Reintentar
                </ActionButton>
              ) : null}
            </div>
          ) : null}
          {vista === "negocio" ? <Negocio /> : null}
          {vista === "tenants" ? <Tenants esAdmin={esAdmin} /> : null}
          {vista === "planes" ? (
            <PlanesView
              esAdmin={esAdmin}
              planesActuales={<Planes esAdmin={esAdmin} />}
              onSalidaChange={actualizarSalidaPlanes}
            />
          ) : null}
          {vista === "suscripciones" ? (
            <SuscripcionesView esAdmin={esAdmin} />
          ) : null}
          {vista === "equipo" ? (
            <EquipoView
              esAdmin={esAdmin}
              esSesionPlataforma={esSesionPlataforma}
            />
          ) : null}
          {vista === "impersonacion" && datos ? (
            <Impersonacion datos={datos} esAdmin={esAdmin} />
          ) : null}
        </main>
        <ConfirmacionSalida
          open={!!salidaPendiente}
          cambios={salidaPlanes.current?.cambios ?? 0}
          donde="la propuesta de planes"
          guardando={guardandoSalida}
          onSeguirEditando={() => setSalidaPendiente(null)}
          onDescartarYSalir={() => {
            const accion = salidaPendiente;
            setSalidaPendiente(null);
            accion?.();
          }}
          onGuardarYSalir={async () => {
            setGuardandoSalida(true);
            try {
              if (await salidaPlanes.current?.guardar()) {
                const accion = salidaPendiente;
                setSalidaPendiente(null);
                accion?.();
              } else setSalidaPendiente(null);
            } finally {
              setGuardandoSalida(false);
            }
          }}
        />
      </div>
    </DesignSystemProvider>
  );
}

// ── Negocio del ecosistema ─────────────────────────────────────────────
// Inteligencia de producto: qué negocio mueven juntas las imprentas sobre la
// plataforma, para decidir dónde invertir. Ver docs/control-plane-negocio-diseno.md

const PERIODOS_NEG: Array<{ k: PeriodoNegocio; label: string }> = [
  { k: "30d", label: "30 días" },
  { k: "90d", label: "90 días" },
  { k: "12m", label: "12 meses" },
];

const TECNOLOGIA_LABEL: Record<string, string> = {
  dtf_textil: "DTF textil",
  dtf_uv: "DTF UV",
  uv: "UV",
  offset: "Offset",
  laser: "Láser",
  inkjet: "Inkjet",
  eco: "Ecosolvente",
  ecosolvente: "Ecosolvente",
  solvente: "Solvente",
  sublimacion: "Sublimación",
  fotoduplicacion: "Fotoduplicación",
};
const tecLabel = (t: string) => TECNOLOGIA_LABEL[t] ?? t;

const FUGA_LABEL: Record<string, string> = {
  precio: "Precio",
  plazo: "Plazo",
  sin_respuesta: "Sin respuesta",
  competencia: "Competencia",
  otro: "Otro",
  vencido: "Vencidas",
};
const fugaLabel = (m: string) => FUGA_LABEL[m] ?? m;

/** Meses para etiquetas de ejes: las claves de bucket se parten como string,
 *  sin pasar por `Date`/ICU (evita el corrimiento de día por zona). */
const MES_CORTO = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];

function Negocio() {
  const [periodo, setPeriodo] = React.useState<PeriodoNegocio>("90d");
  const [data, setData] = React.useState<NegocioPlataforma | null>(null);
  const [cargando, setCargando] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let vivo = true;
    setCargando(true);
    setError(null);
    getNegocioPlataforma(periodo)
      .then((d) => {
        if (vivo) {
          setData(d);
          setCargando(false);
        }
      })
      .catch(() => {
        if (vivo) {
          setError("No se pudo cargar el negocio del ecosistema.");
          setCargando(false);
        }
      });
    return () => {
      vivo = false;
    };
  }, [periodo]);

  const selector = (
    <div className="cpl-seg">
      {PERIODOS_NEG.map((p) => (
        <button
          key={p.k}
          type="button"
          className={periodo === p.k ? "on" : ""}
          aria-pressed={periodo === p.k}
          onClick={() => setPeriodo(p.k)}
        >
          {p.label}
        </button>
      ))}
    </div>
  );

  const k = data?.kpis;
  // Serie: etiquetas x ralas (máx ~8 visibles) y compactas según el período.
  const serie = data?.serie ?? [];
  const paso = Math.max(1, Math.ceil(serie.length / 8));
  // El bucket es una CLAVE de calendario ("2026-07-20"): parsearla con
  // `new Date` la vuelve medianoche UTC y el navegador al oeste la corre un
  // día. Se parte el string y listo — no hay zona que interpretar.
  const fmtX = (iso: string) => {
    const [, m, d] = iso.slice(0, 10).split("-");
    return periodo === "12m" ? MES_CORTO[Number(m) - 1] : `${d}/${m}`;
  };
  const serieChart = serie.map((s, i) => ({
    x: i % paso === 0 || i === serie.length - 1 ? fmtX(s.periodo) : "",
    ventas: s.ventas,
    facturado: s.facturado,
  }));
  const donutCat = (data?.porCategoria ?? []).slice(0, 6).map((c, i) => ({
    label: c.categoria,
    value: c.ventas,
    color: PALETA[i % PALETA.length],
  }));
  const donutTec = (data?.porTecnologia ?? []).slice(0, 6).map((t, i) => ({
    label: tecLabel(t.tecnologia),
    value: t.ventas,
    color: PALETA[i % PALETA.length],
  }));
  const maxTenant = Math.max(
    1,
    ...(data?.porTenant ?? []).map((t) => t.ventas),
  );
  const mediana = data?.medianaTicket ?? 0;
  // El benchmark ticket-vs-mediana sólo tiene sentido con varias imprentas.
  const mostrarBenchmark = (data?.porTenant.length ?? 0) >= 2 && mediana > 0;
  const distTamano = (data?.distribucionTamano ?? []).map((b) => ({
    x: b.rango,
    v: b.tenants,
  }));
  // Más de una moneda en el ecosistema: los totales de arriba suman crudo
  // (no hay tipo de cambio en el sistema); el desglose es la lectura honesta.
  const porMoneda = data?.porMoneda ?? [];
  const mezclaMonedas = porMoneda.length > 1;

  return (
    <div className="cpl-page cpl-neg">
      <div className="cpl-neg-top">
        <p className="cpl-neg-intro">
          El negocio agregado que mueven las imprentas sobre la plataforma.
          Ventas = neto sin IVA (órdenes emitidas); facturado = comprobantes
          fiscales. Sirve para decidir dónde invertir el producto.
        </p>
        {selector}
      </div>

      {mezclaMonedas ? (
        <div
          className="cpl-empty"
          style={{ color: "var(--warn, #a16207)", marginBottom: 10 }}
        >
          Ojo: hay imprentas operando en más de una moneda y los totales suman
          sin convertir. GMV por moneda:{" "}
          {porMoneda
            .map(
              (m) =>
                `${m.moneda} ${mk(m.ventas)} (${m.tenants} imprenta${m.tenants === 1 ? "" : "s"})`,
            )
            .join(" · ")}
          .
        </div>
      ) : null}

      {error ? <div className="cpl-empty">{error}</div> : null}
      {!error && !data && cargando ? (
        <div className="cpl-empty">Cargando…</div>
      ) : null}

      {data && k ? (
        <div
          style={{ opacity: cargando ? 0.55 : 1, transition: "opacity .15s" }}
        >
          <div className="cpl-kgrid">
            <Kpi
              label="Ventas del ecosistema"
              value={mk(k.ventas)}
              sub="neto sin IVA"
              delta={{ actual: k.ventas, previo: k.ventasPrev }}
              spark={serie.map((s) => s.ventas)}
              sparkColor="var(--acc)"
            />
            <Kpi
              label="Facturado"
              value={mk(k.facturado)}
              sub="fiscal emitido"
              delta={{ actual: k.facturado, previo: k.facturadoPrev }}
            />
            <Kpi
              label="Cobrado"
              value={mk(k.cobrado)}
              sub="caja del ecosistema"
              delta={{ actual: k.cobrado, previo: k.cobradoPrev }}
            />
            <Kpi
              label="Órdenes"
              value={fmtN(k.ordenes)}
              sub={`ticket ${mk(k.ticketPromedio)}`}
              delta={{ actual: k.ordenes, previo: k.ordenesPrev }}
            />
            <Kpi
              label="Presupuestos"
              value={fmtN(k.presupuestos)}
              sub="enviados en el período"
            />
            <Kpi
              label="Imprentas con ventas"
              value={`${data.adopcion.conVentas}/${data.adopcion.totalTenants}`}
              sub="activas en el período"
            />
          </div>

          {data.insights.length ? (
            <div className="cpl-neg-insights">
              <div className="cpl-neg-insights-h">
                <BIco.alert />
                Lecturas para el producto
              </div>
              <div className="cards">
                {data.insights.map((i) => (
                  <div key={i.clave} className={`ins ${i.severidad}`}>
                    <div className="t">{i.titulo}</div>
                    <div className="d">{i.detalle}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="cpl-neg-grid">
            <Panel
              title="Ventas y facturación"
              sub={data.periodo.etiqueta}
              right={
                <div className="cpl-legend">
                  <span>
                    <i style={{ background: "var(--acc)" }} /> Ventas
                  </span>
                  <span>
                    <i style={{ background: "var(--ok)" }} /> Facturado
                  </span>
                </div>
              }
            >
              {serieChart.length ? (
                <AreaChart
                  data={serieChart}
                  series={[
                    { key: "ventas", color: "var(--acc)" },
                    { key: "facturado", color: "var(--ok)" },
                  ]}
                  height={220}
                />
              ) : (
                <div className="cpl-empty">Sin ventas en el período.</div>
              )}
            </Panel>

            <Panel title="Mix por categoría" sub="qué se vende">
              {donutCat.length ? (
                <div className="cpl-neg-mix">
                  <Donut
                    segs={donutCat}
                    centerV={mk(k.ventas)}
                    centerL="ventas"
                    hideLegend
                  />
                  <div className="cpl-neg-legend">
                    {data.porCategoria.slice(0, 6).map((c, i) => (
                      <div key={c.categoria} className="row">
                        <i style={{ background: PALETA[i % PALETA.length] }} />
                        <span className="nm">{c.categoria}</span>
                        <span className="val cpl-mono">{mk(c.ventas)}</span>
                        <span className="pc cpl-mono">{c.pct}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="cpl-empty">Sin datos de categoría.</div>
              )}
            </Panel>
          </div>

          <div className="cpl-neg-grid">
            <Panel title="Mix por tecnología" sub="cómo se produce">
              {donutTec.length ? (
                <div className="cpl-neg-mix">
                  <Donut
                    segs={donutTec}
                    centerV={mk(k.ventas)}
                    centerL="ventas"
                    hideLegend
                  />
                  <div className="cpl-neg-legend">
                    {data.porTecnologia.slice(0, 6).map((t, i) => (
                      <div key={t.tecnologia} className="row">
                        <i style={{ background: PALETA[i % PALETA.length] }} />
                        <span className="nm">{tecLabel(t.tecnologia)}</span>
                        <span className="val cpl-mono">{mk(t.ventas)}</span>
                        <span className="pc cpl-mono">{t.pct}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="cpl-empty">Sin datos de tecnología.</div>
              )}
            </Panel>

            <Panel title="Producto" sub="medida y adicionales">
              <div className="cpl-neg-prod">
                <div className="blk">
                  <div className="h">Estándar vs a medida</div>
                  <div className="big cpl-mono">
                    {data.medidas.pctEstandar ?? "—"}
                    <span> % estándar</span>
                  </div>
                  <div className="stack2">
                    <span
                      className="est"
                      style={{ flexGrow: data.medidas.estandar || 0 }}
                    />
                    <span
                      className="per"
                      style={{ flexGrow: data.medidas.personalizada || 0 }}
                    />
                  </div>
                  <div className="sub">
                    {fmtN(data.medidas.estandar)} estándar ·{" "}
                    {fmtN(data.medidas.personalizada)} a medida
                  </div>
                </div>
                <div className="blk">
                  <div className="h">Adicionales · attach rate</div>
                  <div className="big cpl-mono">
                    {data.adicionales.pctCon}
                    <span> % de los ítems</span>
                  </div>
                  {data.adicionales.top.length ? (
                    <div className="chips">
                      {data.adicionales.top.slice(0, 6).map((a) => (
                        <span key={a.etiqueta} className="chip">
                          {a.etiqueta}
                          <b>{a.pctItems}%</b>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="sub">Sin adicionales registrados.</div>
                  )}
                </div>
              </div>
            </Panel>
          </div>

          <Panel
            title="Ranking de imprentas"
            sub={
              mediana > 0
                ? `por ventas · ticket mediano ${mk(mediana)}`
                : "por ventas del período"
            }
            flush
          >
            {data.porTenant.length ? (
              <div className="cpl-neg-rank">
                {data.porTenant.slice(0, 12).map((t) => {
                  const ratio = mediana > 0 ? t.ticket / mediana : 1;
                  return (
                    <div key={t.tenantId} className="r">
                      <TLogo nombre={t.nombre} slug={t.slug} />
                      <div className="nm">
                        <div className="n">{t.nombre}</div>
                        <div className="s">
                          {fmtN(t.ordenes)} órdenes · ticket {mk(t.ticket)}
                          {mostrarBenchmark ? (
                            <span
                              className={`vsmed ${ratio >= 1 ? "up" : "down"}`}
                            >
                              {ratio.toFixed(1)}× mediana
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <div className="bar">
                        <span
                          style={{ width: `${(t.ventas / maxTenant) * 100}%` }}
                        />
                      </div>
                      <div className="v cpl-mono">
                        {mk(t.ventas)}
                        <span className="pc">{t.pct}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="cpl-empty">
                Ninguna imprenta registró ventas en el período.
              </div>
            )}
          </Panel>

          {data.porTenant.length ? (
            <Panel
              title="Tamaño de las imprentas"
              sub="cuántas caen en cada tramo de facturación"
            >
              <Bars data={distTamano} color="var(--acc)" height={150} />
            </Panel>
          ) : null}

          <div className="cpl-neg-adopt">
            <AdoptTile
              label="Con ventas"
              n={data.adopcion.conVentas}
              total={data.adopcion.totalTenants}
            />
            <AdoptTile
              label="Con presupuestos"
              n={data.adopcion.conPresupuestos}
              total={data.adopcion.totalTenants}
            />
            <AdoptTile
              label="Con facturación electrónica"
              n={data.adopcion.conFacturacion}
              total={data.adopcion.totalTenants}
            />
          </div>

          <Panel
            title="Embudo comercial del ecosistema"
            sub="conversión de presupuestos (benchmark)"
          >
            {data.embudo.emitidas > 0 ? (
              <div className="cpl-neg-funnel-wrap">
                <div className="cpl-neg-funnel">
                  {[
                    {
                      label: "Emitidas",
                      n: data.embudo.emitidas,
                      monto: data.embudo.emitidasMonto,
                    },
                    {
                      label: "Aprobadas",
                      n: data.embudo.aprobadas,
                      monto: data.embudo.aprobadasMonto,
                    },
                    {
                      label: "En producción",
                      n: data.embudo.produccion,
                      monto: null,
                    },
                    {
                      label: "Entregadas",
                      n: data.embudo.entregadas,
                      monto: null,
                    },
                  ].map((e) => (
                    <div className="stage" key={e.label}>
                      <div className="n cpl-mono">{fmtN(e.n)}</div>
                      <div className="bar">
                        <span
                          style={{
                            height: `${(e.n / data.embudo.emitidas) * 100}%`,
                          }}
                        />
                      </div>
                      <div className="l">{e.label}</div>
                      {e.monto != null ? (
                        <div className="m cpl-mono">{mk(e.monto)}</div>
                      ) : (
                        <div className="m" />
                      )}
                    </div>
                  ))}
                </div>
                <div className="cpl-neg-funnel-side">
                  <div className="fk">
                    <b className="cpl-mono">
                      {data.embudo.tasaAprobacion ?? "—"}%
                    </b>
                    <span>tasa de aprobación</span>
                  </div>
                  <div className="fk">
                    <b className="cpl-mono">
                      {data.embudo.tasaEntrega ?? "—"}%
                    </b>
                    <span>emitida → entregada</span>
                  </div>
                  {data.embudo.fugas.length ? (
                    <div className="fugas">
                      <div className="ttl">Fugas</div>
                      {data.embudo.fugas.map((f) => (
                        <div key={f.motivo} className="frow">
                          <span>{fugaLabel(f.motivo)}</span>
                          <b className="cpl-mono">{f.cantidad}</b>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="fugas">
                      <div className="ttl">Fugas</div>
                      <div className="frow vacio">Ninguna en el período.</div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="cpl-empty">
                No se enviaron presupuestos formales en el período.
              </div>
            )}
          </Panel>
        </div>
      ) : null}
    </div>
  );
}

function AdoptTile({
  label,
  n,
  total,
}: {
  label: string;
  n: number;
  total: number;
}) {
  const pct = total > 0 ? Math.round((n / total) * 100) : 0;
  return (
    <div className="cpl-adopt">
      <div className="t">{label}</div>
      <div className="v cpl-mono">
        {n}
        <span className="of">/ {total}</span>
      </div>
      <div className="bar">
        <span style={{ width: `${pct}%` }} />
      </div>
      <div className="p cpl-mono">{pct}% de las imprentas</div>
    </div>
  );
}

// ── Observabilidad ─────────────────────────────────────────────────────

function Observabilidad({
  datos,
  onVerTenant,
}: {
  datos: ConsolaPlataforma;
  onVerTenant: (id: string) => void;
}) {
  const { resumen, tenants, actividadSemanal, altasMensuales } = datos;
  const waPend = tenants.reduce((s, t) => s + t.whatsappPendientes, 0);
  const waFall = tenants.reduce((s, t) => s + t.whatsappFallidas, 0);
  const intsError = tenants.flatMap((t) =>
    t.integraciones.filter((i) => i.estado === "ERROR"),
  ).length;
  const intsConectadas = tenants.flatMap((t) =>
    t.integraciones.filter((i) => i.estado === "CONECTADA"),
  ).length;
  const enRiesgo = tenants
    .map((t) => ({ t, riesgo: riesgoDe(t) }))
    .filter((x) => x.riesgo !== null)
    .sort((a) => (!a.t.activo ? -1 : 0));
  const topUso = [...tenants]
    .filter((t) => t.ots30d > 0)
    .sort((a, b) => b.ots30d - a.ots30d)
    .slice(0, 6);
  const maxUso = topUso[0]?.ots30d ?? 1;

  const labelSemana = (iso: string) => {
    const d = new Date(`${iso}T00:00:00`);
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
  };
  const labelMes = (ym: string) => MES_CORTO[Number(ym.slice(5, 7)) - 1];

  const serieChart = actividadSemanal.map((sem) => ({
    x: labelSemana(sem.semana),
    ots: sem.ots,
    cotizaciones: sem.cotizaciones,
  }));
  const sparkOts = actividadSemanal.map((sem) => sem.ots);
  const sparkCotiz = actividadSemanal.map((sem) => sem.cotizaciones);
  const sparkCobros = actividadSemanal.map((sem) => sem.cobros);
  // Tenants acumulados: el spark del KPI, desde las altas mensuales reales.
  const base =
    resumen.tenants - altasMensuales.reduce((s, m) => s + m.altas, 0);
  const sparkTenants = altasMensuales.reduce<number[]>(
    (arr, m) => [...arr, (arr[arr.length - 1] ?? base) + m.altas],
    [],
  );

  // Distribución por plan — real desde la etapa B1. "Sin plan" = legacy.
  const donutPlanes = (() => {
    const porPlan = new Map<
      string,
      { label: string; value: number; color: string }
    >();
    for (const t of tenants) {
      const clave = t.plan?.codigo ?? "sin-plan";
      const actual = porPlan.get(clave);
      if (actual) actual.value += 1;
      else
        porPlan.set(clave, {
          label: t.plan?.nombre ?? "Sin plan",
          value: 1,
          color: t.plan ? (PLAN_COLORS[t.plan.codigo] ?? "#63636d") : "#3c3c46",
        });
    }
    return [...porPlan.values()].sort((a, b) => b.value - a.value);
  })();

  return (
    <div className="cpl-page">
      <div className="cpl-kgrid">
        <Kpi
          label="Estimación de catálogo"
          value={mk(resumen.mrr)}
          sub={
            resumen.sinPlan > 0
              ? `${resumen.sinPlan} tenant${resumen.sinPlan === 1 ? "" : "s"} sin plan`
              : "precios publicados · no es MRR comercial"
          }
        />
        <Kpi
          label="OTs emitidas · 30d"
          value={fmtN(resumen.ots30d)}
          delta={{ actual: resumen.ots30d, previo: resumen.ots30dPrev }}
          sub="vs. 30d previos"
          spark={sparkOts}
        />
        <Kpi
          label="Cotizaciones · 30d"
          value={fmtN(resumen.cotizaciones30d)}
          delta={{
            actual: resumen.cotizaciones30d,
            previo: resumen.cotizaciones30dPrev,
          }}
          sub="vs. 30d previos"
          spark={sparkCotiz}
          sparkColor="var(--info, #5aa2f5)"
        />
        <Kpi
          label="Cobros · 30d"
          value={fmtN(resumen.cobros30d)}
          delta={{ actual: resumen.cobros30d, previo: resumen.cobros30dPrev }}
          sub="vs. 30d previos"
          spark={sparkCobros}
          sparkColor="var(--ok)"
        />
        <Kpi
          label="Tenants activos"
          value={String(resumen.tenantsActivos)}
          sub={`${resumen.tenants} en total`}
          spark={sparkTenants}
          sparkColor="var(--ok)"
        />
        <Kpi
          label="Usuarios habilitados"
          value={fmtN(resumen.usuariosActivos)}
          sub={`storage ${fmtBytes(resumen.storageBytes)}`}
        />
      </div>

      <div className="cpl-grid cpl-g-mrr">
        <Panel
          title="Actividad de la plataforma"
          sub="Últimas 12 semanas"
          right={
            <span className="cpl-legend">
              <span>
                <i style={{ background: "var(--acc)" }} />
                OTs emitidas
              </span>
              <span>
                <i style={{ background: "var(--info, #5aa2f5)" }} />
                Cotizaciones
              </span>
            </span>
          }
        >
          <AreaChart
            data={serieChart}
            height={200}
            series={[
              { key: "ots", color: "var(--acc)" },
              { key: "cotizaciones", color: "var(--info, #5aa2f5)" },
            ]}
          />
          <div className="cpl-chartfoot">
            <div>
              <div className="k">OTs 30d</div>
              <div className="v cpl-mono">{fmtN(resumen.ots30d)}</div>
            </div>
            <div>
              <div className="k">Cotizaciones 30d</div>
              <div className="v cpl-mono">{fmtN(resumen.cotizaciones30d)}</div>
            </div>
            <div>
              <div className="k">Cobros 30d</div>
              <div className="v cpl-mono">{fmtN(resumen.cobros30d)}</div>
            </div>
          </div>
        </Panel>

        <Panel title="Ingresos recurrentes" sub="medición comercial pendiente">
          {[
            { t: "Nuevos", s: "altas del mes", c: "var(--ok)" },
            { t: "Expansión", s: "upgrades de plan", c: "var(--acc-2)" },
            { t: "Contracción", s: "downgrades", c: "var(--warn)" },
            { t: "Churn", s: "bajas", c: "var(--dng)" },
          ].map((m) => (
            <div className="cpl-mov" key={m.t}>
              <span
                className="mi"
                style={{ background: "var(--surface-3)", color: m.c }}
              >
                <BIco.card />
              </span>
              <div className="ml">
                <div className="t">{m.t}</div>
                <div className="s">{m.s}</div>
              </div>
              <span className="mval" style={{ color: "var(--muted-2)" }}>
                —
              </span>
            </div>
          ))}
          <div className="cpl-callout info" style={{ marginTop: 12 }}>
            <BIco.card />
            <div>
              El desglose por altas, cambios de plan y bajas todavía no está
              disponible.
            </div>
          </div>
        </Panel>
      </div>

      <div className="cpl-grid cpl-g-3">
        <Panel title="Tenants por plan" sub={`${resumen.tenants} cuentas`}>
          <div style={{ paddingTop: 8 }}>
            <Donut
              segs={donutPlanes}
              centerV={String(resumen.tenants)}
              centerL="tenants"
            />
          </div>
        </Panel>

        <Panel title="Altas de tenants" sub="Últimos 6 meses">
          <Bars
            data={altasMensuales.map((m) => ({
              x: labelMes(m.mes),
              v: m.altas,
            }))}
            height={168}
          />
        </Panel>

        <Panel title="Salud de plataforma" sub="lo que medimos de verdad">
          <div className="cpl-health dos">
            <div className="cpl-htile">
              <div className="ht">
                <span
                  className="hd"
                  style={{
                    background: waFall > 0 ? "var(--dng)" : "var(--ok)",
                  }}
                />
                Cola WhatsApp
              </div>
              <div className="hv cpl-mono">{waPend}</div>
              <div className="hs">
                pendientes · {waFall > 0 ? `${waFall} fallidas` : "0 fallidas"}
              </div>
            </div>
            <div className="cpl-htile">
              <div className="ht">
                <span
                  className="hd"
                  style={{
                    background: intsError > 0 ? "var(--warn)" : "var(--ok)",
                  }}
                />
                Integraciones
              </div>
              <div className="hv cpl-mono">{intsConectadas}</div>
              <div className="hs">
                conectadas ·{" "}
                {intsError > 0 ? `${intsError} en error` : "0 en error"}
              </div>
            </div>
            <div className="cpl-htile">
              <div className="ht">
                <span
                  className="hd"
                  style={{
                    background:
                      resumen.sinActividad14d > 0 ? "var(--warn)" : "var(--ok)",
                  }}
                />
                Sin actividad 14d
              </div>
              <div className="hv cpl-mono">{resumen.sinActividad14d}</div>
              <div className="hs">señal temprana de churn</div>
            </div>
            <div className="cpl-htile">
              <div className="ht">
                <span className="hd" style={{ background: "var(--ok)" }} />
                Auditoría
              </div>
              <div className="hv cpl-mono">{datos.auditoria.length}</div>
              <div className="hs">eventos del control plane</div>
            </div>
          </div>
        </Panel>
      </div>

      <div className="cpl-grid cpl-g-2">
        <Panel
          title="Tenants en riesgo"
          sub={
            enRiesgo.length
              ? `${enRiesgo.length} requieren atención`
              : "ninguno"
          }
          flush
        >
          {enRiesgo.length === 0 ? (
            <div className="cpl-empty">
              <BIco.building />
              <div className="t">Sin señales de riesgo</div>
              <div className="s">
                Suspensiones, integraciones en error, WhatsApp fallidos e
                inactividad aparecen acá.
              </div>
            </div>
          ) : (
            <table className="cpl-tbl compacta">
              <tbody>
                {enRiesgo.map(({ t, riesgo }) => (
                  <tr key={t.id} onClick={() => onVerTenant(t.id)}>
                    <td>
                      <div className="cpl-tname">
                        <TLogo nombre={t.nombre} slug={t.slug} />
                        <div>
                          <div className="n">{t.nombre}</div>
                          <div className="sub" style={{ color: "var(--warn)" }}>
                            {riesgo}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="r">
                      <EstadoPill t={t} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>

        <Panel title="Mayor uso" sub="OTs emitidas · 30d" flush>
          {topUso.length === 0 ? (
            <div className="cpl-empty">
              <div className="t">Sin actividad en 30 días</div>
            </div>
          ) : (
            <table className="cpl-tbl compacta">
              <tbody>
                {topUso.map((t) => (
                  <tr key={t.id} onClick={() => onVerTenant(t.id)}>
                    <td style={{ width: "48%" }}>
                      <div className="cpl-tname">
                        <TLogo nombre={t.nombre} slug={t.slug} />
                        <div>
                          <div className="n">{t.nombre}</div>
                          <div className="sub">
                            {t.usuariosActivos} usuarios
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="cpl-usebar">
                        <div className="cpl-meter">
                          <span
                            style={{
                              width: `${Math.round((t.ots30d / maxUso) * 100)}%`,
                            }}
                          />
                        </div>
                      </div>
                    </td>
                    <td
                      className="r cpl-mono"
                      style={{ color: "var(--muted-text)" }}
                    >
                      {fmtN(t.ots30d)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      </div>

      <div className="cpl-note">
        Lectura agregada cross-tenant, todo desde la base: sesiones, órdenes,
        cotizaciones, cobros, storage, integraciones y la cola de WhatsApp. Los
        deltas comparan contra los 30 días anteriores. El monitoreo de
        disponibilidad y latencia todavía no está conectado.
      </div>
    </div>
  );
}

// ── Tenants ────────────────────────────────────────────────────────────

function Tenants({ esAdmin }: { esAdmin: boolean }) {
  const [creando, setCreando] = React.useState(false);
  const [version, setVersion] = React.useState(0);
  const [planes, setPlanes] = React.useState<PlanCatalogo[]>([]);
  React.useEffect(() => {
    if (!esAdmin) return;
    let vigente = true;
    getPlanesPlataforma()
      .then((p) => {
        if (vigente) setPlanes(p);
      })
      .catch(() => {
        if (vigente) toast.error("No se pudo cargar el catálogo de planes.");
      });
    return () => {
      vigente = false;
    };
  }, [esAdmin]);
  return (
    <>
      <EmpresasView
        esAdmin={esAdmin}
        planes={planes}
        version={version}
        onCrear={() => setCreando(true)}
      />
      {creando ? (
        <CrearTenantModal
          planes={planes}
          onCerrar={() => {
            setCreando(false);
            setVersion((v) => v + 1);
          }}
        />
      ) : null}
    </>
  );
}

/** Alta de tenant: crea empresa + suscripción + invitación del primer admin. */
function CrearTenantModal({
  planes,
  onCerrar,
}: {
  planes: PlanCatalogo[];
  onCerrar: () => void;
}) {
  const [nombre, setNombre] = React.useState("");
  const [slug, setSlug] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [planId, setPlanId] = React.useState("");
  const [ocupado, setOcupado] = React.useState(false);
  const [invitacionUrl, setInvitacionUrl] = React.useState<string | null>(null);

  const valido =
    nombre.trim().length >= 2 &&
    /^[a-z0-9][a-z0-9-]{1,40}$/.test(slug) &&
    /.+@.+\..+/.test(email) &&
    planId !== "";

  const crear = async () => {
    if (!valido || ocupado) return;
    setOcupado(true);
    try {
      const r = await crearTenantPlataforma({
        nombre: nombre.trim(),
        slug,
        planId,
        adminEmail: email.trim(),
      });
      setInvitacionUrl(r.invitacionUrl);
      toast.success("Empresa creada. Mandale el link de invitación.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo crear.");
      setOcupado(false);
    }
  };

  return (
    <FormDialog
      isOpen
      onOpenChange={(open) => {
        if (!open) onCerrar();
      }}
      title="Nueva empresa"
      description="Creá la empresa, elegí su plan e invitá al primer administrador. El enlace de invitación vence en 7 días."
      isDismissable={!ocupado || !!invitacionUrl}
      className={`${platformTheme} ${styles.dialog}`}
    >
      {invitacionUrl ? (
        <div className="cpl-mb">
          <div className="cpl-field">
            <label>Link de invitación</label>
            <div className="cpl-invlink">{invitacionUrl}</div>
          </div>
          <ActionButton
            type="button"
            variant="primary"
            onPress={() => {
              void navigator.clipboard?.writeText(invitacionUrl);
              toast.success("Link copiado.");
            }}
          >
            Copiar link
          </ActionButton>
        </div>
      ) : (
        <div className="cpl-mb">
          <div className="cpl-field">
            <label htmlFor="empresa-nombre">Nombre de la imprenta</label>
            <Input
              className={fieldFocus.singleBorder}
              fullWidth
              id="empresa-nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Gráfica del Sur SRL"
              autoFocus
            />
          </div>
          <div className="cpl-field">
            <label htmlFor="empresa-slug">Slug (identificador corto)</label>
            <Input
              className={fieldFocus.singleBorder}
              fullWidth
              id="empresa-slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase())}
              placeholder="grafica-del-sur"
            />
          </div>
          <div className="cpl-field">
            <label htmlFor="empresa-email">Email del administrador</label>
            <Input
              className={fieldFocus.singleBorder}
              fullWidth
              id="empresa-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="duenio@imprenta.com"
            />
          </div>
          <div className="cpl-field">
            <label htmlFor="empresa-plan">Plan</label>
            <SelectField
              id="empresa-plan"
              aria-label="Plan"
              value={planId}
              onChange={setPlanId}
              options={[
                { value: "", label: "Elegí un plan…", disabled: true },
                ...planes.map((p) => ({
                  value: p.id,
                  label: `${p.nombre} · ${mk(p.precioMensual)}/mes`,
                })),
              ]}
            />
          </div>
        </div>
      )}
      <div className="cpl-mf">
        <ActionButton
          type="button"
          variant="outline"
          isDisabled={ocupado && !invitacionUrl}
          onPress={onCerrar}
        >
          {invitacionUrl ? "Cerrar" : "Cancelar"}
        </ActionButton>
        {!invitacionUrl ? (
          <ActionButton
            type="button"
            variant="primary"
            isDisabled={!valido || ocupado}
            onPress={() => void crear()}
          >
            {ocupado ? "Creando…" : "Crear empresa"}
          </ActionButton>
        ) : null}
      </div>
    </FormDialog>
  );
}

// ── Planes y precios ───────────────────────────────────────────────────
// El mapeo con el catálogo de Paddle se carga acá y no en un seed porque
// sandbox y producción tienen catálogos distintos: migrar de uno a otro tiene
// que ser cargar un campo, no deployar. Ver docs/suscripciones-cobro-diseno.md

function Planes({ esAdmin }: { esAdmin: boolean }) {
  const [planes, setPlanes] = React.useState<PlanCatalogo[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [editando, setEditando] = React.useState<string | null>(null);

  React.useEffect(() => {
    let vivo = true;
    getPlanesPlataforma()
      .then((p) => vivo && setPlanes(p))
      .catch(() => vivo && setError("No se pudieron cargar los planes."));
    return () => {
      vivo = false;
    };
  }, []);

  if (error)
    return (
      <div className="cpl-page">
        <div className="cpl-empty">{error}</div>
      </div>
    );
  if (!planes)
    return (
      <div className="cpl-page">
        <div className="cpl-empty">Cargando…</div>
      </div>
    );

  const vinculados = planes.filter((p) => p.paddlePriceId).length;

  return (
    <div className="cpl-page cpl-planes">
      <p className="cpl-neg-intro" style={{ marginBottom: 18 }}>
        Cada plan se vende a través de su precio en Paddle. El <b>monto</b> vive
        en el catálogo de Paddle; las <b>features y los límites</b> viven acá.
        El id del precio los une — cargalo abajo.
      </p>

      <Panel
        title="Planes"
        sub={`${vinculados} de ${planes.length} vinculados a Paddle`}
        flush
      >
        <table className="cpl-tbl">
          <thead>
            <tr>
              <th>Plan</th>
              <th>Bajada (la ve el tenant)</th>
              <th>Precio</th>
              <th>Tenants</th>
              <th>Precio en Paddle</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {planes.map((p) => (
              <PlanFila
                key={p.id}
                plan={p}
                esAdmin={esAdmin}
                editando={editando === p.id}
                onEditar={() => setEditando(p.id)}
                onCerrar={() => setEditando(null)}
                onGuardado={(lista) => {
                  setPlanes(lista);
                  setEditando(null);
                }}
              />
            ))}
          </tbody>
        </table>
      </Panel>

      {vinculados === 0 ? (
        <div className="cpl-nota" style={{ marginTop: 14 }}>
          Todavía no hay ningún plan vinculado. Hasta que al menos uno lo esté,
          el checkout no puede dar de alta suscripciones: el webhook resuelve el
          plan por el id del precio.
        </div>
      ) : null}
    </div>
  );
}

function PlanFila({
  plan,
  esAdmin,
  editando,
  onEditar,
  onCerrar,
  onGuardado,
}: {
  plan: PlanCatalogo;
  esAdmin: boolean;
  editando: boolean;
  onEditar: () => void;
  onCerrar: () => void;
  onGuardado: (planes: PlanCatalogo[]) => void;
}) {
  const [priceId, setPriceId] = React.useState(plan.paddlePriceId ?? "");
  const [priceIdAnual, setPriceIdAnual] = React.useState(
    plan.paddlePriceIdAnual ?? "",
  );
  const [productId, setProductId] = React.useState(plan.paddleProductId ?? "");
  const [guardando, setGuardando] = React.useState(false);

  const guardar = async () => {
    if (guardando) return;
    setGuardando(true);
    try {
      // Cada ciclo es un precio distinto en Paddle y se valida por separado
      // (que el id exista y traer el monto real). Se manda el mensual primero
      // porque es el que también fija el productId.
      let lista = await vincularPlanPaddle(
        plan.id,
        priceId.trim() || null,
        productId.trim() || null,
        "mensual",
      );
      if ((priceIdAnual.trim() || "") !== (plan.paddlePriceIdAnual ?? "")) {
        lista = await vincularPlanPaddle(
          plan.id,
          priceIdAnual.trim() || null,
          null,
          "anual",
        );
      }
      toast.success(
        priceId.trim()
          ? `${plan.nombre} quedó vinculado a Paddle.`
          : `${plan.nombre} se desvinculó de Paddle.`,
      );
      onGuardado(lista);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "No se pudo guardar el vínculo.",
      );
      setGuardando(false);
    }
  };

  if (editando) {
    return (
      <tr>
        <td>
          <b>{plan.nombre}</b>
        </td>
        <td colSpan={5}>
          <div className="cpl-planedit">
            <label>
              <span>Price ID</span>
              <Input
                className={fieldFocus.singleBorder}
                fullWidth
                value={priceId}
                onChange={(e) => setPriceId(e.target.value)}
                placeholder="pri_01j…"
                autoFocus
                disabled={guardando}
              />
            </label>
            <label>
              <span>Price ID anual (opcional)</span>
              <Input
                className={fieldFocus.singleBorder}
                fullWidth
                value={priceIdAnual}
                onChange={(e) => setPriceIdAnual(e.target.value)}
                placeholder="pri_01j…"
                disabled={guardando}
              />
            </label>
            <label>
              <span>Product ID (opcional)</span>
              <Input
                className={fieldFocus.singleBorder}
                fullWidth
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                placeholder="pro_01j…"
                disabled={guardando}
              />
            </label>
            <ActionButton
              type="button"
              variant="primary"
              onPress={guardar}
              isDisabled={guardando}
            >
              {guardando ? "Guardando…" : "Guardar"}
            </ActionButton>
            <ActionButton
              type="button"
              variant="outline"
              onPress={onCerrar}
              isDisabled={guardando}
            >
              Cancelar
            </ActionButton>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td>
        <b>{plan.nombre}</b>
        <div className="cpl-sub">
          {plan.codigo}
          {plan.publico ? "" : " · interno"}
        </div>
      </td>
      <td>
        <BajadaPlan plan={plan} esAdmin={esAdmin} onGuardado={onGuardado} />
      </td>
      <td className="cpl-mono">
        {plan.moneda === "USD" ? "US$" : "$"}
        {fmtN(plan.precioMensual)}
        <div className="cpl-sub">por mes</div>
      </td>
      <td className="cpl-mono">{fmtN(plan.tenants)}</td>
      <td>
        {plan.paddlePriceId ? (
          <div className="cpl-precios">
            <span className="cpl-invlink">
              <b>mes</b> {plan.paddlePriceId}
            </span>
            {plan.paddlePriceIdAnual ? (
              <span className="cpl-invlink">
                <b>año</b> {plan.paddlePriceIdAnual}
                {plan.precioAnual !== null ? (
                  <em className="cpl-anualmonto">
                    {plan.moneda === "USD" ? "US$" : "$"}
                    {fmtN(plan.precioAnual)}
                  </em>
                ) : null}
              </span>
            ) : (
              <span className="cpl-sinvinculo">sin precio anual</span>
            )}
          </div>
        ) : (
          <span className="cpl-sinvinculo">sin vincular</span>
        )}
      </td>
      <td style={{ textAlign: "right" }}>
        {esAdmin ? (
          <ActionButton type="button" variant="outline" onPress={onEditar}>
            {plan.paddlePriceId ? "Cambiar" : "Vincular"}
          </ActionButton>
        ) : null}
      </td>
    </tr>
  );
}

/** Edición inline de la bajada comercial del plan (es copy de producto: se
 *  cambia sin deploy y la ve el tenant en su tarjeta). */
function BajadaPlan({
  plan,
  esAdmin,
  onGuardado,
}: {
  plan: PlanCatalogo;
  esAdmin: boolean;
  onGuardado: (planes: PlanCatalogo[]) => void;
}) {
  const [editando, setEditando] = React.useState(false);
  const [texto, setTexto] = React.useState(plan.descripcion ?? "");
  const [guardando, setGuardando] = React.useState(false);

  const guardar = async () => {
    if (guardando) return;
    setGuardando(true);
    try {
      onGuardado(await describirPlan(plan.id, texto.trim() || null));
      setEditando(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally {
      setGuardando(false);
    }
  };

  if (!editando) {
    return (
      <button
        type="button"
        className="cpl-bajada"
        onClick={() => esAdmin && setEditando(true)}
        disabled={!esAdmin}
        title={esAdmin ? "Editar la bajada" : undefined}
      >
        {plan.descripcion ?? <span className="cpl-sinvinculo">sin bajada</span>}
      </button>
    );
  }
  return (
    <div className="cpl-bajada-edit">
      <Textarea
        fullWidth
        className={fieldFocus.singleBorder}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Para imprentas que arrancan a ordenar su producción."
        maxLength={220}
        rows={2}
        autoFocus
        disabled={guardando}
      />
      <div className="acc">
        <ActionButton
          type="button"
          variant="primary"
          onPress={guardar}
          isDisabled={guardando}
        >
          {guardando ? "…" : "Guardar"}
        </ActionButton>
        <ActionButton
          type="button"
          variant="outline"
          onPress={() => {
            setTexto(plan.descripcion ?? "");
            setEditando(false);
          }}
          isDisabled={guardando}
        >
          Cancelar
        </ActionButton>
      </div>
    </div>
  );
}

// ── Impersonación y auditoría ──────────────────────────────────────────

function Impersonacion({
  datos,
  esAdmin,
}: {
  datos: ConsolaPlataforma;
  esAdmin: boolean;
}) {
  const router = useRouter();
  const nombreDe = new Map(datos.tenants.map((t) => [t.id, t.nombre]));
  const [sesiones, setSesiones] = React.useState<SesionImpersonacion[]>([]);
  const [modal, setModal] = React.useState(false);

  const cargar = React.useCallback(async () => {
    try {
      setSesiones(await getSesionesImpersonacion());
    } catch {
      setSesiones([]);
    }
  }, []);
  React.useEffect(() => {
    void cargar();
    // El countdown de la UI baja solo; refrescamos del server cada 20 s por
    // si otra sesión de staff cerró/abrió algo.
    const id = window.setInterval(() => void cargar(), 20000);
    return () => window.clearInterval(id);
  }, [cargar]);

  const entrar = async (tenantId: string, motivo: string) => {
    const r = await iniciarImpersonacion(tenantId, motivo);
    await setSessionToken(r.token);
    toast.success(`Entrando a ${r.tenantNombre}…`);
    router.push("/");
    router.refresh();
  };

  const cerrar = async (id: string) => {
    try {
      await cerrarImpersonacion(id);
      await cargar();
      toast.success("Sesión cerrada.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo cerrar.");
    }
  };

  return (
    <div className="cpl-page">
      <Panel
        title="Sesiones activas"
        sub={sesiones.length ? `${sesiones.length}` : "ninguna"}
        right={
          esAdmin ? (
            <ActionButton
              type="button"
              variant="primary"
              onPress={() => setModal(true)}
            >
              <BIco.eye style={{ width: 15 }} />
              Nueva sesión
            </ActionButton>
          ) : null
        }
      >
        {sesiones.length === 0 ? (
          <div className="cpl-empty" style={{ padding: "28px 10px" }}>
            <BIco.eye />
            <div className="t">Nadie dentro de un tenant</div>
            <div className="s">
              Entrar a un tenant queda registrado, con motivo y vencimiento de
              60 minutos.
            </div>
          </div>
        ) : (
          sesiones.map((sesion) => (
            <SesionActivaCard
              key={sesion.id}
              sesion={sesion}
              onCerrar={cerrar}
            />
          ))
        )}
      </Panel>

      <div style={{ height: 14 }} />

      <Panel
        title="Auditoría del control plane"
        sub={`${datos.auditoria.length} eventos`}
        flush
      >
        {datos.auditoria.length === 0 ? (
          <div className="cpl-empty">
            <BIco.clock />
            <div className="t">Sin eventos todavía</div>
            <div className="s">
              Todo lo que el staff haga en el control plane queda acá.
            </div>
          </div>
        ) : (
          <div className="cpl-audit">
            {datos.auditoria.map((e) => (
              <div className="cpl-arow" key={e.id}>
                <span className="ats">{fechaHora(e.creadoEl)}</span>
                <span
                  className="aic"
                  style={{ background: "var(--acc-bg)", color: "var(--acc-2)" }}
                >
                  <BIco.users />
                </span>
                <div className="amain">
                  <div className="at">
                    <b>{e.staffNombre ?? e.staffEmail}</b> · {e.descripcion}
                    {e.tenantAfectadoId ? (
                      <span style={{ color: "var(--muted-text)" }}>
                        {" "}
                        —{" "}
                        {nombreDe.get(e.tenantAfectadoId) ??
                          "tenant dado de baja"}
                      </span>
                    ) : null}
                  </div>
                </div>
                <span className="atag">{e.tipo.replace(/_/g, " ")}</span>
              </div>
            ))}
          </div>
        )}
      </Panel>

      {modal ? (
        <ImpersonarModal
          tenants={datos.tenants.filter((t) => t.activo)}
          onCerrar={() => setModal(false)}
          onEntrar={entrar}
        />
      ) : null}
    </div>
  );
}

function SesionActivaCard({
  sesion,
  onCerrar,
}: {
  sesion: SesionImpersonacion;
  onCerrar: (id: string) => void;
}) {
  const [seg, setSeg] = React.useState(sesion.expiraEnSeg);
  React.useEffect(() => {
    const id = window.setInterval(
      () => setSeg((s) => Math.max(0, s - 1)),
      1000,
    );
    return () => window.clearInterval(id);
  }, []);
  const mm = String(Math.floor(seg / 60)).padStart(2, "0");
  const ss = String(seg % 60).padStart(2, "0");
  return (
    <div className="cpl-sess">
      <span className="live" />
      <div className="sm">
        <div className="t">
          {sesion.staffNombre ?? "Staff"} → {sesion.tenantNombre}
        </div>
        <div className="s">{sesion.motivo}</div>
      </div>
      <div className="exp">
        <div className="big">
          {mm}:{ss}
        </div>
        <div className="lbl">expira</div>
      </div>
      <ActionButton
        type="button"
        variant="outline"
        onPress={() => onCerrar(sesion.id)}
      >
        Cerrar
      </ActionButton>
    </div>
  );
}

function ImpersonarModal({
  tenants,
  onCerrar,
  onEntrar,
}: {
  tenants: TenantConsola[];
  onCerrar: () => void;
  onEntrar: (tenantId: string, motivo: string) => Promise<void>;
}) {
  const [tenantId, setTenantId] = React.useState("");
  const [motivo, setMotivo] = React.useState("");
  const [ocupado, setOcupado] = React.useState(false);
  const valido = tenantId !== "" && motivo.trim().length >= 5;

  const entrar = async () => {
    if (!valido || ocupado) return;
    setOcupado(true);
    try {
      await onEntrar(tenantId, motivo.trim());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo entrar.");
      setOcupado(false);
    }
  };

  return (
    <FormDialog
      isOpen
      onOpenChange={(open) => {
        if (!open) onCerrar();
      }}
      title="Entrar como soporte"
      description="Acceso auditado y visible para el cliente. La sesión vence en 60 minutos."
      isDismissable={!ocupado}
      className={`${platformTheme} ${styles.dialog}`}
    >
      <div className="cpl-mb">
        <div className="cpl-field">
          <label htmlFor="soporte-tenant">Empresa</label>
          <SelectField
            id="soporte-tenant"
            aria-label="Empresa para sesión de soporte"
            value={tenantId}
            onChange={setTenantId}
            options={[
              { value: "", label: "Elegí una empresa…", disabled: true },
              ...tenants.map((t) => ({ value: t.id, label: t.nombre })),
            ]}
          />
        </div>
        <div className="cpl-field">
          <label htmlFor="soporte-motivo">
            Motivo (obligatorio, queda en la auditoría)
          </label>
          <Textarea
            fullWidth
            className={fieldFocus.singleBorder}
            id="soporte-motivo"
            rows={3}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ticket 412: el cliente reporta que no le sale el PDF de la factura."
            autoFocus
          />
        </div>
        <div className="cpl-callout" style={{ marginTop: 4 }}>
          <BIco.alert />
          <div>
            Impersonando NO podés tocar integraciones, administrar usuarios ni
            borrar archivos: soporte diagnostica, no toma la cuenta.
          </div>
        </div>
      </div>
      <div className="cpl-mf">
        <ActionButton
          type="button"
          variant="outline"
          isDisabled={ocupado}
          onPress={onCerrar}
        >
          Cancelar
        </ActionButton>
        <ActionButton
          type="button"
          variant="primary"
          isDisabled={!valido || ocupado}
          onPress={() => void entrar()}
        >
          {ocupado ? "Entrando…" : "Entrar a la empresa"}
        </ActionButton>
      </div>
    </FormDialog>
  );
}

/** 403: usuario sin rol de plataforma que adivinó la URL. */
export function PlataformaSinAcceso() {
  return (
    <div
      className={`${platformTheme} ${styles.denied}`}
      data-appearance="light"
    >
      <div className="cpl-noacceso">
        <GrafoprintBrand />
        <h1>Esta sección es del equipo de Grafo</h1>
        <p>
          Tu usuario no tiene rol de plataforma. Si creés que deberías tenerlo,
          hablá con quien administra Grafo.
        </p>
        <Link className="cpl-volver-link" href="/">
          ← Volver a la app
        </Link>
      </div>
    </div>
  );
}
