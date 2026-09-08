"use client";

/**
 * Nodos de producción: el catálogo del sistema + los pasos propios del
 * tenant, que son INSTANCIAS de una plantilla del catálogo y heredan su
 * ficha entera (docs/pasos-tenant-por-plantilla-diseno.md).
 *
 * El alta es un modal chico (nombre + plantilla), como el de máquina. Acá
 * vivía un wizard de 13 pantallas que pedía declarar la forma del paso
 * (mecanismo de cantidad, superficie de acomodo, outputs canónicos…): murió
 * con el modelo de instancias — la forma no se escribe, se hereda.
 */

import { EncabezadoConfiguracion } from "@/components/configuracion/encabezado-configuracion";
import visual from "@/components/configuracion/grafoprint-configuracion.module.css";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { normalizarBusqueda } from "@/components/ui/select-buscable";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConfirmacionDestructiva } from "@/components/ui/confirmacion-destructiva";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { categoriaFamiliaLabels, getLabel } from "@/lib/labels-humanos";
import { descripcionPasoParaUsuario } from "@/lib/pasos-presentacion";
import type {
  CatalogoFamilias,
  PasoTenant,
  PlantillaPaso,
} from "@/lib/productos-servicios";
import {
  actualizarPasoTenant,
  eliminarPasoTenant,
  getCatalogoFamilias,
  getPasosTenant,
  getPlantillasPaso,
} from "@/lib/productos-servicios-api";

import { PasoAltaDialog } from "./paso-alta-dialog";
import s from "./pasos-familias.module.css";

