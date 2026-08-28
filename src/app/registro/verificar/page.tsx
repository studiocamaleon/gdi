import Link from "next/link";
import { tryGetCurrentUser } from "@/lib/auth";
import { leerEstadoRegistro } from "@/lib/registro-api";
import { VerificarRegistro } from "@/components/registro/verificar-registro";
import { RegistroNetwork } from "@/components/registro/registro-network";
import s from "@/components/registro/registro.module.css";

export default async function VerificarPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const token = (await searchParams).token ?? "";
  const [estado, usuario] = await Promise.all([
    leerEstadoRegistro(token).catch(() => ({
      valido: false,
      vencido: true,
      completado: false,
      requiereLogin: false,
      email: "—",
      empresa: "tu empresa",
      plan: "—",
    })),
    tryGetCurrentUser(),
  ]);
  return (
    <main className={`${s.page} ${s.verifyPage}`}>
      <div className={s.verifyBackdrop}><RegistroNetwork /></div>
      <nav className={s.verifyNav}>
        <Link className={s.brand} href="/registro" aria-label="Grafoprint">
          <span className={s.mark}><svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true"><path d="M5.5 6.5 L18 6.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /><path d="M5.5 6.5 L12 17.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /><path d="M18 6.5 L12 17.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /><circle cx="5.5" cy="6.5" r="2.2" fill="currentColor" /><circle cx="18" cy="6.5" r="2.2" fill="currentColor" /><circle cx="12" cy="17.5" r="2.2" fill="currentColor" /></svg></span>
          <span>grafoprint</span>
        </Link>
        <span>Activación segura</span>
      </nav>
      <div className={s.verifyCenter}><VerificarRegistro token={token} estado={estado} autenticado={Boolean(usuario)} /></div>
      <footer className={s.verifyFooter}>© Grafoprint · GRUPO IDEA SAS</footer>
    </main>
  );
}
