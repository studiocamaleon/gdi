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
import { ArchivoUploader } from "@/components/archivos/archivo-uploader";
import { ConfirmacionDestructiva } from "@/components/ui/confirmacion-destructiva";
import { MoneyInput } from "@/components/ui/money-input";
import { formatearMoneda } from "@/lib/moneda";
import {
  EGRESO_ESTADO_LABELS,
  NATURALEZA_AYUDA,
  NATURALEZA_LABELS,
  TIPO_COMPROBANTE_LABELS,
  TIPOS_COMPROBANTE_COMPRA,
  FRECUENCIA_LABELS,
  FRECUENCIAS_RECURRENTE,
  REGIMEN_RETENCION_LABELS,
  REGIMENES_RETENCION,
  TRAMO_AGING_LABELS,
  TRAMOS_AGING,
  diasHastaVencimiento,
  etiquetaVencimiento,
  tonoVencimiento,
  type CategoriaEgreso,
  type Egreso,
  type ReporteEgresos,
  type ResumenEgresos,
  type GastoRecurrente,
  type PresupuestadoVsReal,
  type SaldoProveedor,
} from "@/lib/egresos";
import {
  anularEgreso,
  anularPagoEgreso,
  crearEgreso,
  getEgresos,
  getPagosDeEgreso,
  getReporteEgresos,
  getResumenEgresos,
  getPresupuestadoVsReal,
  getRecurrentes,
  getSaldosProveedores,
  crearRecurrente,
  editarRecurrente,
  generarRecurrentes,
  registrarPagoEgresos,
  type CrearEgresoBody,
} from "@/lib/egresos-api";
import type { CuentaFondosResumen, MetodoPago } from "@/lib/administracion";
import type { ProveedorDetalle } from "@/lib/proveedores";
import type { PagoDeEgreso } from "@/lib/egresos";
import type { Archivo } from "@/lib/archivos";
import { listarArchivos } from "@/lib/archivos-api";

type Tab =
  | "por-pagar"
  | "todos"
  | "proveedores"
  | "recurrentes"
  | "analisis";

