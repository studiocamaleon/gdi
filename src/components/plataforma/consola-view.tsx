"use client";

import * as React from "react";
import Link from "next/link";

import { useRouter } from "next/navigation";
import { toast } from "sonner";

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
  PlanBadge,
  TLogo,
  fechaCorta,
  fmtBytes,
  fmtN,
  haceCuanto,
  riesgoDe,
} from "@/components/plataforma/kit";
import {
  cambiarPlanTenant,
  cerrarImpersonacion,
  crearTenantPlataforma,
  generarBillingPlataforma,
  getBillingPlataforma,
  getNegocioPlataforma,
  getPlanesPlataforma,
  describirPlan,
  vincularPlanPaddle,
  getSesionesImpersonacion,
  iniciarImpersonacion,
  reactivarTenant,
  suspenderTenant,
  type BillingPlataforma,
  type ConsolaPlataforma,
  type NegocioPlataforma,
  type PeriodoNegocio,
  type PlanCatalogo,
  type SesionImpersonacion,
  type TenantConsola,
} from "@/lib/plataforma-api";

/**
 * La consola del control plane, con el shell de "Grafo Control Plane"
 * (claude.ai/design): rail oscuro + cuatro secciones. Regla de esta vista:
 * cada número que muestra es VERDAD — donde el diseño pide billing (MRR,
 * planes, cupos) o impersonation, la sección lo dice y apunta a su etapa,
 * no muestra datos inventados. Ver docs/control-plane-diseno.md
 */

type Vista =
  | "observabilidad"
  | "negocio"
  | "tenants"
  | "planes"
  | "billing"
  | "impersonacion";

const NAV: Array<{
  grupo: string;
  items: Array<{ k: Vista; label: string; ic: keyof typeof BIco }>;
}> = [
  {
    grupo: "Plataforma",
    items: [
      { k: "observabilidad", label: "Observabilidad", ic: "gauge" },
      { k: "negocio", label: "Negocio", ic: "chart" },
      { k: "tenants", label: "Tenants", ic: "building" },
      { k: "planes", label: "Planes", ic: "check" },
      { k: "billing", label: "Facturación", ic: "card" },
    ],
  },
  {
    grupo: "Operaciones",
    items: [{ k: "impersonacion", label: "Impersonación", ic: "mask" }],
  },
];

const TITULOS: Record<Vista, { crumb: string; title: string }> = {
  observabilidad: { crumb: "Plataforma", title: "Observabilidad" },
  negocio: { crumb: "Plataforma", title: "Negocio del ecosistema" },
  tenants: { crumb: "Plataforma", title: "Tenants" },
  planes: { crumb: "Plataforma", title: "Planes y precios" },
  billing: { crumb: "Plataforma", title: "Facturación de suscripciones" },
  impersonacion: { crumb: "Operaciones", title: "Impersonación y auditoría" },
};

