"use client";

/**
 * Comercial → Cupones (F4 descuentos — docs/descuentos-diseno.md §5.3).
 * Listado en cards + alta + QR imprimible (el lector 2D tipea el código).
 * Crear/editar exige SUPERVISOR/ADMIN (el cupón ES la autorización del
 * descuento: aplicarlo no gatea); el resto sólo mira.
 */

import * as React from "react";
import {
  CopyIcon,
  Edit3Icon,
  PlusIcon,
  PowerIcon,
  TagIcon,
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
    // El ID, no el código: el item de la ficha lleva `motorCodigo =
    // producto.id` (el uuid), que es contra lo que se compara al validar.
    const productos = await getProductos(true);
    return productos.map((p) => ({ ref: p.id, nombre: p.nombre }));
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

  // Los QR del talón se generan en el CLIENTE: pedirle uno por cupón al API
  // serían N requests, y mandarlos en el listado lo engordaría sin necesidad
  // (el QR sólo codifica el código, que ya viaja).
  const [qrs, setQrs] = React.useState<Record<string, string>>({});
  React.useEffect(() => {
    let vivo = true;
    void (async () => {
      const { toDataURL } = await import("qrcode");
      const pares = await Promise.all(
        cupones.map(async (c) => {
          try {
            return [
              c.id,
              await toDataURL(c.codigo, { margin: 0, width: 120 }),
            ] as const;
          } catch {
            return [c.id, ""] as const;
          }
        }),
      );
      if (vivo) setQrs(Object.fromEntries(pares.filter(([, url]) => url)));
    })();
    return () => {
      vivo = false;
    };
  }, [cupones]);

  // "Hoy" se fija en el cliente: calcularlo durante el render lo haría
  // distinto en el server y rompería la hidratación.
  const [hoy, setHoy] = React.useState<number | null>(null);
  React.useEffect(() => setHoy(Date.now()), []);

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

  const copiarCodigo = async (codigo: string) => {
    try {
      await navigator.clipboard.writeText(codigo);
      toast.success(`Código ${codigo} copiado.`);
    } catch {
      toast.error("El navegador no dejó copiar. Seleccionalo a mano.");
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
            const vence = cupon.vigenciaHasta
              ? new Date(cupon.vigenciaHasta).getTime()
              : null;
            const vencido = vence != null && hoy != null && vence < hoy;
            // Días que le quedan: sólo para avisar cuando está por vencerse.
            const diasRestantes =
              vence != null && hoy != null && !vencido
                ? Math.ceil((vence - hoy) / 86_400_000)
                : null;
            const porVencer = diasRestantes != null && diasRestantes <= 14;
            // Tres estados, como el diseño: activo · en pausa (desactivado a
            // mano) · sin efecto (agotado o vencido, el cupón queda "usado").
            const anulado = agotado || vencido;
            const estado = anulado
              ? { clase: s.off, label: vencido ? "Vencido" : "Sin usos" }
              : !cupon.activo
                ? { clase: s.pausa, label: "En pausa" }
                : { clase: s.on, label: "Activo" };
            const usoPct =
              cupon.usoMax != null && cupon.usoMax > 0
                ? Math.min(100, (cupon.usoCount / cupon.usoMax) * 100)
                : 0;

            return (
              <article
                key={cupon.id}
                className={`${s.tk}${anulado ? ` ${s.anulado}` : ""}`}
              >
                <div className={s.paper}>
                  <div className={s.body}>
                    <div className={s.top}>
                      <button
                        type="button"
                        className={s.codigo}
                        onClick={() => void copiarCodigo(cupon.codigo)}
                        title="Copiar código"
                      >
                        <span>{cupon.codigo}</span>
                        <CopyIcon />
                      </button>
                      <span className={s.spacer} />
                      <span className={`${s.estado} ${estado.clase}`}>
                        {estado.label}
                      </span>
                    </div>

                    <div className={s.valor}>
                      <b>{valorLabel(cupon, moneda)}</b>
                      <span>
                        {cupon.tipo === "PORCENTAJE"
                          ? "sobre el neto"
                          : "de descuento"}
                      </span>
                    </div>

                    {cupon.descripcion ? (
                      <div className={s.desc}>{cupon.descripcion}</div>
                    ) : null}

                    <span className={s.alcance}>
                      <TagIcon />
                      <span className={s.path}>
                        <b>{ALCANCE_LABEL[cupon.alcanceTipo]}</b>
                        {cupon.alcanceTipo !== "ORDEN"
                          ? ` · ${cupon.alcanceNombre ?? cupon.alcanceRef ?? "—"}`
                          : ""}
                        {cupon.montoMinimo
                          ? ` · desde ${formatearMoneda(cupon.montoMinimo, moneda, { decimales: 0 })}`
                          : ""}
                      </span>
                    </span>

                    <div className={s.meta}>
                      <span className={s.dato}>
                        <span className={s.k}>
                          {vencido ? "Venció" : "Vence"}
                        </span>
                        <span
                          className={`${s.v}${porVencer || vencido ? ` ${s.warn}` : ""}`}
                        >
                          {cupon.vigenciaHasta
                            ? `${fechaCorta(cupon.vigenciaHasta)}${
                                porVencer ? ` · ${diasRestantes} días` : ""
                              }`
                            : "Sin vencimiento"}
                        </span>
                      </span>
                      {puedeEditar ? (
                        <span className={s.acts}>
                          <button
                            type="button"
                            className={s.ib}
                            onClick={() => setEditor(cupon)}
                            title="Editar"
                            aria-label={`Editar ${cupon.codigo}`}
                          >
                            <Edit3Icon />
                          </button>
                          <button
                            type="button"
                            className={s.ib}
                            onClick={() => void toggleActivo(cupon)}
                            title={cupon.activo ? "Pausar" : "Reactivar"}
                            aria-label={cupon.activo ? "Pausar" : "Reactivar"}
                          >
                            <PowerIcon />
                          </button>
                          <button
                            type="button"
                            className={`${s.ib} ${s.peligro}`}
                            onClick={() => setAEliminar(cupon)}
                            title="Eliminar"
                            aria-label={`Eliminar ${cupon.codigo}`}
                          >
                            <Trash2Icon />
                          </button>
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {/* Talón troquelado: el QR se ve siempre; al tocarlo se
                      abre grande para imprimir. */}
                  <div className={s.stub}>
                    {qrs[cupon.id] ? (
                      <button
                        type="button"
                        className={s.qr}
                        onClick={() => void verQr(cupon)}
                        title="Ver el QR grande para imprimir"
                        aria-label={`QR de ${cupon.codigo}`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={qrs[cupon.id]} alt="" />
                      </button>
                    ) : (
                      <span className={s.qrVacio} />
                    )}
                    <span className={s.usos}>
                      {cupon.usoMax == null
                        ? cupon.usoCount
                        : `${cupon.usoCount} / ${cupon.usoMax}`}
                    </span>
                    {cupon.usoMax != null ? (
                      <span
                        className={`${s.usoBarra}${agotado ? ` ${s.lleno}` : ""}`}
                      >
                        <i style={{ width: `${usoPct}%` }} />
                      </span>
                    ) : null}
                    <span className={s.cap}>
                      {cupon.usoMax == null ? "usos · libre" : "usos"}
                    </span>
                  </div>
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
              <span className={s.codigoGrande}>{qr.codigo}</span>
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
