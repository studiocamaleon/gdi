"use client";
import { CuentaDialog } from "./cuenta-fondos-dialog";
import { useCapacidad } from "@/components/navigation/capacidades-provider";
import { usePuede } from "@/components/navigation/permisos-provider";
import { crearCuentaFondos, getCuentasFondos } from "@/lib/administracion-api";
import {
  ConfiguracionPage,
  ConfiguracionHeader,
} from "@/components/configuracion/configuracion-workspace";
import { ActionButton } from "@/components/design-system/action-button";
import { FormSheet } from "@/components/design-system/form-sheet";
import configStyles from "@/components/configuracion/configuracion-workspace.module.css";

import * as React from "react";
import {
  CheckIcon,
  CreditCardIcon,
  LandmarkIcon,
  MoreHorizontalIcon,
  PlusIcon,
  SearchIcon,
  ShieldCheckIcon,
} from "lucide-react";
import { toast } from "sonner";

import {
  METODO_PAGO_TIPOS,
  METODO_PAGO_TIPO_LABELS,
  plazoAcreditacionLabel,
  simularMetodo,
  type CuentaFondosResumen,
  type MetodoPago,
  type MetodoPagoTipo,
} from "@/lib/administracion";
import {
  createMetodoPago,
  instalarCatalogoMetodosPago,
  getMetodosPago,
  updateMetodoPago,
  type UpsertMetodoPagoPayload,
} from "@/lib/administracion-api";
import { useConfigRegional } from "@/components/navigation/config-regional-provider";
import { formatearMoneda } from "@/lib/moneda";

const BASE_SIMULACION = 100_000;

/** El formateador de la vista, en la moneda del tenant (fila y sheet lo usan). */
function useFmt() {
  const { moneda } = useConfigRegional();
  return (n: number) => formatearMoneda(n, moneda, { decimales: 0 });
}

type SheetDraft = UpsertMetodoPagoPayload & { id?: string };

function draftDesdeMetodo(metodo: MetodoPago): SheetDraft {
  return {
    id: metodo.id,
    nombre: metodo.nombre,
    tipo: metodo.tipo,
    comisionPct: metodo.comisionPct,
    ivaComisionPct: metodo.ivaComisionPct,
    plazoAcreditacionDias: metodo.plazoAcreditacionDias,
    sufreRetencion: metodo.sufreRetencion,
    cuentaDestinoId: metodo.cuentaDestinoId,
    activo: metodo.activo,
  };
}

function draftNuevo(): SheetDraft {
  return {
    nombre: "",
    tipo: "transferencia",
    comisionPct: 0,
    ivaComisionPct: 0,
    plazoAcreditacionDias: 0,
    sufreRetencion: false,
    cuentaDestinoId: null,
    activo: true,
  };
}

