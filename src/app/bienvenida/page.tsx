import { redirect } from "next/navigation";
import { tryGetCurrentUser } from "@/lib/auth";
import { Bienvenida } from "@/components/registro/bienvenida";

export default async function BienvenidaPage() {
  if (!(await tryGetCurrentUser())) redirect("/login");
  return <main className="grid min-h-screen place-items-center bg-muted/40 p-5"><Bienvenida /></main>;
}