export function PasosFamiliasView({
  puedeGestionar,
}: {
  puedeGestionar: boolean;
}) {
  const router = useRouter();
  const [pasos, setPasos] = React.useState<PasoTenant[]>([]);
  const [plantillas, setPlantillas] = React.useState<PlantillaPaso[]>([]);
  const [catalogo, setCatalogo] = React.useState<CatalogoFamilias | null>(null);
  const [cargando, setCargando] = React.useState(true);
  const [altaAbierta, setAltaAbierta] = React.useState(false);
  const [aEliminar, setAEliminar] = React.useState<PasoTenant | null>(null);
  const [errorCarga, setErrorCarga] = React.useState(false);
  const [busquedaCatalogo, setBusquedaCatalogo] = React.useState("");
  const [categoriaCatalogo, setCategoriaCatalogo] = React.useState("todas");
  const [tipoVisible, setTipoVisible] = React.useState<"SIMPLE" | "COMPUESTO">(
    "SIMPLE",
  );

  const recargar = React.useCallback(async () => {
    setPasos(await getPasosTenant());
  }, []);

  React.useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        setErrorCarga(false);
        const [filas, plants, cat] = await Promise.all([
          getPasosTenant(),
          getPlantillasPaso(),
          getCatalogoFamilias(),
        ]);
        if (!vivo) return;
        setPasos(filas);
        setPlantillas(plants);
        setCatalogo(cat);
      } catch {
        if (vivo) {
          setErrorCarga(true);
          toast.error("No se pudieron cargar los nodos.");
        }
      } finally {
        if (vivo) setCargando(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, []);

  const sistema = React.useMemo(
    () => (catalogo?.familias ?? []).filter((f) => f.origen === "sistema"),
    [catalogo],
  );
  const categoriasSistema = React.useMemo(
    () => [...new Set(sistema.map((familia) => familia.categoria))].sort(),
    [sistema],
  );
  const sistemaFiltrado = React.useMemo(() => {
    const query = normalizarBusqueda(busquedaCatalogo);
    return sistema.filter((familia) => {
      if (
        categoriaCatalogo !== "todas" &&
        familia.categoria !== categoriaCatalogo
      ) {
        return false;
      }
      if (!query) return true;
      const categoria = getLabel(
        categoriaFamiliaLabels,
        familia.categoria,
      ).label;
      return [
        familia.nombre,
        descripcionPasoParaUsuario(familia.descripcion),
        categoria,
      ].some((texto) => normalizarBusqueda(texto).includes(query));
    });
  }, [busquedaCatalogo, categoriaCatalogo, sistema]);
  const pasosVisibles = React.useMemo(
    () => pasos.filter((paso) => paso.tipoPaso === tipoVisible),
    [pasos, tipoVisible],
  );

  const toggleActivo = async (paso: PasoTenant) => {
    try {
      await actualizarPasoTenant(paso.id, { activo: !paso.activo });
      toast.success(paso.activo ? "Nodo inhabilitado" : "Nodo reactivado");
      await recargar();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo actualizar");
    }
  };

  const confirmarEliminar = async () => {
    if (!aEliminar) return;
    try {
      await eliminarPasoTenant(aEliminar.id);
      toast.success("Nodo eliminado");
      setAEliminar(null);
      await recargar();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo eliminar");
    }
  };

  return (
    <div className={`content ${visual.page}`}>
      <EncabezadoConfiguracion
        area="nodos"
        titulo="Nodos de producción"
        descripcion="Definí las operaciones del taller y cómo se calculan sus tiempos, materiales y recursos."
        acciones={
          puedeGestionar && pasos.length > 0 ? (
            <Button onClick={() => setAltaAbierta(true)}>+ Nuevo nodo</Button>
          ) : null
        }
      />

      <nav className={s.tipoNav} aria-label="Tipo de nodo">
        <button
          type="button"
          data-active={tipoVisible === "SIMPLE"}
          aria-pressed={tipoVisible === "SIMPLE"}
          onClick={() => setTipoVisible("SIMPLE")}
        >
          <strong>Nodos simples</strong>
          <span>Operaciones reales con tiempo, materiales y recursos</span>
        </button>
        <button
          type="button"
          data-active={tipoVisible === "COMPUESTO"}
          aria-pressed={tipoVisible === "COMPUESTO"}
          onClick={() => setTipoVisible("COMPUESTO")}
        >
          <strong>Nodos compuestos</strong>
          <span>Agrupan nodos simples en una operación de producción</span>
        </button>
      </nav>

      <div className={s.wrap}>
        <section className={s.seccion}>
          <div className={s.seccionHead}>
            <div>
              <div className={s.seccionTitulo}>
                {tipoVisible === "COMPUESTO"
                  ? "Tus nodos compuestos"
                  : "Tus nodos simples"}
              </div>
              <div className={s.seccionSub}>
                {tipoVisible === "COMPUESTO"
                  ? "Agrupan nodos simples y se configuran en el contexto de cada producto."
                  : "Creados por tu empresa a partir de una plantilla del catálogo: heredan cómo se calculan y agregan la configuración base de tu taller."}
              </div>
            </div>
          </div>

          {cargando ? (
            <div className={s.catalogoGrid}>Cargando…</div>
          ) : errorCarga ? (
            <EstadoVacio
              variant="compacto"
              titulo="No pudimos cargar tus nodos"
              descripcion="Revisá la conexión y volvé a intentar."
              cta={{
                label: "Reintentar",
                onClick: () => window.location.reload(),
              }}
            />
          ) : pasosVisibles.length === 0 ? (
            <EstadoVacio
              variant="compacto"
              titulo={
                tipoVisible === "COMPUESTO"
                  ? "Todavía no creaste nodos compuestos"
                  : "Todavía no creaste nodos simples"
              }
              cta={
                puedeGestionar
                  ? {
                      label: "Crear el primero",
                      onClick: () => setAltaAbierta(true),
                    }
                  : undefined
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="tbl min-w-[760px]">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Parte de</th>
                    <th>Categoría</th>
                    <th>Estación</th>
                    <th>Estado</th>
                    <th className="right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {pasosVisibles.map((paso) => (
                    <tr
                      key={paso.id}
                      className={paso.activo ? undefined : s.inactiva}
                    >
                      <td>
                        <div className="name">{paso.nombre}</div>
                        {paso.descripcion ? (
                          <div className="desc">{paso.descripcion}</div>
                        ) : null}
                        {paso.tipoPaso === "COMPUESTO" ? (
                          <span className="tag warm">
                            Nodo compuesto · {paso.pasosInternos?.length ?? 0}{" "}
                            nodos internos
                          </span>
                        ) : null}
                      </td>
                      <td>
                        {paso.heredaFicha === false ? (
                          <span className="tag warm">
                            Plantilla inexistente
                          </span>
                        ) : (
                          <span className={s.formaChip}>
                            {paso.tipoPaso === "COMPUESTO"
                              ? "Subflujo reutilizable"
                              : (paso.plantillaNombre ?? paso.plantillaCodigo)}
                          </span>
                        )}
                      </td>
                      <td>
                        {paso.categoria
                          ? getLabel(categoriaFamiliaLabels, paso.categoria)
                              .label
                          : "—"}
                      </td>
                      <td>
                        {paso.estacion ? (
                          <>
                            {paso.estacion.nombre}
                            {paso.estacionHeredada ? (
                              <span className="desc"> (de la plantilla)</span>
                            ) : null}
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>
                        <span className="tag">
                          {paso.activo ? "Activo" : "Inhabilitado"}
                        </span>
                      </td>
                      <td className="right">
                        {puedeGestionar ? (
                          <Link
                            href={`/productos-servicios/pasos/${paso.id}`}
                            className={buttonVariants({
                              variant: "outline",
                              size: "sm",
                            })}
                          >
                            Configurar
                          </Link>
                        ) : null}
                        {puedeGestionar ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleActivo(paso)}
                          >
                            {paso.activo ? "Inhabilitar" : "Reactivar"}
                          </Button>
                        ) : null}
                        {puedeGestionar ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setAEliminar(paso)}
                          >
                            Eliminar
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {tipoVisible === "SIMPLE" ? (
          <section className={s.seccion}>
            <div className={s.seccionHead}>
              <div>
                <div className={s.seccionTitulo}>Catálogo del sistema</div>
                <div className={s.seccionSub}>
                  Los {sistema.length} tipos de nodo que trae Grafoprint. Su
                  definición técnica se actualiza automáticamente; podés
                  configurar cómo los usa tu empresa.
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-3 border-b p-4 sm:flex-row">
              <Input
                type="search"
                value={busquedaCatalogo}
                onChange={(event) => setBusquedaCatalogo(event.target.value)}
                placeholder="Buscar un tipo de nodo"
                aria-label="Buscar en el catálogo de nodos"
                className="sm:max-w-sm"
              />
              <Select
                value={categoriaCatalogo}
                onValueChange={(value) =>
                  setCategoriaCatalogo(value ?? "todas")
                }
              >
                <SelectTrigger className="w-full sm:w-64">
                  <SelectValue>
                    {categoriaCatalogo === "todas"
                      ? "Todas las categorías"
                      : getLabel(categoriaFamiliaLabels, categoriaCatalogo)
                          .label}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="todas">Todas las categorías</SelectItem>
                    {categoriasSistema.map((categoria) => (
                      <SelectItem key={categoria} value={categoria}>
                        {getLabel(categoriaFamiliaLabels, categoria).label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div className="overflow-x-auto">
              <table className="tbl min-w-[760px]">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Descripción</th>
                    <th>Categoría</th>
                    <th className="right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {sistemaFiltrado.map((f) => (
                    <tr key={f.codigo}>
                      <td>
                        <div className="name">{f.nombre}</div>
                      </td>
                      <td>
                        <div className="desc">
                          {descripcionPasoParaUsuario(f.descripcion)}
                        </div>
                      </td>
                      <td>
                        {getLabel(categoriaFamiliaLabels, f.categoria).label}
                      </td>
                      <td className="right">
                        {puedeGestionar ? (
                          <Link
                            href={`/productos-servicios/pasos/${f.codigo}`}
                            className={buttonVariants({
                              variant: f.configBase ? "outline" : "ghost",
                              size: "sm",
                            })}
                          >
                            {f.configBase
                              ? "Editar configuración"
                              : "Configurar"}
                          </Link>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!cargando && sistemaFiltrado.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">
                No hay tipos de nodo que coincidan con esos filtros.
              </p>
            ) : null}
          </section>
        ) : null}
      </div>

      {puedeGestionar ? (
        <PasoAltaDialog
          open={altaAbierta}
          plantillas={plantillas}
          onClose={() => setAltaAbierta(false)}
          onCreado={(paso) => {
            setAltaAbierta(false);
            router.push(`/productos-servicios/pasos/${paso.id}`);
          }}
        />
      ) : null}

      <ConfirmacionDestructiva
        open={aEliminar !== null}
        onOpenChange={(open) => {
          if (!open) setAEliminar(null);
        }}
        titulo="Eliminar nodo"
        nombreItem={aEliminar?.nombre}
        requiereTipear={false}
        descripcion="Sólo se puede eliminar un nodo que ningún flujo ni orden usó jamás. Si tiene historial, el sistema va a ofrecer inhabilitarlo en su lugar."
        accionLabel="Eliminar"
        onConfirmar={confirmarEliminar}
      />
    </div>
  );
}
