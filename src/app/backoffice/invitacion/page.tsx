import { InvitacionBackoffice } from "@/components/plataforma/invitacion-backoffice";
export const metadata = {
  title: "Invitación al equipo · Grafo",
  referrer: "no-referrer" as const,
};
export default function InvitacionPage() {
  return <InvitacionBackoffice />;
}
