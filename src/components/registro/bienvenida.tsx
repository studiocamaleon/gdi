"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Boxes,
  Building2,
  Check,
  Factory,
  LoaderCircle,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { completarOnboarding } from "@/lib/registro-api";
import s from "./registro.module.css";

const PRIMEROS_PASOS = [
  { titulo: "Datos de tu empresa", detalle: "Completá la información fiscal y las preferencias del negocio.", icono: Building2 },
  { titulo: "Máquinas y materiales", detalle: "Cargá los recursos reales con los que trabaja tu imprenta.", icono: Factory },
  { titulo: "Tu primer producto", detalle: "Configurá su ruta productiva y empezá a cotizar.", icono: Boxes },
];

export function Bienvenida({ nombre, empresa, plan, diasTrial }: { nombre?: string | null; empresa: string; plan: string; diasTrial: number }) {
  const router = useRouter();
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const primerNombre = nombre?.trim().split(/\s+/)[0];

  async function entrar() {
    setCargando(true);
    setError(null);
    try {
      await completarOnboarding();
      router.replace("/");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos abrir el panel.");
      setCargando(false);
    }
  }

  return (
    <section className={s.welcomeCard}>
      <div className={s.welcomeAccent} />
      <div className={s.welcomeIntro}>
        <div className={s.welcomeIcon}><Sparkles aria-hidden="true" /></div>
        <div className={s.welcomeEyebrow}><i /> Espacio activo</div>
        <h1>Bienvenido a Grafoprint{primerNombre ? `, ${primerNombre}` : ""}.</h1>
        <p><strong>{empresa}</strong> ya está lista. Desde ahora tenés un único lugar para ordenar, cotizar y conectar toda tu operación.</p>

        <div className={s.welcomeFacts}>
          <div><span>Plan Trial</span><strong>{plan}</strong></div>
          <div><span>Período inicial</span><strong>{diasTrial} días</strong></div>
          <div><span>Activación</span><strong><Check /> Sin tarjeta</strong></div>
        </div>

        {error ? <div className={s.welcomeError} role="alert">{error}</div> : null}
        <button className={s.welcomeButton} type="button" disabled={cargando} onClick={entrar}>
          {cargando ? <><LoaderCircle className={s.welcomeSpinner} /> Preparando el panel…</> : <>Entrar al panel de {empresa} <ArrowRight /></>}
        </button>
        <div className={s.welcomeTrust}><ShieldCheck /> Tu espacio y tus datos están separados de los demás negocios.</div>
      </div>

      <aside className={s.welcomeSteps}>
        <div className={s.welcomeStepsHead}>
          <span>Tu primera recorrida</span>
          <h2>Empezá por lo esencial.</h2>
          <p>No hace falta configurar todo hoy. Estos tres pasos te permiten llegar rápidamente a una cotización real.</p>
        </div>
        <ol>
          {PRIMEROS_PASOS.map((paso, indice) => {
            const Icono = paso.icono;
            return (
              <li key={paso.titulo}>
                <div className={s.welcomeStepIcon}><Icono aria-hidden="true" /><small>0{indice + 1}</small></div>
                <div><strong>{paso.titulo}</strong><span>{paso.detalle}</span></div>
              </li>
            );
          })}
        </ol>
        <div className={s.welcomeTip}><Sparkles /><span>El sistema te irá guiando y podés volver a configurar cada sección cuando quieras.</span></div>
      </aside>
    </section>
  );
}
