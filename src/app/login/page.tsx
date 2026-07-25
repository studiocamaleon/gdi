import { Suspense } from "react";
import { redirect } from "next/navigation";
import { tryGetCurrentUser } from "@/lib/auth";
import { LoginConstellation } from "@/components/auth/login-constellation";
import { LoginForm } from "@/components/auth/login-form";

function LoginLogo() {
  return (
    <svg viewBox="0 0 24 24" width="32" height="32" fill="none" aria-hidden="true">
      <path d="M5.5 6.5 L18 6.5" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M5.5 6.5 L12 17.5" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M18 6.5 L12 17.5" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M18 6.5 L18 14.5" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" opacity="0.55" />
      <circle cx="5.5" cy="6.5" r="2.2" fill="#fff" />
      <circle cx="18" cy="6.5" r="2.2" fill="#fff" />
      <circle cx="12" cy="17.5" r="2.2" fill="#fff" />
      <circle cx="18" cy="14.5" r="1.4" fill="#fff" opacity="0.55" />
    </svg>
  );
}

export default async function LoginPage() {
  const current = await tryGetCurrentUser();

  if (current) {
    redirect("/");
  }

  return (
    <main className="gp-login">
      <aside className="pane-left">
        <LoginConstellation />
        <div className="eyebrow">
          <span className="rule" />
          GRÁFICA DIGITAL INTELIGENTE
        </div>

        <h2 className="quote">
          Toda producción gráfica
          <br />
          es un <em>grafo</em> de decisiones
          <br />
          conectadas.
        </h2>
        <div className="author">manifiesto Grafoprint</div>

        <div className="graph-art" />

        <div className="brand-block">
          <span className="mark">
            <LoginLogo />
          </span>
          <div>
            <div className="word">grafoprint</div>
            <div className="tagline">gráfica digital inteligente</div>
          </div>
        </div>

        <div className="corner">v2.0 · sandbox</div>
      </aside>

      <section className="pane-right">
        {/* `useSearchParams` del formulario —lee el motivo por el que la
            persona terminó acá— necesita un límite de Suspense. */}
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </section>

      <div className="ingress-lockup" aria-hidden="true">
        <LoginLogo />
        <div className="word">grafoprint</div>
        <div className="status">
          <span className="dot" />
          Validando sesión
        </div>
      </div>

      <div className="ingress-flash" aria-hidden="true" />
    </main>
  );
}
