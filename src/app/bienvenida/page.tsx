import Link from "next/link";
import { redirect } from "next/navigation";
import { tryGetCurrentUser } from "@/lib/auth";
import { Bienvenida } from "@/components/registro/bienvenida";
import { RegistroNetwork } from "@/components/registro/registro-network";
import s from "@/components/registro/registro.module.css";

export default async function BienvenidaPage() {
  const sesion = await tryGetCurrentUser();
  if (!sesion) redirect("/login");
  const usuario = sesion.currentUser;
  const tenant = usuario.tenantActual;
  return (
    <main className={`${s.page} ${s.welcomePage}`}>
      <div className={s.verifyBackdrop}><RegistroNetwork /></div>
      <nav className={s.welcomeNav}>
        <Link className={s.brand} href="/" aria-label="Grafoprint">
          <span className={s.mark}><svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true"><path d="M5.5 6.5 L18 6.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /><path d="M5.5 6.5 L12 17.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /><path d="M18 6.5 L12 17.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /><circle cx="5.5" cy="6.5" r="2.2" fill="currentColor" /><circle cx="18" cy="6.5" r="2.2" fill="currentColor" /><circle cx="12" cy="17.5" r="2.2" fill="currentColor" /></svg></span>
          <span>grafoprint</span>
        </Link>
        <span>Tu espacio está listo</span>
      </nav>
      <div className={s.welcomeCenter}>
        <Bienvenida
          nombre={usuario.nombreCompleto}
          empresa={tenant.nombre}
          plan={tenant.suscripcion?.planNombre ?? "Trial"}
          diasTrial={tenant.suscripcion?.diasRestantes ?? 14}
        />
      </div>
      <footer className={s.verifyFooter}>© Grafoprint · GRUPO IDEA SAS</footer>
    </main>
  );
}
