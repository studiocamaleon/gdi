import { redirect } from "next/navigation";
import { getMarketingSiteUrl } from "@/lib/marketing-site";

export default function PrivacidadPage() {
  redirect(`${getMarketingSiteUrl()}/privacidad`);
}
