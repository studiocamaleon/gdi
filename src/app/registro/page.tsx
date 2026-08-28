import { Suspense } from "react";
import Link from "next/link";
import { RegistroForm } from "@/components/registro/registro-form";
import { RegistroNetwork } from "@/components/registro/registro-network";
import s from "@/components/registro/registro.module.css";
import { listarPlanesRegistro } from "@/lib/registro-api";

export default async function RegistroPage() {
  const planes = await listarPlanesRegistro().catch(() => []);
  return (
    <main className={s.page}>
      <nav className={s.nav}>
        <div className={s.navInner}>
          <Link className={s.brand} href="/login" aria-label="Grafoprint">
            <span className={s.mark}><svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true"><path d="M5.5 6.5 L18 6.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /><path d="M5.5 6.5 L12 17.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /><path d="M18 6.5 L12 17.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /><circle cx="5.5" cy="6.5" r="2.2" fill="currentColor" /><circle cx="18" cy="6.5" r="2.2" fill="currentColor" /><circle cx="12" cy="17.5" r="2.2" fill="currentColor" /></svg></span>
            <span>grafoprint</span>
          </Link>
          <div className={s.navRight}><span>¿Ya tenés cuenta?</span><Link href="/login">Iniciar sesión</Link></div>
        </div>
      </nav>
      <header className={`${s.wrap} ${s.hero}`}>
        <div className={s.network}><RegistroNetwork /></div>
        <div className={s.eyebrow}><span>TRIAL</span> 14 días completos · sin tarjeta de crédito</div>
        <h1>Todo lo que tu gráfica necesita para dar <em>el próximo paso.</em></h1>
        <p>Creá tu cuenta y empezá a ordenar, automatizar y conectar toda tu operación.</p>
      </header>
      <div className={s.wrap}>{planes.length ? <Suspense fallback={null}><RegistroForm planes={planes} /></Suspense> : <section className={s.unavailable}><h2>El registro todavía no está disponible</h2><p>Probá nuevamente en unos minutos o escribinos a soporte@grafoprint.com.ar.</p></section>}</div>
      <footer className={s.proof}><div className={`${s.wrap} ${s.proofInner}`}><span>Imprentas que ya trabajan con Grafoprint</span><i /><strong>Gráfica Corporearte</strong></div></footer>
    </main>
  );
}
