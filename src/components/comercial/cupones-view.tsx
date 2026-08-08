"use client";

/**
 * Comercial → Cupones (F4 descuentos — docs/descuentos-diseno.md §5.3).
 * Listado en cards + alta + QR imprimible (el lector 2D tipea el código).
 * Crear/editar exige SUPERVISOR/ADMIN (el cupón ES la autorización del
 * descuento: aplicarlo no gatea); el resto sólo mira.
 */

import * as React from "react";
import {
  Edit3Icon,
  PlusIcon,
  PowerIcon,
  QrCodeIcon,
  TicketPercentIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";

import { ConfirmacionDestructiva } from "@/components/ui/confirmacion-destructiva";
import { SelectBuscable } from "@/components/ui/select-buscable";
import {
  actualizarCupon,
  crearCupon,
  eliminarCupon,
  listarCupones,
  qrCupon,
  type Cupon,
  type CuponAlcanceTipo,
} from "@/lib/cupones-api";
import { getClientes } from "@/lib/clientes-api";
import {
  getCatalogoComercial,
  getProductos,
} from "@/lib/productos-servicios-api";
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

/**
 * Una opción elegible del alcance: `ref` es lo técnico (lo que compara el
 * motor), `nombre` lo visible, `grupo` el encabezado bajo el que se lista.
 */
type OpcionAlcance = { ref: string; nombre: string; grupo?: string };

/**
 * Trae las opciones que corresponden al alcance elegido. El `ref` tiene que
 * ser EXACTAMENTE lo que compara el motor al validar el cupón
 * (cupon-reglas.ts): código para categorías y productos, id para clientes.
 */
async function opcionesDeAlcance(
  tipo: CuponAlcanceTipo,
): Promise<OpcionAlcance[]> {
  if (tipo === "CATEGORIA" || tipo === "SUBCATEGORIA") {
    const catalogo = await getCatalogoComercial();
    if (tipo === "CATEGORIA") {
      return catalogo.map((c) => ({ ref: c.codigo, nombre: c.nombre }));
    }
    // La subcategoría va AGRUPADA bajo su categoría: hay nombres que se
    // repiten entre familias ("Vinilos" está en más de una), y el grupo
    // además es buscable (tipear "gran formato" trae todas las suyas).
    return catalogo.flatMap((c) =>
      (c.subcategorias ?? []).map((s) => ({
        ref: s.codigo,
        nombre: s.nombre,
        grupo: c.nombre,
      })),
    );
  }
  if (tipo === "PRODUCTO") {
    // El motor compara contra el CÓDIGO del producto, no contra su uuid.
    const productos = await getProductos(true);
    return productos.map((p) => ({ ref: p.codigo, nombre: p.nombre }));
  }
  if (tipo === "CLIENTE") {
    const clientes = await getClientes({ limit: 500 });
    return clientes.map((c) => ({ ref: c.id, nombre: c.nombre }));
  }
  return [];
}

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
  // null = cerrado · "nuevo" = alta · Cupon = edición de ese cupón.
  const [editor, setEditor] = React.useState<Cupon | "nuevo" | null>(null);
  const [aEliminar, setAEliminar] = React.useState<Cupon | null>(null);
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

  const eliminar = async (cupon: Cupon) => {
    // El backend rechaza borrar un cupón ya redimido (es historial) y pide
    // desactivarlo: ese mensaje se muestra tal cual.
    await eliminarCupon(cupon.id);
    setCupones((current) => current.filter((c) => c.id !== cupon.id));
    setAEliminar(null);
    toast.success(`Cupón ${cupon.codigo} eliminado.`);
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
            onClick={() => setEditor("nuevo")}
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
                        {/* El nombre legible; los cupones creados antes de
                            guardarlo caen a la ref cruda. */}
                        {cupon.alcanceTipo === "ORDEN"
                          ? ALCANCE_LABEL.ORDEN
                          : `${ALCANCE_LABEL[cupon.alcanceTipo]} · ${
                              cupon.alcanceNombre ?? cupon.alcanceRef ?? "—"
                            }`}
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
                    <>
                      <button
                        type="button"
                        className={`${s.act} ${s.solo}`}
                        onClick={() => setEditor(cupon)}
                        title="Editar el cupón"
                        aria-label={`Editar ${cupon.codigo}`}
                      >
                        <Edit3Icon />
                      </button>
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
                      <button
                        type="button"
                        className={`${s.act} ${s.solo} ${s.peligro}`}
                        onClick={() => setAEliminar(cupon)}
                        title="Eliminar el cupón"
                        aria-label={`Eliminar ${cupon.codigo}`}
                      >
                        <Trash2Icon />
                      </button>
                    </>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {editor ? (
        <CuponModal
          cupon={editor === "nuevo" ? null : editor}
          onClose={() => setEditor(null)}
          onGuardado={(cupon, esNuevo) => {
            setEditor(null);
            setCupones((current) =>
              esNuevo
                ? [cupon, ...current]
                : current.map((c) => (c.id === cupon.id ? cupon : c)),
            );
            toast.success(
              esNuevo
                ? `Cupón ${cupon.codigo} creado.`
                : `Cupón ${cupon.codigo} actualizado.`,
            );
            recargar();
          }}
        />
      ) : null}

      <ConfirmacionDestructiva
        open={aEliminar != null}
        onOpenChange={(open) => {
          if (!open) setAEliminar(null);
        }}
        titulo="Eliminar cupón"
        descripcion="El código deja de existir: si ya imprimiste QRs con él, dejan de funcionar."
        impacto={[
          "Un cupón que ya se usó en alguna orden NO se puede eliminar: en ese caso desactivalo y su historial queda intacto.",
        ]}
        nombreItem={aEliminar?.codigo}
        requiereTipear={false}
        accionLabel="Eliminar cupón"
        onConfirmar={async () => {
          if (aEliminar) await eliminar(aEliminar);
        }}
      />

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

/** Alta y edición comparten formulario: `cupon = null` es alta. */
function CuponModal({
  cupon,
  onClose,
  onGuardado,
}: {
  cupon: Cupon | null;
  onClose: () => void;
  onGuardado: (cupon: Cupon, esNuevo: boolean) => void;
}) {
  const editando = cupon != null;
  const [codigo, setCodigo] = React.useState(cupon?.codigo ?? "");
  const [descripcion, setDescripcion] = React.useState(
    cupon?.descripcion ?? "",
  );
  const [tipo, setTipo] = React.useState<"PORCENTAJE" | "MONTO">(
    cupon?.tipo ?? "PORCENTAJE",
  );
  const [valor, setValor] = React.useState(cupon?.valor ?? 10);
  const [alcanceTipo, setAlcanceTipo] = React.useState<CuponAlcanceTipo>(
    cupon?.alcanceTipo ?? "ORDEN",
  );
  const [alcanceRef, setAlcanceRef] = React.useState(cupon?.alcanceRef ?? "");
  // Opciones del alcance: el usuario elige de una lista, nunca tipea códigos
  // internos. Se cargan on-demand al elegir el tipo (no al abrir el modal).
  const [opciones, setOpciones] = React.useState<OpcionAlcance[]>([]);
  const [cargandoOpciones, setCargandoOpciones] = React.useState(false);

  React.useEffect(() => {
    if (alcanceTipo === "ORDEN") {
      setOpciones([]);
      return;
    }
    let vivo = true;
    setCargandoOpciones(true);
    opcionesDeAlcance(alcanceTipo)
      .then((lista) => {
        if (!vivo) return;
        setOpciones(lista);
        // Si lo que había seleccionado no está en la lista nueva (cambió el
        // tipo de alcance), se limpia para no mandar una ref que no existe.
        setAlcanceRef((actual) =>
          lista.some((o) => o.ref === actual) ? actual : "",
        );
      })
      .catch(() => {
        if (vivo) setOpciones([]);
      })
      .finally(() => {
        if (vivo) setCargandoOpciones(false);
      });
    return () => {
      vivo = false;
    };
  }, [alcanceTipo]);
  const [montoMinimo, setMontoMinimo] = React.useState(
    cupon?.montoMinimo != null ? String(cupon.montoMinimo) : "",
  );
  const [vigenciaHasta, setVigenciaHasta] = React.useState(
    // <input type="date"> quiere YYYY-MM-DD; el backend manda ISO completo.
    cupon?.vigenciaHasta ? cupon.vigenciaHasta.slice(0, 10) : "",
  );
  const [usoMax, setUsoMax] = React.useState(
    cupon?.usoMax != null ? String(cupon.usoMax) : "",
  );
  const [guardando, setGuardando] = React.useState(false);

  const guardar = async () => {
    if (!editando && !codigo.trim()) {
      toast.error("Poné el código del cupón.");
      return;
    }
    if (alcanceTipo !== "ORDEN" && !alcanceRef.trim()) {
      toast.error(
        `Elegí ${alcanceTipo === "CLIENTE" ? "el cliente" : alcanceTipo === "PRODUCTO" ? "el producto" : "la categoría"} al que aplica el cupón.`,
      );
      return;
    }
    setGuardando(true);
    try {
      // Los campos vacíos se mandan como null al editar (para BORRAR el dato)
      // y como undefined al crear (para omitirlos).
      const comunes = {
        descripcion: descripcion.trim() || undefined,
        tipo,
        valor,
        alcanceTipo,
        alcanceRef: alcanceTipo !== "ORDEN" ? alcanceRef.trim() : undefined,
        // El nombre se congela junto con la ref: así la card lo muestra sin
        // volver a pedir catálogos, y sobrevive a que renombren la categoría.
        alcanceNombre:
          alcanceTipo !== "ORDEN"
            ? (() => {
                const elegida = opciones.find((o) => o.ref === alcanceRef);
                if (!elegida) return undefined;
                // Con grupo se guarda "Categoría › Subcategoría": en la card
                // "Vinilos" solo no dice de qué familia es.
                return elegida.grupo
                  ? `${elegida.grupo} › ${elegida.nombre}`
                  : elegida.nombre;
              })()
            : undefined,
        montoMinimo: montoMinimo ? Number(montoMinimo) : undefined,
        vigenciaHasta: vigenciaHasta || undefined,
        usoMax: usoMax ? Number(usoMax) : undefined,
      };
      const guardado = editando
        ? await actualizarCupon(cupon.id, comunes)
        : await crearCupon({ codigo: codigo.trim(), ...comunes });
      onGuardado(guardado, !editando);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : `No se pudo ${editando ? "actualizar" : "crear"} el cupón.`,
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
        aria-label={editando ? `Editar cupón ${codigo}` : "Nuevo cupón"}
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
          {editando ? `Editar ${codigo}` : "Nuevo cupón"}
        </h2>

        <div className={s.grid2}>
          <div className={s.field}>
            <label>Código</label>
            <input
              type="text"
              placeholder="SORTEO2026"
              value={codigo}
              disabled={editando}
              onChange={(e) => setCodigo(e.target.value.toUpperCase())}
            />
            {editando ? (
              <span className={s.hint}>
                No se edita: puede haber QRs impresos con este código.
              </span>
            ) : null}
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
                  ? "Cliente"
                  : alcanceTipo === "PRODUCTO"
                    ? "Producto"
                    : alcanceTipo === "SUBCATEGORIA"
                      ? "Subcategoría"
                      : "Categoría"}
              </label>
              {/* Lista con buscador (la misma de Egresos): con cientos de
                  clientes o productos, un <select> nativo obliga a
                  recorrerlos a mano. */}
              <SelectBuscable
                value={alcanceRef}
                onChange={setAlcanceRef}
                opciones={opciones.map((o) => ({
                  value: o.ref,
                  label: o.nombre,
                  grupo: o.grupo ?? null,
                }))}
                disabled={cargandoOpciones || opciones.length === 0}
                placeholder={
                  cargandoOpciones
                    ? "Cargando…"
                    : opciones.length === 0
                      ? "No hay opciones disponibles"
                      : `Elegí ${
                          alcanceTipo === "CLIENTE"
                            ? "el cliente"
                            : alcanceTipo === "PRODUCTO"
                              ? "el producto"
                              : "la categoría"
                        }`
                }
                placeholderBusqueda="Buscar…"
                vacio="Nada coincide con la búsqueda."
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
            onClick={() => void guardar()}
          >
            {guardando
              ? "Guardando…"
              : editando
                ? "Guardar cambios"
                : "Crear cupón"}
          </button>
        </div>
      </div>
    </div>
  );
}
