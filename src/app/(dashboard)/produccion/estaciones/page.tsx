import { EstacionesView } from "@/components/produccion/estaciones-view";
import { getFamiliasPasos, getRecursosEstaciones } from "@/lib/estaciones-api";
import { cargarDatosTableroProduccion } from "@/lib/tablero-produccion-server";
import { SinPermiso } from "@/components/navigation/sin-permiso";
import { tienePermiso } from "@/lib/permisos-server";
import { DesignSystemProvider } from "@/components/design-system/appearance";

export const dynamic = "force-dynamic";

export default async function EstacionesPage() {
  if (!(await tienePermiso("produccion.ver")))
    return <SinPermiso modulo="Estaciones de producción" />;
  const puedeConfigurar = await tienePermiso("produccion.configurar");
  const [datos, familias, recursos] = await Promise.all([
    cargarDatosTableroProduccion({ soloPendientes: true }),
    puedeConfigurar
      ? getFamiliasPasos()
          .then((value) => ({ ok: true, value }))
          .catch(() => ({ ok: false, value: [] }))
      : Promise.resolve({ ok: false, value: [] }),
    puedeConfigurar
      ? getRecursosEstaciones()
          .then((value) => ({ ok: true, value }))
          .catch(() => ({ ok: false, value: { empleados: [], maquinas: [] } }))
      : Promise.resolve({ ok: false, value: { empleados: [], maquinas: [] } }),
  ]);
  return (
    <DesignSystemProvider theme="brand" appearance="light">
      <EstacionesView
        {...datos}
        initialFamilias={familias.value}
        empleados={recursos.value.empleados}
        maquinas={recursos.value.maquinas}
        configuracionDisponible={
          puedeConfigurar &&
          familias.ok &&
          recursos.ok &&
          !datos.initialPartialWarning
        }
      />
    </DesignSystemProvider>
  );
}
