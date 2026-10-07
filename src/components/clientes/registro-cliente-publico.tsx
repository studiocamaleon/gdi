"use client";
import { useState, type FormEvent } from "react";
import { CheckCheck, ArrowRight, ShieldCheck } from "lucide-react";
import { Input } from "@heroui/react";
import { apiRequest } from "@/lib/api";
import { condicionesAlta } from "@/lib/clientes-autoregistro-api";
import { ActionButton } from "@/components/design-system/action-button";
import { SelectField } from "@/components/design-system/select-field";
import { DesignSystemProvider } from "@/components/design-system/appearance";
import brandTheme from "@/components/design-system/brand-workspace-theme.module.css";
import styles from "./solicitudes-alta.module.css";

export function RegistroClientePublico({
  token,
  empresa,
  disponible = true,
}: {
  token: string;
  empresa: string;
  disponible?: boolean;
}) {
  const [tipo, setTipo] = useState("CUIT");
  const [condicion, setCondicion] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [recibida, setRecibida] = useState(false);
  const [error, setError] = useState("");
  async function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (enviando) return;
    if (!condicion) {
      setError("Seleccioná tu condición fiscal.");
      return;
    }
    const datos = Object.fromEntries(new FormData(event.currentTarget));
    setEnviando(true);
    setError("");
    try {
      await apiRequest(
        `/registro-clientes/${encodeURIComponent(token)}`,
        {
          method: "POST",
          body: JSON.stringify({
            ...datos,
            documentoTipo: tipo,
            condicionFiscal: condicion,
          }),
        },
        { auth: false },
      );
      setRecibida(true);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "No pudimos enviar la solicitud. Intentá de nuevo.",
      );
    } finally {
      setEnviando(false);
    }
  }
  return (
    <DesignSystemProvider theme="brand" appearance="light">
      <main
        data-ui="heroui"
        data-appearance="light"
        className={`${brandTheme.theme} ${styles.publico}`}
      >
        <div className={styles.formulario}>
          <header className={styles.cabecera}>
            <span className={styles.eyebrow}>ALTA DE CLIENTE</span>
            <p className={styles.empresa}>
              {empresa || "Grafoprint"}
              <span>.</span>
            </p>
          </header>
          {!disponible ? (
            <section className={styles.contenido}>
              <h1>Enlace no disponible</h1>
              <p>Pedile a la empresa un enlace nuevo para registrarte.</p>
            </section>
          ) : recibida ? (
            <section className={styles.contenido} aria-live="polite">
              <CheckCheck className={styles.exito} size={32} />
              <h1>Solicitud recibida</h1>
              <p>
                El equipo de {empresa} revisará tus datos antes de completar el
                alta. No necesitás enviarlos nuevamente.
              </p>
            </section>
          ) : (
            <form onSubmit={enviar} className={styles.contenido}>
              <div>
                <h1>Tus datos para facturar</h1>
                <p>
                  Completá los datos obligatorios. El equipo revisará la
                  solicitud antes de darte de alta.
                </p>
              </div>
              <label className={styles.campo} htmlFor="nombre-fiscal">
                Nombre completo o razón social
                <Input
                  id="nombre-fiscal"
                  name="nombre"
                  required
                  minLength={3}
                  maxLength={160}
                  autoComplete="name"
                  placeholder="Tal como figura en tu documentación"
                  disabled={enviando}
                />
              </label>
              <div className={styles.dosColumnas}>
                <div className={styles.campo}>
                  <span>Documento</span>
                  <SelectField
                    aria-label="Tipo de documento"
                    value={tipo}
                    onChange={(v) => {
                      setTipo(v);
                      if (v === "DNI") setCondicion("consumidor_final");
                    }}
                    disabled={enviando}
                    options={[
                      { value: "CUIT", label: "CUIT / CUIL" },
                      { value: "DNI", label: "DNI" },
                    ]}
                  />
                </div>
                <label className={styles.campo} htmlFor="numero-documento">
                  Número
                  <Input
                    id="numero-documento"
                    name="documentoNumero"
                    required
                    inputMode="numeric"
                    minLength={7}
                    maxLength={15}
                    placeholder={tipo === "CUIT" ? "11 dígitos" : "Sin puntos"}
                    disabled={enviando}
                  />
                </label>
              </div>
              <div className={styles.campo}>
                <span>Condición frente al IVA</span>
                <SelectField
                  aria-label="Condición frente al IVA"
                  value={condicion}
                  onChange={setCondicion}
                  required
                  disabled={enviando || tipo === "DNI"}
                  options={condicionesAlta}
                />
              </div>
              <label className={styles.campo} htmlFor="telefono-alta">
                Teléfono con código de área
                <Input
                  id="telefono-alta"
                  name="telefono"
                  type="tel"
                  required
                  minLength={8}
                  maxLength={30}
                  autoComplete="tel"
                  placeholder="+54 …"
                  disabled={enviando}
                />
                <small>Incluí el código de país si no es de Argentina.</small>
              </label>
              <div className={styles.separador}>
                <span>Domicilio fiscal · Argentina</span>
              </div>
              <label className={styles.campo} htmlFor="direccion-alta">
                Calle y altura
                <Input
                  id="direccion-alta"
                  name="direccion"
                  required
                  minLength={3}
                  maxLength={200}
                  autoComplete="street-address"
                  placeholder="Incluí piso o departamento, si corresponde"
                  disabled={enviando}
                />
              </label>
              <label className={styles.campo} htmlFor="ciudad-alta">
                Localidad
                <Input
                  id="ciudad-alta"
                  name="ciudad"
                  required
                  minLength={2}
                  maxLength={120}
                  autoComplete="address-level2"
                  disabled={enviando}
                />
              </label>
              <div className={styles.trampa} aria-hidden="true">
                <label>
                  Sitio web
                  <input
                    name="sitioWeb"
                    tabIndex={-1}
                    autoComplete="off"
                    maxLength={100}
                  />
                </label>
              </div>
              {error && (
                <p className={styles.error} role="alert">
                  {error}
                </p>
              )}
              <ActionButton
                type="submit"
                isDisabled={enviando}
                size="lg"
                className={styles.enviar}
              >
                {enviando ? "Enviando…" : "Enviar solicitud"}
                <ArrowRight size={18} />
              </ActionButton>
              <p className={styles.aviso}>
                <ShieldCheck size={16} />
                Estos datos se usarán para tu ficha de cliente y facturación. El
                envío no crea una cuenta de acceso.
              </p>
            </form>
          )}
        </div>
        <footer className={styles.pie}>
          Gestionado con <strong>grafoprint.</strong> ·{" "}
          <a href="/privacidad" target="_blank" rel="noreferrer">
            Privacidad
          </a>
        </footer>
      </main>
    </DesignSystemProvider>
  );
}
