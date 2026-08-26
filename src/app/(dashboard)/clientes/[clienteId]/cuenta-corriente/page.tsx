import { redirect } from "next/navigation";
export default async function Page({ params }: { params: Promise<{ clienteId: string }> }) { const { clienteId } = await params; redirect(`/crm/clientes/${clienteId}/cuenta-corriente`); }
