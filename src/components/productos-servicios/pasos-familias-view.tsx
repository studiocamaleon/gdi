"use client";

/**
 * Pasos de producción: el catálogo del sistema + los pasos propios del
 * tenant, que son INSTANCIAS de una plantilla del catálogo y heredan su
 * ficha entera (docs/pasos-tenant-por-plantilla-diseno.md).
 *
 * El alta es un modal chico (nombre + plantilla), como el de máquina. Acá
 * vivía un wizard de 13 pantallas que pedía declarar la forma del paso
 * (mecanismo de cantidad, superficie de acomodo, outputs canónicos…): murió
 * con el modelo de instancias — la forma no se escribe, se hereda.
 */

import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ConfirmacionDestructiva } from "@/components/ui/confirmacion-destructiva";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { categoriaFamiliaLabels, getLabel } from "@/lib/labels-humanos";
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

export function PasosFamiliasView() {
  const [pasos, setPasos] = React.useState<PasoTenant[]>([]);
  const [plantillas, setPlantillas] = React.useState<PlantillaPaso[]>([]);
  const [catalogo, setCatalogo] = React.useState<CatalogoFamilias | null>(null);
  const [cargando, setCargando] = React.useState(true);
  const [altaAbierta, setAltaAbierta] = React.useState(false);
  const [aEliminar, setAEliminar] = React.useState<PasoTenant | null>(null);

  const recargar = React.useCallback(async () => {
    setPasos(await getPasosTenant());
  }, []);

  React.useEffect(() => {
    let vivo = true;
    (async () => {
      try {
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
        if (vivo) toast.error("No se pudieron cargar los pasos.");
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

  const toggleActivo = async (paso: PasoTenant) => {
    try {
      await actualizarPasoTenant(paso.id, { activo: !paso.activo });
      toast.success(paso.activo ? "Paso inhabilitado" : "Paso reactivado");
      await recargar();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo actualizar");
    }
  };

  const confirmarEliminar = async () => {
    if (!aEliminar) return;
    try {
      await eliminarPasoTenant(aEliminar.id);
      toast.success("Paso eliminado");
      setAEliminar(null);
      await recargar();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo eliminar");
    }
  };

  return (
    <div className="content">
      <div className="page-head">
        <div className="title-block">
          <h1>Pasos de producción</h1>
          <p>
            Los tipos de paso con los que se arman las rutas: el catálogo del
            sistema más los que crea tu empresa.
          </p>
        </div>
        {/* Sin pasos propios manda el CTA del estado vacío ("Crear el
            primero"); con pasos, este. Nunca los dos a la vez. */}
        {pasos.length > 0 ? (
          <Button onClick={() => setAltaAbierta(true)}>+ Nuevo paso</Button>
        ) : null}
      </div>

      <div className={s.wrap}>
        <section className={s.seccion}>
          <div className={s.seccionHead}>
            <div>
              <div className={s.seccionTitulo}>Tus pasos</div>
              <div className={s.seccionSub}>
                Creados por tu empresa a partir de una plantilla del catálogo:
                heredan cómo se calculan y sólo cambian el nombre y los
                defaults de tu taller.
              </div>
            </div>
          </div>

          {cargando ? (
            <div className={s.catalogoGrid}>Cargando…</div>
          ) : pasos.length === 0 ? (
            <EstadoVacio
              variant="compacto"
              titulo="Todavía no creaste pasos propios"
              cta={{
                label: "Crear el primero",
                onClick: () => setAltaAbierta(true),
              }}
            />
          ) : (
            <table className="tbl">
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
                {pasos.map((paso) => (
                  <tr
                    key={paso.id}
                    className={paso.activo ? undefined : s.inactiva}
                  >
                    <td>
                      <div className="name">{paso.nombre}</div>
                      {paso.descripcion ? (
                        <div className="desc">{paso.descripcion}</div>
                      ) : null}
                    </td>
                    <td>
                      {paso.heredaFicha === false ? (
                        <span className="tag warm">Plantilla inexistente</span>
                      ) : (
                        <span className={s.formaChip}>
                          {paso.plantillaNombre ?? paso.plantillaCodigo}
                        </span>
                      )}
                    </td>
                    <td>
                      {paso.categoria
                        ? getLabel(categoriaFamiliaLabels, paso.categoria).label
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
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleActivo(paso)}
                      >
                        {paso.activo ? "Inhabilitar" : "Reactivar"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setAEliminar(paso)}
                      >
                        Eliminar
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className={s.seccion}>
          <div className={s.seccionHead}>
            <div>
              <div className={s.seccionTitulo}>Catálogo del sistema</div>
              <div className={s.seccionSub}>
                Los {sistema.length} tipos de paso que trae Grafo. No se
                editan; cualquiera sirve de plantilla para un paso tuyo.
              </div>
            </div>
          </div>
          <table className="tbl">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Descripción</th>
                <th>Categoría</th>
              </tr>
            </thead>
            <tbody>
              {sistema.map((f) => (
                <tr key={f.codigo}>
                  <td>
                    <div className="name">{f.nombre}</div>
                  </td>
                  <td>
                    <div className="desc">{f.descripcion}</div>
                  </td>
                  <td>{getLabel(categoriaFamiliaLabels, f.categoria).label}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      <PasoAltaDialog
        open={altaAbierta}
        plantillas={plantillas}
        onClose={() => setAltaAbierta(false)}
        onCreado={async () => {
          setAltaAbierta(false);
          await recargar();
        }}
      />

      <ConfirmacionDestructiva
        open={aEliminar !== null}
        onOpenChange={(open) => {
          if (!open) setAEliminar(null);
        }}
        titulo="Eliminar paso"
        nombreItem={aEliminar?.nombre}
        requiereTipear={false}
        descripcion="Sólo se puede eliminar un paso que ninguna ruta ni orden usó jamás. Si tiene historial, el sistema va a ofrecer inhabilitarlo en su lugar."
        accionLabel="Eliminar"
        onConfirmar={confirmarEliminar}
      />
    </div>
  );
}
