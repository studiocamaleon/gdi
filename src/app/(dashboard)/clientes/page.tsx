import { ClientesTable } from "@/components/clientes/clientes-table";
import { getClientes } from "@/lib/clientes-api";

export const dynamic = "force-dynamic";

export default async function ClientesPage() {
  const clientes = await getClientes();

  return <ClientesTable initialClientes={clientes} />;
}
