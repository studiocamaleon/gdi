"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  Check,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  KeyRound,
  LoaderCircle,
  LogIn,
  ShieldCheck,
  TriangleAlert,
  UserRound,
  UsersRound,
} from "lucide-react";
import { completarRegistro, type EstadoRegistro } from "@/lib/registro-api";
import { setSessionToken } from "@/lib/session";
import s from "./registro.module.css";

export function VerificarRegistro({ token, estado, autenticado }: { token: string; estado: EstadoRegistro; autenticado: boolean }) {
  const router = useRouter();
  const [cargando, setCargando] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fase, setFase] = React.useState(0);
  const [espacioListo, setEspacioListo] = React.useState(false);

  async function completar() {
    const inicio = Date.now();
    const movimientoReducido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let temporizador: ReturnType<typeof setInterval> | undefined;
    setCargando(true);
    setFase(0);
    setEspacioListo(false);
    setError(null);
    if (!movimientoReducido) {
      temporizador = setInterval(() => setFase((actual) => Math.min(actual + 1, TAREAS_PROVISION.length - 1)), 320);
    }
    try {
      const respuesta = await completarRegistro(token, estado.requiereLogin);
      if (respuesta.requiereLogin) {
        if (temporizador) clearInterval(temporizador);
        router.push(`/login?registro=${encodeURIComponent(token)}`);
        return;
      }
      if (respuesta.accessToken) await setSessionToken(respuesta.accessToken);
      const esperaMinima = movimientoReducido ? 0 : Math.max(0, 1500 - (Date.now() - inicio));
      if (esperaMinima) await esperar(esperaMinima);
      if (temporizador) clearInterval(temporizador);
      setFase(TAREAS_PROVISION.length);
      setEspacioListo(true);
      if (!movimientoReducido) await esperar(520);
      router.replace("/bienvenida");
      router.refresh();
    } catch (e) {
      if (temporizador) clearInterval(temporizador);
      setError(e instanceof Error ? e.message : "No pudimos crear la cuenta.");
      setCargando(false);
      setEspacioListo(false);
    }
  }

  const bloqueado = !estado.valido || estado.completado;
  const titulo = estado.completado
    ? "Esta cuenta ya fue creada"
    : estado.vencido
      ? "Este enlace ya venció"
      : "Tu correo está confirmado";
  const descripcion = estado.completado
    ? "El espacio ya fue creado. Podés iniciar sesión para continuar."
    : estado.vencido
      ? "Volvé a registrarte para recibir un enlace de confirmación nuevo."
      : `Ya podemos preparar el espacio de trabajo de ${estado.empresa}.`;

  if (cargando) {
    return <CreandoEspacio empresa={estado.empresa} plan={estado.plan} fase={fase} listo={espacioListo} />;
  }

  return (
    <section className={s.verifyCard}>
      <div className={s.verifyAccent} />
      <div className={s.verifyBody}>
        <div className={`${s.verifyIcon} ${bloqueado ? s.verifyIconWarning : ""}`}>
          {bloqueado ? <TriangleAlert aria-hidden="true" /> : <CheckCircle2 aria-hidden="true" />}
        </div>
        <div className={s.verifyEyebrow}>{bloqueado ? "Revisá el enlace" : "Identidad verificada"}</div>
        <h1>{titulo}</h1>
        <p className={s.verifyLead}>{descripcion}</p>

        {!bloqueado ? (
          <div className={s.verifyProgress} aria-label="Progreso del registro">
            <div className={s.verifyStepDone}><span><Check /></span><small>Cuenta</small></div>
            <i />
            <div className={s.verifyStepDone}><span><Check /></span><small>Correo</small></div>
            <i />
            <div className={s.verifyStepActive}><span>3</span><small>Tu espacio</small></div>
          </div>
        ) : null}

        <div className={s.verifySummary}>
          <div><span>Empresa</span><strong>{estado.empresa}</strong></div>
          <div><span>Plan Trial</span><strong>{estado.plan}</strong></div>
          <div><span>Correo</span><strong>{estado.email}</strong></div>
        </div>

        {estado.requiereLogin && !autenticado ? (
          <div className={s.verifyNotice}>
            <LogIn aria-hidden="true" />
            <div><strong>Ya tenés una cuenta en Grafoprint</strong><span>Ingresá con tu contraseña actual y agregaremos esta nueva empresa a tu usuario.</span></div>
          </div>
        ) : null}

        {error ? (
          <div className={`${s.verifyNotice} ${s.verifyError}`} role="alert">
            <TriangleAlert aria-hidden="true" />
            <div><strong>No pudimos continuar</strong><span>{error}</span></div>
          </div>
        ) : null}

        {bloqueado ? (
          <Link className={s.verifyButton} href={estado.completado ? "/login" : "/registro"}>
            {estado.completado ? "Ir a iniciar sesión" : "Volver a registrarme"}<ArrowRight aria-hidden="true" />
          </Link>
        ) : estado.requiereLogin && !autenticado ? (
          <Link className={s.verifyButton} href={`/login?registro=${encodeURIComponent(token)}`}>
            Iniciar sesión y continuar <ArrowRight aria-hidden="true" />
          </Link>
        ) : (
          <button className={s.verifyButton} type="button" disabled={cargando} onClick={completar}>
            {cargando ? <><LoaderCircle className={s.verifySpinner} aria-hidden="true" /> Creando tu espacio…</> : <>Crear mi espacio de trabajo <ArrowRight aria-hidden="true" /></>}
          </button>
        )}

        {!bloqueado ? (
          <div className={s.verifyTrust}>
            <span><ShieldCheck /> Acceso protegido</span>
            <span><Clock3 /> Trial de 14 días</span>
          </div>
        ) : null}
      </div>
    </section>
  );
}

