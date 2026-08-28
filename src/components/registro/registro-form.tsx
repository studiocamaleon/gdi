"use client";

import * as React from "react";
import { ArrowRight, Check, ChevronDown, Clock3, Eye, EyeOff, Info, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { iniciarRegistro, type PlanRegistro } from "@/lib/registro-api";
import { monedaDe } from "@/lib/monedas";
import { latamCountries, zonaHorariaDe } from "@/lib/paises";
import s from "./registro.module.css";

const PAISES = latamCountries.map((pais) => ({
  codigo: pais.code,
  nombre: `${pais.name} · ${monedaDe(pais.monedaSugerida).nombre.toLocaleLowerCase("es")}`,
}));

type Ciclo = "mensual" | "anual";
type Campos = { nombreCompleto: string; empresaNombre: string; email: string; password: string };
const CAMPOS_INICIALES: Campos = { nombreCompleto: "", empresaNombre: "", email: "", password: "" };

function esCampoValido(nombre: keyof Campos, valor: string) {
  if (nombre === "email") return /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(valor.trim());
  if (nombre === "password") return valor.length >= 10;
  return valor.trim().length >= 2;
}

function puntajeClave(valor: string) {
  let puntos = 0;
  if (valor.length >= 10) puntos += 1;
  if (valor.length >= 14) puntos += 1;
  if (/[A-Z]/.test(valor) && /[a-z]/.test(valor)) puntos += 1;
  if (/[0-9]|[^A-Za-z0-9]/.test(valor)) puntos += 1;
  return Math.min(puntos, 4);
}

function numeroFeature(plan: PlanRegistro, clave: string) {
  const valor = plan.features[clave];
  return typeof valor === "number" ? valor : null;
}

function capacidades(plan: PlanRegistro) {
  const usuarios = numeroFeature(plan, "usuariosMax");
  const ordenes = numeroFeature(plan, "ordenesMesMax");
  return [
    usuarios ? <><b>{usuarios}</b> usuarios</> : <>Usuarios ilimitados</>,
    ordenes ? <><b>{new Intl.NumberFormat("es-AR").format(ordenes)}</b> órdenes/mes</> : <>Órdenes ilimitadas</>,
    plan.features.afip ? <>Facturación fiscal</> : <>Comercial + producción</>,
  ];
}

function prestaciones(plan: PlanRegistro) {
  if (plan.precioAConsultar) return ["Todo lo de Producción", "Soporte prioritario", "4 h mensuales con especialista", "Integraciones a medida"];
  if (plan.recomendado) return ["Todo lo de Taller", "Costos por máquina y merma", "Comisiones de vendedores", "AFIP y Mercado Pago"];
  return ["Presupuestos por WhatsApp", "Tablero de órdenes", "Catálogo de productos", "Soporte por correo"];
}

function precioDe(plan: PlanRegistro, ciclo: Ciclo) {
  if (plan.precioAConsultar || plan.precioMensual == null) return null;
  return ciclo === "anual" ? Math.round(plan.precioMensual * 0.8) : plan.precioMensual;
}

export function RegistroForm({ planes }: { planes: PlanRegistro[] }) {
  const params = useSearchParams();
  const elegibles = planes.filter((plan) => plan.registroPublico);
  const solicitado = params.get("plan");
  const inicial = elegibles.some((plan) => plan.codigo === solicitado)
    ? solicitado!
    : elegibles.find((plan) => plan.recomendado)?.codigo ?? elegibles[0]?.codigo ?? "estudio";
  const [planCodigo, setPlanCodigo] = React.useState(inicial);
  const [ciclo, setCiclo] = React.useState<Ciclo>("mensual");
  const [pais, setPais] = React.useState("AR");
  const [campos, setCampos] = React.useState<Campos>(CAMPOS_INICIALES);
  const [claveVisible, setClaveVisible] = React.useState(false);
  const [terminos, setTerminos] = React.useState(false);
  const [cargando, setCargando] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [enviado, setEnviado] = React.useState<string | null>(null);
  const planElegido = planes.find((plan) => plan.codigo === planCodigo) ?? elegibles[0];
  const clavePuntos = puntajeClave(campos.password);
  const formularioValido = (Object.entries(campos) as [keyof Campos, string][]).every(([nombre, valor]) => esCampoValido(nombre, valor)) && terminos;

  function actualizarCampo(nombre: keyof Campos, valor: string) {
    setCampos((actual) => ({ ...actual, [nombre]: valor }));
  }

  async function enviar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!formularioValido || !planElegido?.registroPublico) return;
    setError(null);
    setCargando(true);
    try {
      const zonaHoraria = zonaHorariaDe(pais);
      const atribucion = Object.fromEntries(["utm_source", "utm_medium", "utm_campaign", "utm_content"].map((clave) => [clave, params.get(clave)]).filter(([, valor]) => valor));
      const respuesta = await iniciarRegistro({ ...campos, planCodigo: planElegido.codigo, paisCodigo: pais, zonaHoraria, aceptaTerminos: terminos, aceptaMarketing: false, origen: "web_comercial", atribucion });
      setEnviado(respuesta.mensaje);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos iniciar el registro.");
    } finally {
      setCargando(false);
    }
  }

  if (enviado) {
    return <section className={s.success} aria-live="polite"><span className={s.successIcon}><Check aria-hidden="true" /></span><div><h2>Revisá tu correo</h2><p>{enviado}</p><small>El enlace dura 2 horas. Revisá también Spam o Promociones.</small></div></section>;
  }

  return (
    <div className={s.cols}>
      <form className={s.panel} onSubmit={enviar} noValidate>
        <header className={s.panelHead}><h2>Creá tu espacio de trabajo</h2><p>Tres minutos. Después importás productos y clientes desde una planilla.</p></header>
        <div className={s.panelBody}>
          <div className={s.grid2}>
            <CampoTexto id="nombre" label="Tu nombre" name="nombreCompleto" value={campos.nombreCompleto} placeholder="Ana Beltrán" autoComplete="name" onChange={actualizarCampo} />
            <CampoTexto id="empresa" label="Nombre de la imprenta" name="empresaNombre" value={campos.empresaNombre} placeholder="Gráfica del Sur" autoComplete="organization" onChange={actualizarCampo} />
          </div>
          <CampoTexto id="email" label="Correo de trabajo" name="email" value={campos.email} placeholder="vos@tuimprenta.com" type="email" autoComplete="email" icono={<Mail />} onChange={actualizarCampo}>Usalo con el dominio de tu empresa para invitar al equipo sin aprobaciones.</CampoTexto>

          <div className={s.field}>
            <label htmlFor="password">Contraseña</label>
            <div className={`${s.control} ${s.withLead}`}>
              <LockKeyhole className={s.lead} aria-hidden="true" />
              <input id="password" name="password" type={claveVisible ? "text" : "password"} value={campos.password} placeholder="Mínimo 10 caracteres" autoComplete="new-password" minLength={10} maxLength={72} onChange={(event) => actualizarCampo("password", event.target.value)} className={esCampoValido("password", campos.password) ? s.inputValid : undefined} />
              <button type="button" className={s.eye} onClick={() => setClaveVisible((visible) => !visible)} aria-label={claveVisible ? "Ocultar contraseña" : "Mostrar contraseña"}>{claveVisible ? <EyeOff /> : <Eye />}</button>
            </div>
            <div className={s.meter} data-strength={clavePuntos}>{[0, 1, 2, 3].map((valor) => <i key={valor} />)}</div>
            <div className={s.hintRow}><span>Si ya sos usuario, conservaremos tu clave actual.</span><span className={s.meterLabel}>{campos.password ? ["—", "débil", "aceptable", "buena", "excelente"][clavePuntos] : "—"}</span></div>
          </div>

          <div className={s.field}>
            <label htmlFor="pais">País <span>define moneda e impuestos</span></label>
            <div className={`${s.control} ${s.withFlag}`}><span className={s.flag}>{pais}</span><select id="pais" value={pais} onChange={(event) => setPais(event.target.value)}>{PAISES.map((opcion) => <option key={opcion.codigo} value={opcion.codigo}>{opcion.nombre}</option>)}</select><ChevronDown className={s.chevron} aria-hidden="true" /></div>
          </div>

          <div className={s.checks}>
            <CheckControl checked={terminos} onChange={setTerminos}>Acepto los <a href="/terminos" target="_blank" rel="noreferrer">términos de servicio</a> y la <a href="/privacidad" target="_blank" rel="noreferrer">política de privacidad</a>.</CheckControl>
          </div>
          {error ? <div className={s.error} role="alert"><strong>No pudimos continuar</strong><span>{error}</span></div> : null}
          {planElegido ? <div className={s.summary}><div><span className={s.summaryLabel}>Plan elegido</span><div className={s.summaryPlan}>{planElegido.nombre} <span>· {ciclo}</span></div></div><div className={s.summaryAmount}><div>{precioDe(planElegido, ciclo) == null ? "A medida" : `$ ${precioDe(planElegido, ciclo)}`}</div><span>{ciclo === "anual" ? "USD/mes facturado anual" : "USD/mes tras el trial"}</span></div></div> : null}
          <button className={s.submit} type="submit" disabled={!formularioValido || cargando}><span>{cargando ? "Enviando verificación…" : formularioValido && planElegido ? `Empezar el trial con ${planElegido.nombre}` : "Completá tus datos para continuar"}</span><ArrowRight aria-hidden="true" /></button>
          <div className={s.after}><span><LockKeyhole /> No pedimos tarjeta</span><span><ShieldCheck /> Datos alojados en la región</span><span><Clock3 /> Cancelás cuando quieras</span></div>
        </div>
      </form>

      <aside>
        <div className={s.plansHead}><div><strong>Elegí con qué plan probar</strong><span>Podés cambiarlo antes de pagar.</span></div><div className={s.cycle}><button type="button" aria-pressed={ciclo === "mensual"} onClick={() => setCiclo("mensual")}>Mensual</button><button type="button" aria-pressed={ciclo === "anual"} onClick={() => setCiclo("anual")}>Anual <span>−20%</span></button></div></div>
        <div className={`${s.plans} ${ciclo === "anual" ? s.annual : ""}`}>
          {planes.map((plan) => {
            const elegido = plan.codigo === planCodigo;
            const contenido = <><div className={s.planTop}><span className={s.radio} aria-hidden="true" /><div className={s.planCopy}><div className={s.planName}>{plan.nombre}{plan.recomendado ? <span className={s.recommended}>Recomendada</span> : null}</div><p>{plan.descripcion}</p></div><div className={s.price}>{plan.precioAConsultar ? <><div className={s.consult}>A medida</div><span>hablemos</span></> : <><del>$ {plan.precioMensual}</del><div><small>$</small>{precioDe(plan, ciclo)}</div><span>USD/mes</span></>}</div></div><div className={s.caps}>{capacidades(plan).map((capacidad, indice) => <span key={indice}>{capacidad}</span>)}</div><div className={s.more}><ul>{prestaciones(plan).map((item) => <li key={item}><Check />{item}</li>)}</ul></div></>;
            return plan.registroPublico ? <label key={plan.codigo} className={`${s.plan} ${elegido ? s.selected : ""}`}><input type="radio" name="plan" value={plan.codigo} checked={elegido} onChange={() => setPlanCodigo(plan.codigo)} />{contenido}</label> : <a key={plan.codigo} className={s.plan} href="mailto:soporte@grafoprint.com.ar?subject=Plan%20Enterprise">{contenido}</a>;
          })}
        </div>
        <div className={s.asideNote}><Info aria-hidden="true" /><p>Durante el trial probás <b>todas las funciones del plan elegido</b>. Al terminar, decidís si seguís o exportás tus datos.</p></div>
      </aside>
    </div>
  );
}

function CampoTexto({ id, label, name, value, placeholder, type = "text", autoComplete, icono, children, onChange }: { id: string; label: string; name: keyof Campos; value: string; placeholder: string; type?: string; autoComplete?: string; icono?: React.ReactNode; children?: React.ReactNode; onChange: (nombre: keyof Campos, valor: string) => void }) {
  const valido = esCampoValido(name, value);
  return <div className={s.field}><label htmlFor={id}>{label}</label><div className={`${s.control} ${icono ? s.withLead : ""} ${valido ? s.done : ""}`}>{icono ? <span className={s.lead}>{icono}</span> : null}<input id={id} name={name} type={type} value={value} placeholder={placeholder} autoComplete={autoComplete} required minLength={2} onChange={(event) => onChange(name, event.target.value)} className={valido ? s.inputValid : undefined} /><Check className={s.valid} aria-hidden="true" /></div>{children ? <div className={s.hint}>{children}</div> : null}</div>;
}

function CheckControl({ checked, onChange, children }: { checked: boolean; onChange: (checked: boolean) => void; children: React.ReactNode }) {
  return <label className={s.check}><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /><span className={s.box}><Check aria-hidden="true" /></span><span className={s.checkText}>{children}</span></label>;
}
