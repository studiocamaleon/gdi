import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowLeft,
  ArrowUpRight,
  Layers3,
  Network,
  Printer,
} from "lucide-react";
import { GrafoprintIsologo } from "@/components/brand/grafoprint-isologo";
import { LoginForm } from "@/components/auth/login-form";
import { RegistroAmbient } from "@/components/registro/registro-ambient";
import { tryGetCurrentUser } from "@/lib/auth";
import shared from "@/components/registro/registro-premium.module.css";
import s from "@/components/auth/login-premium.module.css";

export const metadata: Metadata = {
  title: "Iniciar sesión · Grafoprint",
  description:
    "Volvé a tu espacio de trabajo en Grafo, el sistema operativo de la industria gráfica.",
  robots: { index: false, follow: true },
};

export default async function LoginPage() {
  const current = await tryGetCurrentUser();
  if (current) redirect("/");

  const site =
    process.env.MARKETING_SITE_URL ??
    (process.env.NODE_ENV === "development"
      ? "http://localhost:3002"
      : "https://grafoprint.com");

  return (
    <main className={shared.page}>
      <a className={shared.skipLink} href="#login-formulario">
        Saltar al formulario
      </a>
      <header className={shared.nav}>
        <a className={shared.brand} href={site} aria-label="Grafoprint, inicio">
          <span className={shared.mark}>
            <GrafoprintIsologo size={24} />
          </span>
          <span>
            grafoprint<span className={shared.brandDot}>.</span>
          </span>
        </a>
        <div className={shared.navRight}>
          <span>¿Todavía no tenés cuenta?</span>
          <Link href="/registro">
            Crear cuenta <ArrowUpRight size={16} />
          </Link>
        </div>
      </header>
      <div className={s.layout}>
        <aside className={s.story} aria-label="Tu operación en Grafo">
          <RegistroAmbient />
          <div className={s.storyCopy}>
            <a className={shared.backLink} href={site}>
              <ArrowLeft size={15} /> Volver a Grafo
            </a>
            <div className={s.storyMain}>
              <span className={shared.eyebrow}>
                <i /> CADA CONEXIÓN CUENTA
              </span>
              <h2>
                Tu operación, <br />
                <em>en movimiento.</em>
              </h2>
              <p>
                El sistema operativo
                <br /> de la industria gráfica.
              </p>
              <span className={s.description}>
                Tu equipo, tus proyectos y tu producción.
                <br />
                Todo vuelve a conectarse acá.
              </span>
            </div>
            <div className={s.storyFooter}>
              <div className={shared.specialties}>
                <span>
                  <Printer /> Print
                </span>
                <span>
                  <Layers3 /> Sign
                </span>
                <span>
                  <Network /> Industrial
                </span>
              </div>
              <span className={s.storyCaption}>
                DE LA PRIMERA IDEA A LA ÚLTIMA ENTREGA.
              </span>
            </div>
          </div>
        </aside>
        <section
          className={s.workspace}
          id="login-formulario"
          aria-label="Acceder a tu cuenta"
        >
          <div className={s.formWrap}>
            {/* El formulario conserva el motivo de cierre y la continuación del registro. */}
            <Suspense
              fallback={
                <p className={shared.loading} role="status">
                  Preparando tu acceso…
                </p>
              }
            >
              <LoginForm />
            </Suspense>
          </div>
          <footer className={[shared.footer, s.footer].join(" ")}>
            <span>© {new Date().getFullYear()} Grafoprint</span>
            <nav aria-label="Información legal">
              <Link href="/terminos">Términos</Link>
              <Link href="/privacidad">Privacidad</Link>
              <a href="mailto:soporte@grafoprint.com.ar">
                Ayuda <ArrowUpRight size={12} />
              </a>
            </nav>
          </footer>
        </section>
      </div>
    </main>
  );
}
