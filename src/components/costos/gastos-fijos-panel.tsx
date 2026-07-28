"use client";

/**
 * Gastos fijos de estructura, con la forma de Holdprint: una lista y nada más.
 *
 * El módulo es INDEPENDIENTE — no lee de centros de costo ni de legajos — y por
 * eso tampoco clasifica por centro: el centro ya declara sus propios gastos en
 * su planilla, y cargarlos de los dos lados los contaría dos veces.
 * Ver docs/gastos-fijos-estructura-diseno.md
 */

import * as React from "react";
import { FilterIcon, PlusIcon, SearchIcon, XIcon } from "lucide-react";
import { toast } from "sonner";

import { GdiSpinner } from "@/components/brand/gdi-spinner";
import {
  createGastoFijo,
  eliminarGastoFijo,
  FRECUENCIAS_GASTO_FIJO,
  FRECUENCIA_LABEL,
  getGastosFijos,
  updateGastoFijo,
  type FrecuenciaGastoFijo,
  type GastoFijo,
  type GastoFijoPayload,
} from "@/lib/gastos-fijos-api";
import { getProveedores } from "@/lib/proveedores-api";
import { getCategoriasEgreso } from "@/lib/egresos-api";
import type { CategoriaEgreso } from "@/lib/egresos";
import { getMetodosPago } from "@/lib/administracion-api";
import { formatearMoneda } from "@/lib/moneda";
import { useConfigRegional } from "@/components/navigation/config-regional-provider";
import { ConfirmacionDestructiva } from "@/components/ui/confirmacion-destructiva";
import { ConfirmacionSalida } from "@/components/ui/confirmacion-salida";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

type Estado = "todos" | "activos" | "inactivos";

type Formulario = {
  nombre: string;
  valor: string;
  frecuencia: FrecuenciaGastoFijo;
  metodoPagoId: string;
  proveedorId: string;
  notas: string;
  categoriaEgresoId: string;
  documento: string;
  vigenteDesde: string;
  /** Cómo termina la vigencia, como en el modelo de referencia. */
  fin: "nunca" | "en" | "despues";
  vigenteHasta: string;
  repeticiones: string;
};

const SIN_VALOR = "__ninguno__";

/** Cuántas veces al año se paga cada frecuencia. */
const CUOTAS_POR_ANIO: Record<FrecuenciaGastoFijo, number> = {
  MENSUAL: 12,
  BIMESTRAL: 6,
  TRIMESTRAL: 4,
  SEMESTRAL: 2,
  ANUAL: 1,
};

