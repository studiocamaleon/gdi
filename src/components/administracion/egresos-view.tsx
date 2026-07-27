"use client";

/**
 * Egresos y Cuentas por pagar.
 *
 * Dos vistas del MISMO registro, no dos módulos:
 *   · "Por pagar" — el filtro de lo que vence y todavía se debe, ordenado por
 *     fecha. Es la primera pregunta del lunes a la mañana.
 *   · "Todos" — el historial completo, para consultar y analizar.
 *
 * El alta colapsa el egreso y su pago en un solo gesto: el switch "Ya está
 * pagado" viene ENCENDIDO, porque el 80% de los egresos de una imprenta son de
 * contado (la nafta, la limpieza, el flete) y hacer dos pantallas para eso
 * sería burocracia.
 *
 * Ver docs/egresos-y-cuentas-por-pagar-diseno.md
 */

import * as React from "react";

import { useConfigRegional } from "@/components/navigation/config-regional-provider";
import { usePuede } from "@/components/navigation/permisos-provider";
import { ConfirmacionDestructiva } from "@/components/ui/confirmacion-destructiva";
import { MoneyInput } from "@/components/ui/money-input";
import { formatearMoneda } from "@/lib/moneda";
import {
  EGRESO_ESTADO_LABELS,
  NATURALEZA_AYUDA,
  NATURALEZA_LABELS,
  TIPO_COMPROBANTE_LABELS,
  TIPOS_COMPROBANTE_COMPRA,
  diasHastaVencimiento,
  etiquetaVencimiento,
  tonoVencimiento,
  type CategoriaEgreso,
  type Egreso,
  type ResumenEgresos,
} from "@/lib/egresos";
import {
  anularEgreso,
  anularPagoEgreso,
  crearEgreso,
  getEgresos,
  getPagosDeEgreso,
  getResumenEgresos,
  registrarPagoEgresos,
  type CrearEgresoBody,
} from "@/lib/egresos-api";
import type { CuentaFondosResumen, MetodoPago } from "@/lib/administracion";
import type { ProveedorDetalle } from "@/lib/proveedores";
import type { PagoDeEgreso } from "@/lib/egresos";

type Tab = "por-pagar" | "todos";

/** Hoy en ISO local, para comparar vencimientos sin arrastrar zona horaria. */
function hoyIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * MoneyInput trabaja con TEXTO (para no pelear con el cursor mientras se
 * tipea) y acá el formulario razona en números. Este adaptador guarda el texto
 * que el usuario ve y avisa el número al padre.
 */
function CampoMonto({
  valor,
  onCambio,
  ariaLabel,
}: {
  valor: number;
  onCambio: (n: number) => void;
  ariaLabel: string;
}) {
  const { moneda } = useConfigRegional();
  const [texto, setTexto] = React.useState(valor ? String(valor) : "");
  return (
    <MoneyInput
      inputClassName="h-auto"
      value={texto}
      onValueChange={(t, n) => {
        setTexto(t);
        onCambio(n ?? 0);
      }}
      moneda={moneda}
      ariaLabel={ariaLabel}
    />
  );
}

