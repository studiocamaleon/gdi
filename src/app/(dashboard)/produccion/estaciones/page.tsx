import {
  EstacionesPanel,
  type EmpleadoRef,
  type MaquinaRef,
} from "@/components/produccion/estaciones-panel";
import { getEstaciones, getFamiliasPasos } from "@/lib/estaciones-api";
import { getEmpleados } from "@/lib/empleados-api";
import { getMaquinas } from "@/lib/maquinaria-api";
import type { Estacion, FamiliaPasoCatalogo } from "@/lib/estaciones";

export const dynamic = "force-dynamic";

/**
 * El panel edita estaciones REALES: familias de pasos (rutean el tablero),
 * máquinas y empleados del tenant. Todo se trae del backend; si la API no
 * responde, el panel arranca vacío.
 */
export default async function EstacionesPage() {
  let estaciones: Estacion[] = [];
  let familias: FamiliaPasoCatalogo[] = [];
  let empleados: EmpleadoRef[] = [];
  let maquinas: MaquinaRef[] = [];
  try {
    const [ests, fams, emps, maqs] = await Promise.all([
      getEstaciones(),
      getFamiliasPasos(),
      getEmpleados(),
      getMaquinas(),
    ]);
    estaciones = ests;
    familias = fams;
    empleados = emps.map((emp) => ({
      id: emp.id,
      nombreCompleto: emp.nombreCompleto,
      sector: emp.sector,
    }));
    maquinas = maqs.map((maq) => ({
      id: maq.id,
      codigo: maq.codigo,
      nombre: maq.nombre,
    }));
  } catch {
    // La vista muestra sus estados vacíos.
  }
  return (
    <EstacionesPanel
      initialEstaciones={estaciones}
      initialFamilias={familias}
      empleados={empleados}
      maquinas={maquinas}
    />
  );
}