export function ConsolaPlataformaView({
  datos: datosIniciales,
  ambiente,
}: {
  datos: ConsolaPlataforma;
  ambiente: "produccion" | "desarrollo";
}) {
  // Estado local: las acciones del control plane (cambiar plan, suspender…)
  // devuelven la consola actualizada y se refresca sin recargar.
  const [datos, setDatos] = React.useState(datosIniciales);
  const [vista, setVista] = React.useState<Vista>("observabilidad");
  const [tenantAbierto, setTenantAbierto] = React.useState<string | null>(null);
  const [cerrando, setCerrando] = React.useState(false);
  const router = useRouter();
  const esAdmin = datos.staff?.rol === "ADMIN";
  // El staff del backoffice no tiene tenant: no puede "volver a la app", sólo
  // cerrar sesión (que lo deja en su propio login). El que llegó desde su
  // dashboard sí conserva "Volver a la app".
  const esSesionPlataforma = datos.staff?.esSesionPlataforma === true;

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
  const abierto = tenantAbierto
    ? (datos.tenants.find((t) => t.id === tenantAbierto) ?? null)
    : null;
  const iniciales = (datos.staff?.nombre ?? datos.staff?.email ?? "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  return (
    <div className="cpl-bo">
      <aside className="cpl-rail">
        <div className="cpl-rail-top">
          <div className="cpl-rail-brand">
            <span className="cpl-rail-mark">
              <BIco.node />
            </span>
            <div>
              <div className="cpl-rail-name">Grafo</div>
              <div className="cpl-rail-sub">Control Plane</div>
            </div>
          </div>
          <div className="cpl-env">
            <span className={`d ${ambiente === "produccion" ? "" : "dev"}`} />
            {ambiente === "produccion" ? "Producción" : "Desarrollo"}
            <span className="who">grupo idea</span>
          </div>
        </div>
        <nav className="cpl-rail-nav">
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
                    onClick={() => {
                      setVista(it.k);
                      setTenantAbierto(null);
                    }}
                  >
                    <Ni />
                    <span>{it.label}</span>
                    {it.k === "tenants" ? (
                      <span className="cnt">{datos.tenants.length}</span>
                    ) : null}

                  </button>
                );
              })}
            </React.Fragment>
          ))}
          {esSesionPlataforma ? null : (
            <Link className="cpl-nav-i cpl-nav-volver" href="/">
              <BIco.arrowLeft />
              <span>Volver a la app</span>
            </Link>
          )}
          <button
            type="button"
            className="cpl-nav-i cpl-nav-salir"
            onClick={cerrarSesion}
            disabled={cerrando}
          >
            <BIco.logout />
            <span>{cerrando ? "Cerrando sesión…" : "Cerrar sesión"}</span>
          </button>
        </nav>
        <div className="cpl-rail-user">
          <span className="av">{iniciales}</span>
          <div>
            <div className="nm">{datos.staff?.nombre ?? datos.staff?.email}</div>
            <div className="rl">
              Staff · {datos.staff?.rol === "ADMIN" ? "Admin" : "Soporte"} de
              plataforma
            </div>
          </div>
        </div>
      </aside>

      <main className="cpl-work">
        <div className="cpl-topbar">
          <div>
            <div className="crumb">{meta.crumb}</div>
            <h1>{meta.title}</h1>
          </div>
          <span className="grow" />
        </div>

        {vista === "observabilidad" ? (
          <Observabilidad
            datos={datos}
            onVerTenant={(id) => {
              setVista("tenants");
              setTenantAbierto(id);
            }}
          />
        ) : null}
        {vista === "negocio" ? <Negocio /> : null}
        {vista === "tenants" ? (
          <Tenants
            tenants={datos.tenants}
            abierto={abierto}
            esAdmin={esAdmin}
            onAbrir={setTenantAbierto}
            onCerrar={() => setTenantAbierto(null)}
            onConsola={setDatos}
          />
        ) : null}
        {vista === "planes" ? <Planes esAdmin={esAdmin} /> : null}
        {vista === "billing" ? <Billing esAdmin={esAdmin} /> : null}
        {vista === "impersonacion" ? (
          <Impersonacion datos={datos} esAdmin={esAdmin} />
        ) : null}
      </main>
    </div>
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
  const fmtX = (iso: string) =>
    periodo === "12m"
      ? new Date(iso).toLocaleDateString("es-AR", { month: "short" })
      : new Date(iso).toLocaleDateString("es-AR", {
          day: "2-digit",
          month: "2-digit",
        });
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
  const maxTenant = Math.max(1, ...(data?.porTenant ?? []).map((t) => t.ventas));
  const mediana = data?.medianaTicket ?? 0;
  // El benchmark ticket-vs-mediana sólo tiene sentido con varias imprentas.
  const mostrarBenchmark = (data?.porTenant.length ?? 0) >= 2 && mediana > 0;
  const distTamano = (data?.distribucionTamano ?? []).map((b) => ({
    x: b.rango,
    v: b.tenants,
  }));

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

      {error ? <div className="cpl-empty">{error}</div> : null}
      {!error && !data && cargando ? (
        <div className="cpl-empty">Cargando…</div>
      ) : null}

      {data && k ? (
        <div style={{ opacity: cargando ? 0.55 : 1, transition: "opacity .15s" }}>
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
                    <b className="cpl-mono">{data.embudo.tasaAprobacion ?? "—"}%</b>
                    <span>tasa de aprobación</span>
                  </div>
                  <div className="fk">
                    <b className="cpl-mono">{data.embudo.tasaEntrega ?? "—"}%</b>
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
  const labelMes = (ym: string) =>
    new Date(`${ym}-01T00:00:00`)
      .toLocaleDateString("es-AR", { month: "short" })
      .replace(".", "");

  const serieChart = actividadSemanal.map((sem) => ({
    x: labelSemana(sem.semana),
    ots: sem.ots,
    cotizaciones: sem.cotizaciones,
  }));
  const sparkOts = actividadSemanal.map((sem) => sem.ots);
  const sparkCotiz = actividadSemanal.map((sem) => sem.cotizaciones);
  const sparkCobros = actividadSemanal.map((sem) => sem.cobros);
  // Tenants acumulados: el spark del KPI, desde las altas mensuales reales.
  const base = resumen.tenants - altasMensuales.reduce((s, m) => s + m.altas, 0);
  const sparkTenants = altasMensuales.reduce<number[]>(
    (arr, m) => [...arr, (arr[arr.length - 1] ?? base) + m.altas],
    [],
  );

  // Distribución por plan — real desde la etapa B1. "Sin plan" = legacy.
  const donutPlanes = (() => {
    const porPlan = new Map<string, { label: string; value: number; color: string }>();
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
          label="MRR"
          value={mk(resumen.mrr)}
          sub={
            resumen.sinPlan > 0
              ? `${resumen.sinPlan} tenant${resumen.sinPlan === 1 ? "" : "s"} sin plan`
              : "mensual recurrente"
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
          label="Usuarios activos"
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

        <Panel title="Movimientos de MRR" sub="requiere etapa B">
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
              Se enciende con <b>planes y suscripciones</b> (etapa B): MRR real,
              no estimado.
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
                          <div className="sub">{t.usuariosActivos} usuarios</div>
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
                    <td className="r cpl-mono" style={{ color: "var(--muted)" }}>
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
        deltas comparan contra los 30 días anteriores. MRR, planes y salud de
        infraestructura (uptime, latencia) llegan con la etapa B y con APM.
      </div>
    </div>
  );
}

// ── Tenants ────────────────────────────────────────────────────────────

type Filtro = "todos" | "activos" | "riesgo" | "suspendidos";

const FILTROS: Array<{ k: Filtro; label: string }> = [
  { k: "todos", label: "Todos" },
  { k: "activos", label: "Activos" },
  { k: "riesgo", label: "En riesgo" },
  { k: "suspendidos", label: "Suspendidos" },
];

function Tenants({
  tenants,
  abierto,
  esAdmin,
  onAbrir,
  onCerrar,
  onConsola,
}: {
  tenants: TenantConsola[];
  abierto: TenantConsola | null;
  esAdmin: boolean;
  onAbrir: (id: string) => void;
  onCerrar: () => void;
  onConsola: (c: ConsolaPlataforma) => void;
}) {
  const [q, setQ] = React.useState("");
  const [filtro, setFiltro] = React.useState<Filtro>("todos");
  const [creando, setCreando] = React.useState(false);
  // El catálogo se pide una vez, cuando un ADMIN lo va a necesitar.
  const [planes, setPlanes] = React.useState<PlanCatalogo[] | null>(null);
  React.useEffect(() => {
    if (!esAdmin) return;
    let vivo = true;
    getPlanesPlataforma()
      .then((p) => vivo && setPlanes(p))
      .catch(() => vivo && setPlanes([]));
    return () => {
      vivo = false;
    };
  }, [esAdmin]);

  const filas = tenants.filter((t) => {
    if (filtro === "activos" && (!t.activo || riesgoDe(t))) return false;
    if (filtro === "riesgo" && (!t.activo || !riesgoDe(t))) return false;
    if (filtro === "suspendidos" && t.activo) return false;
    const s = q.trim().toLowerCase();
    return (
      !s || t.nombre.toLowerCase().includes(s) || t.slug.toLowerCase().includes(s)
    );
  });

  return (
    <div className="cpl-page">
      <div className="cpl-toolbar">
        <div className="cpl-search">
          <BIco.search />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nombre o slug…"
          />
        </div>
        <div className="cpl-seg">
          {FILTROS.map((f) => (
            <button
              key={f.k}
              type="button"
              className={filtro === f.k ? "on" : ""}
              onClick={() => setFiltro(f.k)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <span style={{ flex: 1 }} />
        {esAdmin ? (
          <button
            type="button"
            className="cpl-btn pri"
            onClick={() => setCreando(true)}
          >
            <BIco.building style={{ width: 15 }} />
            Nuevo tenant
          </button>
        ) : null}
      </div>

      <Panel flush>
        {filas.length === 0 ? (
          <div className="cpl-empty">
            <BIco.search />
            <div className="t">Sin resultados</div>
            <div className="s">Ajustá la búsqueda o el filtro.</div>
          </div>
        ) : (
          <table className="cpl-tbl">
            <thead>
              <tr>
                <th>Tenant</th>
                <th>Plan</th>
                <th>Estado</th>
                <th className="r">MRR</th>
                <th className="r">Usuarios</th>
                <th className="r">OTs 30d</th>
                <th className="r">Storage</th>
                <th>Integraciones</th>
                <th className="r">Últ. actividad</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((t) => (
                <tr key={t.id} onClick={() => onAbrir(t.id)}>
                  <td>
                    <div className="cpl-tname">
                      <TLogo nombre={t.nombre} slug={t.slug} />
                      <div>
                        <div className="n">{t.nombre}</div>
                        <div className="sub">{t.slug}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    {t.plan ? (
                      <PlanBadge codigo={t.plan.codigo} nombre={t.plan.nombre} />
                    ) : (
                      <span style={{ color: "var(--muted-2)", fontSize: 11.5 }}>
                        sin plan
                      </span>
                    )}
                  </td>
                  <td>
                    <EstadoPill t={t} />
                  </td>
                  <td className="r cpl-mono">
                    {t.plan && t.plan.estado === "activa" && t.plan.precioMensual > 0
                      ? mk(t.plan.precioMensual)
                      : "—"}
                  </td>
                  <td className="r cpl-mono">
                    {t.usuariosActivos}
                    {t.plan?.usuariosMax ? (
                      <span style={{ color: "var(--muted-2)" }}>
                        {" "}
                        / {t.plan.usuariosMax}
                      </span>
                    ) : null}
                  </td>
                  <td className="r cpl-mono">{t.ots30d}</td>
                  <td className="r cpl-mono">{fmtBytes(t.storageBytes)}</td>
                  <td>
                    <span className="cpl-ints">
                      {t.integraciones.length === 0 ? (
                        <span style={{ color: "var(--muted-2)" }}>—</span>
                      ) : (
                        t.integraciones.map((i) => (
                          <span
                            key={i.proveedor}
                            className={`cpl-int ${i.estado.toLowerCase()}`}
                            title={i.ultimoErrorTexto ?? i.estado}
                          >
                            {i.proveedor === "MERCADOPAGO" ? "MP" : i.proveedor}
                          </span>
                        ))
                      )}
                    </span>
                  </td>
                  <td
                    className="r"
                    style={{
                      color:
                        t.sinActividad14d && t.activo
                          ? "var(--warn)"
                          : "var(--muted)",
                      fontSize: 11.5,
                    }}
                  >
                    {haceCuanto(t.ultimoAccesoEl)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      <div className="cpl-note">
        {filas.length} de {tenants.length} tenants. Las acciones de ciclo de
        vida (plan, suspensión, alta) son de ADMIN y quedan en la auditoría.
      </div>

      {abierto ? (
        <TenantDrawer
          t={abierto}
          esAdmin={esAdmin}
          planes={planes ?? []}
          onCerrar={onCerrar}
          onConsola={onConsola}
        />
      ) : null}
      {creando ? (
        <CrearTenantModal
          planes={planes ?? []}
          onCerrar={() => setCreando(false)}
        />
      ) : null}
    </div>
  );
}

function TenantDrawer({
  t,
  esAdmin,
  planes,
  onCerrar,
  onConsola,
}: {
  t: TenantConsola;
  esAdmin: boolean;
  planes: PlanCatalogo[];
  onCerrar: () => void;
  onConsola: (c: ConsolaPlataforma) => void;
}) {
  const riesgo = riesgoDe(t);
  const [suspendiendo, setSuspendiendo] = React.useState(false);
  const [ocupado, setOcupado] = React.useState(false);

  const cambiar = async (planId: string) => {
    if (!planId || ocupado) return;
    setOcupado(true);
    try {
      onConsola(await cambiarPlanTenant(t.id, planId));
      toast.success("Plan actualizado.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo cambiar el plan.");
    } finally {
      setOcupado(false);
    }
  };

  const reactivar = async () => {
    if (ocupado) return;
    setOcupado(true);
    try {
      onConsola(await reactivarTenant(t.id));
      toast.success("Tenant reactivado.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo reactivar.");
    } finally {
      setOcupado(false);
    }
  };

  const gb = (n: number) => n / 1024 ** 3;
  const limites: Array<{
    k: string;
    usado: number;
    tope: number | null;
    texto: string;
  }> = t.plan
    ? [
        {
          k: "Usuarios",
          usado: t.usuariosActivos,
          tope: t.plan.usuariosMax,
          texto: `${t.usuariosActivos} / ${t.plan.usuariosMax ?? "∞"}`,
        },
        {
          k: "Órdenes / mes",
          usado: t.ots30d,
          tope: t.plan.ordenesMesMax,
          texto: `${t.ots30d} / ${t.plan.ordenesMesMax ?? "∞"}`,
        },
        {
          k: "Almacenamiento",
          usado: gb(t.storageBytes),
          tope: t.plan.storageGb,
          texto: `${fmtBytes(t.storageBytes)} / ${t.plan.storageGb ?? "∞"} GB`,
        },
      ]
    : [];

  return (
    <>
      <div className="cpl-scrim" onClick={onCerrar} />
      <aside className="cpl-drawer">
        <div className="cpl-dh">
          <TLogo nombre={t.nombre} slug={t.slug} size={46} />
          <div>
            <div className="dh-title">{t.nombre}</div>
            <div className="dh-sub">{t.slug}</div>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              {t.plan ? (
                <PlanBadge codigo={t.plan.codigo} nombre={t.plan.nombre} />
              ) : null}
              <EstadoPill t={t} />
            </div>
          </div>
          <button type="button" className="x" onClick={onCerrar}>
            <BIco.x />
          </button>
        </div>

        <div className="cpl-db">
          {riesgo ? (
            <div className="cpl-callout" style={{ marginBottom: 6 }}>
              <BIco.alert />
              <div>
                <b>Atención.</b> {riesgo}
              </div>
            </div>
          ) : null}

          <div className="cpl-dsec">
            <div className="dsec-t">Cuenta</div>
            <div className="cpl-kv2">
              <div className="c">
                <div className="k">Alta</div>
                <div className="v cpl-mono">{fechaCorta(t.creadoEl)}</div>
              </div>
              <div className="c">
                <div className="k">Última actividad</div>
                <div className="v">{haceCuanto(t.ultimoAccesoEl)}</div>
              </div>
              <div className="c">
                <div className="k">Actividad 30d</div>
                <div className="v cpl-mono">
                  {t.ots30d} OTs · {t.cotizaciones30d} cotiz. · {t.cobros30d}{" "}
                  cobros
                </div>
              </div>
              <div className="c">
                <div className="k">WhatsApp</div>
                <div className="v cpl-mono">
                  {t.whatsappFallidas > 0
                    ? `${t.whatsappFallidas} fallidas`
                    : t.whatsappPendientes > 0
                      ? `${t.whatsappPendientes} pend.`
                      : "ok"}
                </div>
              </div>
            </div>
          </div>

          <div className="cpl-dsec">
            <div className="dsec-t">Plan y límites</div>
            {t.plan ? (
              <div className="cpl-limits">
                {limites.map((l) => {
                  const pct = l.tope
                    ? Math.min(100, (l.usado / l.tope) * 100)
                    : 0;
                  const tono = pct >= 90 ? "dng" : pct >= 75 ? "warn" : "";
                  return (
                    <div className="cpl-limit" key={l.k}>
                      <div className="lt">
                        <span className="lk">{l.k}</span>
                        <span className="lv">{l.texto}</span>
                      </div>
                      <div className={`cpl-meter ${tono}`}>
                        <span style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="cpl-callout info">
                <BIco.card />
                <div>
                  <b>Sin plan asignado (legacy).</b> Se lo trata como ilimitado
                  hasta que se le asigne uno — los gates recién muerden con el
                  plan puesto.
                </div>
              </div>
            )}
          </div>

          <div className="cpl-dsec">
            <div className="dsec-t">Suscripción · facturación de Grupo Idea</div>
            <div className="cpl-kv2">
              <div className="c">
                <div className="k">MRR</div>
                <div className="v cpl-mono">
                  {t.plan && t.plan.estado === "activa"
                    ? mk(t.plan.precioMensual)
                    : "—"}
                </div>
              </div>
              <div className="c">
                <div className="k">Facturas</div>
                <div className="v" style={{ fontSize: 13 }}>
                  llegan con la etapa B2
                </div>
              </div>
            </div>
          </div>

          <div className="cpl-dsec">
            <div className="dsec-t">Integraciones</div>
            {t.integraciones.length === 0 ? (
              <div style={{ fontSize: 12, color: "var(--muted-2)" }}>
                Sin integraciones conectadas.
              </div>
            ) : (
              <div className="cpl-kv2">
                {t.integraciones.map((i) => (
                  <div className="c" key={i.proveedor}>
                    <div className="k">{i.proveedor}</div>
                    <div
                      className="v"
                      style={{
                        color:
                          i.estado === "CONECTADA"
                            ? "var(--ok)"
                            : i.estado === "ERROR"
                              ? "var(--dng)"
                              : "var(--muted)",
                        fontSize: 13,
                      }}
                    >
                      {i.estado === "CONECTADA"
                        ? "Conectada"
                        : i.estado === "ERROR"
                          ? (i.ultimoErrorTexto ?? "En error")
                          : "Desconectada"}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {esAdmin ? (
          <div className="cpl-dactions">
            <select
              className="cpl-select"
              value=""
              disabled={ocupado}
              onChange={(e) => void cambiar(e.target.value)}
            >
              <option value="" disabled>
                {t.plan ? `Cambiar plan (${t.plan.nombre})…` : "Asignar plan…"}
              </option>
              {planes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre} · {mk(p.precioMensual)}/mes
                </option>
              ))}
            </select>
            <span style={{ flex: 1 }} />
            {t.activo ? (
              <button
                type="button"
                className="cpl-btn dng"
                disabled={ocupado}
                onClick={() => setSuspendiendo(true)}
              >
                Suspender
              </button>
            ) : (
              <button
                type="button"
                className="cpl-btn"
                disabled={ocupado}
                onClick={() => void reactivar()}
              >
                Reactivar
              </button>
            )}
          </div>
        ) : null}
      </aside>

      {suspendiendo ? (
        <SuspenderModal
          t={t}
          onCerrar={() => setSuspendiendo(false)}
          onConsola={(c) => {
            onConsola(c);
            setSuspendiendo(false);
            onCerrar();
          }}
        />
      ) : null}
    </>
  );
}

/** Suspender pide MOTIVO: va a la auditoría y el cliente puede preguntarlo. */
function SuspenderModal({
  t,
  onCerrar,
  onConsola,
}: {
  t: TenantConsola;
  onCerrar: () => void;
  onConsola: (c: ConsolaPlataforma) => void;
}) {
  const [motivo, setMotivo] = React.useState("");
  const [ocupado, setOcupado] = React.useState(false);

  const confirmar = async () => {
    if (motivo.trim().length < 3 || ocupado) return;
    setOcupado(true);
    try {
      onConsola(await suspenderTenant(t.id, motivo.trim()));
      toast.success(`${t.nombre} suspendido.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo suspender.");
      setOcupado(false);
    }
  };

  return (
    <>
      <div className="cpl-scrim" style={{ zIndex: 90 }} onClick={onCerrar} />
      <div className="cpl-modal">
        <div className="cpl-mh">
          <div className="mt">Suspender {t.nombre}</div>
          <div className="ms">
            Corta el acceso de todos sus usuarios en el acto y pausa la
            suscripción. No borra nada: reactivar lo deja como estaba.
          </div>
        </div>
        <div className="cpl-mb">
          <div className="cpl-field">
            <label>Motivo (queda en la auditoría)</label>
            <textarea
              rows={3}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Falta de pago desde…"
              autoFocus
            />
          </div>
        </div>
        <div className="cpl-mf">
          <button type="button" className="cpl-btn" onClick={onCerrar}>
            Cancelar
          </button>
          <button
            type="button"
            className="cpl-btn dng"
            disabled={motivo.trim().length < 3 || ocupado}
            onClick={() => void confirmar()}
          >
            {ocupado ? "Suspendiendo…" : "Suspender tenant"}
          </button>
        </div>
      </div>
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
      toast.success("Tenant creado. Mandale el link de invitación.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo crear.");
      setOcupado(false);
    }
  };

  return (
    <>
      <div className="cpl-scrim" style={{ zIndex: 90 }} onClick={onCerrar} />
      <div className="cpl-modal">
        <div className="cpl-mh">
          <div className="mt">Nuevo tenant</div>
          <div className="ms">
            Crea la empresa con su plan e invita al primer administrador. El
            link de invitación se lo mandás vos — vence en 7 días.
          </div>
        </div>
        {invitacionUrl ? (
          <div className="cpl-mb">
            <div className="cpl-field">
              <label>Link de invitación</label>
              <div className="cpl-invlink">{invitacionUrl}</div>
            </div>
            <button
              type="button"
              className="cpl-btn pri"
              onClick={() => {
                void navigator.clipboard?.writeText(invitacionUrl);
                toast.success("Link copiado.");
              }}
            >
              Copiar link
            </button>
          </div>
        ) : (
          <div className="cpl-mb">
            <div className="cpl-field">
              <label>Nombre de la imprenta</label>
              <input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Gráfica del Sur SRL"
                autoFocus
              />
            </div>
            <div className="cpl-field">
              <label>Slug (identificador corto)</label>
              <input
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase())}
                placeholder="grafica-del-sur"
              />
            </div>
            <div className="cpl-field">
              <label>Email del administrador</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="duenio@imprenta.com"
              />
            </div>
            <div className="cpl-field">
              <label>Plan</label>
              <select value={planId} onChange={(e) => setPlanId(e.target.value)}>
                <option value="" disabled>
                  Elegí un plan…
                </option>
                {planes.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre} · {mk(p.precioMensual)}/mes
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
        <div className="cpl-mf">
          <button type="button" className="cpl-btn" onClick={onCerrar}>
            {invitacionUrl ? "Cerrar" : "Cancelar"}
          </button>
          {!invitacionUrl ? (
            <button
              type="button"
              className="cpl-btn pri"
              disabled={!valido || ocupado}
              onClick={() => void crear()}
            >
              {ocupado ? "Creando…" : "Crear tenant"}
            </button>
          ) : null}
        </div>
      </div>
    </>
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

  if (error) return <div className="cpl-page"><div className="cpl-empty">{error}</div></div>;
  if (!planes) return <div className="cpl-page"><div className="cpl-empty">Cargando…</div></div>;

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
  const [productId, setProductId] = React.useState(plan.paddleProductId ?? "");
  const [guardando, setGuardando] = React.useState(false);

  const guardar = async () => {
    if (guardando) return;
    setGuardando(true);
    try {
      const lista = await vincularPlanPaddle(
        plan.id,
        priceId.trim() || null,
        productId.trim() || null,
      );
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
              <input
                value={priceId}
                onChange={(e) => setPriceId(e.target.value)}
                placeholder="pri_01j…"
                autoFocus
                disabled={guardando}
              />
            </label>
            <label>
              <span>Product ID (opcional)</span>
              <input
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                placeholder="pro_01j…"
                disabled={guardando}
              />
            </label>
            <button
              type="button"
              className="cpl-btn pri"
              onClick={guardar}
              disabled={guardando}
            >
              {guardando ? "Guardando…" : "Guardar"}
            </button>
            <button
              type="button"
              className="cpl-btn"
              onClick={onCerrar}
              disabled={guardando}
            >
              Cancelar
            </button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td>
        <b>{plan.nombre}</b>
        <div className="cpl-sub">{plan.codigo}</div>
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
          <span className="cpl-invlink" style={{ display: "inline-flex" }}>
            {plan.paddlePriceId}
          </span>
        ) : (
          <span className="cpl-sinvinculo">sin vincular</span>
        )}
      </td>
      <td style={{ textAlign: "right" }}>
        {esAdmin ? (
          <button type="button" className="cpl-btn" onClick={onEditar}>
            {plan.paddlePriceId ? "Cambiar" : "Vincular"}
          </button>
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
      <textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Para imprentas que arrancan a ordenar su producción."
        maxLength={220}
        rows={2}
        autoFocus
        disabled={guardando}
      />
      <div className="acc">
        <button type="button" className="cpl-btn pri" onClick={guardar} disabled={guardando}>
          {guardando ? "…" : "Guardar"}
        </button>
        <button
          type="button"
          className="cpl-btn"
          onClick={() => {
            setTexto(plan.descripcion ?? "");
            setEditando(false);
          }}
          disabled={guardando}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

// ── Facturación de suscripciones (B2) ─────────────────────────────────

function Billing({ esAdmin }: { esAdmin: boolean }) {
  const [datos, setDatos] = React.useState<BillingPlataforma | null>(null);
  const [pvId, setPvId] = React.useState("");
  const [generando, setGenerando] = React.useState(false);

  const cargar = React.useCallback(async () => {
    try {
      const d = await getBillingPlataforma();
      setDatos(d);
      setPvId((prev) => prev || (d.puntosVenta[0]?.id ?? ""));
    } catch {
      setDatos(null);
    }
  }, []);
  React.useEffect(() => {
    void cargar();
  }, [cargar]);

  const generar = async () => {
    if (!pvId || generando) return;
    setGenerando(true);
    try {
      const r = await generarBillingPlataforma({ puntoVentaId: pvId });
      toast.success(
        `Billing ${r.periodo}: ${r.generadas} borrador(es) nuevo(s), ${r.yaExistian} ya existían.`,
      );
      if (r.salteadas.length > 0) {
        toast.error(
          `Salteadas: ${r.salteadas.map((x) => x.tenantNombre).join(", ")}.`,
        );
      }
      await cargar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo generar.");
    } finally {
      setGenerando(false);
    }
  };

  if (!datos) {
    return (
      <div className="cpl-page">
        <div className="cpl-empty">
          <div className="t">Cargando…</div>
        </div>
      </div>
    );
  }

  if (!datos.tenantPlataforma) {
    return (
      <div className="cpl-page">
        <Panel>
          <div className="cpl-callout" style={{ marginTop: 16 }}>
            <BIco.alert />
            <div>
              <b>Falta el tenant plataforma.</b> Las facturas de suscripción se
              emiten desde el tenant de Grupo Idea: marcá uno con
              Tenant.esPlataforma (una sola vez, por script).
            </div>
          </div>
        </Panel>
      </div>
    );
  }

  const totalPendiente = datos.pendientes.reduce((s, p) => s + p.monto, 0);

  return (
    <div className="cpl-page">
      <div className="cpl-grid cpl-g-2" style={{ marginTop: 0 }}>
        <Panel
          title={`Período ${datos.periodoActual}`}
          sub={`emite ${datos.tenantPlataforma.nombre}`}
        >
          {datos.pendientes.length === 0 ? (
            <div className="cpl-empty" style={{ padding: "20px 10px" }}>
              <BIco.check />
              <div className="t">Nada pendiente</div>
              <div className="s">
                Todas las suscripciones con precio ya tienen su factura del
                período.
              </div>
            </div>
          ) : (
            <>
              {datos.pendientes.map((p) => (
                <div className="cpl-mov" key={p.tenantId}>
                  <span
                    className="mi"
                    style={{ background: "var(--surface-3)", color: "var(--acc-2)" }}
                  >
                    <BIco.building />
                  </span>
                  <div className="ml">
                    <div className="t">{p.tenantNombre}</div>
                    <div className="s">plan {p.planNombre}</div>
                  </div>
                  <span className="mval">{mk(p.monto)}</span>
                </div>
              ))}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  paddingTop: 12,
                  borderTop: "1px solid var(--hair)",
                  fontSize: 12.5,
                }}
              >
                <span style={{ color: "var(--muted)" }}>Total del período</span>
                <span className="cpl-mono" style={{ fontWeight: 600 }}>
                  {mk(totalPendiente)}
                </span>
              </div>
            </>
          )}
          {esAdmin ? (
            <div style={{ display: "flex", gap: 9, marginTop: 14 }}>
              <select
                className="cpl-select"
                value={pvId}
                onChange={(e) => setPvId(e.target.value)}
              >
                {datos.puntosVenta.length === 0 ? (
                  <option value="">sin puntos de venta activos</option>
                ) : null}
                {datos.puntosVenta.map((pv) => (
                  <option key={pv.id} value={pv.id}>
                    PV {String(pv.numero).padStart(4, "0")}
                    {pv.nombre ? ` · ${pv.nombre}` : ""}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="cpl-btn pri"
                disabled={!pvId || generando || datos.pendientes.length === 0}
                onClick={() => void generar()}
              >
                {generando ? "Generando…" : "Generar borradores"}
              </button>
            </div>
          ) : null}
          <div className="cpl-note" style={{ marginTop: 14 }}>
            El generador crea BORRADORES (reentrante: no duplica). La emisión
            con CAE sigue el flujo normal en Administración → Comprobantes del
            tenant {datos.tenantPlataforma.nombre}, con un punto de venta
            dedicado al SaaS para que la numeración y el libro IVA queden
            separables de la imprenta.
          </div>
        </Panel>

        <Panel
          title="Facturas de suscripción"
          sub={`${datos.facturas.length} registradas`}
          flush
        >
          {datos.facturas.length === 0 ? (
            <div className="cpl-empty">
              <BIco.card />
              <div className="t">Todavía sin facturas</div>
              <div className="s">Generá el período para ver los borradores acá.</div>
            </div>
          ) : (
            <table className="cpl-tbl compacta">
              <thead>
                <tr>
                  <th>Período</th>
                  <th>Tenant</th>
                  <th className="r">Monto</th>
                  <th>Comprobante</th>
                </tr>
              </thead>
              <tbody>
                {datos.facturas.map((f) => (
                  <tr key={f.id}>
                    <td className="cpl-mono">{f.periodo}</td>
                    <td>{f.tenantClienteNombre}</td>
                    <td className="r cpl-mono">{mk(f.monto)}</td>
                    <td>
                      {f.comprobante.estado === "emitido" ? (
                        <span className="cpl-pill ok">
                          <span className="d" />
                          {f.comprobante.letra} {f.comprobante.numeroCompleto}
                        </span>
                      ) : f.comprobante.estado === "borrador" ? (
                        <span className="cpl-pill warn">
                          <span className="d" />
                          Borrador
                        </span>
                      ) : (
                        <span className="cpl-pill dng">
                          <span className="d" />
                          {f.comprobante.estado}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
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
            <button
              type="button"
              className="cpl-btn pri"
              onClick={() => setModal(true)}
            >
              <BIco.eye style={{ width: 15 }} />
              Nueva sesión
            </button>
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
            <SesionActivaCard key={sesion.id} sesion={sesion} onCerrar={cerrar} />
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
                <span className="ats">
                  {new Date(e.creadoEl).toLocaleString("es-AR", {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
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
                      <span style={{ color: "var(--muted)" }}>
                        {" "}
                        — {nombreDe.get(e.tenantAfectadoId) ?? "tenant dado de baja"}
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
      <button
        type="button"
        className="cpl-btn"
        onClick={() => onCerrar(sesion.id)}
      >
        Cerrar
      </button>
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
    <>
      <div className="cpl-scrim" style={{ zIndex: 90 }} onClick={onCerrar} />
      <div className="cpl-modal">
        <div className="cpl-mh">
          <div className="mt">Entrar a un tenant</div>
          <div className="ms">
            Vas a operar como soporte dentro de la cuenta. Todo queda firmado
            “en nombre de” y el cliente ve que entraste. Expira en 60 minutos.
          </div>
        </div>
        <div className="cpl-mb">
          <div className="cpl-field">
            <label>Tenant</label>
            <select value={tenantId} onChange={(e) => setTenantId(e.target.value)}>
              <option value="" disabled>
                Elegí un tenant…
              </option>
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="cpl-field">
            <label>Motivo (obligatorio, queda en la auditoría)</label>
            <textarea
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
          <button type="button" className="cpl-btn" onClick={onCerrar}>
            Cancelar
          </button>
          <button
            type="button"
            className="cpl-btn pri"
            disabled={!valido || ocupado}
            onClick={() => void entrar()}
          >
            {ocupado ? "Entrando…" : "Entrar al tenant"}
          </button>
        </div>
      </div>
    </>
  );
}

/** 403: usuario sin rol de plataforma que adivinó la URL. */
export function PlataformaSinAcceso() {
  return (
    <div className="cpl-bo" style={{ display: "grid", placeItems: "center" }}>
      <div className="cpl-noacceso">
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