function periodoActual() {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`;
}

function formularioVacio(): Formulario {
  return {
    nombre: "",
    valor: "",
    frecuencia: "MENSUAL",
    metodoPagoId: "",
    proveedorId: "",
    notas: "",
    categoriaEgresoId: "",
    documento: "",
    vigenteDesde: periodoActual(),
    fin: "nunca",
    vigenteHasta: "",
    repeticiones: "",
  };
}

function desdeGasto(g: GastoFijo): Formulario {
  return {
    nombre: g.nombre,
    valor: String(g.valor),
    frecuencia: g.frecuencia,
    metodoPagoId: g.metodoPagoId ?? "",
    proveedorId: g.proveedorId ?? "",
    notas: g.notas ?? "",
    categoriaEgresoId: g.categoriaEgresoId,
    documento: g.documento ?? "",
    vigenteDesde: g.vigenteDesde,
    fin: g.vigenteHasta ? "en" : "nunca",
    vigenteHasta: g.vigenteHasta ?? "",
    repeticiones: "",
  };
}

/**
 * El catálogo de categorías no guarda color, así que el punto de la lista lo
 * deriva del código: mismo código, mismo color siempre, sin tocar el schema.
 */
const PALETA = [
  "#2f6fdb", "#d9642a", "#7a52d0", "#1f9d6b", "#b8791b",
  "#0e9aa7", "#c0392b", "#3f8f8a", "#9a6b3f", "#c77dab",
];
function colorCategoria(codigo: string): string {
  let h = 0;
  for (let i = 0; i < codigo.length; i++) h = (h * 31 + codigo.charCodeAt(i)) >>> 0;
  return PALETA[h % PALETA.length];
}

const numero = (v: string) => {
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

/**
 * "Termina después de N repeticiones" se resuelve acá y viaja como un
 * `vigenteHasta` concreto: la base guarda vigencias, no reglas, así que la
 * cuenta se hace una vez y el resultado queda a la vista al reabrir la ficha.
 */
function calcularVigenteHasta(f: Formulario): string | null {
  if (f.fin === "nunca") return null;
  if (f.fin === "en") return f.vigenteHasta || null;

  const repeticiones = Math.max(1, Math.round(numero(f.repeticiones)));
  const mesesPorCuota = 12 / CUOTAS_POR_ANIO[f.frecuencia];
  const [anio, mes] = f.vigenteDesde.split("-").map(Number);
  if (!anio || !mes) return null;

  const indice = anio * 12 + (mes - 1) + repeticiones * mesesPorCuota - 1;
  return `${Math.floor(indice / 12)}-${String((indice % 12) + 1).padStart(2, "0")}`;
}

export function GastosFijosPanel({ initialGastos }: { initialGastos: GastoFijo[] }) {
  const { moneda } = useConfigRegional();
  const fmt = (v: number) => formatearMoneda(v, moneda, { decimales: 2 });

  const [gastos, setGastos] = React.useState(initialGastos);
  const [busqueda, setBusqueda] = React.useState("");
  const [estado, setEstado] = React.useState<Estado>("todos");
  const [filtroAbierto, setFiltroAbierto] = React.useState(false);
  const [fichaAbierta, setFichaAbierta] = React.useState(false);
  const [editando, setEditando] = React.useState<GastoFijo | null>(null);
  const [aEliminar, setAEliminar] = React.useState<GastoFijo | null>(null);
  const [form, setForm] = React.useState<Formulario>(formularioVacio);
  const [tab, setTab] = React.useState<"datos" | "clasificacion">("datos");
  const [guardando, setGuardando] = React.useState(false);
  const [sucio, setSucio] = React.useState(false);
  const [confirmandoSalida, setConfirmandoSalida] = React.useState(false);
  const [proveedores, setProveedores] = React.useState<
    Array<{ id: string; nombre: string }>
  >([]);
  const [metodos, setMetodos] = React.useState<
    Array<{ id: string; nombre: string }>
  >([]);
  const [categorias, setCategorias] = React.useState<CategoriaEgreso[]>([]);

  // Proveedores y métodos de pago se piden al abrir la ficha por primera vez:
  // son catálogos que casi no cambian y no hacen falta para ver la lista.
  const cargarCatalogos = React.useCallback(async () => {
    if (categorias.length > 0) return;
    try {
      const [ps, ms, cs] = await Promise.all([
        getProveedores(),
        getMetodosPago(),
        getCategoriasEgreso(),
      ]);
      setProveedores(ps.map((p) => ({ id: p.id, nombre: p.nombre })));
      setMetodos(ms.map((m) => ({ id: m.id, nombre: m.nombre })));
      // Un gasto fijo es por definición de estructura: las de producción o
      // inversión son del otro lado del catálogo y acá no aplican.
      setCategorias(
        cs.filter((c) => c.activo && c.naturaleza === "GASTO_ESTRUCTURA"),
      );
    } catch {
      // Que no se pueda elegir favorecido no debería impedir cargar el gasto.
    }
  }, [categorias.length]);

  // Un gasto nuevo arranca con una categoría puesta para no obligar a elegirla:
  // "Otros gastos" si existe, y si no la primera del catálogo.
  React.useEffect(() => {
    if (categorias.length === 0) return;
    setForm((f) =>
      f.categoriaEgresoId
        ? f
        : {
            ...f,
            categoriaEgresoId:
              categorias.find((c) => c.codigo === "otros_gastos")?.id ??
              categorias[0].id,
          },
    );
  }, [categorias]);

  const recargar = React.useCallback(async () => {
    try {
      setGastos(await getGastosFijos());
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudieron cargar los gastos.",
      );
    }
  }, []);

  const filtrados = React.useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    return gastos.filter((g) => {
      if (estado === "activos" && !g.activo) return false;
      if (estado === "inactivos" && g.activo) return false;
      if (!termino) return true;
      return (
        g.nombre.toLowerCase().includes(termino) ||
        (g.proveedorNombre ?? "").toLowerCase().includes(termino)
      );
    });
  }, [gastos, busqueda, estado]);

  // El total suma el MENSUAL, que es lo que pesa en el punto de equilibrio.
  // Sumar las cuotas mezclaría un seguro anual con un alquiler mensual y daría
  // un número que no significa nada.
  const total = filtrados.reduce((acc, g) => acc + g.importeMensual, 0);

  const abrir = (gasto: GastoFijo | null) => {
    setEditando(gasto);
    setForm(gasto ? desdeGasto(gasto) : formularioVacio());
    setTab("datos");
    setSucio(false);
    setFichaAbierta(true);
    void cargarCatalogos();
  };

  const editar = <K extends keyof Formulario>(campo: K, valor: Formulario[K]) => {
    setForm((actual) => ({ ...actual, [campo]: valor }));
    setSucio(true);
  };

  const guardar = async () => {
    if (!form.nombre.trim()) {
      toast.error("El gasto necesita una descripción.");
      return;
    }
    if (!form.categoriaEgresoId) {
      toast.error("Elegí una categoría para el gasto.");
      return;
    }
    setGuardando(true);
    try {
      const payload: GastoFijoPayload = {
        nombre: form.nombre.trim(),
        categoriaEgresoId: form.categoriaEgresoId,
        valor: numero(form.valor),
        frecuencia: form.frecuencia,
        proveedorId: form.proveedorId || null,
        metodoPagoId: form.metodoPagoId || null,
        documento: form.documento.trim() || null,
        vigenteDesde: form.vigenteDesde,
        vigenteHasta: calcularVigenteHasta(form),
        notas: form.notas.trim() || null,
      };
      if (editando) await updateGastoFijo(editando.id, payload);
      else await createGastoFijo(payload);

      setSucio(false);
      toast.success(editando ? "Gasto guardado." : "Gasto creado.");
      setFichaAbierta(false);
      await recargar();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo guardar el gasto.",
      );
    } finally {
      setGuardando(false);
    }
  };

  const pedirCierre = (siguiente: boolean) => {
    if (siguiente) return setFichaAbierta(true);
    if (sucio) return setConfirmandoSalida(true);
    setFichaAbierta(false);
  };

  const mensualDelForm =
    (numero(form.valor) * CUOTAS_POR_ANIO[form.frecuencia]) / 12;

  return (
    <div className="content">
      <div className="page-head">
        <div className="title-block">
          <h1>Gastos fijos</h1>
          <div className="sub">
            Lo que la estructura cuesta todos los meses, con trabajo o sin él.
            Es la base del punto de equilibrio.
          </div>
        </div>
      </div>

      <div className="gfijo-toolbar">
        <div className="gfijo-buscador">
          <SearchIcon />
          <input
            type="search"
            placeholder="Búsqueda"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            aria-label="Buscar gasto fijo"
          />
        </div>
        <div className="gfijo-acciones">
          <button
            type="button"
            className={`gfijo-btn ${filtroAbierto ? "activo" : ""}`}
            onClick={() => setFiltroAbierto((v) => !v)}
          >
            <FilterIcon />
            Filtrar
          </button>
          <button
            type="button"
            className="gfijo-btn gfijo-btn-primario"
            onClick={() => abrir(null)}
          >
            <PlusIcon />
            Insertar gasto
          </button>
        </div>
      </div>

      {filtroAbierto ? (
        <div className="gfijo-filtros">
          <label className="gfijo-chip">
            <span>Estado</span>
            <select
              value={estado}
              onChange={(e) => setEstado(e.target.value as Estado)}
            >
              <option value="todos">Todos</option>
              <option value="activos">Activos</option>
              <option value="inactivos">Inactivos</option>
            </select>
          </label>
          <button
            type="button"
            className="gfijo-cerrar-filtros"
            aria-label="Quitar filtros"
            onClick={() => {
              setEstado("todos");
              setFiltroAbierto(false);
            }}
          >
            <XIcon />
          </button>
        </div>
      ) : null}

      <div className="card tbl-scroll">
        <table className="tbl gfijo-tabla">
          <thead>
            <tr>
              <th>Descripción</th>
              <th>Categoría</th>
              <th>Favorecido</th>
              <th>Frecuencia</th>
              <th className="right">Valor</th>
              <th className="right sticky-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.length === 0 ? (
              <tr>
                <td colSpan={6} className="gfijo-vacio">
                  <div>No hay elementos registrados</div>
                  <button type="button" onClick={() => abrir(null)}>
                    Haga clic aquí
                  </button>{" "}
                  para añadir
                </td>
              </tr>
            ) : null}
            {filtrados.map((g) => (
              <tr key={g.id} className={g.activo ? "" : "gfijo-inactivo"}>
                <td>
                  <div className="name">{g.nombre}</div>
                </td>
                <td className="gfijo-cat" title={g.categoriaNombre}>
                  <span
                    className="gfijo-punto"
                    style={{ background: colorCategoria(g.categoriaCodigo) }}
                  />
                  {g.categoriaNombre}
                </td>
                <td>{g.proveedorNombre ?? "—"}</td>
                <td>{FRECUENCIA_LABEL[g.frecuencia]}</td>
                <td className="right numeric">
                  <div className="strong-value">{fmt(g.valor)}</div>
                  {g.frecuencia !== "MENSUAL" ? (
                    <div className="desc">{fmt(g.importeMensual)} / mes</div>
                  ) : null}
                </td>
                <td className="right sticky-right">
                  <span className="centros-actions">
                    <button type="button" className="btn" onClick={() => abrir(g)}>
                      Editar
                    </button>
                    <button
                      type="button"
                      className="icon-btn"
                      title="Eliminar"
                      aria-label={`Eliminar ${g.nombre}`}
                      onClick={() => setAEliminar(g)}
                    >
                      <XIcon />
                    </button>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="gfijo-total">
        <span>Total mensual:</span>
        <strong>{fmt(total)}</strong>
      </div>

      <Sheet open={fichaAbierta} onOpenChange={pedirCierre}>
        <SheetContent
          side="right"
          className="gfijo-ficha !w-[min(720px,96vw)] !max-w-none"
        >
          <SheetHeader>
            <SheetTitle>
              {editando ? "Gasto fijo" : "Añadir gastos fijos"}
            </SheetTitle>
            <SheetDescription>
              Se carga el valor de una cuota y cada cuánto se paga; el mensual lo
              calcula el sistema.
            </SheetDescription>
          </SheetHeader>

          <nav className="gfijo-tabs">
            {(
              [
                ["datos", "Datos generales"],
                ["clasificacion", "Clasificación"],
              ] as const
            ).map(([valor, etiqueta]) => (
              <button
                key={valor}
                type="button"
                className={`gfijo-tab ${tab === valor ? "activa" : ""}`}
                onClick={() => setTab(valor)}
              >
                {etiqueta}
              </button>
            ))}
          </nav>

          <div className="gfijo-cuerpo">
            {tab === "datos" ? (
              <>
                <section className="gfijo-seccion">
                  <header className="gfijo-seccion-head">
                    <h3>Datos del gasto</h3>
                  </header>
                  <div className="gfijo-form">
                    <label className="gfijo-ancho">
                      <span>Descripción *</span>
                      <input
                        value={form.nombre}
                        placeholder="Alquiler del local"
                        onChange={(e) => editar("nombre", e.target.value)}
                      />
                    </label>
                    <label>
                      <span>Valor *</span>
                      <input
                        inputMode="decimal"
                        value={form.valor}
                        placeholder="0,00"
                        onChange={(e) => editar("valor", e.target.value)}
                      />
                    </label>
                    <label>
                      <span>Período *</span>
                      <select
                        value={form.frecuencia}
                        onChange={(e) =>
                          editar("frecuencia", e.target.value as FrecuenciaGastoFijo)
                        }
                      >
                        {FRECUENCIAS_GASTO_FIJO.map((f) => (
                          <option key={f.value} value={f.value}>
                            {f.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>Forma de pago</span>
                      <select
                        value={form.metodoPagoId || SIN_VALOR}
                        onChange={(e) =>
                          editar(
                            "metodoPagoId",
                            e.target.value === SIN_VALOR ? "" : e.target.value,
                          )
                        }
                      >
                        <option value={SIN_VALOR}>Sin especificar</option>
                        {metodos.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.nombre}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="gfijo-ancho">
                      <span>Favorecido</span>
                      <select
                        value={form.proveedorId || SIN_VALOR}
                        onChange={(e) =>
                          editar(
                            "proveedorId",
                            e.target.value === SIN_VALOR ? "" : e.target.value,
                          )
                        }
                      >
                        <option value={SIN_VALOR}>Sin especificar</option>
                        {proveedores.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.nombre}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="gfijo-ancho">
                      <span>Observación</span>
                      <textarea
                        rows={3}
                        value={form.notas}
                        onChange={(e) => editar("notas", e.target.value)}
                      />
                    </label>
                  </div>
                  {numero(form.valor) > 0 && form.frecuencia !== "MENSUAL" ? (
                    <footer className="gfijo-seccion-foot">
                      <span>Se prorratea para el punto de equilibrio</span>
                      <strong>= {fmt(mensualDelForm)} / mes</strong>
                    </footer>
                  ) : null}
                </section>

                <section className="gfijo-seccion">
                  <header className="gfijo-seccion-head">
                    <h3>Vigencia</h3>
                    <p>
                      Desde qué mes cuenta para la estructura y hasta cuándo. El
                      histórico queda: subir el alquiler en julio no cambia lo
                      que costó en junio.
                    </p>
                  </header>
                  <div className="gfijo-form">
                    <label>
                      <span>Empezando en *</span>
                      <input
                        type="month"
                        value={form.vigenteDesde}
                        onChange={(e) =>
                          editar("vigenteDesde", e.target.value || periodoActual())
                        }
                      />
                    </label>
                    <fieldset className="gfijo-fin gfijo-ancho">
                      <legend>Termina en</legend>
                      {(
                        [
                          ["nunca", "Nunca"],
                          ["en", "En"],
                          ["despues", "Después"],
                        ] as const
                      ).map(([valor, etiqueta]) => (
                        <label key={valor} className="gfijo-radio">
                          <input
                            type="radio"
                            name="gfijo-fin"
                            checked={form.fin === valor}
                            onChange={() => editar("fin", valor)}
                          />
                          <span>{etiqueta}</span>
                        </label>
                      ))}
                      {form.fin === "en" ? (
                        <input
                          type="month"
                          value={form.vigenteHasta}
                          onChange={(e) => editar("vigenteHasta", e.target.value)}
                        />
                      ) : null}
                      {form.fin === "despues" ? (
                        <span className="gfijo-repeticiones">
                          <input
                            inputMode="numeric"
                            value={form.repeticiones}
                            placeholder="12"
                            onChange={(e) => editar("repeticiones", e.target.value)}
                          />
                          <span>
                            repeticiones
                            {calcularVigenteHasta(form)
                              ? ` · hasta ${calcularVigenteHasta(form)}`
                              : ""}
                          </span>
                        </span>
                      ) : null}
                    </fieldset>
                  </div>
                </section>
              </>
            ) : null}

            {tab === "clasificacion" ? (
              <section className="gfijo-seccion">
                <header className="gfijo-seccion-head">
                  <h3>Clasificación</h3>
                  <p>
                    El gasto fijo no se imputa a centros de costo: el centro ya
                    declara sus propios gastos en su planilla, y cargarlos de los
                    dos lados los contaría dos veces.
                  </p>
                </header>
                <div className="gfijo-form">
                  <label>
                    <span>Clasificar gasto</span>
                    <select
                      value={form.categoriaEgresoId}
                      onChange={(e) => editar("categoriaEgresoId", e.target.value)}
                    >
                      {categorias.length === 0 ? (
                        <option value="">Cargando…</option>
                      ) : null}
                      {categorias.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nombre}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Documento</span>
                    <input
                      value={form.documento}
                      placeholder="Factura, contrato…"
                      onChange={(e) => editar("documento", e.target.value)}
                    />
                  </label>
                </div>
              </section>
            ) : null}
          </div>

          <SheetFooter className="gfijo-acciones-pie">
            <Button variant="outline" onClick={() => pedirCierre(false)}>
              Cancelar
            </Button>
            <Button onClick={guardar} disabled={guardando}>
              {guardando ? <GdiSpinner className="size-4" /> : null}
              Guardar
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <ConfirmacionSalida
        open={confirmandoSalida}
        cambios={1}
        guardando={guardando}
        onGuardarYSalir={async () => {
          setConfirmandoSalida(false);
          await guardar();
        }}
        onDescartarYSalir={() => {
          setConfirmandoSalida(false);
          setSucio(false);
          setFichaAbierta(false);
        }}
        onSeguirEditando={() => setConfirmandoSalida(false)}
      />

      <ConfirmacionDestructiva
        open={aEliminar !== null}
        onOpenChange={(abierto) => {
          if (!abierto) setAEliminar(null);
        }}
        titulo="Eliminar gasto fijo"
        descripcion={`¿Eliminar "${aEliminar?.nombre ?? ""}" de la estructura?`}
        impacto={[
          "El punto de equilibrio baja en ese importe.",
          "Esta acción no se puede deshacer.",
        ]}
        nombreItem={aEliminar?.nombre}
        requiereTipear={false}
        accionLabel="Eliminar"
        onConfirmar={async () => {
          if (!aEliminar) return;
          const gasto = aEliminar;
          setAEliminar(null);
          try {
            await eliminarGastoFijo(gasto.id);
            toast.success(`"${gasto.nombre}" eliminado.`);
            await recargar();
          } catch (error) {
            toast.error(
              error instanceof Error ? error.message : "No se pudo eliminar.",
            );
          }
        }}
      />
    </div>
  );
}
