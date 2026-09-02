"use client";

import * as React from "react";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  BoxesIcon,
  BoxIcon,
  GitBranchIcon,
  Layers3Icon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  Trash2Icon,
  WorkflowIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  construirColumnasProductivas,
  insertarNodoProductivo,
  moverNodoProductivo,
  type DestinoNodoProductivo,
} from "@/lib/modelo-productivo-layout";
import type {
  CatalogoFamilias,
  NodoRutaWorkflow,
  PasoTenant,
  ProductoListItem,
  RutaWorkflow,
  TipoNodoRutaWorkflow,
} from "@/lib/productos-servicios";
import styles from "./ruta-workflow-editor.module.css";

type OpcionNodo = {
  id: string;
  nombre: string;
  descripcion: string;
  tipo: TipoNodoRutaWorkflow;
  familiaCodigo?: string;
  producto?: ProductoListItem;
};

function columnasAWorkflow(
  columnas: string[][],
  nodosActuales: NodoRutaWorkflow[],
): RutaWorkflow {
  const porClave = new Map(nodosActuales.map((nodo) => [nodo.clave, nodo]));
  const nodos = columnas
    .flatMap((columna) => columna)
    .map((clave, orden) => ({
      ...porClave.get(clave)!,
      orden,
    }));
  const aristas = columnas
    .slice(1)
    .flatMap((columna, index) =>
      columnas[index].flatMap((desdeClave) =>
        columna.map((haciaClave) => ({ desdeClave, haciaClave })),
      ),
    );
  return {
    contractVersion: 1,
    topologia: columnas.some((columna) => columna.length > 1)
      ? "DAG"
      : "LINEAL",
    nodos,
    aristas,
  };
}

