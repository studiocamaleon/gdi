import type { Metadata } from "next";
import { RecuperarAcceso } from "@/components/auth/recuperar-acceso";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Recuperar acceso · Grafoprint",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export default function Page() {
  return <RecuperarAcceso />;
}
