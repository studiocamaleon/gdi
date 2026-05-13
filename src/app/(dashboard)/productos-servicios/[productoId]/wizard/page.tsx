import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ProductoWizardRedirectPage({
  params,
  searchParams,
}: {
  params: Promise<{ productoId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { productoId } = await params;
  const sp = await searchParams;
  const step = Array.isArray(sp.step) ? sp.step[0] : sp.step;
  const tab = stepToTab(step);
  redirect(`/productos-servicios/${productoId}?tab=${tab}`);
}

function stepToTab(step: string | undefined) {
  if (step === "rutas") return "rutas";
  if (step === "config-pasos") return "pasos";
  if (step === "cargos") return "cargos";
  if (step === "precio") return "pricing";
  return "identidad";
}
