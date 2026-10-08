import { PropuestaFicha } from "@/components/comercial/propuesta-ficha";
import { notFound } from "next/navigation";
import { ApiError } from "@/lib/api";
import { ActionLink } from "@/components/design-system/action-link";
import { getPresupuestoEdicion } from "@/lib/presupuestos-api";
import { getClientes } from "@/lib/clientes-api";
import {
  getCargosDirectosCatalogo,
  getProductos,
} from "@/lib/productos-servicios-api";
import { tryGetCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function EditarPresupuestoPage({
  params,
}: {
  params: Promise<{ presupuestoId: string }>;
}) {
  const { presupuestoId } = await params;
  let presupuesto;
  try {
    presupuesto = await getPresupuestoEdicion(presupuestoId);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    if (error instanceof ApiError && error.status === 409) return (
      <section className="space-y-4 p-6">
        <h1 className="text-2xl font-semibold">Este presupuesto ya no admite una nueva versión</h1>
        <p role="alert">{error.message}</p>
        <ActionLink variant="outline" href={`/comercial/presupuestos/${presupuestoId}`}>Volver al presupuesto</ActionLink>
      </section>
    );
    throw error;
  }
  const [clientes, productos, cargos, usuario] = await Promise.all([
    getClientes({ limit: 100 }, true),
    getProductos(true, true),
    getCargosDirectosCatalogo(true, true),
    tryGetCurrentUser(),
  ]);
  return (
    <PropuestaFicha
      presupuestoBase={presupuesto}
      initialClientes={clientes}
      initialProductos={productos}
      initialCargosDirectos={cargos}
      currentUser={usuario?.currentUser ?? null}
    />
  );
}
