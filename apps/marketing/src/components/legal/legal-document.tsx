import Link from "next/link";
import type { ReactNode } from "react";
import s from "./legal-document.module.css";

export type LegalSection = { id: string; title: string; content: ReactNode };

export function LegalDocument({
  eyebrow,
  title,
  intro,
  sections,
  notice,
  path,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  sections: LegalSection[];
  notice?: ReactNode;
  path: string;
}) {
  return (
    <main className={s.page}>
      <nav className={s.nav}>
        <div className={s.navInner}>
          <Link className={s.brand} href="/" aria-label="Grafoprint, inicio">
            <span className={s.mark}>
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M5.5 6.5 L18 6.5"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
                <path
                  d="M5.5 6.5 L12 17.5"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
                <path
                  d="M18 6.5 L12 17.5"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
                <circle cx="5.5" cy="6.5" r="2.2" fill="currentColor" />
                <circle cx="18" cy="6.5" r="2.2" fill="currentColor" />
                <circle cx="12" cy="17.5" r="2.2" fill="currentColor" />
              </svg>
            </span>
            <span>grafoprint</span>
          </Link>
          <Link className={s.back} href="/">
            Volver a Grafo
          </Link>
        </div>
      </nav>
      <div className={s.layout}>
        <aside className={s.aside} aria-label="Contenido">
          <span>Contenido</span>
          {sections.map((section) => (
            <a key={section.id} href={`#${section.id}`}>
              {section.title}
            </a>
          ))}
        </aside>
        <article className={s.document}>
          <p className={s.eyebrow}>{eyebrow}</p>
          <h1>{title}</h1>
          <p className={s.intro}>{intro}</p>
          <div className={s.meta}>
            <span>Versión 2026-09-24</span>
            <span>Actualizado el 24 de septiembre de 2026</span>
            <span>Argentina</span>
          </div>
          {notice ? <div className={s.notice}>{notice}</div> : null}
          {sections.map((section) => (
            <section className={s.section} id={section.id} key={section.id}>
              <h2>{section.title}</h2>
              {section.content}
            </section>
          ))}
          <section className={s.contact}>
            <h2>Contacto</h2>
            <p>
              <strong>GRUPO IDEA SAS</strong> · Grafoprint
              <br />
              CUIT: 33-71888258-9
              <br />
              Domicilio legal: Julio Argentino Roca 1260, El Calafate, Santa Cruz,
              CP 9405, Argentina.
            </p>
            <p>
              Para consultas legales, de soporte o sobre privacidad:{" "}
              <a href="mailto:soporte@grafoprint.com.ar">
                soporte@grafoprint.com.ar
              </a>
              .
            </p>
          </section>
          <nav className={s.related} aria-label="Información legal">
            {[
              { href: "/terminos", label: "Términos de servicio" },
              { href: "/privacidad", label: "Política de privacidad" },
              { href: "/eliminacion-de-datos", label: "Eliminación de datos" },
            ].map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                aria-current={path === href ? "page" : undefined}
              >
                {label}
              </Link>
            ))}
          </nav>
        </article>
      </div>
    </main>
  );
}