const TAREAS_PROVISION = [
  { etiqueta: "Empresa", texto: "Creando un espacio de trabajo aislado", icono: Building2 },
  { etiqueta: "Accesos", texto: "Preparando roles y permisos iniciales", icono: UsersRound },
  { etiqueta: "Región", texto: "Configurando moneda y zona horaria", icono: CircleDollarSign },
  { etiqueta: "Plan", texto: "Activando el plan y su período de prueba", icono: BadgeCheck },
  { etiqueta: "Administrador", texto: "Vinculando tu usuario administrador", icono: UserRound },
  { etiqueta: "Sesión", texto: "Protegiendo tu primer acceso", icono: KeyRound },
];

function CreandoEspacio({ empresa, plan, fase, listo }: { empresa: string; plan: string; fase: number; listo: boolean }) {
  const tareaActiva = TAREAS_PROVISION[Math.min(fase, TAREAS_PROVISION.length - 1)];
  return (
    <section className={s.provisionLayout} aria-live="polite" aria-busy={!listo}>
      <div className={s.provisionStage}>
        <svg className={s.provisionWires} viewBox="0 0 544 544" aria-hidden="true">
          {TAREAS_PROVISION.map((tarea, indice) => {
            const posicion = posicionNodo(indice, TAREAS_PROVISION.length);
            return <line key={tarea.etiqueta} x1="272" y1="272" x2={posicion.x} y2={posicion.y} className={indice < fase || listo ? s.provisionWireDone : indice === fase ? s.provisionWireActive : ""} />;
          })}
        </svg>
        <div className={`${s.provisionHub} ${listo ? s.provisionHubDone : ""}`}>
          <span className={s.provisionHubRing} />
          {listo ? <Check aria-hidden="true" /> : <span className={s.provisionMark}><i /><i /><i /></span>}
        </div>
        {TAREAS_PROVISION.map((tarea, indice) => {
          const posicion = posicionNodo(indice, TAREAS_PROVISION.length);
          const Icono = tarea.icono;
          const terminada = indice < fase || listo;
          const activa = indice === fase && !listo;
          return (
            <div key={tarea.etiqueta} className={`${s.provisionNode} ${activa ? s.provisionNodeActive : ""} ${terminada ? s.provisionNodeDone : ""}`} style={{ left: posicion.x, top: posicion.y }}>
              <Icono aria-hidden="true" />
              {terminada ? <span className={s.provisionNodeCheck}><Check /></span> : null}
              <small>{tarea.etiqueta}</small>
            </div>
          );
        })}
      </div>

      <div className={s.provisionPanel}>
        <div className={s.provisionHead}>
          <div className={s.provisionKick}><i /> {listo ? "Espacio preparado" : "Creando tu espacio"}</div>
          <h2>{listo ? "Todo listo para empezar" : tareaActiva.texto}</h2>
          <p><strong>{empresa}</strong> · Plan {plan}</p>
          <span>{listo ? "Te estamos llevando a la bienvenida…" : "Esto suele tardar sólo unos segundos."}</span>
        </div>
        <div className={s.provisionTrack}><i className={listo ? s.provisionTrackDone : ""} /></div>
        <ul className={s.provisionLog}>
          {TAREAS_PROVISION.map((tarea, indice) => {
            const terminada = indice < fase || listo;
            const activa = indice === fase && !listo;
            return (
              <li key={tarea.etiqueta} className={terminada ? s.provisionLogDone : activa ? s.provisionLogActive : ""}>
                <span className={s.provisionStatus}>{terminada ? <Check /> : null}</span>
                {tarea.texto}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

function posicionNodo(indice: number, total: number) {
  const angulo = -Math.PI / 2 + indice * (Math.PI * 2 / total);
  return { x: 272 + Math.cos(angulo) * 176, y: 272 + Math.sin(angulo) * 176 };
}

function esperar(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
