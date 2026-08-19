import {
  EstacionesPanel,
  type EmpleadoRef,
  type MaquinaRef,
} from "@/components/produccion/estaciones-panel";
import { getEstaciones, getFamiliasPasos } from "@/lib/estaciones-api";
import { getRecursosEstaciones } from "@/lib/estaciones-api";
import { SinPermiso } from "@/components/navigation/sin-permiso";
import { tienePermiso } from "@/lib/permisos-server";
import type { Estacion, FamiliaPasoCatalogo } from "@/lib/estaciones";

export const dynamic = "force-dynamic";

/**
 * El panel edita estaciones REALES: familias de pasos (rutean el tablero),
 * máquinas y empleados del tenant. Todo se trae del backend; si la API no
 * responde, el panel arranca vacío.
 */
export default async function EstacionesPage() {
  if (!(await tienePermiso("produccion.configurar"))) {
    return <SinPermiso modulo="Configuración de estaciones" />;
  }
  let estaciones: Estacion[] = [];
  let familias: FamiliaPasoCatalogo[] = [];
  let empleados: EmpleadoRef[] = [];
  let maquinas: MaquinaRef[] = [];
  let loadWarning: string | null = null;
  const [ests, fams, recursos] = await Promise.allSettled([
    getEstaciones(),
    getFamiliasPasos(),
    getRecursosEstaciones(),
  ]);
  if (ests.status === "fulfilled") estaciones = ests.value;
  if (fams.status === "fulfilled") familias = fams.value;
  if (recursos.status === "fulfilled") {
    empleados = recursos.value.empleados.map((emp) => ({
      id: emp.id,
      nombreCompleto: emp.nombreCompleto,
      sector: emp.sector,
    }));
    maquinas = recursos.value.maquinas.map((maq) => ({
      id: maq.id,
      codigo: maq.codigo,
      nombre: maq.nombre,
    }));
  }
  if ([ests, fams, recursos].some((resultado) => resultado.status === "rejected")) {
    loadWarning = "Parte de la configuración del taller no pudo cargarse. Se conservaron los datos disponibles.";
  }
  return (
    <EstacionesPanel
      initialEstaciones={estaciones}
      initialFamilias={familias}
      empleados={empleados}
      maquinas={maquinas}
      initialLoadWarning={loadWarning}
    />
  );
}
