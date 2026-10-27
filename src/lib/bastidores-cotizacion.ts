import type { EstructuraBastidor } from "./estructura-bastidor-api";

type PasoBastidor = {
  activado?: boolean;
  familiaCodigo?: string;
  estructuraBastidor?: EstructuraBastidor;
};

type ComponenteBastidor = {
  nombre?: string;
  codigo?: string;
  pasos?: PasoBastidor[];
  componentes?: ComponenteBastidor[];
};

/** Conserva la estructura calculada de cada componente, sin reconstruir defaults. */
export function recolectarBastidoresCotizacion(cotizacion: {
  pasos?: PasoBastidor[];
  componentesFabricados?: ComponenteBastidor[];
}) {
  const fuentes: Array<{
    key: string;
    label: string;
    estructura: EstructuraBastidor | null;
  }> = [];
  const agregar = (pasos: PasoBastidor[], ruta: string, nombre?: string) => {
    pasos.forEach((paso, index) => {
      if (paso.activado === false) return;
      if (
        !paso.estructuraBastidor &&
        paso.familiaCodigo !== "estructura_bastidor"
      )
        return;
      fuentes.push({
        key: `bastidor3d:${ruta}:${index}`,
        label: nombre ? `${nombre} · Bastidor 3D` : "Bastidor 3D",
        estructura: paso.estructuraBastidor ?? null,
      });
    });
  };
  const recorrer = (
    componentes: ComponenteBastidor[],
    ruta = "",
    nombres: string[] = [],
  ) => {
    componentes.forEach((componente, index) => {
      const clave = `${ruta}/${index}`;
      const nombre = [
        ...nombres,
        componente.nombre || componente.codigo || "Componente",
      ];
      agregar(componente.pasos ?? [], clave, nombre.join(" › "));
      recorrer(componente.componentes ?? [], clave, nombre);
    });
  };
  agregar(cotizacion.pasos ?? [], "raiz");
  recorrer(cotizacion.componentesFabricados ?? []);
  return fuentes;
}
