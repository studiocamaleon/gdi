"use client";

/**
 * Comercial → Cupones (F4 descuentos — docs/descuentos-diseno.md §5.3).
 * Listado en cards + alta + QR imprimible (el lector 2D tipea el código).
 * Crear/editar exige SUPERVISOR/ADMIN (el cupón ES la autorización del
 * descuento: aplicarlo no gatea); el resto sólo mira.
 */

import * as React from "react";
import {
  PlusIcon,
  PowerIcon,
  QrCodeIcon,
  TicketPercentIcon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";

import {
  actualizarCupon,
  crearCupon,
  listarCupones,
  qrCupon,
  type Cupon,
  type CuponAlcanceTipo,
} from "@/lib/cupones-api";
import { formatearMoneda, type Moneda } from "@/lib/moneda";
import {
  useConfigRegional,
  useFecha,
} from "@/components/navigation/config-regional-provider";
import s from "./cupones-view.module.css";

const ALCANCE_LABEL: Record<CuponAlcanceTipo, string> = {
  ORDEN: "Toda la orden",
  CATEGORIA: "Categoría",
  SUBCATEGORIA: "Subcategoría",
  PRODUCTO: "Producto",
  CLIENTE: "Cliente",
};

function valorLabel(cupon: Cupon, moneda: Moneda) {
  return cupon.tipo === "PORCENTAJE"
    ? `−${cupon.valor.toLocaleString("es-AR")}%`
    : `−${formatearMoneda(cupon.valor, moneda, { decimales: 0 })}`;
}

export function CuponesView({
  initial,
  puedeEditar,
}: {
  initial: Cupon[];
  puedeEditar: boolean;
}) {
  const { moneda } = useConfigRegional();
  const { fechaCorta } = useFecha();
  const [cupones, setCupones] = React.useState<Cupon[]>(initial);
  const [altaOpen, setAltaOpen] = React.useState(false);
  const [qr, setQr] = React.useState<{
    codigo: string;
    dataUrl: string;
  } | null>(null);

  const recargar = React.useCallback(() => {
    listarCupones()
      .then(setCupones)
      .catch(() => {});
  }, []);

  const toggleActivo = async (cupon: Cupon) => {
    try {
      const actualizado = await actualizarCupon(cupon.id, {
        activo: !cupon.activo,
      });
      setCupones((current) =>
        current.map((c) => (c.id === cupon.id ? actualizado : c)),
      );
      toast.success(
        actualizado.activo
          ? `${cupon.codigo} activado.`
          : `${cupon.codigo} desactivado.`,
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo actualizar.",
      );
    }
  };

  const verQr = async (cupon: Cupon) => {
    try {
      setQr(await qrCupon(cupon.id));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo generar el QR.",
      );
    }
  };

  return (
    <section className={s.wrap}>
      <div className={s.inner}>
      <div className="page-head">
        <div className="title-block">
          <h1>Cupones</h1>
          <div className="sub">
            Descuentos con código: el cupón define alcance, vigencia y usos, y
            se redime al emitir la orden. El QR se escanea con el lector 2D.
          </div>
        </div>
        {puedeEditar ? (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setAltaOpen(true)}
          >
            <PlusIcon />
            Nuevo cupón
          </button>
        ) : null}
      </div>

      {cupones.length === 0 ? (
        <div className={s.vacio}>
          <strong>Sin cupones todavía</strong>
          {puedeEditar
            ? "Creá el primero: un código para un sorteo, una campaña o un cliente frecuente."
            : "Cuando un supervisor cree cupones, van a aparecer acá."}
        </div>
      ) : (
        <div className={s.grid}>
          {cupones.map((cupon) => {
            const agotado =
              cupon.usoMax != null && cupon.usoCount >= cupon.usoMax;
            const vencido =
              cupon.vigenciaHasta != null &&
              new Date(cupon.vigenciaHasta) < new Date();
            // Un solo chip resume el estado real: sirve más que ver los
            // datos crudos y decidir uno mismo si el cupón sigue sirviendo.
            const estado = !cupon.activo
              ? { label: "Inactivo", clase: "" }
              : vencido
                ? { label: "Vencido", clase: s.alerta }
                : agotado
                  ? { label: "Sin usos", clase: s.alerta }
                  : { label: "Activo", clase: s.ok };
            return (
              <article
                key={cupon.id}
                className={`${s.card}${cupon.activo ? "" : ` ${s.inactivo}`}`}
              >
                <div className={s.cardHead}>
                  <span className={s.codigo}>{cupon.codigo}</span>
                  <span className={`${s.estado} ${estado.clase}`}>
                    {estado.label}
                  </span>
                </div>

                <div className={s.cardBody}>
                  <div className={s.valorRow}>
                    <span className={s.valor}>{valorLabel(cupon, moneda)}</span>
                    <span className={s.valorSub}>
                      {cupon.tipo === "PORCENTAJE"
                        ? "sobre el neto"
                        : "de descuento"}
                    </span>
                  </div>

                  {cupon.descripcion ? (
                    <div className={s.desc}>{cupon.descripcion}</div>
                  ) : null}

                  <dl className={s.datos}>
                    <div className={s.dato}>
                      <dt>Alcance</dt>
                      <dd>
                        {ALCANCE_LABEL[cupon.alcanceTipo]}
                        {cupon.alcanceRef ? ` · ${cupon.alcanceRef}` : ""}
                      </dd>
                    </div>
                    <div className={s.dato}>
                      <dt>Usos</dt>
                      <dd className={agotado ? s.alerta : undefined}>
                        {cupon.usoMax == null
                          ? `${cupon.usoCount} · sin límite`
                          : `${cupon.usoCount} de ${cupon.usoMax}`}
                      </dd>
                    </div>
                    {cupon.vigenciaHasta ? (
                      <div className={s.dato}>
                        <dt>{vencido ? "Venció" : "Vence"}</dt>
                        <dd className={vencido ? s.alerta : undefined}>
                          {fechaCorta(cupon.vigenciaHasta)}
                        </dd>
                      </div>
                    ) : null}
                    {cupon.montoMinimo ? (
                      <div className={s.dato}>
                        <dt>Compra mínima</dt>
                        <dd>
                          {formatearMoneda(cupon.montoMinimo, moneda, {
                            decimales: 0,
                          })}
                        </dd>
                      </div>
                    ) : null}
                  </dl>
                </div>

                <div className={s.acts}>
                  <button
                    type="button"
                    className={s.act}
                    onClick={() => void verQr(cupon)}
                    title="Ver el QR para imprimir o escanear"
                  >
                    <QrCodeIcon />
                    QR
                  </button>
                  <span className={s.actSpacer} />
                  {puedeEditar ? (
                    <button
                      type="button"
                      className={`${s.act} ${s.solo}`}
                      onClick={() => void toggleActivo(cupon)}
                      title={
                        cupon.activo
                          ? "Desactivar: deja de poder aplicarse"
                          : "Activar"
                      }
                      aria-label={cupon.activo ? "Desactivar" : "Activar"}
                    >
                      <PowerIcon />
                    </button>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {altaOpen ? (
        <AltaCuponModal
          onClose={() => setAltaOpen(false)}
          onCreado={(cupon) => {
            setAltaOpen(false);
            setCupones((current) => [cupon, ...current]);
            toast.success(`Cupón ${cupon.codigo} creado.`);
            recargar();
          }}
        />
      ) : null}

      {qr ? (
        <div className={s.overlay} onClick={() => setQr(null)}>
          <div
            className={s.modal}
            role="dialog"
            aria-modal="true"
            aria-label={`QR del cupón ${qr.codigo}`}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className={s.close}
              onClick={() => setQr(null)}
              aria-label="Cerrar"
            >
              <XIcon />
            </button>
            <h2>
              <TicketPercentIcon />
              QR del cupón
            </h2>
            <div className={s.qrBox}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr.dataUrl} alt={`QR ${qr.codigo}`} />
              <span className={s.codigo}>{qr.codigo}</span>
            </div>
            <div className={s.foot}>
              <a
                className="btn"
                href={qr.dataUrl}
                download={`cupon-${qr.codigo}.png`}
              >
                Descargar PNG
              </a>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setQr(null)}
              >
                Listo
              </button>
            </div>
          </div>
        </div>
      ) : null}
      </div>
    </section>
  );
}

function AltaCuponModal({
  onClose,
  onCreado,
}: {
  onClose: () => void;
  onCreado: (cupon: Cupon) => void;
}) {
  const [codigo, setCodigo] = React.useState("");
  const [descripcion, setDescripcion] = React.useState("");
  const [tipo, setTipo] = React.useState<"PORCENTAJE" | "MONTO">("PORCENTAJE");
  const [valor, setValor] = React.useState(10);
  const [alcanceTipo, setAlcanceTipo] =
    React.useState<CuponAlcanceTipo>("ORDEN");
  const [alcanceRef, setAlcanceRef] = React.useState("");
  const [montoMinimo, setMontoMinimo] = React.useState("");
  const [vigenciaHasta, setVigenciaHasta] = React.useState("");
  const [usoMax, setUsoMax] = React.useState("");
  const [guardando, setGuardando] = React.useState(false);

  const crear = async () => {
    if (!codigo.trim()) {
      toast.error("Poné el código del cupón.");
      return;
    }
    if (alcanceTipo !== "ORDEN" && !alcanceRef.trim()) {
      toast.error("Indicá a qué apunta el alcance (código o id).");
      return;
    }
    setGuardando(true);
    try {
      const cupon = await crearCupon({
        codigo: codigo.trim(),
        descripcion: descripcion.trim() || undefined,
        tipo,
        valor,
        alcanceTipo,
        alcanceRef: alcanceTipo !== "ORDEN" ? alcanceRef.trim() : undefined,
        montoMinimo: montoMinimo ? Number(montoMinimo) : undefined,
        vigenciaHasta: vigenciaHasta || undefined,
        usoMax: usoMax ? Number(usoMax) : undefined,
      });
      onCreado(cupon);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo crear el cupón.",
      );
      setGuardando(false);
    }
  };

  return (
    <div className={s.overlay} onClick={onClose}>
      <div
        className={s.modal}
        role="dialog"
        aria-modal="true"
        aria-label="Nuevo cupón"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className={s.close}
          onClick={onClose}
          aria-label="Cerrar"
        >
          <XIcon />
        </button>
        <h2>
          <TicketPercentIcon />
          Nuevo cupón
        </h2>

        <div className={s.grid2}>
          <div className={s.field}>
            <label>Código</label>
            <input
              type="text"
              placeholder="SORTEO2026"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.toUpperCase())}
            />
          </div>
          <div className={s.field}>
            <label>Tipo</label>
            <select
              value={tipo}
              onChange={(e) =>
                setTipo(e.target.value as "PORCENTAJE" | "MONTO")
              }
            >
              <option value="PORCENTAJE">Porcentaje (%)</option>
              <option value="MONTO">Monto ($)</option>
            </select>
          </div>
        </div>

        <div className={s.grid2}>
          <div className={s.field}>
            <label>{tipo === "PORCENTAJE" ? "Porcentaje" : "Monto neto"}</label>
            <input
              type="number"
              min={0}
              max={tipo === "PORCENTAJE" ? 100 : undefined}
              value={valor}
              onChange={(e) => setValor(Number(e.target.value) || 0)}
            />
          </div>
          <div className={s.field}>
            <label>Usos máximos</label>
            <input
              type="number"
              min={1}
              placeholder="Ilimitado · 1 = sorteo"
              value={usoMax}
              onChange={(e) => setUsoMax(e.target.value)}
            />
          </div>
        </div>

        <div className={s.grid2}>
          <div className={s.field}>
            <label>Alcance</label>
            <select
              value={alcanceTipo}
              onChange={(e) =>
                setAlcanceTipo(e.target.value as CuponAlcanceTipo)
              }
            >
              {Object.entries(ALCANCE_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          {alcanceTipo !== "ORDEN" ? (
            <div className={s.field}>
              <label>
                {alcanceTipo === "CLIENTE"
                  ? "Id del cliente"
                  : alcanceTipo === "PRODUCTO"
                    ? "Id del producto (motor)"
                    : "Código de la categoría"}
              </label>
              <input
                type="text"
                value={alcanceRef}
                onChange={(e) => setAlcanceRef(e.target.value)}
              />
            </div>
          ) : null}
        </div>

        <div className={s.grid2}>
          <div className={s.field}>
            <label>Vence</label>
            <input
              type="date"
              value={vigenciaHasta}
              onChange={(e) => setVigenciaHasta(e.target.value)}
            />
          </div>
          {/* La compra mínima es del ticket completo, no del alcance: va
              siempre, cualquiera sea a qué apunte el cupón. */}
          <div className={s.field}>
            <label>Compra mínima ($ neto)</label>
            <input
              type="number"
              min={0}
              placeholder="Sin mínimo"
              value={montoMinimo}
              onChange={(e) => setMontoMinimo(e.target.value)}
            />
          </div>
        </div>

        <div className={s.field}>
          <label>Descripción</label>
          <textarea
            rows={2}
            placeholder="Sorteo aniversario — 20% en cartelería"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
          />
        </div>

        <div className={s.foot}>
          <button type="button" className="btn" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={guardando}
            onClick={() => void crear()}
          >
            {guardando ? "Creando…" : "Crear cupón"}
          </button>
        </div>
      </div>
    </div>
  );
}