function FilaMetodo({
  metodo,
  abierto,
  onToggleAbierto,
  onEditar,
}: {
  metodo: MetodoPago;
  abierto: boolean;
  onToggleAbierto: () => void;
  onEditar: () => void;
}) {
  const fmt = useFmt();
  const sim = simularMetodo(metodo, BASE_SIMULACION);
  return (
    <>
      <div
        className={`apm-tr apm-row ${abierto ? "open" : ""} ${metodo.activo ? "" : "off"}`}
        onClick={onToggleAbierto}
      >
        <span>
          <button
            type="button"
            className={configStyles.expandButton}
            aria-label={`Ver detalle de ${metodo.nombre}`}
            aria-expanded={abierto}
            onClick={(event) => {
              event.stopPropagation();
              onToggleAbierto();
            }}
          >
            <svg
              className="apm-chev"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m9 6 6 6-6 6" />
            </svg>
          </button>
        </span>
        <span className="apm-name">
          <span className="nm">
            {metodo.nombre}{" "}
            <span className="tag">{METODO_PAGO_TIPO_LABELS[metodo.tipo]}</span>
          </span>
          <span className="acct">
            <LandmarkIcon />
            {metodo.tipo === "cheque_echeq"
              ? "Cuenta al depositar"
              : (metodo.cuentaDestinoNombre ?? "Sin cuenta destino")}
          </span>
        </span>
        <span className="apm-pct mono">
          {metodo.comisionPct === 0 ? (
            <span className="z">0%</span>
          ) : (
            `${metodo.comisionPct}%`
          )}
        </span>
        <span className="apm-pct mono">
          {metodo.ivaComisionPct === 0 ? (
            <span className="z">—</span>
          ) : (
            `${metodo.ivaComisionPct}%`
          )}
        </span>
        <span className="apm-plazo">
          {metodo.plazoAcreditacionDias === 0 ? (
            <span className="inst">Inmediato</span>
          ) : (
            `${metodo.plazoAcreditacionDias} d`
          )}
        </span>
        <span>
          {metodo.sufreRetencion ? (
            <span className="apm-ret-y">
              <ShieldCheckIcon />
              Sufre ret.
            </span>
          ) : (
            <span className="apm-ret-n">No</span>
          )}
        </span>
        <span>
          <span className={`apm-state ${metodo.activo ? "on" : "off"}`}>
            <span className="d" />
            {metodo.activo ? "Activo" : "Inactivo"}
          </span>
        </span>
        <span>
          <button
            type="button"
            className="apm-rowmenu"
            onClick={(event) => {
              event.stopPropagation();
              onEditar();
            }}
            title="Editar"
            aria-label={`Editar ${metodo.nombre}`}
          >
            <MoreHorizontalIcon />
          </button>
        </span>
      </div>
      {abierto ? (
        <div className="apm-exp">
          <div className="apm-exp-in">
            <div className="apm-calc-flow">
              <div className="apm-calc-step">
                <span className="l">Cobrás</span>
                <span className="v">{fmt(sim.base)}</span>
              </div>
              {sim.comision > 0 ? (
                <>
                  <span className="apm-calc-arrow">−</span>
                  <div className="apm-calc-step neg">
                    <span className="l">Comisión {metodo.comisionPct}%</span>
                    <span className="v">{fmt(sim.comision)}</span>
                  </div>
                </>
              ) : null}
              {sim.ivaComision > 0 ? (
                <>
                  <span className="apm-calc-arrow">−</span>
                  <div className="apm-calc-step neg">
                    <span className="l">IVA s/com.</span>
                    <span className="v">{fmt(sim.ivaComision)}</span>
                  </div>
                </>
              ) : null}
              <span className="apm-calc-arrow">→</span>
              <div className="apm-calc-step net">
                <span className="l">Neto acreditado</span>
                <span className="v">{fmt(sim.neto)}</span>
              </div>
            </div>
            <div className="apm-calc-note">
              Sobre <b>{fmt(sim.base)}</b> acreditás <b>{fmt(sim.neto)}</b>
              <br />
              {plazoAcreditacionLabel(metodo.plazoAcreditacionDias)}
              {metodo.sufreRetencion ? " · aplica retención" : ""}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function SheetMetodo({
  draft,
  cuentas,
  guardando,
  onClose,
  onSave,
}: {
  draft: SheetDraft;
  cuentas: CuentaFondosResumen[];
  guardando: boolean;
  onClose: () => void;
  onSave: (draft: SheetDraft) => void;
}) {
  const conValores = useCapacidad("valores");
  const fmt = useFmt();
  const [form, setForm] = React.useState<SheetDraft>(draft);
  const sim = simularMetodo(form, BASE_SIMULACION);
  const esCheque = form.tipo === "cheque_echeq";
  const set = <K extends keyof SheetDraft>(campo: K, valor: SheetDraft[K]) =>
    setForm((prev) => ({ ...prev, [campo]: valor }));
  const seleccionarTipo = (tipo: MetodoPagoTipo) =>
    setForm((prev) => ({
      ...prev,
      tipo,
      cuentaDestinoId: tipo === "cheque_echeq" ? null : prev.cuentaDestinoId,
    }));
  const esNuevo = !draft.id;

  return (
    <FormSheet
      title={esNuevo ? "Nuevo método de pago" : "Editar método de pago"}
      description="Comisiones, acreditación y cuenta de destino."
      onClose={onClose}
      busy={guardando}
      className={configStyles.paymentSheet}
      footer={
        <div className="apm-sheet-foot">
          <ActionButton
            variant="outline"
            isDisabled={guardando}
            onPress={onClose}
          >
            Cancelar
          </ActionButton>
          <ActionButton
            variant="primary"
            isDisabled={guardando || !form.nombre.trim()}
            onPress={() => onSave(form)}
          >
            <CheckIcon />
            {guardando
              ? "Guardando…"
              : esNuevo
                ? "Crear método"
                : "Guardar cambios"}
          </ActionButton>
        </div>
      }
    >
      <div className="apm-sheet-body">
        <div className="apm-field">
          <label htmlFor="metodo-nombre">Nombre</label>
          <input
            id="metodo-nombre"
            value={form.nombre}
            onChange={(e) => set("nombre", e.target.value)}
            placeholder="Ej. Transferencia bancaria"
          />
        </div>
        <div className="apm-field">
          <label htmlFor="metodo-tipo">Tipo</label>
          <select
            id="metodo-tipo"
            value={form.tipo}
            onChange={(e) => seleccionarTipo(e.target.value as MetodoPagoTipo)}
          >
            {METODO_PAGO_TIPOS.filter(
              (tipo) => conValores || tipo !== "cheque_echeq",
            ).map((tipo) => (
              <option key={tipo} value={tipo}>
                {METODO_PAGO_TIPO_LABELS[tipo]}
              </option>
            ))}
          </select>
        </div>
        <div className="apm-field-row">
          <div className="apm-field">
            <label htmlFor="metodo-comisionPct">Comisión</label>
            <div className="apm-suffix">
              <input
                type="number"
                step="0.01"
                min="0"
                id="metodo-comisionPct"
                value={form.comisionPct}
                onChange={(e) => set("comisionPct", +e.target.value || 0)}
              />
              <span className="s">%</span>
            </div>
          </div>
          <div className="apm-field">
            <label htmlFor="metodo-ivaComisionPct">IVA s/ comisión</label>
            <div className="apm-suffix">
              <input
                type="number"
                min="0"
                id="metodo-ivaComisionPct"
                value={form.ivaComisionPct}
                onChange={(e) => set("ivaComisionPct", +e.target.value || 0)}
              />
              <span className="s">%</span>
            </div>
          </div>
        </div>
        <div className="apm-field-row">
          <div className="apm-field">
            <label htmlFor="metodo-plazoAcreditacionDias">
              Plazo de acreditación
            </label>
            <div className="apm-suffix">
              <input
                type="number"
                min="0"
                id="metodo-plazoAcreditacionDias"
                value={form.plazoAcreditacionDias}
                onChange={(e) =>
                  set("plazoAcreditacionDias", +e.target.value || 0)
                }
              />
              <span className="s">días</span>
            </div>
          </div>
          <div className="apm-field">
            <label htmlFor="metodo-cuentaDestinoId">Cuenta destino</label>
            {esCheque ? (
              <input
                id="metodo-cuentaDestinoId"
                value="Se elige al depositar el valor"
                disabled
                aria-label="La cuenta destino se elige al depositar"
              />
            ) : (
              <select
                id="metodo-cuentaDestinoId"
                value={form.cuentaDestinoId ?? ""}
                onChange={(e) => set("cuentaDestinoId", e.target.value || null)}
              >
                <option value="">Sin cuenta destino</option>
                {cuentas.map((cuenta) => (
                  <option key={cuenta.id} value={cuenta.id}>
                    {cuenta.nombre}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
        <div className="apm-toggle-field">
          <div>
            <div className="t">Sufre retención</div>
            <div className="s">SIRCREB, IIBB, ganancias u otros regímenes.</div>
          </div>
          <button
            type="button"
            className={`apm-sw ${form.sufreRetencion ? "on" : ""}`}
            onClick={() => set("sufreRetencion", !form.sufreRetencion)}
            role="switch"
            aria-checked={form.sufreRetencion}
            aria-label="Sufre retención"
          />
        </div>
        <div className="apm-toggle-field">
          <div>
            <div className="t">Método activo</div>
            <div className="s">Disponible al registrar cobros.</div>
          </div>
          <button
            type="button"
            className={`apm-sw ${form.activo ? "on" : ""}`}
            onClick={() => set("activo", !form.activo)}
            role="switch"
            aria-checked={form.activo}
            aria-label="Método activo"
          />
        </div>
        <div className="apm-sheet-calc">
          <div className="cl">Simulación sobre {fmt(BASE_SIMULACION)}</div>
          <div className="apm-sc-row">
            <span className="l">Bruto cobrado</span>
            <span className="v">{fmt(sim.base)}</span>
          </div>
          {sim.comision > 0 ? (
            <div className="apm-sc-row neg">
              <span className="l">− Comisión ({form.comisionPct}%)</span>
              <span className="v">−{fmt(sim.comision)}</span>
            </div>
          ) : null}
          {sim.ivaComision > 0 ? (
            <div className="apm-sc-row neg">
              <span className="l">− IVA sobre comisión</span>
              <span className="v">−{fmt(sim.ivaComision)}</span>
            </div>
          ) : null}
          <div className="apm-sc-row total">
            <span className="l">
              Neto acreditado ·{" "}
              {plazoAcreditacionLabel(form.plazoAcreditacionDias)}
            </span>
            <span className="v">{fmt(sim.neto)}</span>
          </div>
        </div>
      </div>
    </FormSheet>
  );
}

export function MetodosPagoView({
  initialMetodos,
  initialCuentas,
}: {
  initialMetodos: MetodoPago[];
  initialCuentas: CuentaFondosResumen[];
}) {
  const [metodos, setMetodos] = React.useState(initialMetodos);
  const [cuentas, setCuentas] = React.useState(initialCuentas);
  const conValores = useCapacidad("valores");
  const puedeCrearCuenta = usePuede("administracion.gestionar");
  const { moneda } = useConfigRegional();
  const [nuevaCuenta, setNuevaCuenta] = React.useState(false);
  const [guardandoCuenta, setGuardandoCuenta] = React.useState(false);
  const [busqueda, setBusqueda] = React.useState("");
  const [tab, setTab] = React.useState<"todos" | "activos" | "inactivos">(
    "todos",
  );
  const [abiertoId, setAbiertoId] = React.useState<string | null>(null);
  const [sheet, setSheet] = React.useState<SheetDraft | null>(null);
  const [guardando, setGuardando] = React.useState(false);
  const [instalando, setInstalando] = React.useState(false);

  const lista = React.useMemo(
    () =>
      metodos.filter((metodo) => {
        if (!conValores && metodo.tipo === "cheque_echeq") return false;
        if (tab === "activos" && !metodo.activo) return false;
        if (tab === "inactivos" && metodo.activo) return false;
        if (busqueda) {
          const s =
            `${metodo.nombre} ${METODO_PAGO_TIPO_LABELS[metodo.tipo]} ${metodo.cuentaDestinoNombre ?? ""}`.toLowerCase();
          if (!s.includes(busqueda.toLowerCase())) return false;
        }
        return true;
      }),
    [metodos, tab, busqueda, conValores],
  );

  const guardar = async (draft: SheetDraft) => {
    setGuardando(true);
    try {
      const payload: UpsertMetodoPagoPayload = {
        nombre: draft.nombre.trim(),
        tipo: draft.tipo,
        comisionPct: draft.comisionPct,
        ivaComisionPct: draft.ivaComisionPct,
        plazoAcreditacionDias: draft.plazoAcreditacionDias,
        sufreRetencion: draft.sufreRetencion,
        cuentaDestinoId:
          draft.tipo === "cheque_echeq"
            ? null
            : (draft.cuentaDestinoId ?? null),
        activo: draft.activo,
      };
      const guardado = draft.id
        ? await updateMetodoPago(draft.id, payload)
        : await createMetodoPago(payload);
      setMetodos((current) =>
        draft.id
          ? current.map((m) => (m.id === guardado.id ? guardado : m))
          : [...current, guardado],
      );
      setSheet(null);
      toast.success(draft.id ? "Método actualizado." : "Método creado.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo guardar el método.",
      );
    } finally {
      setGuardando(false);
    }
  };

  const instalarCatalogo = async () => {
    setInstalando(true);
    try {
      const resultado = await instalarCatalogoMetodosPago();
      const actualizados = await getMetodosPago();
      setMetodos(actualizados);
      toast.success(
        resultado.creados > 0
          ? `Catálogo instalado: ${resultado.creados} métodos sugeridos.`
          : "El catálogo sugerido ya estaba instalado.",
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo instalar el catálogo.",
      );
    } finally {
      setInstalando(false);
    }
  };

  return (
    <ConfiguracionPage>
      <div className="apm-wrap">
        <ConfiguracionHeader
          titulo="Métodos de pago"
          descripcion="Medios de cobro, comisiones y plazos de acreditación."
          acciones={
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setSheet(draftNuevo())}
            >
              <PlusIcon />
              Nuevo método
            </button>
          }
        />

        {puedeCrearCuenta && (
          <div className="apm-concept">
            <div className="c">
              <strong>Cuentas de cobro</strong>
              <p>
                {cuentas.length
                  ? cuentas.map((c) => c.nombre).join(" · ")
                  : "Agregá una caja, banco o billetera para recibir los cobros."}
              </p>
            </div>
            <ActionButton
              variant="outline"
              onPress={() => setNuevaCuenta(true)}
            >
              <PlusIcon /> Agregar cuenta
            </ActionButton>
          </div>
        )}
        {nuevaCuenta && (
          <CuentaDialog
            open
            monedaLocal={moneda.codigo}
            ocupado={guardandoCuenta}
            onOpenChange={(open) => !guardandoCuenta && setNuevaCuenta(open)}
            onGuardar={async (payload) => {
              setGuardandoCuenta(true);
              try {
                await crearCuentaFondos(payload);
                setNuevaCuenta(false);
                setCuentas(await getCuentasFondos());
                toast.success("Cuenta de cobro creada.");
              } catch (error) {
                toast.error(
                  error instanceof Error
                    ? error.message
                    : "No se pudo guardar la cuenta.",
                );
              } finally {
                setGuardandoCuenta(false);
              }
            }}
          />
        )}
        <div className="apm-concept">
          <div className="c">
            <div className="n">
              <span className="dot" style={{ background: "var(--ink)" }} />
              Facturado
            </div>
            <div className="d">
              Lo que factura la orden. <b>El total nominal</b> del comprobante.
            </div>
          </div>
          <div className="c">
            <div className="n">
              <span
                className="dot"
                style={{ background: "var(--accent-soft-foreground)" }}
              />
              Neto acreditado
            </div>
            <div className="d">
              Lo que <b>entra a la cuenta</b> tras comisión e IVA del método.
            </div>
          </div>
          <div className="c">
            <div className="n">
              <span className="dot" style={{ background: "var(--ok)" }} />
              Disponible real
            </div>
            <div className="d">
              Neto menos <b>retenciones y percepciones</b> — plata que podés
              usar.
            </div>
          </div>
        </div>

        {metodos.length === 0 ? (
          <div className="apm-empty">
            <div className="ico">
              <CreditCardIcon />
            </div>
            <h3>Todavía no cargaste métodos de pago</h3>
            <p>
              Definí cómo cobra tu imprenta —efectivo, transferencia, tarjetas,
              QR— con su comisión y plazo de acreditación. Se usan al registrar
              cada cobro.
            </p>
            <div className="acciones">
              <button
                type="button"
                className="btn"
                disabled={instalando}
                onClick={() => void instalarCatalogo()}
              >
                {instalando ? "Instalando…" : "Instalar catálogo sugerido"}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setSheet(draftNuevo())}
              >
                <PlusIcon />
                Crear primer método
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="apm-toolbar">
              <div className="apm-search">
                <SearchIcon />
                <input
                  placeholder="Buscar método, tipo o cuenta…"
                  aria-label="Buscar método, tipo o cuenta"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                />
              </div>
              <div className="apm-seg">
                {(
                  [
                    ["todos", "Todos"],
                    ["activos", "Activos"],
                    ["inactivos", "Inactivos"],
                  ] as const
                ).map(([k, l]) => (
                  <button
                    key={k}
                    type="button"
                    className={tab === k ? "on" : ""}
                    onClick={() => setTab(k)}
                  >
                    {l}
                  </button>
                ))}
              </div>
              <span className="apm-tcount">
                {lista.length} de {metodos.length} métodos
              </span>
            </div>
            <div className="apm-tbl">
              <div className="apm-tr apm-th">
                <span></span>
                <span>Método / Cuenta destino</span>
                <span>Comisión</span>
                <span>IVA s/com</span>
                <span>Plazo</span>
                <span>Retención</span>
                <span>Estado</span>
                <span></span>
              </div>
              {lista.map((metodo) => (
                <FilaMetodo
                  key={metodo.id}
                  metodo={metodo}
                  abierto={abiertoId === metodo.id}
                  onToggleAbierto={() =>
                    setAbiertoId(abiertoId === metodo.id ? null : metodo.id)
                  }
                  onEditar={() => setSheet(draftDesdeMetodo(metodo))}
                />
              ))}
            </div>
          </>
        )}

        {sheet ? (
          <SheetMetodo
            draft={sheet}
            cuentas={cuentas}
            guardando={guardando}
            onClose={() => setSheet(null)}
            onSave={(draft) => void guardar(draft)}
          />
        ) : null}
      </div>
    </ConfiguracionPage>
  );
}
