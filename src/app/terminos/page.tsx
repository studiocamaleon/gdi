import { redirect } from "next/navigation";
import { getMarketingSiteUrl } from "@/lib/marketing-site";

export default function TerminosPage() {
  redirect(`${getMarketingSiteUrl()}/terminos`);
}
