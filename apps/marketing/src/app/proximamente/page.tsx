import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { Brand } from "../../components/brand";
import { getSiteConfig } from "../../lib/site-config";
import styles from "./prelaunch.module.css";

const title = "Próximo lanzamiento · Grafoprint";
const description =
  "Estamos preparando el lanzamiento de Grafoprint. Conocé el sistema, usá Grafo3D y contactá al equipo.";
export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/proximamente" },
  openGraph: { title, description, url: "/proximamente" },
};

export default function PrelaunchPage() {
  const site = getSiteConfig();
  if (site.isLive) redirect("/");

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link href="/" aria-label="Grafoprint, inicio">
          <Brand />
        </Link>
        <Link href="/">
          Volver a la web <ArrowUpRight size={16} />
        </Link>
      </header>
      <main className={styles.main}>
        <span className="eyebrow">PRÓXIMAMENTE</span>
        <h1>
          Estamos preparando
          <br />
          lo que viene<span>.</span>
        </h1>
        <p className={styles.intro}>
          Grafoprint está cerca de su lanzamiento. El registro, los planes y el
          inicio de sesión se habilitarán cuando el sistema esté disponible.
        </p>
        <div className={styles.actions}>
          <a className="button button-orange" href={site.contact}>
            Hablemos de tu gráfica <ArrowUpRight size={17} />
          </a>
          <Link className="text-link" href="/#experiencia">
            Conocer el sistema <ArrowUpRight size={16} />
          </Link>
        </div>
        <aside className={styles.grafo3d} aria-label="Grafo3D disponible">
          <div>
            <h2>Grafo3D ya está disponible.</h2>
            <p>
              Diseñá tus letras 3D desde el navegador. Gratis y sin registro.
            </p>
          </div>
          <a className="text-link" href="/3d">
            Abrir Grafo3D <ArrowUpRight size={16} />
          </a>
        </aside>
      </main>
      <footer className={styles.footer}>
        <span>
          © {new Date().getFullYear()} Grafoprint · Hecho en Argentina
        </span>
        <nav aria-label="Información legal">
          <a href={site.terms}>Términos</a>
          <a href={site.privacy}>Privacidad</a>
          <a href={site.dataDeletion}>Eliminación de datos</a>
        </nav>
      </footer>
    </div>
  );
}
