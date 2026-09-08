"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { BoxesIcon, CopyPlusIcon, GitBranchIcon } from "lucide-react";
import { toast } from "sonner";

import { ConfigPasosEditorView } from "@/components/productos-servicios/config-pasos-editor-view";
import { EditorDefiniciones } from "@/components/productos-servicios/receta-producto-tab";
import {
  guardarBorradorReceta,
  type LookupsConfigPaso,
  type ProductoReceta,
} from "@/lib/productos-servicios-api";
import type {
  CargoDirectoCatalogo,
  CatalogoFamilias,
  ProductoDetalle,
  RutaAlternativaDetalle,
} from "@/lib/productos-servicios";
import styles from "./modelo-productivo-editor-view.module.css";

export function ModeloProductivoEditorView({
  producto,
  rutaAlternativa,
  catalogoFamilias,
  lookups,
  catalogoCargos,
  recetas,
  nodoInicial,
}: {
  producto: ProductoDetalle;
  rutaAlternativa: RutaAlternativaDetalle;
  catalogoFamilias: CatalogoFamilias;
  lookups: LookupsConfigPaso;
  catalogoCargos: CargoDirectoCatalogo[];
  recetas: ProductoReceta[];
  nodoInicial?: string;
}) {
  const router = useRouter();
  const [modeloAbierto, setModeloAbierto] = React.useState(true);
  const [nodoSeleccionado, setNodoSeleccionado] = React.useState<string>(
    nodoInicial || "ruta",
  );
  const [creandoRevision, setCreandoRevision] = React.useState(false);
  const receta = recetas.find(
    (item) => item.rutaAlternativa.id === rutaAlternativa.id,
  );
  const borradorDesdeProps = receta?.revisiones.find(
    (revision) => revision.estado === "BORRADOR",
  );
  const [borrador, setBorrador] = React.useState(borradorDesdeProps ?? null);
  const borradorRef = React.useRef(borradorDesdeProps ?? null);
  const actualizarBorrador = React.useCallback(
    (revision: NonNullable<typeof borradorDesdeProps>) => {
      borradorRef.current = revision;
      setBorrador(revision);
    },
    [],
  );
  React.useEffect(() => {
    if (!borradorDesdeProps) return;
    if (borradorRef.current?.updatedAt === borradorDesdeProps.updatedAt) return;
    actualizarBorrador(borradorDesdeProps);
  }, [actualizarBorrador, borradorDesdeProps]);
  const revisionVisible = borrador ?? receta?.revisionPublicada ?? null;
  const estructura =
    producto.estructuraProducto ??
    (producto.esCompuesto ? "COMPUESTO" : "SIMPLE");

  const prepararBorrador = async () => {
    setCreandoRevision(true);
    try {
      const revision = await guardarBorradorReceta(producto.id, {
        rutaAlternativaId: rutaAlternativa.id,
        cambios: revisionVisible
          ? `Revisión del modelo productivo V${revisionVisible.numero + 1}`
          : "Definición inicial del modelo productivo",
      });
      actualizarBorrador(revision);
      toast.success(
        revisionVisible
          ? "La nueva revisión está lista para editar."
          : "El modelo productivo quedó listo para configurar.",
      );
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo preparar la revisión.",
      );
    } finally {
      setCreandoRevision(false);
    }
  };

  const panel = ({
    onEditarPaso,
  }: {
    onEditarPaso: (nodoClave: string) => void;
  }) =>
    borrador ? (
      <EditorDefiniciones
        producto={producto}
        catalogoFamilias={catalogoFamilias}
        rutaAlternativaId={rutaAlternativa.id}
        ruta={rutaAlternativa}
        revision={borrador}
        embedded
        nodoSeleccionado={nodoSeleccionado}
        onSeleccionarNodo={setNodoSeleccionado}
        onEditarPaso={onEditarPaso}
        onClose={() => setModeloAbierto(false)}
        onRevisionGuardada={actualizarBorrador}
      />
    ) : (
      <section className={styles.preparePanel}>
        <header>
          <span>MODELO PRODUCTIVO</span>
          <h1>
            {revisionVisible
              ? `Crear revisión V${revisionVisible.numero + 1}`
              : "Configurar la primera versión"}
          </h1>
          <p>
            Los pasos actuales se conservan. La revisión permite incorporar
            subrutas, dependencias y documentos sin modificar la versión
            publicada.
          </p>
        </header>
        <div className={styles.prepareBody}>
          <span className={styles.prepareIcon}>
            {revisionVisible ? <CopyPlusIcon /> : <GitBranchIcon />}
          </span>
          <div>
            <strong>
              {revisionVisible
                ? `Partir de la versión publicada V${revisionVisible.numero}`
                : "Crear un borrador versionado"}
            </strong>
            <p>
              La BOM seguirá siendo una proyección multinivel. Toda la
              configuración se realizará desde este editor.
            </p>
          </div>
          <button
            type="button"
            disabled={creandoRevision}
            onClick={prepararBorrador}
          >
            <BoxesIcon />
            {creandoRevision ? "Preparando…" : "Preparar edición"}
          </button>
        </div>
      </section>
    );

  return (
    <ConfigPasosEditorView
      producto={producto}
      rutaAlternativa={rutaAlternativa}
      catalogoFamilias={catalogoFamilias}
      lookups={lookups}
      catalogoCargos={catalogoCargos}
      embedded
      onPasoPersistido={async () => {
        const revisionActual = borradorRef.current;
        if (!revisionActual) return;
        const revision = await guardarBorradorReceta(producto.id, {
          rutaAlternativaId: rutaAlternativa.id,
          expectedUpdatedAt: revisionActual.updatedAt,
          cambios: "Configuración de un paso actualizada",
        });
        actualizarBorrador(revision);
      }}
      modeloProductivo={{
        active: modeloAbierto,
        estructura,
        componentes: revisionVisible?.componentes ?? [],
        etapas: revisionVisible?.pasosCompuestosJson ?? [],
        nodoSeleccionado,
        panel,
        onOpen: (nodoClave = "ruta") => {
          setNodoSeleccionado(nodoClave);
          setModeloAbierto(true);
        },
        onClose: () => setModeloAbierto(false),
      }}
    />
  );
}