function claveNueva(prefijo: string) {
  return `${prefijo}:${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`}`;
}

function tituloNodo(nodo: NodoRutaWorkflow, familias: CatalogoFamilias) {
  if (nodo.tipo === "COMPONENTE") return nodo.nombre;
  return (
    nodo.nombreVisible?.trim() ||
    familias.familias.find((familia) => familia.codigo === nodo.familiaCodigo)
      ?.nombre ||
    "Paso de producción"
  );
}

function iconoTipo(tipo: TipoNodoRutaWorkflow) {
  if (tipo === "COMPONENTE") return BoxesIcon;
  if (tipo === "ETAPA") return Layers3Icon;
  return WorkflowIcon;
}

export function RutaWorkflowEditor({
  value,
  onChange,
  catalogoFamilias,
  pasosTenant,
  productos,
}: {
  value: RutaWorkflow;
  onChange: (workflow: RutaWorkflow) => void;
  catalogoFamilias: CatalogoFamilias;
  pasosTenant: PasoTenant[];
  productos: ProductoListItem[];
}) {
  const [destino, setDestino] = React.useState<DestinoNodoProductivo | null>(
    null,
  );
  const [tipo, setTipo] = React.useState<TipoNodoRutaWorkflow>("PASO");
  const [busqueda, setBusqueda] = React.useState("");
  const [arrastrando, setArrastrando] = React.useState<string | null>(null);
  const [zoom, setZoom] = React.useState(100);
  const [editando, setEditando] = React.useState<string | null>(null);
  const columnas = React.useMemo(
    () => construirColumnasProductivas(value.nodos, value.aristas),
    [value],
  );
  const columnasClaves = columnas.map((columna) =>
    columna.map((nodo) => nodo.clave),
  );
  const compuestos = React.useMemo(
    () =>
      new Map(
        pasosTenant
          .filter((paso) => paso.tipoPaso === "COMPUESTO")
          .map((paso) => [paso.id, paso]),
      ),
    [pasosTenant],
  );
  const opciones = React.useMemo<OpcionNodo[]>(() => {
    if (tipo === "COMPONENTE") {
      const usados = new Set(
        value.nodos
          .filter((nodo) => nodo.tipo === "COMPONENTE")
          .map((nodo) => nodo.productoComponenteId),
      );
      return productos
        .filter((producto) => !usados.has(producto.id))
        .map((producto) => ({
          id: producto.id,
          nombre: producto.nombre,
          descripcion: `${producto.codigo} · Producto con receta propia`,
          tipo,
          producto,
        }));
    }
    if (tipo === "ETAPA") {
      return [...compuestos.values()].map((paso) => ({
        id: paso.id,
        nombre: paso.nombre,
        descripcion: "Etapa consolidada · un estado en producción",
        tipo,
        familiaCodigo: paso.id,
      }));
    }
    return catalogoFamilias.familias
      .filter(
        (familia) =>
          familia.visibleEnSelector !== false &&
          !compuestos.has(familia.codigo),
      )
      .map((familia) => ({
        id: familia.codigo,
        nombre: familia.nombre,
        descripcion: familia.descripcion ?? "Operación individual",
        tipo,
        familiaCodigo: familia.codigo,
      }));
  }, [catalogoFamilias.familias, compuestos, productos, tipo, value.nodos]);
  const opcionesFiltradas = opciones.filter((opcion) =>
    `${opcion.nombre} ${opcion.descripcion}`
      .toLocaleLowerCase("es")
      .includes(busqueda.trim().toLocaleLowerCase("es")),
  );

  const abrirAlta = (
    nuevoDestino: DestinoNodoProductivo,
    tipoInicial: TipoNodoRutaWorkflow = "PASO",
  ) => {
    setDestino(nuevoDestino);
    setTipo(tipoInicial);
    setBusqueda("");
  };

  const agregar = (opcion: OpcionNodo) => {
    if (!destino) return;
    const nodo: NodoRutaWorkflow = opcion.producto
      ? {
          clave: claveNueva("componente"),
          tipo: "COMPONENTE",
          orden: value.nodos.length,
          productoComponenteId: opcion.producto.id,
          codigo: opcion.producto.codigo,
          nombre: opcion.producto.nombre,
          requerido: true,
        }
      : {
          clave: claveNueva("ruta-borrador"),
          tipo: opcion.tipo === "ETAPA" ? "ETAPA" : "PASO",
          orden: value.nodos.length,
          familiaCodigo: opcion.familiaCodigo!,
          nombreVisible: opcion.nombre,
          icono: opcion.tipo === "ETAPA" ? "Layers" : "Layout",
        };
    const siguientes = insertarNodoProductivo(
      columnasClaves,
      nodo.clave,
      destino,
    );
    onChange(columnasAWorkflow(siguientes, [...value.nodos, nodo]));
    setDestino(null);
  };

  const mover = (clave: string, nuevoDestino: DestinoNodoProductivo) => {
    const siguientes = moverNodoProductivo(columnasClaves, clave, nuevoDestino);
    onChange(columnasAWorkflow(siguientes, value.nodos));
  };

  const eliminar = (clave: string) => {
    const siguientes = columnasClaves
      .map((columna) => columna.filter((item) => item !== clave))
      .filter((columna) => columna.length > 0);
    onChange(
      columnasAWorkflow(
        siguientes,
        value.nodos.filter((nodo) => nodo.clave !== clave),
      ),
    );
  };

  const nodoEditado = value.nodos.find((nodo) => nodo.clave === editando);

  return (
    <section className={styles.editor}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>Workflow reusable</span>
          <h2>Recorrido de la ruta</h2>
          <p>
            Ordená de izquierda a derecha. Los nodos en una misma columna se
            ejecutan en paralelo.
          </p>
        </div>
        <div className={styles.headerTools}>
          <span className={styles.topology}>
            <GitBranchIcon /> Ruta {value.topologia}
          </span>
          <div className={styles.zoom}>
            <button
              type="button"
              onClick={() => setZoom((actual) => Math.max(70, actual - 10))}
              aria-label="Alejar Workflow"
            >
              <ZoomOutIcon />
            </button>
            <span>{zoom}%</span>
            <button
              type="button"
              onClick={() => setZoom((actual) => Math.min(130, actual + 10))}
              aria-label="Acercar Workflow"
            >
              <ZoomInIcon />
            </button>
          </div>
        </div>
      </header>

      <div className={styles.viewport}>
        <div
          className={styles.canvas}
          style={{ transform: `scale(${zoom / 100})` }}
        >
          <div className={styles.endpoint}>
            <span />
            <b>INICIO</b>
          </div>
          {columnas.length === 0 ? (
            <button
              type="button"
              className={styles.empty}
              onClick={() => abrirAlta({ tipo: "SECUENCIAL", posicion: 0 })}
            >
              <PlusIcon />
              <strong>Agregar primer nodo</strong>
              <span>Paso, Etapa o Componente</span>
            </button>
          ) : null}
          {columnas.map((columna, columnaIndex) => (
            <React.Fragment key={columna.map((nodo) => nodo.clave).join("|")}>
              <button
                type="button"
                className={styles.gapAdd}
                onClick={() =>
                  abrirAlta({ tipo: "SECUENCIAL", posicion: columnaIndex })
                }
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => {
                  if (arrastrando) {
                    mover(arrastrando, {
                      tipo: "SECUENCIAL",
                      posicion: columnaIndex,
                    });
                  }
                  setArrastrando(null);
                }}
                aria-label={`Agregar un momento antes del ${columnaIndex + 1}`}
              >
                <PlusIcon />
              </button>
              <div
                className={styles.moment}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => {
                  if (arrastrando) {
                    mover(arrastrando, {
                      tipo: "PARALELO",
                      columna: columnaIndex,
                    });
                  }
                  setArrastrando(null);
                }}
              >
                <div className={styles.momentHead}>
                  <span>
                    MOMENTO {String(columnaIndex + 1).padStart(2, "0")}
                  </span>
                  {columna.length > 1 ? (
                    <b>{columna.length} en paralelo</b>
                  ) : null}
                </div>
                <div className={styles.nodes}>
                  {columna.map((nodo) => {
                    const Icon = iconoTipo(nodo.tipo);
                    return (
                      <article
                        key={nodo.clave}
                        draggable
                        onDragStart={() => setArrastrando(nodo.clave)}
                        onDragEnd={() => setArrastrando(null)}
                        className={`${styles.node} ${styles[nodo.tipo.toLowerCase()]}`}
                      >
                        <div className={styles.nodeIcon}>
                          <Icon />
                        </div>
                        <div className={styles.nodeCopy}>
                          <span>
                            {nodo.tipo === "COMPONENTE"
                              ? "SUBRUTA FABRICADA"
                              : nodo.tipo === "ETAPA"
                                ? "ETAPA CONSOLIDADA"
                                : "PASO DE PRODUCCIÓN"}
                          </span>
                          <strong>{tituloNodo(nodo, catalogoFamilias)}</strong>
                          <small>
                            {nodo.tipo === "COMPONENTE"
                              ? "Receta y ruta propias"
                              : nodo.tipo === "ETAPA"
                                ? "Un estado en producción"
                                : "Operación individual"}
                          </small>
                        </div>
                        <div className={styles.nodeActions}>
                          {nodo.tipo !== "COMPONENTE" ? (
                            <button
                              type="button"
                              onClick={() => setEditando(nodo.clave)}
                              aria-label="Editar nombre del nodo"
                            >
                              <PencilIcon />
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => eliminar(nodo.clave)}
                            aria-label="Eliminar nodo"
                          >
                            <Trash2Icon />
                          </button>
                        </div>
                        <div className={styles.moveActions}>
                          <button
                            type="button"
                            disabled={columnaIndex === 0}
                            onClick={() =>
                              mover(nodo.clave, {
                                tipo: "SECUENCIAL",
                                posicion: columnaIndex - 1,
                              })
                            }
                            aria-label="Mover nodo a la izquierda"
                          >
                            <ArrowLeftIcon />
                          </button>
                          <button
                            type="button"
                            disabled={columnaIndex === columnas.length - 1}
                            onClick={() =>
                              mover(nodo.clave, {
                                tipo: "SECUENCIAL",
                                posicion: columnaIndex + 1,
                              })
                            }
                            aria-label="Mover nodo a la derecha"
                          >
                            <ArrowRightIcon />
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
                <button
                  type="button"
                  className={styles.parallelAdd}
                  onClick={() =>
                    abrirAlta({ tipo: "PARALELO", columna: columnaIndex })
                  }
                >
                  <PlusIcon /> Agregar en paralelo
                </button>
              </div>
            </React.Fragment>
          ))}
          {columnas.length > 0 ? (
            <button
              type="button"
              className={styles.gapAdd}
              onClick={() =>
                abrirAlta({
                  tipo: "SECUENCIAL",
                  posicion: columnas.length,
                })
              }
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => {
                if (arrastrando) {
                  mover(arrastrando, {
                    tipo: "SECUENCIAL",
                    posicion: columnas.length,
                  });
                }
                setArrastrando(null);
              }}
              aria-label="Agregar un momento al final"
            >
              <PlusIcon />
            </button>
          ) : null}
          <div className={`${styles.endpoint} ${styles.end}`}>
            <span />
            <b>FIN</b>
          </div>
        </div>
      </div>

      <Dialog
        open={Boolean(destino)}
        onOpenChange={(open) => !open && setDestino(null)}
      >
        <DialogContent className={styles.dialog}>
          <DialogHeader className={styles.dialogHeader}>
            <span className={styles.eyebrow}>
              Ruta de producción · nuevo nodo
            </span>
            <DialogTitle>¿Qué querés incorporar?</DialogTitle>
            <DialogDescription>
              Elegí la clase de nodo y luego una opción del catálogo.
            </DialogDescription>
          </DialogHeader>
          <div className={styles.typeGrid}>
            {(
              [
                ["PASO", WorkflowIcon, "Paso", "Una operación individual"],
                [
                  "COMPONENTE",
                  BoxesIcon,
                  "Componente",
                  "Producto hijo fabricado",
                ],
                ["ETAPA", Layers3Icon, "Etapa", "Subtareas con un estado"],
              ] as const
            ).map(([itemTipo, Icon, label, description]) => (
              <button
                type="button"
                key={itemTipo}
                className={tipo === itemTipo ? styles.typeActive : ""}
                onClick={() => setTipo(itemTipo)}
              >
                <Icon />
                <span>
                  <strong>{label}</strong>
                  <small>{description}</small>
                </span>
              </button>
            ))}
          </div>
          <label className={styles.search}>
            <SearchIcon />
            <Input
              value={busqueda}
              onChange={(event) => setBusqueda(event.target.value)}
              placeholder="Buscar por nombre"
            />
          </label>
          <div className={styles.optionList}>
            {opcionesFiltradas.map((opcion) => {
              const Icon = iconoTipo(opcion.tipo);
              return (
                <button
                  type="button"
                  key={opcion.id}
                  onClick={() => agregar(opcion)}
                >
                  <span className={styles.optionIcon}>
                    <Icon />
                  </span>
                  <span>
                    <strong>{opcion.nombre}</strong>
                    <small>{opcion.descripcion}</small>
                  </span>
                  <PlusIcon />
                </button>
              );
            })}
            {opcionesFiltradas.length === 0 ? (
              <div className={styles.noResults}>
                <BoxIcon /> No hay opciones disponibles para esta búsqueda.
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(nodoEditado)}
        onOpenChange={(open) => !open && setEditando(null)}
      >
        <DialogContent className={styles.nameDialog}>
          <DialogHeader>
            <DialogTitle>Nombre visible del nodo</DialogTitle>
            <DialogDescription>
              Este nombre se propone al aplicar la ruta a un producto.
            </DialogDescription>
          </DialogHeader>
          {nodoEditado && nodoEditado.tipo !== "COMPONENTE" ? (
            <Input
              autoFocus
              value={nodoEditado.nombreVisible ?? ""}
              onChange={(event) =>
                onChange({
                  ...value,
                  nodos: value.nodos.map((nodo) =>
                    nodo.clave === nodoEditado.clave &&
                    nodo.tipo !== "COMPONENTE"
                      ? { ...nodo, nombreVisible: event.target.value }
                      : nodo,
                  ),
                })
              }
            />
          ) : null}
          <div className={styles.nameActions}>
            <Button onClick={() => setEditando(null)}>Listo</Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
