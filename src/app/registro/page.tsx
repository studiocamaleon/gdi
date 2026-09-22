import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpRight,
  ArrowRight,
  Layers3,
  Mail,
  Network,
  Printer,
} from "lucide-react";
import { GrafoprintIsologo } from "@/components/brand/grafoprint-isologo";
import { RegistroForm } from "@/components/registro/registro-form";
import { RegistroAmbient } from "@/components/registro/registro-ambient";
import s from "@/components/registro/registro-premium.module.css";
import { listarPlanesRegistro } from "@/lib/registro-api";

export const metadata: Metadata = {
  title: "Creá tu cuenta · Grafoprint",
  description:
    "Empezá con Grafo, el sistema operativo de la industria gráfica. Elegí tu plan y conectá cotización, producción y gestión.",
  robots: { index: false, follow: true },
};

export default async function RegistroPage() {
  const planes = await listarPlanesRegistro().catch(() => []);
  const site =
    process.env.MARKETING_SITE_URL ??
    (process.env.NODE_ENV === "development"
      ? "http://localhost:3002"
      : "https://grafoprint.com");
  return (
    <main className={s.page}>
      <a className={s.skipLink} href="#registro-formulario">
        Saltar al formulario
      </a>
      <header className={s.nav}>
        <a className={s.brand} href={site} aria-label="Grafoprint, inicio">
          <span className={s.mark}>
            <GrafoprintIsologo size={24} />
          </span>
          <span>
            grafoprint<span className={s.brandDot}>.</span>
          </span>
        </a>
        <div className={s.navRight}>
          <span>¿Ya tenés cuenta?</span>
          <Link href="/login">
            Iniciar sesión <ArrowUpRight size={16} />
          </Link>
        </div>
      </header>
      <div className={s.layout}>
        <aside className={s.story} aria-label="Bienvenido a Grafo">
          <RegistroAmbient />
          <div className={s.storyCopy}>
            <a className={s.backLink} href={site}>
              <ArrowLeft size={15} /> Volver a Grafo
            </a>
            <div className={s.storyMain}>
              <span className={s.eyebrow}>
                <i /> EL PRÓXIMO PASO ES TUYO
              </span>
              <h1>
                Lo que viene,{" "}
                <br />
                empieza <em>acá.</em>
              </h1>
              <p>
                El sistema operativo{" "}
                <br />
                de la industria gráfica.
              </p>
              <span className={s.storyDescription}>
                De la primera idea a la última entrega.
                <br />
                Toda tu operación, conectada.
              </span>
            </div>
            <div className={s.storyFooter}>
              <div className={s.specialties}>
                <span>
                  <Printer /> Impresión
                </span>
                <span>
                  <Layers3 /> Cartelería
                </span>
                <span>
                  <Network /> Industrial
                </span>
              </div>
              <div className={s.trust}>
                <span>YA TRABAJA CON GRAFO</span>
                <strong>Gráfica Corporearte</strong>
              </div>
            </div>
          </div>
        </aside>
        <section
          className={s.workspace}
          id="registro-formulario"
          aria-label="Crear tu cuenta"
        >
          <div className={s.formWrap}>
            <div className={s.intro}>
              <span className={s.formEyebrow}>
                TU EMPRESA. TU PRÓXIMO CAPÍTULO.
              </span>
              <h2>
                Creá tu espacio de trabajo<span>.</span>
              </h2>
              <p>Elegí tu plan y empezá a conectar tu operación.</p>
            </div>
            {planes.length ? (
              <Suspense
                fallback={
                  <p className={s.loading} role="status">
                    Preparando el formulario…
                  </p>
                }
              >
                <RegistroForm planes={planes} />
              </Suspense>
            ) : (
              <section className={s.unavailable} role="status">
                <Mail size={26} />
                <h3>Enseguida volvemos.</h3>
                <p>
                  No pudimos cargar los planes. Volvé a intentarlo en unos
                  minutos o escribinos para ayudarte a empezar.
                </p>
                <a className={s.retry} href="/registro">
                  Volver a intentar <ArrowRight size={16} />
                </a>
                <a href="mailto:soporte@grafoprint.com.ar">
                  Contactar al equipo
                </a>
              </section>
            )}
            <footer className={s.footer}>
              <span>© {new Date().getFullYear()} Grafoprint</span>
              <nav aria-label="Información legal">
                <Link href="/terminos">Términos</Link>
                <Link href="/privacidad">Privacidad</Link>
                <a href="mailto:soporte@grafoprint.com.ar">
                  Ayuda <ArrowUpRight size={12} />
                </a>
              </nav>
            </footer>
          </div>
        </section>
      </div>
    </main>
  );
}