/** Un decimal, en formato local. */
const pct1 = (v: number) =>
  v.toLocaleString("es-AR", { maximumFractionDigits: 1 });

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
  const [reporte, setReporte] = React.useState<ReporteEgresos | null>(null);
  const [saldos, setSaldos] = React.useState<SaldoProveedor[] | null>(null);
  const [recurrentes, setRecurrentes] = React.useState<
    GastoRecurrente[] | null
  >(null);
  const [presu, setPresu] = React.useState<PresupuestadoVsReal | null>(null);

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
    if (t === "proveedores") {
      setSaldos(null);
      getSaldosProveedores()
        .then((r) => setSaldos(r.proveedores))
        .catch(() => setSaldos([]));
      return;
    }
    if (t === "recurrentes") {
      setRecurrentes(null);
      getRecurrentes()
        .then((r) => setRecurrentes(r.recurrentes))
        .catch(() => setRecurrentes([]));
      return;
    }
    if (t === "analisis") {
      // El reporte se pide recién acá: es una agregación sobre todo el
      // período y no hace falta pagarla si nadie abre el tab.
      setReporte(null);
      setPresu(null);
      getReporteEgresos()
        .then(setReporte)
        .catch(() => setReporte(null));
      getPresupuestadoVsReal()
        .then(setPresu)
        .catch(() => setPresu(null));
      return;
    }
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
          <button
            type="button"
            className={tab === "proveedores" ? "on" : ""}
            onClick={() => cambiarTab("proveedores")}
          >
            Proveedores
          </button>
          <button
            type="button"
            className={tab === "recurrentes" ? "on" : ""}
            onClick={() => cambiarTab("recurrentes")}
          >
            Recurrentes
          </button>
          <button
            type="button"
            className={tab === "analisis" ? "on" : ""}
            onClick={() => cambiarTab("analisis")}
          >
            Análisis
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

      {tab === "analisis" ? (
        <Analisis reporte={reporte} presu={presu} fmt={fmt} />
      ) : tab === "recurrentes" ? (
        <Recurrentes
          recurrentes={recurrentes}
          categorias={categorias}
          proveedores={proveedores}
          hoy={hoy}
          puedeGestionar={puedeGestionar}
          fmt={fmt}
          onCambio={() => cambiarTab("recurrentes")}
        />
      ) : tab === "proveedores" ? (
        <SaldosProveedores saldos={saldos} fmt={fmt} />
      ) : visibles.length === 0 ? (
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
 * Plantillas que emiten egresos solas (journeys B5 y B6).
 *
 * El monto es una SUGERENCIA y la pantalla lo dice: la luz no viene igual dos
 * meses seguidos, así que el egreso nace pendiente con ese importe y quien lo
 * paga lo corrige. Si el sistema tratara el monto como verdad, mentiría con
 * precisión.
 */
function Recurrentes({
  recurrentes,
  categorias,
  proveedores,
  hoy,
  puedeGestionar,
  fmt,
  onCambio,
}: {
  recurrentes: GastoRecurrente[] | null;
  categorias: CategoriaEgreso[];
  proveedores: ProveedorDetalle[];
  hoy: string;
  puedeGestionar: boolean;
  fmt: (v: number) => string;
  onCambio: () => void;
}) {
  const [alta, setAlta] = React.useState(false);
  const [emitiendo, setEmitiendo] = React.useState(false);
  const [aviso, setAviso] = React.useState<string | null>(null);
  const activas = categorias.filter((c) => c.activo);

  const [descripcion, setDescripcion] = React.useState("");
  const [categoriaId, setCategoriaId] = React.useState(activas[0]?.id ?? "");
  const [proveedorId, setProveedorId] = React.useState("");
  const [monto, setMonto] = React.useState(0);
  const [frecuencia, setFrecuencia] = React.useState("mensual");
  const [dia, setDia] = React.useState(10);
  const [desde, setDesde] = React.useState(hoy.slice(0, 7));

  const emitir = async () => {
    setEmitiendo(true);
    setAviso(null);
    try {
      const r = await generarRecurrentes();
      setAviso(
        r.emitidos === 0
          ? "No había nada pendiente de emitir."
          : `${r.emitidos} egreso${r.emitidos === 1 ? "" : "s"} emitido${r.emitidos === 1 ? "" : "s"}.`,
      );
      onCambio();
    } catch (e) {
      setAviso(e instanceof Error ? e.message : "No se pudo emitir.");
    } finally {
      setEmitiendo(false);
    }
  };

  const guardar = async () => {
    await crearRecurrente({
      descripcion: descripcion.trim(),
      categoriaEgresoId: categoriaId,
      proveedorId: proveedorId || undefined,
      monto,
      frecuencia,
      diaVencimiento: dia,
      vigenteDesde: desde,
    });
    setAlta(false);
    setDescripcion("");
    setMonto(0);
    onCambio();
  };

  if (!recurrentes) {
    return <div className="egr-cargando">Cargando plantillas…</div>;
  }

  return (
    <div className="egr-analisis">
      <div className="egr-toolbar">
        {puedeGestionar ? (
          <>
            <button type="button" className="btn" onClick={() => setAlta(true)}>
              Nueva plantilla
            </button>
            <button
              type="button"
              className="btn"
              disabled={emitiendo}
              onClick={() => void emitir()}
            >
              {emitiendo ? "Emitiendo…" : "Emitir pendientes"}
            </button>
          </>
        ) : null}
        {aviso ? <span className="egr-sub">{aviso}</span> : null}
      </div>

      {recurrentes.length === 0 ? (
        <div className="egr-empty">
          <div className="ttl">Sin gastos recurrentes</div>
          <div className="sub">
            El alquiler, la luz, el contador: cargalos una vez y aparecen solos
            cada mes en Cuentas por pagar.
          </div>
        </div>
      ) : (
        <div className="egr-tabla-wrap">
          <table className="egr-tabla">
            <thead>
              <tr>
                <th>Plantilla</th>
                <th>Categoría</th>
                <th>Frecuencia</th>
                <th className="num">Importe</th>
                <th>Último emitido</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {recurrentes.map((r) => (
                <tr key={r.id} className={r.activo ? "" : "muted-row"}>
                  <td>
                    {r.descripcion}
                    <span className="egr-sub">
                      {r.proveedorNombre ?? "sin proveedor"} · vence el día{" "}
                      {r.diaVencimiento}
                      {r.gastoFijoNombre
                        ? ` · presupuestado: ${r.gastoFijoNombre}`
                        : ""}
                    </span>
                  </td>
                  <td>{r.categoriaNombre}</td>
                  <td>{FRECUENCIA_LABELS[r.frecuencia] ?? r.frecuencia}</td>
                  <td className="num mono">
                    {fmt(r.monto)}
                    <span className="egr-sub">sugerido</span>
                  </td>
                  <td className="mono">
                    {r.ultimoPeriodoGenerado ?? "—"}
                    <span className="egr-sub">
                      {r.egresosEmitidos} emitido
                      {r.egresosEmitidos === 1 ? "" : "s"}
                    </span>
                  </td>
                  <td>
                    {puedeGestionar ? (
                      <button
                        type="button"
                        className="egr-link"
                        onClick={async () => {
                          await editarRecurrente(r.id, { activo: !r.activo });
                          onCambio();
                        }}
                      >
                        {r.activo ? "Desactivar" : "Activar"}
                      </button>
                    ) : (
                      <span className={`egr-badge ${r.activo ? "" : "anulado"}`}>
                        {r.activo ? "Activa" : "Inactiva"}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {alta ? (
        <div className="egr-modal-bg" role="dialog" aria-modal="true">
          <div className="egr-modal egr-modal-sm">
            <div className="egr-modal-head">
              <h2>Nueva plantilla</h2>
              <button
                type="button"
                className="egr-x"
                onClick={() => setAlta(false)}
              >
                ×
              </button>
            </div>
            <div className="egr-modal-body">
              <div className="egr-grid">
                <label className="egr-f egr-f-wide">
                  <span>Descripción</span>
                  <input
                    value={descripcion}
                    onChange={(e) => setDescripcion(e.target.value)}
                    placeholder="Alquiler del galpón, Internet, Contador…"
                  />
                </label>
                <label className="egr-f">
                  <span>Categoría</span>
                  <select
                    className="egr-select"
                    value={categoriaId}
                    onChange={(e) => setCategoriaId(e.target.value)}
                  >
                    {activas.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="egr-f">
                  <span>Proveedor</span>
                  <select
                    className="egr-select"
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
                <label className="egr-f">
                  <span>Importe sugerido</span>
                  <CampoMonto
                    valor={monto}
                    onCambio={setMonto}
                    ariaLabel="Importe sugerido"
                  />
                  <small className="egr-hint">
                    Se puede corregir mes a mes: la luz nunca es igual.
                  </small>
                </label>
                <label className="egr-f">
                  <span>Frecuencia</span>
                  <select
                    className="egr-select"
                    value={frecuencia}
                    onChange={(e) => setFrecuencia(e.target.value)}
                  >
                    {FRECUENCIAS_RECURRENTE.map((f) => (
                      <option key={f} value={f}>
                        {FRECUENCIA_LABELS[f]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="egr-f">
                  <span>Vence el día</span>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={dia}
                    onChange={(e) =>
                      setDia(
                        Math.max(1, Math.min(31, Number(e.target.value) || 1)),
                      )
                    }
                  />
                  <small className="egr-hint">
                    El 31 en un mes corto cae el último día.
                  </small>
                </label>
                <label className="egr-f">
                  <span>Desde</span>
                  <input
                    type="month"
                    value={desde}
                    onChange={(e) => setDesde(e.target.value)}
                  />
                </label>
              </div>
            </div>
            <div className="egr-modal-foot">
              <button
                type="button"
                className="btn"
                onClick={() => setAlta(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={
                  descripcion.trim().length < 2 || !categoriaId || monto <= 0
                }
                onClick={() => void guardar()}
              >
                Crear
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Saldo por proveedor con antigüedad (journey E2) — el espejo de la matriz de
 * deudores, del otro lado del mostrador.
 */
function SaldosProveedores({
  saldos,
  fmt,
}: {
  saldos: SaldoProveedor[] | null;
  fmt: (v: number) => string;
}) {
  if (!saldos) return <div className="egr-cargando">Calculando saldos…</div>;
  if (saldos.length === 0) {
    return (
      <div className="egr-empty">
        <div className="ttl">No le debés nada a nadie</div>
        <div className="sub">
          Acá vas a ver la deuda de cada proveedor repartida por antigüedad.
        </div>
      </div>
    );
  }
  const totales = TRAMOS_AGING.map((t) =>
    saldos.reduce((acc, p) => acc + p.aging[t], 0),
  );
  const total = saldos.reduce((acc, p) => acc + p.total, 0);
  return (
    <div className="egr-tabla-wrap">
      <table className="egr-tabla">
        <thead>
          <tr>
            <th>Proveedor</th>
            {TRAMOS_AGING.map((t) => (
              <th key={t} className="num">
                {TRAMO_AGING_LABELS[t]}
              </th>
            ))}
            <th className="num">Total</th>
          </tr>
        </thead>
        <tbody>
          {saldos.map((p) => (
            <tr key={p.proveedorId ?? "sin"}>
              <td>
                {p.nombre}
                <span className="egr-sub">
                  {p.cuit ? `CUIT ${p.cuit} · ` : ""}
                  {p.egresos} egreso{p.egresos === 1 ? "" : "s"}
                </span>
              </td>
              {TRAMOS_AGING.map((t) => (
                <td
                  key={t}
                  className={`num mono ${
                    /* Lo vencido hace más de 60 días es el KPI de riesgo. */
                    (t === "d61_90" || t === "d90_mas") && p.aging[t] > 0
                      ? "egr-mal"
                      : ""
                  }`}
                >
                  {p.aging[t] > 0 ? fmt(p.aging[t]) : "—"}
                </td>
              ))}
              <td className="num mono strong">{fmt(p.total)}</td>
            </tr>
          ))}
          <tr className="egr-fila-total">
            <td className="strong">Total</td>
            {totales.map((v, i) => (
              <td key={TRAMOS_AGING[i]} className="num mono">
                {v > 0 ? fmt(v) : "—"}
              </td>
            ))}
            <td className="num mono strong">{fmt(total)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/**
 * "¿En qué se me va la plata?" (journey E3).
 *
 * Separa lo que es GASTO del período de lo que sólo movió caja. Sin esa
 * separación, el mes en que se compra una guillotina parece catastrófico, un
 * retiro de socios se lee como gasto, y el adelanto de sueldo se cuenta dos
 * veces (el adelanto y después el sueldo).
 */
function Analisis({
  reporte,
  presu,
  fmt,
}: {
  reporte: ReporteEgresos | null;
  presu: PresupuestadoVsReal | null;
  fmt: (v: number) => string;
}) {
  if (!reporte) {
    return <div className="egr-cargando">Calculando el período…</div>;
  }
  if (reporte.egresos === 0) {
    return (
      <div className="egr-empty">
        <div className="ttl">Sin egresos en el período</div>
        <div className="sub">
          El análisis agrupa por fecha de competencia — el mes al que pertenece
          el gasto, no el día en que se pagó.
        </div>
      </div>
    );
  }
  const noEsGasto = reporte.totalSalida - reporte.totalResultado;
  return (
    <div className="egr-analisis">
      <div className="egr-kpis">
        <div className="egr-kpi">
          <span className="l">Gasto del período</span>
          <span className="v">{fmt(reporte.totalResultado)}</span>
          <span className="h">costo de producción + estructura</span>
        </div>
        <div className="egr-kpi">
          <span className="l">Salió de la caja</span>
          <span className="v">{fmt(reporte.totalSalida)}</span>
          <span className="h">{reporte.egresos} egresos</span>
        </div>
        <div className="egr-kpi">
          <span className="l">No es gasto</span>
          <span className="v">{fmt(noEsGasto)}</span>
          <span className="h">inversión, retiros, adelantos</span>
        </div>
        <div className="egr-kpi">
          <span className="l">Período</span>
          <span className="v egr-periodo">{reporte.desde}</span>
          <span className="h">al {reporte.hasta} · por competencia</span>
        </div>
      </div>

      {presu && presu.lineas.length > 0 ? (
        <section className="egr-panel">
          <div className="egr-panel-t">
            Presupuestado vs. real de la estructura · {presu.periodo}
          </div>
          <div className="egr-tabla-wrap">
            <table className="egr-tabla">
              <thead>
                <tr>
                  <th>Gasto fijo</th>
                  <th className="num">Presupuestado</th>
                  <th className="num">Real</th>
                  <th className="num">Desvío</th>
                </tr>
              </thead>
              <tbody>
                {presu.lineas.map((l) => (
                  <tr key={l.gastoFijoId} className={l.sinRegistrar ? "muted-row" : ""}>
                    <td>
                      {l.nombre}
                      {l.sinRegistrar ? (
                        <span className="egr-sub">sin egresos este mes</span>
                      ) : null}
                    </td>
                    <td className="num mono">{fmt(l.presupuestado)}</td>
                    <td className="num mono">
                      {l.sinRegistrar ? "—" : fmt(l.real)}
                    </td>
                    <td
                      className={`num mono ${
                        l.sinRegistrar ? "" : l.desvio > 0 ? "egr-mal" : ""
                      }`}
                    >
                      {l.sinRegistrar ? (
                        "—"
                      ) : (
                        <>
                          {l.desvio >= 0 ? "+" : "−"}
                          {fmt(Math.abs(l.desvio))}
                          {l.desvioPct != null ? (
                            <span className="egr-sub">
                              {l.desvioPct >= 0 ? "+" : "−"}
                              {pct1(Math.abs(l.desvioPct))}%
                            </span>
                          ) : null}
                        </>
                      )}
                    </td>
                  </tr>
                ))}
                <tr className="egr-fila-total">
                  <td className="strong">Total con registro</td>
                  <td className="num mono strong">{fmt(presu.presupuestado)}</td>
                  <td className="num mono strong">{fmt(presu.real)}</td>
                  <td
                    className={`num mono strong ${presu.desvio > 0 ? "egr-mal" : ""}`}
                  >
                    {presu.desvio >= 0 ? "+" : "−"}
                    {fmt(Math.abs(presu.desvio))}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          {/* Comparar contra cero un gasto que nadie registró mostraría un
              ahorro que no existe: se listan pero no suman. */}
          {presu.sinRegistrar > 0 ? (
            <div className="egr-nota-inline">
              {presu.sinRegistrar} gasto
              {presu.sinRegistrar === 1 ? "" : "s"} fijo
              {presu.sinRegistrar === 1 ? "" : "s"} todavía sin egresos este mes:
              se listan pero no entran en el total, porque compararlos contra
              cero mostraría un ahorro que no existe.
            </div>
          ) : null}
        </section>
      ) : null}

      <div className="egr-analisis-cols">
        <section className="egr-panel">
          <div className="egr-panel-t">Por naturaleza</div>
          {reporte.naturalezas.map((n) => (
            <div className="egr-linea" key={n.naturaleza}>
              <span className="egr-linea-n">
                {NATURALEZA_LABELS[n.naturaleza]}
                {!n.incideEnResultado ? (
                  <small>no es gasto del período</small>
                ) : null}
              </span>
              <span className="egr-linea-b">
                <span
                  className={`egr-linea-f ${n.incideEnResultado ? "" : "off"}`}
                  style={{ width: `${n.pct}%` }}
                />
              </span>
              <span className="egr-linea-p mono">{n.pct}%</span>
              <span className="egr-linea-m mono">{fmt(n.monto)}</span>
            </div>
          ))}
        </section>

        <section className="egr-panel">
          <div className="egr-panel-t">Por categoría</div>
          {reporte.categorias.map((c) => (
            <div className="egr-linea" key={c.categoriaId}>
              <span className="egr-linea-n">
                {c.nombre}
                <small>
                  {c.egresos} egreso{c.egresos === 1 ? "" : "s"}
                </small>
              </span>
              <span className="egr-linea-b">
                <span
                  className="egr-linea-f"
                  style={{ width: `${c.pct}%` }}
                />
              </span>
              <span className="egr-linea-p mono">{c.pct}%</span>
              <span className="egr-linea-m mono">{fmt(c.monto)}</span>
            </div>
          ))}
        </section>
      </div>
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
  const [cuotas, setCuotas] = React.useState(1);
  const [guardando, setGuardando] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const categoria = activas.find((c) => c.id === categoriaId);
  const total = neto + iva;

  const proveedorElegido = proveedores.find((p) => p.id === proveedorId);

  // El plazo del proveedor precarga el vencimiento: es el dato por el que se
  // carga en el maestro. `0` es contado y también es una respuesta, así que se
  // aplica igual (vence hoy) en vez de ignorarse como si no estuviera.
  React.useEffect(() => {
    const dias = proveedorElegido?.condicionPagoDias;
    if (dias != null) setVencimiento(sumarDias(hoy, dias));
  }, [proveedorElegido, hoy]);

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
        if (cuotas > 1) body.cuotas = cuotas;
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
                {proveedorElegido?.condicionPagoDias != null ? (
                  <small className="egr-hint">
                    {proveedorElegido.condicionPagoDias === 0
                      ? `${proveedorElegido.nombre} es de contado.`
                      : `${proveedorElegido.nombre} da ${proveedorElegido.condicionPagoDias} días.`}
                  </small>
                ) : null}
              </label>
            ) : null}

            {!yaPagado ? (
              <label className="egr-f">
                <span>Cuotas</span>
                <input
                  type="number"
                  min={1}
                  max={36}
                  value={cuotas}
                  onChange={(e) =>
                    setCuotas(Math.max(1, Math.min(36, Number(e.target.value) || 1)))
                  }
                />
                {cuotas > 1 ? (
                  <small className="egr-hint">
                    {cuotas} egresos, uno por mes desde el vencimiento. Cada uno
                    se paga por separado.
                  </small>
                ) : null}
              </label>
            ) : null}

            {/* El importe y el documento van juntos en su propia sub-grilla y
                no sueltos en la grilla de 2 columnas: arriba hay campos
                condicionales (beneficiario, vencimiento) y según cuáles se
                muestren, estos tres caerían corridos de fila. */}
            <div className="egr-sub egr-sub-3">
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
            </div>

            {tipoComprobante !== "SIN_DOCUMENTO" ? (
              <div className="egr-sub egr-sub-2">
                <label className="egr-f">
                  <span>Punto de venta</span>
                  <input
                    value={puntoVenta}
                    onChange={(e) => setPuntoVenta(e.target.value)}
                    placeholder="0001"
                  />
                </label>
                <label className="egr-f">
                  <span>Número</span>
                  <input
                    value={numeroComprobante}
                    onChange={(e) => setNumeroComprobante(e.target.value)}
                    placeholder="00012345"
                  />
                </label>
              </div>
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
  const [retenciones, setRetenciones] = React.useState<
    Array<{ regimen: string; monto: number }>
  >([]);
  const [chequeNumero, setChequeNumero] = React.useState("");
  const [chequeBanco, setChequeBanco] = React.useState("");
  const [chequeFormato, setChequeFormato] = React.useState("echeq");
  const [chequeFechaPago, setChequeFechaPago] = React.useState("");
  const [guardando, setGuardando] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const metodo = metodosPago.find((m) => m.id === metodoPagoId);
  const esCheque = metodo?.tipo === "cheque_echeq";
  const total = egresos.reduce((acc, e) => acc + (montos[e.id] ?? 0), 0);
  const retencionesTotal = retenciones.reduce((acc, r) => acc + r.monto, 0);
  // Lo que realmente sale de la cuenta: lo retenido se deposita al fisco.
  const neto = total - retencionesTotal;
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
        retenciones: retenciones
          .filter((r) => r.monto > 0)
          .map((r) => ({
            regimen: r.regimen,
            // La base es el total del pago y la alícuota se deriva: al
            // administrativo le llega el MONTO en el certificado, no el %.
            base: total,
            alicuota: total > 0 ? Math.round((r.monto / total) * 100000) / 1000 : 0,
            monto: r.monto,
          })),
        cheque: esCheque
          ? {
              numero: chequeNumero.trim(),
              banco: chequeBanco.trim(),
              formato: chequeFormato,
              fechaPago: chequeFechaPago || undefined,
            }
          : undefined,
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

          {esCheque ? (
            <div className="egr-sub-bloque">
              <div className="egr-panel-t">Cheque propio</div>
              <div className="egr-grid">
                <label className="egr-f">
                  <span>Número</span>
                  <input
                    value={chequeNumero}
                    onChange={(e) => setChequeNumero(e.target.value)}
                    placeholder="00012345"
                  />
                </label>
                <label className="egr-f">
                  <span>Banco</span>
                  <input
                    value={chequeBanco}
                    onChange={(e) => setChequeBanco(e.target.value)}
                    placeholder="Galicia"
                  />
                </label>
                <label className="egr-f">
                  <span>Formato</span>
                  <select
                    className="egr-select"
                    value={chequeFormato}
                    onChange={(e) => setChequeFormato(e.target.value)}
                  >
                    <option value="echeq">e-cheq</option>
                    <option value="fisico">Físico</option>
                  </select>
                </label>
                <label className="egr-f">
                  <span>Fecha de pago</span>
                  <input
                    type="date"
                    value={chequeFechaPago}
                    onChange={(e) => setChequeFechaPago(e.target.value)}
                  />
                  <small className="egr-hint">
                    Con fecha futura es diferido.
                  </small>
                </label>
              </div>
              <div className="egr-nota-inline">
                La factura queda saldada, pero la plata no sale de la cuenta
                hasta que el banco lo debite.
              </div>
            </div>
          ) : null}

          <div className="egr-sub-bloque">
            <div className="egr-panel-t">
              Retenciones practicadas
              <button
                type="button"
                className="egr-link egr-mini"
                onClick={() =>
                  setRetenciones((prev) => [
                    ...prev,
                    { regimen: "SICORE_GANANCIAS", monto: 0 },
                  ])
                }
              >
                + Agregar
              </button>
            </div>
            {retenciones.length === 0 ? (
              <div className="egr-sub">
                Sin retenciones: sale el total del pago.
              </div>
            ) : (
              retenciones.map((r, i) => (
                <div className="egr-ret-fila" key={i}>
                  <select
                    className="egr-select"
                    value={r.regimen}
                    onChange={(e) =>
                      setRetenciones((prev) =>
                        prev.map((x, j) =>
                          j === i ? { ...x, regimen: e.target.value } : x,
                        ),
                      )
                    }
                  >
                    {REGIMENES_RETENCION.map((g) => (
                      <option key={g} value={g}>
                        {REGIMEN_RETENCION_LABELS[g]}
                      </option>
                    ))}
                  </select>
                  <CampoMonto
                    valor={r.monto}
                    onCambio={(v) =>
                      setRetenciones((prev) =>
                        prev.map((x, j) => (j === i ? { ...x, monto: v } : x)),
                      )
                    }
                    ariaLabel="Monto retenido"
                  />
                  <button
                    type="button"
                    className="egr-link"
                    onClick={() =>
                      setRetenciones((prev) => prev.filter((_, j) => j !== i))
                    }
                  >
                    Quitar
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="egr-total">
            <span>
              {retencionesTotal > 0 ? "Sale de la cuenta" : "Total del pago"}
            </span>
            <strong className="mono">{fmt(neto)}</strong>
          </div>
          {retencionesTotal > 0 ? (
            <div className="egr-nota-inline">
              Se saldan {fmt(total)} de deuda; {fmt(retencionesTotal)} quedan
              retenidos para depositar al fisco.
            </div>
          ) : null}

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
            disabled={
              guardando ||
              total <= 0 ||
              excede ||
              retencionesTotal > total ||
              (esCheque && (!chequeNumero.trim() || !chequeBanco.trim()))
            }
            onClick={() => void guardar()}
          >
            {guardando
              ? "Registrando…"
              : esCheque
                ? `Emitir cheque por ${fmt(neto)}`
                : `Pagar ${fmt(neto)}`}
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
  const [archivos, setArchivos] = React.useState<Archivo[]>([]);
  const [anulandoPago, setAnulandoPago] = React.useState<PagoDeEgreso | null>(
    null,
  );

  const cargar = React.useCallback(() => {
    getPagosDeEgreso(egreso.id)
      .then((r) => setPagos(r.pagos))
      .catch(() => setPagos([]));
    listarArchivos("EGRESO", egreso.id)
      .then(setArchivos)
      .catch(() => setArchivos([]));
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
            <div className="egr-pagos-t">Factura escaneada</div>
            <ArchivoUploader
              scope="EGRESO"
              entidadId={egreso.id}
              archivos={archivos}
              onCambio={setArchivos}
              soloLectura={!puedeAnular && egreso.estado === "anulado"}
              titulo="Arrastrá la factura del proveedor"
              vacio="Sin la factura adjunta."
            />
          </div>

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
                  {!p.anuladoEl ? (
                    <a
                      className="egr-link"
                      href={`/api/backend/egresos/pagos/${p.id}/orden-pago.pdf`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Orden de pago
                    </a>
                  ) : null}
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
