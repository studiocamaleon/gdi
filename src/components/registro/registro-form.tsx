"use client";

import * as React from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  Clock3,
  Eye,
  EyeOff,
  Layers3,
  LockKeyhole,
  MailCheck,
  Network,
  Printer,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import {
  Field,
  FieldGroup,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { iniciarRegistro, type PlanRegistro } from "@/lib/registro-api";
import {
  errorCampoRegistro,
  LIMITES_REGISTRO,
  nombrePlanRegistro,
  planInicialRegistro,
  puntajeClaveRegistro,
  type CamposRegistro,
} from "@/lib/registro-presentacion";
import { monedaDe } from "@/lib/monedas";
import { latamCountries, zonaHorariaDe } from "@/lib/paises";
import { cn } from "@/lib/utils";
import s from "./registro-premium.module.css";

const CAMPOS_INICIALES: CamposRegistro = {
  nombreCompleto: "",
  empresaNombre: "",
  email: "",
  password: "",
};
const ICONOS = { taller: Printer, estudio: Layers3, diamante: Network };
const DESCRIPCIONES: Record<string, string> = {
  taller: "Impresión y gestión",
  estudio: "Cartelería y fabricación",
  diamante: "Toda tu operación",
};

function precio(plan: PlanRegistro) {
  return plan.precioAConsultar || plan.precioMensual == null
    ? null
    : new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(
        plan.precioMensual,
      );
}

function capacidades(plan: PlanRegistro) {
  const resultado: string[] = [];
  const usuarios = plan.features.usuariosMax;
  const ordenes = plan.features.ordenesMesMax;
  if (typeof usuarios === "number")
    resultado.push(
      usuarios > 0 ? `Hasta ${usuarios} usuarios` : "Usuarios ilimitados",
    );
  if (typeof ordenes === "number" && ordenes > 0)
    resultado.push(
      `${new Intl.NumberFormat("es-AR").format(ordenes)} órdenes/mes`,
    );
  if (plan.features.afip) resultado.push("Facturación fiscal");
  return resultado;
}

export function RegistroForm({ planes }: { planes: PlanRegistro[] }) {
  const params = useSearchParams();
  const [planCodigo, setPlanCodigo] = React.useState(() =>
    planInicialRegistro(planes, params.get("plan")),
  );
  const [pais, setPais] = React.useState("AR");
  const [campos, setCampos] = React.useState<CamposRegistro>(CAMPOS_INICIALES);
  const [tocados, setTocados] = React.useState<
    Partial<Record<keyof CamposRegistro, boolean>>
  >({});
  const [claveVisible, setClaveVisible] = React.useState(false);
  const [terminos, setTerminos] = React.useState(false);
  const [cargando, setCargando] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [enviado, setEnviado] = React.useState<string | null>(null);
  const enviando = React.useRef(false);
  const successTitle = React.useRef<HTMLHeadingElement>(null);
  const planElegido = planes.find(
    (plan) =>
      plan.codigo === planCodigo &&
      plan.registroPublico &&
      !plan.precioAConsultar,
  );
  const clavePuntos = puntajeClaveRegistro(campos.password);
  const formularioValido =
    (Object.entries(campos) as [keyof CamposRegistro, string][]).every(
      ([nombre, valor]) => !errorCampoRegistro(nombre, valor),
    ) &&
    terminos &&
    Boolean(planElegido);

  React.useEffect(() => {
    if (enviado) successTitle.current?.focus();
  }, [enviado]);

  function actualizarCampo(nombre: keyof CamposRegistro, valor: string) {
    setCampos((actual) => ({ ...actual, [nombre]: valor }));
  }
  function tocar(nombre: keyof CamposRegistro) {
    setTocados((actual) => ({ ...actual, [nombre]: true }));
  }
  function mensaje(nombre: keyof CamposRegistro) {
    return tocados[nombre] ? errorCampoRegistro(nombre, campos[nombre]) : null;
  }

  async function enviar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!formularioValido || !planElegido || enviando.current) return;
    enviando.current = true;
    setError(null);
    setCargando(true);
    try {
      const atribucion = Object.fromEntries(
        ["utm_source", "utm_medium", "utm_campaign", "utm_content"]
          .map((clave) => [clave, params.get(clave)])
          .filter(([, valor]) => valor),
      );
      const respuesta = await iniciarRegistro({
        ...campos,
        planCodigo: planElegido.codigo,
        paisCodigo: pais,
        zonaHoraria: zonaHorariaDe(pais),
        aceptaTerminos: terminos,
        aceptaMarketing: false,
        origen: "web_comercial",
        atribucion,
      });
      setEnviado(respuesta.mensaje);
      setCampos((actual) => ({ ...actual, password: "" }));
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No pudimos iniciar el registro.",
      );
    } finally {
      enviando.current = false;
      setCargando(false);
    }
  }

  if (enviado)
    return (
      <section className={s.success} aria-live="polite">
        <span className={s.successIcon}>
          <MailCheck size={30} />
        </span>
        <span className={s.formEyebrow}>UN PASO MÁS Y ESTÁS ADENTRO</span>
        <h3 tabIndex={-1} ref={successTitle}>
          Revisá tu correo<span>.</span>
        </h3>
        <p>{enviado}</p>
        <div className={s.emailNotice}>
          <Clock3 size={17} />
          <span>
            El enlace dura 2 horas.
            <br />
            Revisá también Spam o Promociones.
          </span>
        </div>
        <div className={s.successSteps}>
          <span>
            <Check size={15} /> Tus datos
          </span>
          <i />
          <strong>02 Confirmá tu correo</strong>
          <i />
          <span>03 Tu espacio</span>
        </div>
        <a className={s.helpLink} href="mailto:soporte@grafoprint.com.ar">
          ¿Necesitás ayuda? Hablemos <ArrowUpRight size={15} />
        </a>
      </section>
    );

  return (
    <form className={s.form} onSubmit={enviar} noValidate aria-busy={cargando}>
      <FieldSet className={s.planFieldset} disabled={cargando}>
        <FieldLegend className={s.sectionTitle}>
          <span>01</span> Elegí cómo empezar
        </FieldLegend>
        <div className={s.plans}>
          {planes.map((plan) => {
            const nombre = nombrePlanRegistro(plan),
              elegido = plan.codigo === planCodigo;
            const Icono = ICONOS[plan.codigo as keyof typeof ICONOS] ?? Layers3;
            const contenido = (
              <>
                <div className={s.planTop}>
                  <Icono size={21} />
                  {elegido && <Check size={15} />}
                </div>
                <strong className={s.planName}>{nombre}</strong>
                <span className={s.planDescription}>
                  {DESCRIPCIONES[plan.codigo] ?? plan.descripcion}
                </span>
                <span className={s.planPrice}>
                  {precio(plan) == null ? (
                    <strong>A medida</strong>
                  ) : (
                    <>
                      <small>{plan.moneda}</small>
                      <strong>{precio(plan)}</strong>
                      <small>/mes</small>
                    </>
                  )}
                </span>
                <span className={s.planFoot}>
                  {plan.registroPublico && !plan.precioAConsultar ? (
                    plan.trialDias ? (
                      `${plan.trialDias} días gratis`
                    ) : (
                      "Registro disponible"
                    )
                  ) : (
                    <>
                      Hablemos <ArrowUpRight size={12} />
                    </>
                  )}
                </span>
              </>
            );
            return plan.registroPublico && !plan.precioAConsultar ? (
              <label
                key={plan.codigo}
                className={cn(s.plan, elegido && s.selected)}
              >
                <input
                  type="radio"
                  name="plan"
                  value={plan.codigo}
                  checked={elegido}
                  aria-label={`Plan ${nombre}`}
                  onChange={() => setPlanCodigo(plan.codigo)}
                />
                {contenido}
              </label>
            ) : (
              <a
                key={plan.codigo}
                className={cn(s.plan, s.consultPlan)}
                href={`mailto:soporte@grafoprint.com.ar?subject=${encodeURIComponent(`Plan ${nombre}`)}`}
              >
                {contenido}
              </a>
            );
          })}
        </div>
        {planElegido && (
          <div className={s.planDetail} aria-live="polite">
            <span>
              <Check size={14} /> {nombrePlanRegistro(planElegido)} seleccionado
            </span>
            <p>
              {capacidades(planElegido).join(" · ") ||
                "Podés cambiar de plan antes de contratar."}
            </p>
          </div>
        )}
      </FieldSet>

      <fieldset className={s.dataFieldset} disabled={cargando}>
        <legend className={s.sectionTitle}>
          <span>02</span> Contanos sobre vos
        </legend>
        <FieldGroup className={s.fields}>
          <div className={s.grid2}>
            <CampoTexto
              id="nombre"
              label="Tu nombre"
              name="nombreCompleto"
              value={campos.nombreCompleto}
              placeholder="Ana Beltrán"
              autoComplete="name"
              error={mensaje("nombreCompleto")}
              onBlur={tocar}
              onChange={actualizarCampo}
            />
            <CampoTexto
              id="empresa"
              label="Nombre de tu empresa"
              name="empresaNombre"
              value={campos.empresaNombre}
              placeholder="Gráfica del Sur"
              autoComplete="organization"
              error={mensaje("empresaNombre")}
              onBlur={tocar}
              onChange={actualizarCampo}
            />
          </div>
          <CampoTexto
            id="email"
            label="Correo de trabajo"
            name="email"
            value={campos.email}
            placeholder="vos@tuempresa.com"
            type="email"
            autoComplete="email"
            error={mensaje("email")}
            onBlur={tocar}
            onChange={actualizarCampo}
          >
            Te enviaremos el enlace para confirmar tu cuenta.
          </CampoTexto>
          <Field
            className={s.field}
            data-invalid={Boolean(mensaje("password"))}
          >
            <label htmlFor="password">Contraseña</label>
            <InputGroup className={s.passwordControl}>
              <InputGroupInput
                id="password"
                name="password"
                type={claveVisible ? "text" : "password"}
                value={campos.password}
                placeholder="Mínimo 10 caracteres"
                autoComplete="new-password"
                required
                minLength={10}
                maxLength={72}
                onChange={(event) =>
                  actualizarCampo("password", event.target.value)
                }
                onBlur={() => tocar("password")}
                aria-invalid={Boolean(mensaje("password"))}
                aria-describedby="password-hint password-strength password-error"
              />
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  size="icon-sm"
                  type="button"
                  onClick={() => setClaveVisible((visible) => !visible)}
                  aria-label={
                    claveVisible ? "Ocultar contraseña" : "Mostrar contraseña"
                  }
                >
                  {claveVisible ? <EyeOff /> : <Eye />}
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
            <div
              className={s.meter}
              data-strength={clavePuntos}
              aria-hidden="true"
            >
              {[0, 1, 2, 3].map((valor) => (
                <i key={valor} />
              ))}
            </div>
            <div className={s.passwordHint}>
              <span id="password-hint">
                Si ya tenés cuenta, conservaremos tu clave actual.
              </span>
              <span id="password-strength">
                {campos.password
                  ? ["Muy corta", "Básica", "Aceptable", "Buena", "Fuerte"][
                      clavePuntos
                    ]
                  : "10 caracteres mínimo"}
              </span>
            </div>
            <span id="password-error" className={s.fieldError}>
              {mensaje("password")}
            </span>
          </Field>
          <Field className={s.field}>
            <label htmlFor="pais">
              País de tu empresa <span>Moneda e impuestos</span>
            </label>
            <div className={s.countryControl}>
              <span aria-hidden="true">{pais}</span>
              <select
                id="pais"
                name="paisCodigo"
                value={pais}
                onChange={(event) => setPais(event.target.value)}
              >
                {latamCountries.map((opcion) => (
                  <option key={opcion.code} value={opcion.code}>
                    {opcion.name} ·{" "}
                    {monedaDe(opcion.monedaSugerida).nombre.toLocaleLowerCase(
                      "es",
                    )}
                  </option>
                ))}
              </select>
              <ChevronDown size={16} aria-hidden="true" />
            </div>
          </Field>
        </FieldGroup>
      </fieldset>
      <label className={s.terms}>
        <input
          type="checkbox"
          name="aceptaTerminos"
          checked={terminos}
          disabled={cargando}
          required
          onChange={(event) => setTerminos(event.target.checked)}
        />
        <span>
          Acepto los{" "}
          <a href="/terminos" target="_blank" rel="noreferrer">
            términos de servicio
          </a>{" "}
          y la{" "}
          <a href="/privacidad" target="_blank" rel="noreferrer">
            política de privacidad
          </a>
          .
        </span>
      </label>
      {error && (
        <div className={s.error} role="alert">
          <strong>No pudimos continuar</strong>
          <span>{error}</span>
        </div>
      )}
      {!planElegido && (
        <p className={s.error} role="status">
          Por el momento no hay planes disponibles para registro automático.
          Contactá al equipo para empezar.
        </p>
      )}
      {planElegido && (
        <div className={s.summary}>
          <div>
            <strong>{nombrePlanRegistro(planElegido)}</strong>
            <span>
              {planElegido.trialDias
                ? `${planElegido.trialDias} días de prueba · Sin tarjeta`
                : "Tu plan seleccionado"}
            </span>
          </div>
          <div>
            <strong>
              {precio(planElegido) == null
                ? "A medida"
                : `${planElegido.moneda} ${precio(planElegido)}/mes`}
            </strong>
            <span>
              {planElegido.trialDias
                ? "Después de la prueba"
                : "Precio mensual"}
            </span>
          </div>
        </div>
      )}
      <button
        className={s.submit}
        type="submit"
        disabled={!formularioValido || cargando}
      >
        <span>{cargando ? "Enviando verificación…" : "Crear mi cuenta"}</span>
        {cargando ? (
          <span className={s.spinner} aria-hidden="true" />
        ) : (
          <ArrowRight size={18} aria-hidden="true" />
        )}
      </button>
      <p className={s.after}>
        <LockKeyhole size={13} /> Confirmás tu correo antes de crear tu espacio.
      </p>
    </form>
  );
}

