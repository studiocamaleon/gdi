import Link from "next/link";
import type { ReactNode } from "react";
import s from "./legal-document.module.css";

export type LegalSection = { id: string; title: string; content: ReactNode };

export function LegalDocument({ eyebrow, title, intro, sections, notice }: { eyebrow: string; title: string; intro: string; sections: LegalSection[]; notice?: ReactNode }) {
  return (
    <main className={s.page}>
      <nav className={s.nav}>
        <div className={s.navInner}>
          <Link className={s.brand} href="/registro"><span className={s.mark}><svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true"><path d="M5.5 6.5 L18 6.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /><path d="M5.5 6.5 L12 17.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /><path d="M18 6.5 L12 17.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /><circle cx="5.5" cy="6.5" r="2.2" fill="currentColor" /><circle cx="18" cy="6.5" r="2.2" fill="currentColor" /><circle cx="12" cy="17.5" r="2.2" fill="currentColor" /></svg></span><span>grafoprint</span></Link>
          <Link className={s.back} href="/registro">Volver al registro</Link>
        </div>
      </nav>
      <div className={s.layout}>
        <aside className={s.aside} aria-label="Contenido"><span>Contenido</span>{sections.map((section) => <a key={section.id} href={`#${section.id}`}>{section.title}</a>)}</aside>
        <article className={s.document}>
          <p className={s.eyebrow}>{eyebrow}</p><h1>{title}</h1><p className={s.intro}>{intro}</p>
          <div className={s.meta}><span>Versión 1.0</span><span>Vigente desde el 27 de agosto de 2026</span><span>Argentina</span></div>
          {notice ? <div className={s.notice}>{notice}</div> : null}
          {sections.map((section) => <section className={s.section} id={section.id} key={section.id}><h2>{section.title}</h2>{section.content}</section>)}
          <section className={s.contact}><h2>Contacto</h2><p>Para consultas legales, de soporte o sobre privacidad: <a href="mailto:soporte@grafoprint.com.ar">soporte@grafoprint.com.ar</a>.</p></section>
        </article>
      </div>
    </main>
  );
}
