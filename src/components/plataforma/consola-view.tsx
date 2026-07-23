"use client";

import * as React from "react";
import Link from "next/link";

import {
  BIco,
  EstadoPill,
  Kpi,
  Panel,
  TLogo,
  fechaCorta,
  fmtBytes,
  fmtN,
  haceCuanto,
  riesgoDe,
} from "@/components/plataforma/kit";
import type {
  ConsolaPlataforma,
  TenantConsola,
} from "@/lib/plataforma-api";

/**
 * La consola del control plane, con el shell de "Grafo Control Plane"
 * (claude.ai/design): rail oscuro + cuatro secciones. Regla de esta vista:
 * cada número que muestra es VERDAD — donde el diseño pide billing (MRR,
 * planes, cupos) o impersonation, la sección lo dice y apunta a su etapa,
 * no muestra datos inventados. Ver docs/control-plane-diseno.md
 */

type Vista = "observabilidad" | "tenants" | "billing" | "impersonacion";

const NAV: Array<{
  grupo: string;
  items: Array<{ k: Vista; label: string; ic: keyof typeof BIco }>;
}> = [
  {
    grupo: "Plataforma",
    items: [
      { k: "observabilidad", label: "Observabilidad", ic: "gauge" },
      { k: "tenants", label: "Tenants", ic: "building" },
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
  tenants: { crumb: "Plataforma", title: "Tenants" },
  billing: { crumb: "Plataforma", title: "Facturación de suscripciones" },
  impersonacion: { crumb: "Operaciones", title: "Impersonación y auditoría" },
};

export function ConsolaPlataformaView({
  datos,
  ambiente,
}: {
  datos: ConsolaPlataforma;
  ambiente: "produccion" | "desarrollo";
}) {
  const [vista, setVista] = React.useState<Vista>("observabilidad");
  const [tenantAbierto, setTenantAbierto] = React.useState<string | null>(null);

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
                    {it.k === "billing" || it.k === "impersonacion" ? (
                      <span className="soon">
                        {it.k === "billing" ? "etapa B" : "etapa C"}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </React.Fragment>
          ))}
          <Link className="cpl-nav-i cpl-nav-volver" href="/">
            <BIco.logout />
            <span>Volver a la app</span>
          </Link>
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
        {vista === "tenants" ? (
          <Tenants
            tenants={datos.tenants}
            abierto={abierto}
            onAbrir={setTenantAbierto}
            onCerrar={() => setTenantAbierto(null)}
          />
        ) : null}
        {vista === "billing" ? <BillingBloqueado /> : null}
        {vista === "impersonacion" ? <Impersonacion datos={datos} /> : null}
      </main>
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
  const { resumen, tenants } = datos;
  const cotiz30d = tenants.reduce((s, t) => s + t.cotizaciones30d, 0);
  const cobros30d = tenants.reduce((s, t) => s + t.cobros30d, 0);
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
    .filter((x) => x.riesgo !== null);

  return (
    <div className="cpl-page">
      <div className="cpl-kgrid">
        <Kpi
          label="Tenants activos"
          value={`${resumen.tenantsActivos}`}
          unit={`/ ${resumen.tenants}`}
        />
        <Kpi label="Usuarios activos" value={fmtN(resumen.usuariosActivos)} />
        <Kpi label="OTs emitidas · 30d" value={fmtN(resumen.ots30d)} />
        <Kpi label="Cotizaciones · 30d" value={fmtN(cotiz30d)} />
        <Kpi label="Cobros · 30d" value={fmtN(cobros30d)} />
        <Kpi label="Storage total" value={fmtBytes(resumen.storageBytes)} />
      </div>

      <div className="cpl-grid">
        <div className="cpl-health">
          <div className="cpl-htile">
            <div className="ht">
              <span
                className="hd"
                style={{ background: waFall > 0 ? "var(--dng)" : "var(--ok)" }}
              />
              Cola WhatsApp
            </div>
            <div className="hv cpl-mono">
              {waPend} <span style={{ color: "var(--muted-2)" }}>pend.</span>
            </div>
            <div className="hs">
              {waFall > 0 ? `${waFall} fallidas` : "0 fallidas"}
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
              conectadas · {intsError > 0 ? `${intsError} en error` : "0 en error"}
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
      </div>

      <div className="cpl-grid cpl-g-2">
        <Panel
          title="Tenants en riesgo"
          sub={enRiesgo.length ? `${enRiesgo.length}` : "ninguno"}
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
            <table className="cpl-tbl">
              <tbody>
                {enRiesgo.map(({ t, riesgo }) => (
                  <tr key={t.id} onClick={() => onVerTenant(t.id)}>
                    <td>
                      <div className="cpl-tname">
                        <TLogo nombre={t.nombre} slug={t.slug} />
                        <div>
                          <div className="n">{t.nombre}</div>
                          <div className="sub">{t.slug}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ color: "var(--warn)", fontSize: 12 }}>
                      {riesgo}
                    </td>
                    <td className="r" style={{ width: 30 }}>
                      <BIco.arrow style={{ width: 14, color: "var(--muted-2)" }} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>

        <Panel title="MRR y crecimiento" sub="requiere etapa B">
          <div className="cpl-callout info">
            <BIco.card />
            <div>
              <b>Todavía no hay planes ni suscripciones.</b> Cuando exista la
              etapa B (planes, MRR, movimientos nuevo/expansión/churn y
              facturas de Grupo Idea), este panel se enciende con esos números
              — reales, no estimados. La salud de infraestructura (uptime,
              latencia) necesita además APM, que tampoco vamos a inventar.
            </div>
          </div>
        </Panel>
      </div>

      <div className="cpl-note">
        Todo lo que se ve acá sale de la base: tenants, sesiones, órdenes,
        cotizaciones, cobros, storage, integraciones y la cola de WhatsApp. La
        consola es de sólo lectura.
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
  onAbrir,
  onCerrar,
}: {
  tenants: TenantConsola[];
  abierto: TenantConsola | null;
  onAbrir: (id: string) => void;
  onCerrar: () => void;
}) {
  const [q, setQ] = React.useState("");
  const [filtro, setFiltro] = React.useState<Filtro>("todos");

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
                <th>Estado</th>
                <th className="r">Usuarios</th>
                <th className="r">OTs 30d</th>
                <th className="r">Cotiz. 30d</th>
                <th className="r">Cobros 30d</th>
                <th className="r">Storage</th>
                <th>Integraciones</th>
                <th className="r">Alta</th>
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
                    <EstadoPill t={t} />
                  </td>
                  <td className="r cpl-mono">{t.usuariosActivos}</td>
                  <td className="r cpl-mono">{t.ots30d}</td>
                  <td className="r cpl-mono">{t.cotizaciones30d}</td>
                  <td className="r cpl-mono">{t.cobros30d}</td>
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
                  <td className="r cpl-mono muted">{fechaCorta(t.creadoEl)}</td>
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
        {filas.length} de {tenants.length} tenants. El control plane lee los
        datos de cada tenant pero no muta su operación — las acciones de ciclo
        de vida llegan con la etapa B, registradas en auditoría.
      </div>

      {abierto ? <TenantDrawer t={abierto} onCerrar={onCerrar} /> : null}
    </div>
  );
}

function TenantDrawer({
  t,
  onCerrar,
}: {
  t: TenantConsola;
  onCerrar: () => void;
}) {
  const riesgo = riesgoDe(t);
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
                <div className="k">Usuarios activos</div>
                <div className="v cpl-mono">{t.usuariosActivos}</div>
              </div>
              <div className="c">
                <div className="k">Storage</div>
                <div className="v cpl-mono">
                  {fmtBytes(t.storageBytes)}
                  {t.storageCuotaBytes
                    ? ` / ${fmtBytes(t.storageCuotaBytes)}`
                    : ""}
                </div>
              </div>
            </div>
          </div>

          <div className="cpl-dsec">
            <div className="dsec-t">Actividad · 30 días</div>
            <div className="cpl-kv2">
              <div className="c">
                <div className="k">OTs emitidas</div>
                <div className="v cpl-mono">{t.ots30d}</div>
              </div>
              <div className="c">
                <div className="k">Cotizaciones</div>
                <div className="v cpl-mono">{t.cotizaciones30d}</div>
              </div>
              <div className="c">
                <div className="k">Cobros</div>
                <div className="v cpl-mono">{t.cobros30d}</div>
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

          <div className="cpl-dsec">
            <div className="dsec-t">Suscripción · facturación de Grupo Idea</div>
            <div className="cpl-callout info">
              <BIco.card />
              <div>
                Plan, cupos, MRR y facturas viven en la <b>etapa B</b>. La
                impersonación (“entrar como”) llega con la <b>etapa C</b>, con
                motivo, vencimiento y rastro visible para el cliente.
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

// ── Facturación (etapa B) ──────────────────────────────────────────────

function BillingBloqueado() {
  return (
    <div className="cpl-page">
      <Panel>
        <div className="cpl-empty" style={{ padding: "60px 20px" }}>
          <BIco.card />
          <div className="t">Requiere planes y suscripciones (etapa B)</div>
          <div className="s" style={{ maxWidth: 520, margin: "6px auto 0" }}>
            El diseño está cerrado: MRR con su serie y movimientos, distribución
            por plan, estados moroso/trial, cupos por plan y las facturas
            GI-AAAA-NNNN emitidas desde el tenant de Grupo Idea con punto de
            venta dedicado. Cuando la etapa B exista, esta sección se enciende
            con números reales.
          </div>
        </div>
      </Panel>
    </div>
  );
}

// ── Impersonación y auditoría ──────────────────────────────────────────

function Impersonacion({ datos }: { datos: ConsolaPlataforma }) {
  const nombreDe = new Map(datos.tenants.map((t) => [t.id, t.nombre]));
  return (
    <div className="cpl-page">
      <Panel title="Sesiones activas" sub="etapa C">
        <div className="cpl-callout info" style={{ marginBottom: 4 }}>
          <BIco.eye />
          <div>
            Las sesiones de impersonación llegan con la <b>etapa C</b>: cada
            entrada a un tenant con motivo obligatorio, vencimiento de 60
            minutos, acciones firmadas “en nombre de” y visibles para el
            cliente.
          </div>
        </div>
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
    </div>
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
