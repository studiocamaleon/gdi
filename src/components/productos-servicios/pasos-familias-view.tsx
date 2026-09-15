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

import * as React from "react";
import { PlusIcon, SearchIcon, WorkflowIcon, BoxesIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Card, Chip, Modal, SearchField, Tabs } from "@heroui/react";
import { ActionButton as Button } from "@/components/design-system/action-button";
import { ActionLink } from "@/components/design-system/action-link";
import { SelectField } from "@/components/design-system/select-field";
import { NavigationTabList } from "@/components/design-system/navigation-tab-list";
import { FormDialog } from "@/components/design-system/form-dialog";
import { useDesignScope } from "@/components/design-system/appearance";
import { normalizarBusqueda } from "@/components/ui/select-buscable";
import { GrafoprintLoadingIndicator } from "@/components/brand/grafoprint-loading";
import theme from "@/components/design-system/theme.module.css";
import listPage from "@/components/design-system/list-page.module.css";
import focus from "@/components/design-system/field-focus.module.css";
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
  const scope = useDesignScope();
  const router = useRouter();
  const [pasos, setPasos] = React.useState<PasoTenant[]>([]);
  const [plantillas, setPlantillas] = React.useState<PlantillaPaso[]>([]);
  const [catalogo, setCatalogo] = React.useState<CatalogoFamilias | null>(null);
  const [cargando, setCargando] = React.useState(true);
  const [altaAbierta, setAltaAbierta] = React.useState(false);
  const [aEliminar, setAEliminar] = React.useState<PasoTenant | null>(null);
  const [eliminando, setEliminando] = React.useState(false);
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
    <main {...scope} className={`${theme.theme} ${listPage.page}`}>
      <header className={listPage.header}>
        <div>
          <h1>Nodos de producción</h1>
          <p className={listPage.subtitle}>
            Definí las operaciones del taller y cómo se calculan sus tiempos,
            materiales y recursos.
          </p>
        </div>
        {puedeGestionar && pasos.length > 0 ? (
          <Button onPress={() => setAltaAbierta(true)}>
            <PlusIcon />
            Nuevo nodo
          </Button>
        ) : null}
      </header>
      <Tabs
        selectedKey={tipoVisible}
        onSelectionChange={(key) =>
          setTipoVisible(key as "SIMPLE" | "COMPUESTO")
        }
      >
        <NavigationTabList
          label="Tipo de nodo"
          items={[
            {
              id: "SIMPLE",
              label: "Nodos simples",
              icon: <WorkflowIcon />,
              description:
                "Operaciones reales con tiempo, materiales y recursos",
            },
            {
              id: "COMPUESTO",
              label: "Nodos compuestos",
              icon: <BoxesIcon />,
              description:
                "Agrupan nodos simples en una operación de producción",
            },
          ]}
          variant="detailed"
        />
        <Tabs.Panel id={tipoVisible} className={s.wrap}>
          <Card className={s.seccion}>
            <Card.Header className={s.seccionHead}>
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
            </Card.Header>

            {cargando ? (
              <div className={s.empty}>
                <GrafoprintLoadingIndicator />
              </div>
            ) : errorCarga ? (
              <div className={s.empty}>
                <h3>No pudimos cargar tus nodos</h3>
                <p>Revisá la conexión y volvé a intentar.</p>
                <Button onPress={() => window.location.reload()}>
                  Reintentar
                </Button>
              </div>
            ) : pasosVisibles.length === 0 ? (
              <div className={s.empty}>
                <h3>
                  {tipoVisible === "COMPUESTO"
                    ? "Todavía no creaste nodos compuestos"
                    : "Todavía no creaste nodos simples"}
                </h3>
                {puedeGestionar ? (
                  <Button onPress={() => setAltaAbierta(true)}>
                    <PlusIcon />
                    Crear el primero
                  </Button>
                ) : null}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className={s.table}>
                  <thead>
                    <tr>
                      <th>Nombre</th>
                      <th>Parte de</th>
                      <th>Categoría</th>
                      <th>Estación</th>
                      <th>Estado</th>
                      <th className={s.actionsCell}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pasosVisibles.map((paso) => (
                      <tr
                        key={paso.id}
                        className={paso.activo ? undefined : s.inactiva}
                      >
                        <td>
                          <div className={s.name}>{paso.nombre}</div>
                          {paso.descripcion ? (
                            <div className={s.description}>
                              {paso.descripcion}
                            </div>
                          ) : null}
                          {paso.tipoPaso === "COMPUESTO" ? (
                            <Chip size="sm" color="warning" variant="soft">
                              Nodo compuesto · {paso.pasosInternos?.length ?? 0}{" "}
                              nodos internos
                            </Chip>
                          ) : null}
                        </td>
                        <td>
                          {paso.heredaFicha === false ? (
                            <Chip size="sm" color="warning" variant="soft">
                              Plantilla inexistente
                            </Chip>
                          ) : (
                            <span className={s.formaChip}>
                              {paso.tipoPaso === "COMPUESTO"
                                ? "Subflujo reutilizable"
                                : (paso.plantillaNombre ??
                                  paso.plantillaCodigo)}
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
                                <span className={s.description}>
                                  {" "}
                                  (de la plantilla)
                                </span>
                              ) : null}
                            </>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td>
                          <Chip
                            size="sm"
                            color={paso.activo ? "success" : "default"}
                            variant="soft"
                          >
                            {paso.activo ? "Activo" : "Inhabilitado"}
                          </Chip>
                        </td>
                        <td className={s.actionsCell}>
                          {puedeGestionar ? (
                            <ActionLink
                              href={`/productos-servicios/pasos/${paso.id}`}
                              variant={"outline"}
                            >
                              Configurar
                            </ActionLink>
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
          </Card>

          {tipoVisible === "SIMPLE" ? (
            <Card className={s.seccion}>
              <Card.Header className={s.seccionHead}>
                <div>
                  <div className={s.seccionTitulo}>Catálogo del sistema</div>
                  <div className={s.seccionSub}>
                    Los {sistema.length} tipos de nodo que trae Grafoprint. Su
                    definición técnica se actualiza automáticamente; podés
                    configurar cómo los usa tu empresa.
                  </div>
                </div>
              </Card.Header>
              <div className="flex flex-col gap-3 border-b p-4 sm:flex-row">
                <SearchField
                  aria-label="Buscar en el catálogo de nodos"
                  value={busquedaCatalogo}
                  onChange={setBusquedaCatalogo}
                  className={s.search}
                >
                  <SearchField.Group className={focus.singleBorder}>
                    <SearchField.SearchIcon>
                      <SearchIcon />
                    </SearchField.SearchIcon>
                    <SearchField.Input placeholder="Buscar un tipo de nodo" />
                    <SearchField.ClearButton aria-label="Limpiar búsqueda" />
                  </SearchField.Group>
                </SearchField>
                <SelectField
                  aria-label="Categoría del catálogo"
                  value={categoriaCatalogo}
                  onChange={(value) => setCategoriaCatalogo(value ?? "todas")}
                  className={s.categoryFilter}
                  options={[
                    { value: "todas", label: "Todas las categorías" },
                    ...categoriasSistema.map((categoria) => ({
                      value: categoria,
                      label: getLabel(categoriaFamiliaLabels, categoria).label,
                    })),
                  ]}
                />
              </div>
              <div className="overflow-x-auto">
                <table className={s.table}>
                  <thead>
                    <tr>
                      <th>Nombre</th>
                      <th>Descripción</th>
                      <th>Categoría</th>
                      <th className={s.actionsCell}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sistemaFiltrado.map((f) => (
                      <tr key={f.codigo}>
                        <td>
                          <div className={s.name}>{f.nombre}</div>
                        </td>
                        <td>
                          <div className={s.description}>
                            {descripcionPasoParaUsuario(f.descripcion)}
                          </div>
                        </td>
                        <td>
                          {getLabel(categoriaFamiliaLabels, f.categoria).label}
                        </td>
                        <td className={s.actionsCell}>
                          {puedeGestionar ? (
                            <ActionLink
                              href={`/productos-servicios/pasos/${f.codigo}`}
                              variant={f.configBase ? "outline" : "ghost"}
                            >
                              {f.configBase
                                ? "Editar configuración"
                                : "Configurar"}
                            </ActionLink>
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
            </Card>
          ) : null}
        </Tabs.Panel>
      </Tabs>

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

      <FormDialog
        isDismissable={!eliminando}
        isOpen={aEliminar !== null}
        onOpenChange={(open) => {
          if (!open) setAEliminar(null);
        }}
        title="Eliminar nodo"
        description="Sólo se puede eliminar un nodo que ningún flujo ni orden usó jamás. Si tiene historial, el sistema va a ofrecer inhabilitarlo en su lugar."
      >
        <Modal.Body className={s.dialogBody}>
          <p>
            ¿Eliminar <strong>{aEliminar?.nombre}</strong>?
          </p>
        </Modal.Body>
        <Modal.Footer className={s.dialogFooter}>
          <Button
            variant="outline"
            isDisabled={eliminando}
            onPress={() => setAEliminar(null)}
          >
            Cancelar
          </Button>
          <Button
            variant="danger"
            isDisabled={eliminando}
            onPress={async () => {
              if (eliminando) return;
              setEliminando(true);
              try {
                await confirmarEliminar();
              } finally {
                setEliminando(false);
              }
            }}
          >
            {eliminando ? "Eliminando…" : "Eliminar"}
          </Button>
        </Modal.Footer>
      </FormDialog>
    </main>
  );
}
