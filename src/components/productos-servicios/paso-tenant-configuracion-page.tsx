"use client";

import * as React from "react";
import { CircleAlertIcon } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfigPasosEditorView } from "@/components/productos-servicios/config-pasos-editor-view";
import {
  getCatalogoFamilias,
  getLookupsConfigPaso,
  getPasosTenant,
  buscarMateriasPrimasConfigPaso,
  type LookupsConfigPaso,
} from "@/lib/productos-servicios-api";
import type {
  CatalogoFamilias,
  ProductoDetalle,
  RutaAlternativaDetalle,
} from "@/lib/productos-servicios";

export function PasoTenantConfiguracionPage({ pasoId }: { pasoId: string }) {
  const [datos, setDatos] = React.useState<{
    producto: ProductoDetalle;
    ruta: RutaAlternativaDetalle;
    catalogo: CatalogoFamilias;
    lookups: LookupsConfigPaso;
  } | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [intento, setIntento] = React.useState(0);

  React.useEffect(() => {
    let vivo = true;
    setError(null);
    Promise.all([
      getPasosTenant(),
      getCatalogoFamilias(),
      getLookupsConfigPaso(),
    ])
      .then(async ([pasos, catalogo, lookups]) => {
        if (!vivo) return;
        const pasoTenant = pasos.find((item) => item.id === pasoId);
        const familiaSistema = catalogo.familias.find(
          (item) => item.codigo === pasoId && item.origen === "sistema",
        );
        if (!pasoTenant && !familiaSistema) {
          throw new Error("El paso no existe o no está disponible.");
        }
        const paso = pasoTenant
          ? {
              id: pasoTenant.id,
              nombre: pasoTenant.nombre,
              descripcion: pasoTenant.descripcion,
              icono: pasoTenant.icono,
              activo: pasoTenant.activo,
              plantillaCodigo: pasoTenant.plantillaCodigo,
              configBase: pasoTenant.configBase ?? null,
              origen: "tenant" as const,
            }
          : {
              id: familiaSistema!.codigo,
              nombre: familiaSistema!.nombre,
              descripcion: familiaSistema!.descripcion,
              icono: null,
              activo: true,
              plantillaCodigo: familiaSistema!.codigo,
              configBase: familiaSistema!.configBase ?? null,
              origen: "sistema" as const,
            };
        const heredada = pasoTenant
          ? catalogo.familias.find((item) => item.codigo === pasoTenant.id)
          : null;
        const plantilla = catalogo.familias.find(
          (item) => item.codigo === paso.plantillaCodigo,
        );
        const familia = familiaSistema ?? heredada ??
          (plantilla
            ? {
                ...plantilla,
                codigo: paso.id,
                nombre: paso.nombre,
                descripcion: paso.descripcion ?? plantilla.descripcion,
                origen: "tenant" as const,
                plantillaCodigo: paso.plantillaCodigo,
                configBase: paso.configBase,
              }
            : null);
        if (!familia) {
          throw new Error("La plantilla de este paso ya no está disponible.");
        }
        const base = paso.configBase as
          | {
              slotsMateriales?: Array<{
                materialVarianteId?: string | null;
                candidatos?: Array<{ materiaPrimaId: string }>;
              }>;
            }
          | null
          | undefined;
        const ids = [
          ...new Set(
            (base?.slotsMateriales ?? []).flatMap((slot) =>
              (slot.candidatos ?? []).map((item) => item.materiaPrimaId),
            ),
          ),
        ];
        const varianteIds = [
          ...new Set(
            (base?.slotsMateriales ?? [])
              .map((slot) => slot.materialVarianteId)
              .filter((id): id is string => Boolean(id)),
          ),
        ];
        const materiales =
          ids.length || varianteIds.length
            ? await buscarMateriasPrimasConfigPaso({
                ids,
                varianteIds,
                limit: 50,
              })
            : [];
        const rutaPaso = {
          id: paso.id,
          orden: 1,
          familiaCodigo: paso.id,
          familiaNombre: paso.nombre,
          icono: paso.icono,
          activo: true,
        };
        const ruta = {
          id: `config-base-${paso.id}`,
          nombre: paso.nombre,
          esPreferida: true,
          rutaVersion: 1,
          reglaAutoSeleccionJson: null,
          ruta: {
            id: `config-base-${paso.id}`,
            codigo: "CONFIG_BASE",
            nombre: "Configuración base",
            pasos: [rutaPaso],
          },
          configPasos: [],
          pasosExtras: [],
        } satisfies RutaAlternativaDetalle;
        const producto = {
          id: paso.id,
          tenantId: "",
          codigo: "CONFIG_BASE",
          nombre: paso.nombre,
          descripcion: paso.descripcion,
          unidadComercial: "unidad",
          modoMedidas: "LIBRE",
          minimoComercialPolitica: "NONE",
          minimoComercialCantidad: null,
          minimoComercialBase: "cantidad_comercial",
          medidaDefaultAnchoMm: null,
          medidaDefaultAltoMm: null,
          medidasPredefinidasJson: null,
          personalizacionesJson: null,
          atributosComercialesJson: null,
          precioConfigJson: null,
          activo: paso.activo,
          subcategoriaComercial: {
            id: "config-base",
            categoriaId: "config-base",
            codigo: "config-base",
            nombre: "Configuración base",
            descripcion: "",
            atributosSchemaJson: {},
            orden: 0,
            activo: true,
            categoria: {
              id: "config-base",
              codigo: "config-base",
              nombre: "Configuración base",
              descripcion: "",
              orden: 0,
              activo: true,
            },
          },
          rutasAlternativas: [ruta],
          pasosExtras: [],
          cargosDirectosCotizacion: [],
        } as unknown as ProductoDetalle;
        setDatos({
          producto,
          ruta,
          lookups: { ...lookups, materiasPrimas: materiales },
          catalogo: {
            ...catalogo,
            familias: [
              ...catalogo.familias.filter((item) => item.codigo !== paso.id),
              familia,
            ],
          },
        });
      })
      .catch((err: unknown) => {
        if (vivo) {
          setError(err instanceof Error ? err.message : "No se pudo cargar el paso.");
        }
      });
    return () => {
      vivo = false;
    };
  }, [pasoId, intento]);

  if (error) {
    return (
      <div className="content">
        <Alert variant="destructive">
          <CircleAlertIcon />
          <AlertTitle>No se pudo abrir la configuración</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button className="mt-4" onClick={() => setIntento((value) => value + 1)}>
          Reintentar
        </Button>
      </div>
    );
  }
  if (!datos) {
    return (
      <div className="content flex flex-col gap-3">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-[520px] w-full" />
      </div>
    );
  }
  return (
    <ConfigPasosEditorView
      producto={datos.producto}
      rutaAlternativa={datos.ruta}
      catalogoFamilias={datos.catalogo}
      lookups={datos.lookups}
      configuracionBase={{
        familiaCodigo: pasoId,
        origen: datos.catalogo.familias.find((item) => item.codigo === pasoId)
          ?.origen ?? "sistema",
        volverHref: "/productos-servicios/pasos",
      }}
    />
  );
}