function sumarDias(iso: string, dias: number): string {
  const t = Date.parse(`${iso}T00:00:00Z`) + dias * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

export function EgresosView({
  initialEgresos,
  initialResumen,
  categorias,
  proveedores,
  metodosPago,
  cuentas,
}: {
  initialEgresos: Egreso[];
  initialResumen: ResumenEgresos | null;
  categorias: CategoriaEgreso[];
  proveedores: ProveedorDetalle[];
  metodosPago: MetodoPago[];
  cuentas: CuentaFondosResumen[];
}) {
  // Los permisos se resuelven en el cliente (patrón de la casa): el guard del
  // API es el que manda, esto sólo evita ofrecer botones que van a dar 403.
  const puedeGestionar = usePuede("administracion.gestionar");
  const puedeAnular = usePuede("administracion.anular");
  const { moneda } = useConfigRegional();
  const fmt = (v: number) => formatearMoneda(v, moneda, { decimales: 0 });
  const hoy = React.useMemo(() => hoyIso(), []);

  const [tab, setTab] = React.useState<Tab>("por-pagar");
  const [egresos, setEgresos] = React.useState(initialEgresos);
  const [resumen, setResumen] = React.useState(initialResumen);
  const [cargando, setCargando] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [texto, setTexto] = React.useState("");
  const [altaAbierta, setAltaAbierta] = React.useState(false);
  const [pagoAbierto, setPagoAbierto] = React.useState(false);
  const [seleccion, setSeleccion] = React.useState<Set<string>>(new Set());
  const [detalle, setDetalle] = React.useState<Egreso | null>(null);
  const [anulando, setAnulando] = React.useState<Egreso | null>(null);

  const recargar = React.useCallback(
    async (t: Tab = tab) => {
      setCargando(true);
      setError(null);
      try {
        const [lista, res] = await Promise.all([
          getEgresos(
            t === "por-pagar"
              ? { soloPendientes: true }
              : { texto: texto || undefined },
          ),
          getResumenEgresos(),
        ]);
        setEgresos(lista.egresos);
        setResumen(res);
        setSeleccion(new Set());
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo cargar.");
      } finally {
        setCargando(false);
      }
    },
    [tab, texto],
  );

  const cambiarTab = (t: Tab) => {
    setTab(t);
    void recargar(t);
  };

  const visibles = React.useMemo(() => {
    if (tab === "por-pagar" || !texto.trim()) return egresos;
    const q = texto.trim().toLowerCase();
    return egresos.filter(
      (e) =>
        e.descripcion.toLowerCase().includes(q) ||
        e.beneficiarioNombre.toLowerCase().includes(q) ||
        e.numero.toLowerCase().includes(q),
    );
  }, [egresos, texto, tab]);

  const seleccionados = visibles.filter((e) => seleccion.has(e.id));
  const totalSeleccion = seleccionados.reduce((acc, e) => acc + e.saldo, 0);
  // Un pago es de un solo proveedor: una orden de pago se le manda a alguien.
  const proveedoresSeleccion = new Set(
    seleccionados.map((e) => e.proveedorId ?? "sin"),
  );
  const seleccionPagable =
    seleccionados.length > 0 && proveedoresSeleccion.size === 1;

  return (
    <div className="egr-page">
      <div className="egr-head">
        <div>
          <h1>Egresos</h1>
          <div className="sub">
            Todo lo que sale de la caja. Lo que tiene vencimiento y todavía se
            debe es tu cuenta por pagar.
          </div>
        </div>
        {puedeGestionar ? (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setAltaAbierta(true)}
          >
            Registrar egreso
          </button>
        ) : null}
      </div>

      {resumen ? (
        <div className="egr-kpis">
          <div className={`egr-kpi ${resumen.vencido > 0 ? "mal" : ""}`}>
            <span className="l">Vencido</span>
            <span className="v">{fmt(resumen.vencido)}</span>
            <span className="h">ya se pasó la fecha</span>
          </div>
          <div className="egr-kpi">
            <span className="l">Vence esta semana</span>
            <span className="v">{fmt(resumen.estaSemana)}</span>
            <span className="h">próximos 7 días</span>
          </div>
          <div className="egr-kpi">
            <span className="l">Total a pagar</span>
            <span className="v">{fmt(resumen.aPagar)}</span>
            <span className="h">
              {resumen.egresosPendientes} egreso
              {resumen.egresosPendientes === 1 ? "" : "s"} pendiente
              {resumen.egresosPendientes === 1 ? "" : "s"}
            </span>
          </div>
          {/* El contraste que importa: lo que hay que pagar contra lo que hay. */}
          <div
            className={`egr-kpi ${resumen.cuentas < resumen.aPagar ? "alerta" : "bien"}`}
          >
            <span className="l">En las cuentas</span>
            <span className="v">{fmt(resumen.cuentas)}</span>
            <span className="h">
              {resumen.cuentas < resumen.aPagar
                ? `faltan ${fmt(resumen.aPagar - resumen.cuentas)}`
                : "alcanza para lo pendiente"}
            </span>
          </div>
        </div>
      ) : null}

      <div className="egr-toolbar">
        <div className="egr-tabs" role="tablist">
          <button
            type="button"
            className={tab === "por-pagar" ? "on" : ""}
            onClick={() => cambiarTab("por-pagar")}
          >
            Por pagar
          </button>
          <button
            type="button"
            className={tab === "todos" ? "on" : ""}
            onClick={() => cambiarTab("todos")}
          >
            Todos
          </button>
        </div>
        <input
          className="egr-search"
          placeholder="Buscar por descripción, beneficiario o número…"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
        />
        {seleccionados.length > 0 && puedeGestionar ? (
          <button
            type="button"
            className="btn btn-primary"
            disabled={!seleccionPagable}
            title={
              seleccionPagable
                ? undefined
                : "Un pago es de un solo proveedor: una orden de pago se le manda a alguien."
            }
            onClick={() => setPagoAbierto(true)}
          >
            Pagar {seleccionados.length} · {fmt(totalSeleccion)}
          </button>
        ) : null}
      </div>

      {error ? <div className="egr-error">{error}</div> : null}

      {visibles.length === 0 ? (
        <div className="egr-empty">
          <div className="ttl">
            {tab === "por-pagar"
              ? "No hay nada por pagar"
              : "Todavía no hay egresos"}
          </div>
          <div className="sub">
            {tab === "por-pagar"
              ? "Cuando cargues una factura con vencimiento, va a aparecer acá ordenada por fecha."
              : "Registrá el primero: la nafta, el alquiler, una factura de proveedor."}
          </div>
        </div>
      ) : (
        <div className="egr-tabla-wrap">
          <table className="egr-tabla">
            <thead>
              <tr>
                {tab === "por-pagar" && puedeGestionar ? <th /> : null}
                <th>{tab === "por-pagar" ? "Vence" : "Competencia"}</th>
                <th>Descripción</th>
                <th>Beneficiario</th>
                <th>Categoría</th>
                <th className="num">Total</th>
                <th className="num">Saldo</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((e) => {
                const dias = e.fechaVencimiento
                  ? diasHastaVencimiento(e.fechaVencimiento, hoy)
                  : null;
                const tono = dias != null ? tonoVencimiento(dias) : "";
                return (
                  <tr key={e.id} className={`egr-${tono}`}>
                    {tab === "por-pagar" && puedeGestionar ? (
                      <td className="egr-check">
                        <input
                          type="checkbox"
                          checked={seleccion.has(e.id)}
                          aria-label={`Seleccionar ${e.numero}`}
                          onChange={(ev) =>
                            setSeleccion((prev) => {
                              const next = new Set(prev);
                              if (ev.target.checked) next.add(e.id);
                              else next.delete(e.id);
                              return next;
                            })
                          }
                        />
                      </td>
                    ) : null}
                    <td className="mono">
                      {tab === "por-pagar" && e.fechaVencimiento ? (
                        <>
                          {e.fechaVencimiento}
                          {dias != null ? (
                            <span className="egr-sub">
                              {etiquetaVencimiento(dias)}
                            </span>
                          ) : null}
                        </>
                      ) : (
                        <>
                          {e.fechaCompetencia}
                          {!e.fechaVencimiento ? (
                            <span className="egr-sub">contado</span>
                          ) : null}
                        </>
                      )}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="egr-link"
                        onClick={() => setDetalle(e)}
                      >
                        {e.descripcion}
                      </button>
                      <span className="egr-sub mono">{e.numero}</span>
                    </td>
                    <td>{e.beneficiarioNombre}</td>
                    <td>
                      {e.categoriaNombre}
                      {e.naturaleza && e.naturaleza !== "COSTO_PRODUCCION" && e.naturaleza !== "GASTO_ESTRUCTURA" ? (
                        <span className="egr-sub">
                          {NATURALEZA_LABELS[e.naturaleza]}
                        </span>
                      ) : null}
                    </td>
                    <td className="num mono">{fmt(e.total)}</td>
                    <td className="num mono">
                      {e.saldo > 0 ? fmt(e.saldo) : "—"}
                    </td>
                    <td>
                      <span className={`egr-badge ${e.estado}`}>
                        {EGRESO_ESTADO_LABELS[e.estado]}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {cargando ? <div className="egr-cargando">Actualizando…</div> : null}

      {altaAbierta ? (
        <AltaEgreso
          categorias={categorias}
          proveedores={proveedores}
          metodosPago={metodosPago}
          cuentas={cuentas}
          hoy={hoy}
          onCerrar={() => setAltaAbierta(false)}
          onListo={() => {
            setAltaAbierta(false);
            void recargar();
          }}
        />
      ) : null}

      {pagoAbierto ? (
        <RegistrarPago
          egresos={seleccionados}
          metodosPago={metodosPago}
          cuentas={cuentas}
          hoy={hoy}
          onCerrar={() => setPagoAbierto(false)}
          onListo={() => {
            setPagoAbierto(false);
            void recargar();
          }}
        />
      ) : null}

      {detalle ? (
        <DetalleEgreso
          egreso={detalle}
          puedeAnular={puedeAnular}
          onCerrar={() => setDetalle(null)}
          onAnular={() => {
            setAnulando(detalle);
            setDetalle(null);
          }}
          onCambio={() => void recargar()}
        />
      ) : null}

      <ConfirmacionDestructiva
        open={anulando !== null}
        onOpenChange={(v) => {
          if (!v) setAnulando(null);
        }}
        titulo={`Anular ${anulando?.numero ?? ""}`}
        descripcion="El egreso queda registrado como anulado con su motivo: no se borra, para que el historial no tenga huecos."
        nombreItem={anulando?.descripcion}
        requiereTipear={false}
        motivo={{
          label: "Por qué se anula",
          placeholder: "Se cargó por error, factura duplicada…",
        }}
        accionLabel="Anular egreso"
        onConfirmar={async (motivo) => {
          if (!anulando) return;
          await anularEgreso(anulando.id, motivo);
          setAnulando(null);
          void recargar();
        }}
      />
    </div>
  );
}

/**
 * Alta de un egreso. El switch "Ya está pagado" es el corazón de la pantalla:
 * encendido pide la cuenta y el egreso nace saldado; apagado pide el
 * vencimiento y va a Cuentas por pagar.
 */
function AltaEgreso({
  categorias,
  proveedores,
  metodosPago,
  cuentas,
  hoy,
  onCerrar,
  onListo,
}: {
  categorias: CategoriaEgreso[];
  proveedores: ProveedorDetalle[];
  metodosPago: MetodoPago[];
  cuentas: CuentaFondosResumen[];
  hoy: string;
  onCerrar: () => void;
  onListo: () => void;
}) {
  const { moneda } = useConfigRegional();
  const fmt = (v: number) => formatearMoneda(v, moneda, { decimales: 0 });
  const activas = categorias.filter((c) => c.activo);

  const [yaPagado, setYaPagado] = React.useState(true);
  const [descripcion, setDescripcion] = React.useState("");
  const [categoriaId, setCategoriaId] = React.useState(activas[0]?.id ?? "");
  const [proveedorId, setProveedorId] = React.useState("");
  const [beneficiario, setBeneficiario] = React.useState("");
  const [competencia, setCompetencia] = React.useState(hoy);
  const [vencimiento, setVencimiento] = React.useState(sumarDias(hoy, 30));
  const [neto, setNeto] = React.useState(0);
  const [iva, setIva] = React.useState(0);
  const [tipoComprobante, setTipoComprobante] = React.useState("SIN_DOCUMENTO");
  const [puntoVenta, setPuntoVenta] = React.useState("");
  const [numeroComprobante, setNumeroComprobante] = React.useState("");
  const [metodoPagoId, setMetodoPagoId] = React.useState(
    metodosPago[0]?.id ?? "",
  );
  const [cuentaId, setCuentaId] = React.useState(cuentas[0]?.id ?? "");
  const [referencia, setReferencia] = React.useState("");
  const [notas, setNotas] = React.useState("");
  const [guardando, setGuardando] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const categoria = activas.find((c) => c.id === categoriaId);
  const total = neto + iva;

  // El plazo del proveedor precarga el vencimiento: es el dato por el que se
  // cargó en el maestro.
  React.useEffect(() => {
    const prov = proveedores.find((p) => p.id === proveedorId);
    const dias = (prov as { condicionPagoDias?: number | null } | undefined)
      ?.condicionPagoDias;
    if (dias != null && dias > 0) setVencimiento(sumarDias(hoy, dias));
  }, [proveedorId, proveedores, hoy]);

  const guardar = async () => {
    setGuardando(true);
    setError(null);
    try {
      const body: CrearEgresoBody = {
        descripcion: descripcion.trim(),
        categoriaEgresoId: categoriaId,
        fechaCompetencia: competencia,
        neto,
        iva,
        notas: notas.trim() || undefined,
      };
      if (proveedorId) body.proveedorId = proveedorId;
      else body.beneficiarioNombre = beneficiario.trim();
      if (tipoComprobante !== "SIN_DOCUMENTO") {
        body.tipoComprobante = tipoComprobante;
        body.puntoVenta = puntoVenta.trim() || undefined;
        body.numeroComprobante = numeroComprobante.trim() || undefined;
      }
      if (yaPagado) {
        body.pago = {
          metodoPagoId,
          cuentaOrigenId: cuentaId,
          fecha: competencia,
          referencia: referencia.trim() || undefined,
        };
      } else {
        body.fechaVencimiento = vencimiento;
      }
      await crearEgreso(body);
      onListo();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setGuardando(false);
    }
  };

  const listo =
    descripcion.trim().length >= 2 &&
    categoriaId &&
    total > 0 &&
    (proveedorId || beneficiario.trim().length >= 2) &&
    (!yaPagado || (metodoPagoId && cuentaId));

  return (
    <div className="egr-modal-bg" role="dialog" aria-modal="true">
      <div className="egr-modal">
        <div className="egr-modal-head">
          <h2>Registrar egreso</h2>
          <button type="button" className="egr-x" onClick={onCerrar}>
            ×
          </button>
        </div>

        <div className="egr-modal-body">
          {/* El switch primero: define qué pide el resto del formulario. */}
          <label className="egr-switch">
            <input
              type="checkbox"
              checked={yaPagado}
              onChange={(e) => setYaPagado(e.target.checked)}
            />
            <span>
              <b>Ya está pagado</b>
              <small>
                {yaPagado
                  ? "Salió de la caja ahora: no entra en cuentas por pagar."
                  : "Queda pendiente con vencimiento y entra en cuentas por pagar."}
              </small>
            </span>
          </label>

          <div className="egr-grid">
            <label className="egr-f egr-f-wide">
              <span>Descripción</span>
              <input
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Nafta camioneta, papel obra, alquiler agosto…"
              />
            </label>

            <label className="egr-f">
              <span>Categoría</span>
              <select
                value={categoriaId}
                onChange={(e) => setCategoriaId(e.target.value)}
              >
                {activas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
              {categoria ? (
                <small className="egr-hint">
                  {NATURALEZA_LABELS[categoria.naturaleza]} ·{" "}
                  {NATURALEZA_AYUDA[categoria.naturaleza]}
                </small>
              ) : null}
            </label>

            <label className="egr-f">
              <span>Proveedor</span>
              <select
                value={proveedorId}
                onChange={(e) => setProveedorId(e.target.value)}
              >
                <option value="">Sin proveedor</option>
                {proveedores.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            </label>

            {!proveedorId ? (
              <label className="egr-f">
                <span>¿A quién se le paga?</span>
                <input
                  value={beneficiario}
                  onChange={(e) => setBeneficiario(e.target.value)}
                  placeholder="Flete Ramón, Municipalidad…"
                />
              </label>
            ) : null}

            <label className="egr-f">
              <span>Competencia</span>
              <input
                type="date"
                value={competencia}
                onChange={(e) => setCompetencia(e.target.value)}
              />
              <small className="egr-hint">A qué mes pertenece el gasto.</small>
            </label>

            {!yaPagado ? (
              <label className="egr-f">
                <span>Vencimiento</span>
                <input
                  type="date"
                  value={vencimiento}
                  onChange={(e) => setVencimiento(e.target.value)}
                />
              </label>
            ) : null}

            <label className="egr-f">
              <span>Neto</span>
              <CampoMonto valor={neto} onCambio={setNeto} ariaLabel="Neto" />
            </label>

            <label className="egr-f">
              <span>IVA</span>
              <CampoMonto valor={iva} onCambio={setIva} ariaLabel="IVA" />
            </label>

            <label className="egr-f">
              <span>Comprobante</span>
              <select
                value={tipoComprobante}
                onChange={(e) => setTipoComprobante(e.target.value)}
              >
                {TIPOS_COMPROBANTE_COMPRA.map((t) => (
                  <option key={t} value={t}>
                    {TIPO_COMPROBANTE_LABELS[t]}
                  </option>
                ))}
              </select>
            </label>

            {tipoComprobante !== "SIN_DOCUMENTO" ? (
              <>
                <label className="egr-f egr-f-sm">
                  <span>Punto de venta</span>
                  <input
                    value={puntoVenta}
                    onChange={(e) => setPuntoVenta(e.target.value)}
                    placeholder="0001"
                  />
                </label>
                <label className="egr-f egr-f-sm">
                  <span>Número</span>
                  <input
                    value={numeroComprobante}
                    onChange={(e) => setNumeroComprobante(e.target.value)}
                    placeholder="00012345"
                  />
                </label>
              </>
            ) : null}

            {yaPagado ? (
              <>
                <label className="egr-f">
                  <span>Método de pago</span>
                  <select
                    value={metodoPagoId}
                    onChange={(e) => setMetodoPagoId(e.target.value)}
                  >
                    {metodosPago.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.nombre}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="egr-f">
                  <span>Salió de</span>
                  <select
                    value={cuentaId}
                    onChange={(e) => setCuentaId(e.target.value)}
                  >
                    {cuentas.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre} ({c.moneda})
                      </option>
                    ))}
                  </select>
                </label>
                <label className="egr-f">
                  <span>Referencia</span>
                  <input
                    value={referencia}
                    onChange={(e) => setReferencia(e.target.value)}
                    placeholder="N° de operación"
                  />
                </label>
              </>
            ) : null}

            <label className="egr-f egr-f-wide">
              <span>Notas</span>
              <textarea
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                rows={2}
              />
            </label>
          </div>

          <div className="egr-total">
            <span>Total</span>
            <strong className="mono">{fmt(total)}</strong>
          </div>

          {error ? <div className="egr-error">{error}</div> : null}
        </div>

        <div className="egr-modal-foot">
          <button type="button" className="btn" onClick={onCerrar}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!listo || guardando}
            onClick={() => void guardar()}
          >
            {guardando ? "Guardando…" : "Registrar"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Pago de uno o varios egresos del mismo proveedor. */
function RegistrarPago({
  egresos,
  metodosPago,
  cuentas,
  hoy,
  onCerrar,
  onListo,
}: {
  egresos: Egreso[];
  metodosPago: MetodoPago[];
  cuentas: CuentaFondosResumen[];
  hoy: string;
  onCerrar: () => void;
  onListo: () => void;
}) {
  const { moneda } = useConfigRegional();
  const fmt = (v: number) => formatearMoneda(v, moneda, { decimales: 0 });
  const [metodoPagoId, setMetodoPagoId] = React.useState(
    metodosPago[0]?.id ?? "",
  );
  const [cuentaId, setCuentaId] = React.useState(cuentas[0]?.id ?? "");
  const [fecha, setFecha] = React.useState(hoy);
  const [referencia, setReferencia] = React.useState("");
  // Editable por egreso: así el pago parcial es el mismo formulario.
  const [montos, setMontos] = React.useState<Record<string, number>>(() =>
    Object.fromEntries(egresos.map((e) => [e.id, e.saldo])),
  );
  const [guardando, setGuardando] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const total = egresos.reduce((acc, e) => acc + (montos[e.id] ?? 0), 0);
  const excede = egresos.some((e) => (montos[e.id] ?? 0) > e.saldo + 0.005);

  const guardar = async () => {
    setGuardando(true);
    setError(null);
    try {
      await registrarPagoEgresos({
        metodoPagoId,
        cuentaOrigenId: cuentaId,
        fecha,
        referencia: referencia.trim() || undefined,
        imputaciones: egresos
          .filter((e) => (montos[e.id] ?? 0) > 0)
          .map((e) => ({ egresoId: e.id, monto: montos[e.id] })),
      });
      onListo();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo registrar el pago.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="egr-modal-bg" role="dialog" aria-modal="true">
      <div className="egr-modal">
        <div className="egr-modal-head">
          <h2>Registrar pago</h2>
          <button type="button" className="egr-x" onClick={onCerrar}>
            ×
          </button>
        </div>
        <div className="egr-modal-body">
          <div className="egr-pago-lista">
            {egresos.map((e) => (
              <div className="egr-pago-fila" key={e.id}>
                <div>
                  <b>{e.descripcion}</b>
                  <span className="egr-sub mono">
                    {e.numero} · debe {fmt(e.saldo)}
                  </span>
                </div>
                <CampoMonto
                  valor={montos[e.id] ?? 0}
                  onCambio={(v) =>
                    setMontos((prev) => ({ ...prev, [e.id]: v }))
                  }
                  ariaLabel={`Monto a pagar de ${e.numero}`}
                />
              </div>
            ))}
          </div>

          <div className="egr-grid">
            <label className="egr-f">
              <span>Método de pago</span>
              <select
                value={metodoPagoId}
                onChange={(e) => setMetodoPagoId(e.target.value)}
              >
                {metodosPago.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nombre}
                  </option>
                ))}
              </select>
            </label>
            <label className="egr-f">
              <span>Sale de</span>
              <select
                value={cuentaId}
                onChange={(e) => setCuentaId(e.target.value)}
              >
                {cuentas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre} ({c.moneda})
                  </option>
                ))}
              </select>
            </label>
            <label className="egr-f">
              <span>Fecha</span>
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
              />
            </label>
            <label className="egr-f">
              <span>Referencia</span>
              <input
                value={referencia}
                onChange={(e) => setReferencia(e.target.value)}
                placeholder="N° de transferencia"
              />
            </label>
          </div>

          <div className="egr-total">
            <span>Total del pago</span>
            <strong className="mono">{fmt(total)}</strong>
          </div>

          {excede ? (
            <div className="egr-error">
              Estás imputando más de lo que se debe en alguno de los egresos.
            </div>
          ) : null}
          {error ? <div className="egr-error">{error}</div> : null}
        </div>
        <div className="egr-modal-foot">
          <button type="button" className="btn" onClick={onCerrar}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={guardando || total <= 0 || excede}
            onClick={() => void guardar()}
          >
            {guardando ? "Registrando…" : `Pagar ${fmt(total)}`}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Ficha del egreso con sus pagos y la acción de anular. */
function DetalleEgreso({
  egreso,
  puedeAnular,
  onCerrar,
  onAnular,
  onCambio,
}: {
  egreso: Egreso;
  puedeAnular: boolean;
  onCerrar: () => void;
  onAnular: () => void;
  onCambio: () => void;
}) {
  const { moneda } = useConfigRegional();
  const fmt = (v: number) => formatearMoneda(v, moneda, { decimales: 0 });
  const [pagos, setPagos] = React.useState<PagoDeEgreso[] | null>(null);
  const [anulandoPago, setAnulandoPago] = React.useState<PagoDeEgreso | null>(
    null,
  );

  const cargar = React.useCallback(() => {
    getPagosDeEgreso(egreso.id)
      .then((r) => setPagos(r.pagos))
      .catch(() => setPagos([]));
  }, [egreso.id]);

  React.useEffect(() => cargar(), [cargar]);

  return (
    <div className="egr-modal-bg" role="dialog" aria-modal="true">
      <div className="egr-modal egr-modal-sm">
        <div className="egr-modal-head">
          <h2>
            {egreso.descripcion}
            <span className="egr-sub mono">{egreso.numero}</span>
          </h2>
          <button type="button" className="egr-x" onClick={onCerrar}>
            ×
          </button>
        </div>
        <div className="egr-modal-body">
          <dl className="egr-dl">
            <dt>Beneficiario</dt>
            <dd>{egreso.beneficiarioNombre}</dd>
            <dt>Categoría</dt>
            <dd>
              {egreso.categoriaNombre}
              {egreso.naturaleza ? (
                <small> · {NATURALEZA_LABELS[egreso.naturaleza]}</small>
              ) : null}
            </dd>
            <dt>Competencia</dt>
            <dd className="mono">{egreso.fechaCompetencia}</dd>
            <dt>Vencimiento</dt>
            <dd className="mono">
              {egreso.fechaVencimiento ?? "fue de contado"}
            </dd>
            {egreso.numeroComprobante ? (
              <>
                <dt>Comprobante</dt>
                <dd className="mono">
                  {egreso.tipoComprobante} {egreso.puntoVenta}-
                  {egreso.numeroComprobante}
                </dd>
              </>
            ) : null}
            <dt>Neto</dt>
            <dd className="mono">{fmt(egreso.neto)}</dd>
            <dt>IVA</dt>
            <dd className="mono">{fmt(egreso.iva)}</dd>
            <dt>Total</dt>
            <dd className="mono">
              <strong>{fmt(egreso.total)}</strong>
            </dd>
            <dt>Pagado</dt>
            <dd className="mono">{fmt(egreso.pagadoTotal)}</dd>
            {egreso.registradoPorNombre ? (
              <>
                <dt>Cargado por</dt>
                <dd>{egreso.registradoPorNombre}</dd>
              </>
            ) : null}
            {egreso.notas ? (
              <>
                <dt>Notas</dt>
                <dd>{egreso.notas}</dd>
              </>
            ) : null}
            {egreso.motivoAnulacion ? (
              <>
                <dt>Anulado</dt>
                <dd>{egreso.motivoAnulacion}</dd>
              </>
            ) : null}
          </dl>

          <div className="egr-pagos">
            <div className="egr-pagos-t">Pagos</div>
            {pagos === null ? (
              <div className="egr-sub">Cargando…</div>
            ) : pagos.length === 0 ? (
              <div className="egr-sub">Sin pagos registrados.</div>
            ) : (
              pagos.map((p) => (
                <div
                  className={`egr-pago-item ${p.anuladoEl ? "anulado" : ""}`}
                  key={p.id}
                >
                  <div>
                    <b className="mono">{p.numero}</b>
                    <span className="egr-sub">
                      {p.fecha.slice(0, 10)} · {p.metodoNombre} ·{" "}
                      {p.cuentaNombre}
                      {p.referencia ? ` · ${p.referencia}` : ""}
                      {p.anuladoEl ? ` · anulado: ${p.motivoAnulacion}` : ""}
                    </span>
                  </div>
                  <span className="mono">{fmt(p.monto)}</span>
                  {!p.anuladoEl && puedeAnular ? (
                    <button
                      type="button"
                      className="egr-link"
                      onClick={() => setAnulandoPago(p)}
                    >
                      Anular
                    </button>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </div>
        <div className="egr-modal-foot">
          {puedeAnular && egreso.estado !== "anulado" ? (
            <button type="button" className="btn btn-danger" onClick={onAnular}>
              Anular egreso
            </button>
          ) : null}
          <button type="button" className="btn" onClick={onCerrar}>
            Cerrar
          </button>
        </div>
      </div>

      <ConfirmacionDestructiva
        open={anulandoPago !== null}
        onOpenChange={(v) => {
          if (!v) setAnulandoPago(null);
        }}
        titulo={`Anular el pago ${anulandoPago?.numero ?? ""}`}
        descripcion="El egreso vuelve a deber y la plata vuelve a la cuenta con un contramovimiento. El pago queda en el historial: se intentó y falló, y eso es información."
        requiereTipear={false}
        motivo={{
          label: "Por qué se anula",
          placeholder: "Rechazó la transferencia, cheque sin fondos…",
        }}
        accionLabel="Anular pago"
        onConfirmar={async (motivo) => {
          if (!anulandoPago) return;
          await anularPagoEgreso(anulandoPago.id, motivo);
          setAnulandoPago(null);
          cargar();
          onCambio();
        }}
      />
    </div>
  );
}