function CampoTexto({
  id,
  label,
  name,
  value,
  placeholder,
  type = "text",
  autoComplete,
  error,
  children,
  onBlur,
  onChange,
}: {
  id: string;
  label: string;
  name: keyof CamposRegistro;
  value: string;
  placeholder: string;
  type?: string;
  autoComplete?: string;
  error: string | null;
  children?: React.ReactNode;
  onBlur: (name: keyof CamposRegistro) => void;
  onChange: (name: keyof CamposRegistro, value: string) => void;
}) {
  return (
    <Field className={s.field} data-invalid={Boolean(error)}>
      <label htmlFor={id}>{label}</label>
      <Input
        className={s.input}
        id={id}
        name={name}
        type={type}
        value={value}
        placeholder={placeholder}
        autoComplete={autoComplete}
        autoCapitalize={type === "email" ? "none" : undefined}
        spellCheck={type === "email" ? false : undefined}
        required
        minLength={2}
        maxLength={LIMITES_REGISTRO[name]}
        onChange={(event) => onChange(name, event.target.value)}
        onBlur={() => onBlur(name)}
        aria-invalid={Boolean(error)}
        aria-describedby={
          error ? `${id}-error` : children ? `${id}-hint` : undefined
        }
      />
      {error ? (
        <span className={s.fieldError} id={`${id}-error`}>
          {error}
        </span>
      ) : children ? (
        <span className={s.hint} id={`${id}-hint`}>
          {children}
        </span>
      ) : null}
    </Field>
  );
}
