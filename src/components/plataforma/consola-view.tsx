import Link from "next/link";

import {
  formatBytesPlataforma,
  type ConsolaPlataforma,
  type TenantConsola,
} from "@/lib/plataforma-api";

/**
 * La consola del control plane (etapa A): cards de resumen + tabla de
 * tenants. Server component puro — sin estado ni interacción — y con chrome
 * propio y mínimo: tiene que SENTIRSE otra superficie, no una vista más del
 * dashboard de tenant. Ver docs/control-plane-diseno.md
 */

function fechaRelativa(iso: string | null): string {
  if (!iso) return "nunca";
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "recién";
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.round(h / 24)} d`;
}

function Integraciones({ tenant }: { tenant: TenantConsola }) {
  if (tenant.integraciones.length === 0) {
    return <span className="cpl-muted">—</span>;
  }
  return (
    <span className="cpl-ints">
      {tenant.integraciones.map((i) => (
        <span
          key={i.proveedor}
          className={`cpl-int ${i.estado.toLowerCase()}`}
          title={
            i.ultimoErrorTexto ??
            `${i.proveedor}: ${i.estado.toLowerCase().replace("_", " ")}`
          }
        >
          {i.proveedor === "MERCADOPAGO" ? "MP" : i.proveedor}
        </span>
      ))}
    </span>
  );
}

export function ConsolaPlataformaView({ datos }: { datos: ConsolaPlataforma }) {
  const { resumen, tenants } = datos;
  const cards: Array<{ k: string; v: string; alerta?: boolean }> = [
    { k: "Tenants activos", v: `${resumen.tenantsActivos} / ${resumen.tenants}` },
    { k: "Usuarios activos", v: String(resumen.usuariosActivos) },
    { k: "OTs emitidas · 30d", v: String(resumen.ots30d) },
    { k: "Storage total", v: formatBytesPlataforma(resumen.storageBytes) },
    {
      k: "Sin actividad · 14d",
      v: String(resumen.sinActividad14d),
      alerta: resumen.sinActividad14d > 0,
    },
  ];

  return (
    <div className="cpl-page">
      <div className="cpl-head">
        <div>
          <div className="cpl-eyebrow">Grafo · control plane</div>
          <h1>Plataforma</h1>
          <div className="cpl-sub">
            Todos los tenants, su actividad y su salud. Sólo lectura.
          </div>
        </div>
        <Link className="cpl-volver" href="/">
          ← Volver a la app
        </Link>
      </div>

      <div className="cpl-cards">
        {cards.map((c) => (
          <div key={c.k} className={`cpl-card ${c.alerta ? "alerta" : ""}`}>
            <div className="k">{c.k}</div>
            <div className="v">{c.v}</div>
          </div>
        ))}
      </div>

      <div className="cpl-tabla-wrap">
        <table className="cpl-tabla">
          <thead>
            <tr>
              <th>Tenant</th>
              <th>Usuarios</th>
              <th>Último acceso</th>
              <th>OTs 30d</th>
              <th>Cotiz. 30d</th>
              <th>Cobros 30d</th>
              <th>Storage</th>
              <th>Integraciones</th>
              <th>WhatsApp</th>
            </tr>
          </thead>
          <tbody>
            {tenants.map((t) => (
              <tr key={t.id} className={t.activo ? "" : "cpl-inactivo"}>
                <td>
                  <div className="cpl-tenant">
                    <span className={`cpl-dot ${t.activo ? "ok" : "off"}`} />
                    <div>
                      <div className="n">{t.nombre}</div>
                      <div className="s">{t.slug}</div>
                    </div>
                  </div>
                </td>
                <td className="cpl-num">{t.usuariosActivos}</td>
                <td className={t.sinActividad14d && t.activo ? "cpl-alerta" : ""}>
                  {fechaRelativa(t.ultimoAccesoEl)}
                </td>
                <td className="cpl-num">{t.ots30d}</td>
                <td className="cpl-num">{t.cotizaciones30d}</td>
                <td className="cpl-num">{t.cobros30d}</td>
                <td className="cpl-num">
                  {formatBytesPlataforma(t.storageBytes)}
                  {t.storageCuotaBytes ? (
                    <span className="cpl-muted">
                      {" "}
                      / {formatBytesPlataforma(t.storageCuotaBytes)}
                    </span>
                  ) : null}
                </td>
                <td>
                  <Integraciones tenant={t} />
                </td>
                <td className="cpl-num">
                  {t.whatsappFallidas > 0 ? (
                    <span className="cpl-alerta">{t.whatsappFallidas} fallidas</span>
                  ) : t.whatsappPendientes > 0 ? (
                    `${t.whatsappPendientes} pend.`
                  ) : (
                    <span className="cpl-muted">ok</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** 403: usuario sin rol de plataforma que adivinó la URL. */
export function PlataformaSinAcceso() {
  return (
    <div className="cpl-page">
      <div className="cpl-noacceso">
        <h1>Esta sección es del equipo de Grafo</h1>
        <p>
          Tu usuario no tiene rol de plataforma. Si creés que deberías tenerlo,
          hablá con quien administra Grafo.
        </p>
        <Link className="cpl-volver" href="/">
          ← Volver a la app
        </Link>
      </div>
    </div>
  );
}
