import { ClienteFicha } from "@/components/clientes/cliente-ficha";
import { createEmptyCliente } from "@/lib/clientes";

export default function NuevoClientePage() {
  return <ClienteFicha cliente={createEmptyCliente()} mode="create" />;
}
