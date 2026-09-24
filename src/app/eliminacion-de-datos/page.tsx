import { redirect } from "next/navigation";
import { getMarketingSiteUrl } from "@/lib/marketing-site";

export default function EliminacionDeDatosPage() {
  redirect(`${getMarketingSiteUrl()}/eliminacion-de-datos`);
}
