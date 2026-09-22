"use client";
import {
  ConfiguracionPage,
  ConfiguracionHeader,
  GuardarConfiguracion,
} from "@/components/configuracion/configuracion-workspace";

import * as React from "react";
import { useCapacidad } from "@/components/navigation/capacidades-provider";
import { usePuede } from "@/components/navigation/permisos-provider";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useRouter } from "next/navigation";
import {
  BuildingIcon,
  CheckIcon,
  InfoIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
import { toast } from "sonner";

import { ConfirmacionDestructiva } from "@/components/ui/confirmacion-destructiva";
import {
  CONDICIONES_EMISOR,
  CONDICION_EMISOR_LABELS,
  LEYENDAS_A,
  MODALIDADES_PUNTO_VENTA,
  MODALIDAD_PUNTO_VENTA_LABELS,
  letraComprobante,
  type CondicionFiscalEmisor,
  type ConfiguracionFiscal,
  type LeyendaA,
  type ProveedorFacturacion,
  type ModalidadPuntoVenta,
  type PuntoVenta,
} from "@/lib/administracion";
import {
  crearPuntoVenta,
  eliminarPuntoVenta,
  guardarConfiguracionFiscal,
} from "@/lib/administracion-api";
import {
  CONDICIONES_FISCALES,
  CONDICION_FISCAL_LABELS,
  formatCuit,
} from "@/lib/clientes";

type FormState = {
  razonSocial: string;
  cuit: string;
  condicionFiscal: CondicionFiscalEmisor;
  ingresosBrutos: string;
  domicilioFiscal: string;
  inicioActividades: string;
  leyendaFacturaA: LeyendaA | "";
  proveedorFacturacion: ProveedorFacturacion;
};

function estadoInicial(config: ConfiguracionFiscal | null): FormState {
  return {
    razonSocial: config?.razonSocial ?? "",
    cuit: config ? formatCuit(config.cuit) : "",
    condicionFiscal: config?.condicionFiscal ?? "RI",
    ingresosBrutos: config?.ingresosBrutos ?? "",
    domicilioFiscal: config?.domicilioFiscal ?? "",
    inicioActividades: config?.inicioActividades ?? "",
    leyendaFacturaA: config?.leyendaFacturaA ?? "",
    proveedorFacturacion: config?.proveedorFacturacion ?? "manual",
  };
}

export function ConfiguracionFiscalView({
  initialConfig,
}: {
  initialConfig: ConfiguracionFiscal | null;
}) {
  const router = useRouter();
  const fiscalIncluida = useCapacidad("fiscal_argentina");
  const puedeGestionar = usePuede("administracion.gestionar");
  const puedeGestionarFiscal = fiscalIncluida && puedeGestionar;
  const [form, setForm] = React.useState<FormState>(() =>
    estadoInicial(initialConfig),
  );
  const [guardando, setGuardando] = React.useState(false);
  const [guardado, setGuardado] = React.useState(() =>
    estadoInicial(initialConfig),
  );
  const cambios = (Object.keys(form) as (keyof FormState)[]).filter(
    (key) => form[key] !== guardado[key],
  ).length;
  const [pvNuevo, setPvNuevo] = React.useState<{
    numero: string;
    nombre: string;
    modalidad: ModalidadPuntoVenta;
  } | null>(null);
  const [pvBorrar, setPvBorrar] = React.useState<PuntoVenta | null>(null);

  const configurado = initialConfig !== null;
  const puntosVenta = initialConfig?.puntosVenta ?? [];
  const esRI = form.condicionFiscal === "RI";

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const guardar = async () => {
    if (!form.razonSocial.trim() || !form.cuit.trim()) {
      toast.error("Razón social y CUIT son obligatorios.");
      return;
    }
    setGuardando(true);
    try {
      await guardarConfiguracionFiscal({
        razonSocial: form.razonSocial,
        cuit: form.cuit,
        condicionFiscal: form.condicionFiscal,
        ingresosBrutos: form.ingresosBrutos || undefined,
        domicilioFiscal: form.domicilioFiscal || undefined,
        inicioActividades: form.inicioActividades || undefined,
        leyendaFacturaA: esRI ? form.leyendaFacturaA || null : null,
        proveedorFacturacion: form.proveedorFacturacion,
      });
      toast.success("Datos fiscales guardados.");
      setGuardado({ ...form });
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudieron guardar los datos fiscales.",
      );
    } finally {
      setGuardando(false);
    }
  };

  const agregarPv = async () => {
    if (!pvNuevo || !puedeGestionarFiscal) return;
    const numero = Number(pvNuevo.numero);
    if (!numero || numero < 1) {
      toast.error("El número de punto de venta tiene que ser mayor a 0.");
      return;
    }
    if (!pvNuevo.nombre.trim()) {
      toast.error("Poné un nombre para identificar el punto de venta.");
      return;
    }
    try {
      await crearPuntoVenta({
        numero,
        nombre: pvNuevo.nombre,
        modalidad: pvNuevo.modalidad,
      });
      toast.success(
        `Punto de venta ${String(numero).padStart(4, "0")} agregado.`,
      );
      setPvNuevo(null);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo agregar el punto de venta.",
      );
    }
  };

  const borrarPv = async () => {
    if (!pvBorrar) return;
    try {
      await eliminarPuntoVenta(pvBorrar.id);
      toast.success(`Punto de venta ${pvBorrar.numeroFormateado} eliminado.`);
      setPvBorrar(null);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo eliminar el punto de venta.",
      );
    }
  };

  return (
    <ConfiguracionPage>
      <div className="apm-wrap">
        <ConfiguracionHeader
          titulo="Datos fiscales"
          descripcion="Datos del emisor, comprobantes y puntos de venta."
          acciones={
            <GuardarConfiguracion
              cambios={cambios}
              guardando={guardando}
              onGuardar={() => void guardar()}
            />
          }
        />

        {!fiscalIncluida && (
          <Alert>
            <AlertDescription>
              Tu plan no incluye facturación electrónica. Podés mantener los
              datos del emisor para tus recibos y consultar los puntos de venta
              existentes.
            </AlertDescription>
          </Alert>
        )}

        {!configurado ? (
          <div className="arc-page">
            <div className="arc-variant-note" style={{ margin: "18px 0" }}>
              <InfoIcon />
              <span>
                Todavía no cargaste los datos fiscales del emisor. Sin ellos no
                se puede emitir ningún comprobante: completá la razón social, el
                CUIT y la condición fiscal, y después agregá al menos un punto
                de venta.
              </span>
            </div>
          </div>
        ) : null}

        <div className="arc-page" style={{ display: "block" }}>
          <div className="arc-card" style={{ marginBottom: 20 }}>
            <div className="arc-card-sec">
              <h2 className="arc-sec-t">Emisor</h2>
              <div className="arc-frow">
                <div className="arc-field">
                  <label htmlFor="fiscal-razonSocial">Razón social</label>
                  <input
                    id="fiscal-razonSocial"
                    value={form.razonSocial}
                    onChange={(e) => set("razonSocial", e.target.value)}
                    placeholder="Ej. Grafoprint S.A."
                  />
                </div>
                <div className="arc-field">
                  <label htmlFor="fiscal-cuit">CUIT</label>
                  <input
                    id="fiscal-cuit"
                    value={form.cuit}
                    onChange={(e) => set("cuit", e.target.value)}
                    placeholder="30-71234567-1"
                  />
                </div>
              </div>
              <div className="arc-frow">
                <div className="arc-field">
                  <label htmlFor="fiscal-condicionFiscal">
                    Condición fiscal
                  </label>
                  <select
                    id="fiscal-condicionFiscal"
                    value={form.condicionFiscal}
                    onChange={(e) =>
                      set(
                        "condicionFiscal",
                        e.target.value as CondicionFiscalEmisor,
                      )
                    }
                  >
                    {CONDICIONES_EMISOR.map((c) => (
                      <option key={c} value={c}>
                        {CONDICION_EMISOR_LABELS[c]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="arc-field">
                  <label htmlFor="fiscal-ingresosBrutos">
                    Ingresos Brutos <span className="opt">(opcional)</span>
                  </label>
                  <input
                    id="fiscal-ingresosBrutos"
                    value={form.ingresosBrutos}
                    onChange={(e) => set("ingresosBrutos", e.target.value)}
                    placeholder="Nº de inscripción o convenio multilateral"
                  />
                </div>
              </div>
              <div className="arc-frow">
                <div className="arc-field">
                  <label htmlFor="fiscal-domicilioFiscal">
                    Domicilio fiscal <span className="opt">(opcional)</span>
                  </label>
                  <input
                    id="fiscal-domicilioFiscal"
                    value={form.domicilioFiscal}
                    onChange={(e) => set("domicilioFiscal", e.target.value)}
                    placeholder="Calle 123, Ciudad"
                  />
                </div>
                <div className="arc-field">
                  <label htmlFor="fiscal-inicioActividades">
                    Inicio de actividades{" "}
                    <span className="opt">(opcional)</span>
                  </label>
                  <input
                    id="fiscal-inicioActividades"
                    type="date"
                    value={form.inicioActividades}
                    onChange={(e) => set("inicioActividades", e.target.value)}
                  />
                </div>
              </div>
            </div>

            {esRI ? (
              <div className="arc-card-sec">
                <h2 className="arc-sec-t">
                  Leyenda en las facturas A{" "}
                  <span className="n">sólo si ARCA te la asignó</span>
                </h2>
                <div className="arc-auto-note">
                  <InfoIcon />
                  Reemplaza a la vieja factura M, eliminada por la RG 5762/2025:
                  quien no acredita solvencia emite una A con leyenda.
                </div>
                <div className="arc-field" style={{ marginBottom: 0 }}>
                  <select
                    aria-label="Leyenda en las facturas A"
                    value={form.leyendaFacturaA}
                    onChange={(e) =>
                      set("leyendaFacturaA", e.target.value as LeyendaA | "")
                    }
                  >
                    <option value="">Sin leyenda (caso normal)</option>
                    {LEYENDAS_A.map((l) => (
                      <option key={l} value={l}>
                        {l}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ) : null}

            <div className="arc-card-sec">
              <h2 className="arc-sec-t">
                Qué letra vas a emitir{" "}
                <span className="n">según la condición de cada cliente</span>
              </h2>
              <div className="apm-letras">
                {CONDICIONES_FISCALES.map((receptor) => {
                  const r = letraComprobante(
                    form.condicionFiscal,
                    receptor,
                    form.leyendaFacturaA || null,
                  );
                  return (
                    <div key={receptor} className="apm-letra-card">
                      <span className="big">{r.letra}</span>
                      <span className="txt">
                        <span className="cond">
                          {CONDICION_FISCAL_LABELS[receptor]}
                        </span>
                        <span className="iva">
                          {r.exenta
                            ? "sin IVA"
                            : r.discriminaIva
                              ? "IVA discriminado"
                              : "IVA incluido"}
                        </span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="arc-card">
            <div className="arc-card-sec">
              <h2 className="arc-sec-t">
                Puntos de venta
                <span className="n">
                  {puntosVenta.length === 0
                    ? "ninguno todavía"
                    : `${puntosVenta.length} habilitado${puntosVenta.length === 1 ? "" : "s"}`}
                </span>
              </h2>

              {!fiscalIncluida && (
                <Alert>
                  <AlertDescription>
                    Tu plan no incluye facturación electrónica. Podés mantener
                    los datos del emisor para tus recibos y consultar los puntos
                    de venta existentes.
                  </AlertDescription>
                </Alert>
              )}

              {!configurado ? (
                <div className="arc-auto-note" style={{ marginBottom: 0 }}>
                  <InfoIcon />
                  Guardá primero los datos del emisor para poder agregar puntos
                  de venta.
                </div>
              ) : (
                <>
                  {puntosVenta.length === 0 ? (
                    <div className="arc-auto-note">
                      <InfoIcon />
                      Agregá el punto de venta que ARCA te habilitó. Para
                      facturar por API tiene que ser de tipo Web Services.
                    </div>
                  ) : (
                    <div style={{ marginBottom: 12 }}>
                      {puntosVenta.map((pv) => (
                        <div key={pv.id} className="ats-mv-tr ats-mv-row">
                          <span className="ats-mv-date">
                            {pv.numeroFormateado}
                          </span>
                          <span className="ats-mv-concept">
                            <span className="c">{pv.nombre}</span>
                            <span className="o">
                              {MODALIDAD_PUNTO_VENTA_LABELS[pv.modalidad]}
                            </span>
                          </span>
                          <span>
                            <span
                              className={`ats-mv-origin ${pv.activo ? "cobro" : "arqueo"}`}
                            >
                              {pv.activo ? "Activo" : "Inactivo"}
                            </span>
                          </span>
                          <span className="r">
                            <button
                              type="button"
                              className="btn btn-sm"
                              onClick={() => setPvBorrar(pv)}
                            >
                              <Trash2Icon />
                              Quitar
                            </button>
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {pvNuevo ? (
                    <div className="arc-ret-line">
                      <div className="arc-frow3" style={{ marginBottom: 10 }}>
                        <div
                          className="arc-field sm"
                          style={{ marginBottom: 0 }}
                        >
                          <label htmlFor="fiscal-pvNumero">Número</label>
                          <input
                            id="fiscal-pvNumero"
                            type="number"
                            value={pvNuevo.numero}
                            onChange={(e) =>
                              setPvNuevo({ ...pvNuevo, numero: e.target.value })
                            }
                            placeholder="1"
                          />
                        </div>
                        <div
                          className="arc-field sm"
                          style={{ marginBottom: 0 }}
                        >
                          <label htmlFor="fiscal-pv-nombre">Nombre</label>
                          <input
                            id="fiscal-pv-nombre"
                            value={pvNuevo.nombre}
                            onChange={(e) =>
                              setPvNuevo({ ...pvNuevo, nombre: e.target.value })
                            }
                            placeholder="Casa central"
                          />
                        </div>
                        <div
                          className="arc-field sm"
                          style={{ marginBottom: 0 }}
                        >
                          <label htmlFor="fiscal-pv-modalidad">Modalidad</label>
                          <select
                            id="fiscal-pv-modalidad"
                            value={pvNuevo.modalidad}
                            onChange={(e) =>
                              setPvNuevo({
                                ...pvNuevo,
                                modalidad: e.target
                                  .value as ModalidadPuntoVenta,
                              })
                            }
                          >
                            {MODALIDADES_PUNTO_VENTA.map((m) => (
                              <option key={m} value={m}>
                                {MODALIDAD_PUNTO_VENTA_LABELS[m]}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => void agregarPv()}
                        >
                          <CheckIcon />
                          Agregar
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm"
                          onClick={() => setPvNuevo(null)}
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="arc-ret-add"
                      disabled={!puedeGestionarFiscal}
                      onClick={() =>
                        setPvNuevo({
                          numero: "",
                          nombre: "",
                          modalidad: "web_services",
                        })
                      }
                    >
                      <PlusIcon />
                      Agregar punto de venta
                    </button>
                  )}
                </>
              )}
            </div>

            <div className="arc-card-sec">
              <h2 className="arc-sec-t">
                Cómo se pide el CAE
                <span className="n">
                  {initialConfig?.proveedorFacturacion === "afipsdk"
                    ? "automático"
                    : "a mano"}
                </span>
              </h2>
              <div className="arc-field" style={{ marginBottom: 12 }}>
                <select
                  aria-label="Proveedor de facturación"
                  disabled={!puedeGestionarFiscal}
                  value={form.proveedorFacturacion}
                  onChange={(e) =>
                    set(
                      "proveedorFacturacion",
                      e.target.value as ProveedorFacturacion,
                    )
                  }
                >
                  <option value="manual">
                    Manual — emito en el portal de ARCA y cargo el CAE acá
                  </option>
                  <option value="afipsdk">
                    Automático — Grafo le pide el CAE a ARCA
                  </option>
                </select>
              </div>
              <div className="arc-auto-note" style={{ marginBottom: 0 }}>
                <BuildingIcon />
                {form.proveedorFacturacion === "afipsdk" ? (
                  <span>
                    Al emitir, Grafo le pide el número y el CAE a ARCA. En este
                    entorno de desarrollo va contra{" "}
                    <b style={{ color: "var(--ink-2)" }}>homologación</b>: los
                    comprobantes son reales en formato pero{" "}
                    <b style={{ color: "var(--signal)" }}>
                      no tienen validez fiscal
                    </b>
                    .
                  </span>
                ) : (
                  <span>
                    El comprobante se numera con nuestro contador y queda sin
                    CAE; lo cargás a mano desde el detalle.
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <ConfirmacionDestructiva
        open={pvBorrar !== null}
        onOpenChange={(o) => !o && setPvBorrar(null)}
        titulo="Quitar punto de venta"
        descripcion={`Se elimina el punto de venta ${pvBorrar?.numeroFormateado} · ${pvBorrar?.nombre}.`}
        impacto={[
          "No se puede quitar si ya tiene comprobantes emitidos.",
          "Podés volver a agregarlo con el mismo número.",
        ]}
        requiereTipear={false}
        accionLabel="Quitar punto de venta"
        onConfirmar={() => borrarPv()}
      />
    </ConfiguracionPage>
  );
}
