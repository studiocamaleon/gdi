"use client";
import {
  ConfiguracionPage,
  ConfiguracionHeader,
  GuardarConfiguracion,
} from "@/components/configuracion/configuracion-workspace";
import configStyles from "@/components/configuracion/configuracion-workspace.module.css";
import { TipoCambioEmpresa } from "@/components/comercial/tipo-cambio-panel";

import * as React from "react";
import { useRouter } from "next/navigation";
import { InfoIcon } from "lucide-react";
import { toast } from "sonner";

import { LogoTenantCard } from "@/components/archivos/logo-tenant-card";
import type { LogoTenant } from "@/lib/archivos-api";
import { guardarDatosEmpresa, type DatosEmpresa } from "@/lib/empresa-api";
import { MONEDA_DEFAULT, monedaDe, monedas as MONEDAS } from "@/lib/monedas";
import {
  PAIS_DEFAULT,
  latamCountries as PAISES,
  ZONAS_HORARIAS,
  monedaSugeridaDe,
  phoneCodeDe,
  zonaHorariaDe,
} from "@/lib/paises";

/**
 * Cómo se presenta el negocio ante su cliente.
 *
 * Es la pantalla hermana de Datos fiscales, y están separadas a propósito: acá
 * va el nombre con el que la imprenta firma un presupuesto, allá la razón
 * social que ARCA exige en un comprobante. También son dos permisos distintos.
 */

type FormState = {
  nombre: string;
  paisCodigo: string;
  telefonoCodigo: string;
  telefonoNumero: string;
  whatsappCodigo: string;
  whatsappNumero: string;
  email: string;
  sitioWeb: string;
  domicilioComercial: string;
  localidad: string;
  provincia: string;
  horarioAtencion: string;
  urlResenas: string;
  urlPerfilGoogle: string;
  monedaCodigo: string;
  zonaHoraria: string;
  redondeoPrecio: string;
};

const vacio = (v: string | null) => v ?? "";

/** "$ 1.234,56" en la moneda elegida, para que el select se explique solo. */
function ejemploMoneda(codigo: string, entero = false): string {
  const m = monedaDe(codigo);
  const decimales = entero ? 0 : m.decimales;
  const n = new Intl.NumberFormat(m.locale, {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  }).format(1234.56);
  return `${m.simbolo} ${n}`;
}

/**
 * Los anchos del par código+número van inline y no en globals.css: la hoja
 * global tiene `.arc-field select { width: 100% }` con la misma
 * especificidad, y gana por venir después.
 */
const ANCHO_CODIGO: React.CSSProperties = { width: 128, flex: "0 0 auto" };
const ANCHO_NUMERO: React.CSSProperties = { flex: 1, minWidth: 0 };

function estadoInicial(d: DatosEmpresa): FormState {
  return {
    nombre: d.nombre,
    // Una imprenta argentina no debería tener que elegir Argentina: el resto
    // del sistema asume lo mismo en el alta de clientes.
    paisCodigo: d.paisCodigo ?? PAIS_DEFAULT,
    telefonoCodigo: d.telefonoCodigo ?? phoneCodeDe(PAIS_DEFAULT),
    telefonoNumero: vacio(d.telefonoNumero),
    whatsappCodigo: vacio(d.whatsappCodigo),
    whatsappNumero: vacio(d.whatsappNumero),
    email: vacio(d.email),
    sitioWeb: vacio(d.sitioWeb),
    domicilioComercial: vacio(d.domicilioComercial),
    localidad: vacio(d.localidad),
    provincia: vacio(d.provincia),
    horarioAtencion: vacio(d.horarioAtencion),
    urlResenas: vacio(d.urlResenas),
    urlPerfilGoogle: vacio(d.urlPerfilGoogle),
    monedaCodigo: d.monedaCodigo || MONEDA_DEFAULT,
    zonaHoraria: d.zonaHoraria || zonaHorariaDe(PAIS_DEFAULT),
    redondeoPrecio: d.redondeoPrecio || "moneda",
  };
}

export function DatosEmpresaView({
  initial,
  logoInicial,
}: {
  initial: DatosEmpresa;
  logoInicial: LogoTenant;
}) {
  const router = useRouter();
  const [form, setForm] = React.useState<FormState>(() =>
    estadoInicial(initial),
  );
  const [guardando, setGuardando] = React.useState(false);
  const [guardado, setGuardado] = React.useState(() => estadoInicial(initial));
  const cambios = (Object.keys(form) as (keyof FormState)[]).filter(
    (key) => form[key] !== guardado[key],
  ).length;

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const guardar = async () => {
    if (!form.nombre.trim()) {
      toast.error("El nombre de la empresa no puede quedar vacío.");
      return;
    }
    setGuardando(true);
    try {
      await guardarDatosEmpresa({
        nombre: form.nombre,
        paisCodigo: form.paisCodigo || undefined,
        telefonoCodigo: form.telefonoCodigo || undefined,
        telefonoNumero: form.telefonoNumero || undefined,
        whatsappCodigo: form.whatsappNumero
          ? form.whatsappCodigo || form.telefonoCodigo
          : undefined,
        whatsappNumero: form.whatsappNumero || undefined,
        email: form.email || undefined,
        sitioWeb: form.sitioWeb || undefined,
        domicilioComercial: form.domicilioComercial || undefined,
        localidad: form.localidad || undefined,
        provincia: form.provincia || undefined,
        horarioAtencion: form.horarioAtencion || undefined,
        urlResenas: form.urlResenas || undefined,
        urlPerfilGoogle: form.urlPerfilGoogle || undefined,
        monedaCodigo: form.monedaCodigo || undefined,
        zonaHoraria: form.zonaHoraria || undefined,
        redondeoPrecio: form.redondeoPrecio || undefined,
      });
      toast.success("Datos de la empresa guardados.");
      setGuardado({ ...form });
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudieron guardar los datos de la empresa.",
      );
    } finally {
      setGuardando(false);
    }
  };

  return (
    <ConfiguracionPage>
      <div className="apm-wrap">
        <ConfiguracionHeader
          titulo="Empresa"
          descripcion="La identidad, el contacto y la configuración regional de tu negocio."
          acciones={
            <GuardarConfiguracion
              cambios={cambios}
              guardando={guardando}
              onGuardar={() => void guardar()}
            />
          }
        />

        <div className={configStyles.formGrid}>
          <div className="arc-card">
            <div className="arc-card-sec">
              <h2 className="arc-sec-t">
                <span className={configStyles.sectionNumber} aria-hidden="true">
                  01
                </span>
                Identidad
              </h2>
              {/*
                El nombre y el logo son la misma cosa —la marca— y se leen
                juntos: apilados, la pantalla arrancaba con tres bloques
                sueltos y el ojo no sabía que el cuadrado de la izquierda era
                el logo de ESE nombre.
              */}
              <div className="emp-identidad">
                <div className="arc-field">
                  <label htmlFor="empresa-nombre">Nombre comercial</label>
                  <input
                    id="empresa-nombre"
                    value={form.nombre}
                    onChange={(e) => set("nombre", e.target.value)}
                    placeholder="Ej. Gráfica Corporearte"
                  />
                  <div className="arc-hint">
                    El nombre con el que firmás un presupuesto. La razón social
                    —la que exige la factura— se carga en Datos fiscales.
                  </div>
                </div>
                <div className="emp-identidad-logo">
                  <LogoTenantCard
                    nombreNegocio={form.nombre || "Grafo"}
                    logoInicial={logoInicial}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="arc-card">
            <div className="arc-card-sec">
              <h2 className="arc-sec-t">
                <span className={configStyles.sectionNumber} aria-hidden="true">
                  02
                </span>
                Contacto
              </h2>
              <div className="arc-frow">
                <div className="arc-field">
                  <label htmlFor="empresa-paisCodigo">País</label>
                  <select
                    id="empresa-paisCodigo"
                    value={form.paisCodigo}
                    onChange={(e) => {
                      const pais = e.target.value;
                      set("paisCodigo", pais);
                      // El código telefónico acompaña al país salvo que ya lo
                      // hayan tocado a mano: cambiar de país y quedarse con el
                      // +54 sólo produce un WhatsApp que no llega.
                      set("telefonoCodigo", phoneCodeDe(pais));
                      // Moneda y zona acompañan también: son SUGERENCIA (se
                      // pueden pisar abajo, en Regional), pero el caso normal
                      // es que la imprenta chilena quiera CLP y Santiago sin
                      // tener que saber qué es una zona IANA.
                      set("monedaCodigo", monedaSugeridaDe(pais));
                      set("zonaHoraria", zonaHorariaDe(pais));
                    }}
                  >
                    {PAISES.map((p) => (
                      <option key={p.code} value={p.code}>
                        {p.flag} {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="arc-field">
                  <label htmlFor="empresa-email">
                    Email <span className="opt">(opcional)</span>
                  </label>
                  <input
                    id="empresa-email"
                    value={form.email}
                    onChange={(e) => set("email", e.target.value)}
                    placeholder="ventas@ejemplo.com.ar"
                  />
                </div>
              </div>
              <div className="arc-frow">
                <div className="arc-field">
                  <label htmlFor="empresa-telefonoNumero">
                    Teléfono <span className="opt">(opcional)</span>
                  </label>
                  <div className="emp-tel">
                    <select
                      aria-label="Código de país del teléfono"
                      value={form.telefonoCodigo}
                      onChange={(e) => set("telefonoCodigo", e.target.value)}
                      style={ANCHO_CODIGO}
                    >
                      {PAISES.map((p) => (
                        <option key={p.code} value={p.phoneCode}>
                          {p.flag} +{p.phoneCode}
                        </option>
                      ))}
                    </select>
                    <input
                      id="empresa-telefonoNumero"
                      value={form.telefonoNumero}
                      onChange={(e) => set("telefonoNumero", e.target.value)}
                      placeholder="3415551840"
                      style={ANCHO_NUMERO}
                    />
                  </div>
                  <div className="arc-hint">Sin el código de país.</div>
                </div>
                <div className="arc-field">
                  <label htmlFor="empresa-whatsappNumero">
                    WhatsApp <span className="opt">(si es otro número)</span>
                  </label>
                  <div className="emp-tel">
                    <select
                      aria-label="Código de país de WhatsApp"
                      value={form.whatsappCodigo || form.telefonoCodigo}
                      onChange={(e) => set("whatsappCodigo", e.target.value)}
                      style={ANCHO_CODIGO}
                    >
                      {PAISES.map((p) => (
                        <option key={p.code} value={p.phoneCode}>
                          {p.flag} +{p.phoneCode}
                        </option>
                      ))}
                    </select>
                    <input
                      id="empresa-whatsappNumero"
                      value={form.whatsappNumero}
                      onChange={(e) => set("whatsappNumero", e.target.value)}
                      placeholder="Vacío = el mismo teléfono"
                      style={ANCHO_NUMERO}
                    />
                  </div>
                </div>
              </div>
              <div className="arc-frow">
                <div className="arc-field">
                  <label htmlFor="empresa-sitioWeb">
                    Sitio web <span className="opt">(opcional)</span>
                  </label>
                  <input
                    id="empresa-sitioWeb"
                    value={form.sitioWeb}
                    onChange={(e) => set("sitioWeb", e.target.value)}
                    placeholder="www.ejemplo.com.ar"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="arc-card">
            <div className="arc-card-sec">
              <h2 className="arc-sec-t">
                <span className={configStyles.sectionNumber} aria-hidden="true">
                  03
                </span>
                Dónde atendés
              </h2>
              <div className="arc-frow">
                <div className="arc-field">
                  <label htmlFor="empresa-domicilioComercial">
                    Domicilio comercial <span className="opt">(opcional)</span>
                  </label>
                  <input
                    id="empresa-domicilioComercial"
                    value={form.domicilioComercial}
                    onChange={(e) => set("domicilioComercial", e.target.value)}
                    placeholder="Calle 123"
                  />
                  <div className="arc-hint">
                    Dónde retira el cliente. No siempre es el domicilio fiscal.
                  </div>
                </div>
                <div className="arc-field">
                  <label htmlFor="empresa-horarioAtencion">
                    Horario de atención <span className="opt">(opcional)</span>
                  </label>
                  <input
                    id="empresa-horarioAtencion"
                    value={form.horarioAtencion}
                    onChange={(e) => set("horarioAtencion", e.target.value)}
                    placeholder="Lunes a viernes de 9 a 18"
                  />
                </div>
              </div>
              <div className="arc-frow">
                <div className="arc-field">
                  <label htmlFor="empresa-localidad">
                    Localidad <span className="opt">(opcional)</span>
                  </label>
                  <input
                    id="empresa-localidad"
                    value={form.localidad}
                    onChange={(e) => set("localidad", e.target.value)}
                    placeholder="Rosario"
                  />
                </div>
                <div className="arc-field">
                  <label htmlFor="empresa-provincia">
                    Provincia <span className="opt">(opcional)</span>
                  </label>
                  <input
                    id="empresa-provincia"
                    value={form.provincia}
                    onChange={(e) => set("provincia", e.target.value)}
                    placeholder="Santa Fe"
                  />
                </div>
              </div>
              <div className="arc-frow">
                <div className="arc-field">
                  <label htmlFor="empresa-urlPerfilGoogle">
                    URL de tu perfil de Google{" "}
                    <span className="opt">(opcional)</span>
                  </label>
                  <input
                    id="empresa-urlPerfilGoogle"
                    value={form.urlPerfilGoogle}
                    onChange={(e) => set("urlPerfilGoogle", e.target.value)}
                    placeholder="https://maps.app.goo.gl/…"
                  />
                  <div className="arc-hint">
                    Es a dónde lleva el botón “Ver mapa” del seguimiento que ve
                    el cliente. Si lo dejás vacío, busca tu domicilio en Google
                    Maps.
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="arc-card">
            <div className="arc-card-sec">
              <h2 className="arc-sec-t">
                <span className={configStyles.sectionNumber} aria-hidden="true">
                  04
                </span>
                Regional
              </h2>
              <div className="arc-frow">
                <div className="arc-field">
                  <label htmlFor="empresa-monedaCodigo">Moneda</label>
                  <select
                    id="empresa-monedaCodigo"
                    value={form.monedaCodigo}
                    onChange={(e) => set("monedaCodigo", e.target.value)}
                  >
                    {MONEDAS.map((m) => (
                      <option key={m.codigo} value={m.codigo}>
                        {m.codigo} — {m.nombre} ({m.simbolo})
                      </option>
                    ))}
                  </select>
                  <div className="arc-hint">
                    Ej.: {ejemploMoneda(form.monedaCodigo)}
                  </div>
                </div>
                <div className="arc-field">
                  <label htmlFor="empresa-zonaHoraria">Zona horaria</label>
                  <select
                    id="empresa-zonaHoraria"
                    value={form.zonaHoraria}
                    onChange={(e) => set("zonaHoraria", e.target.value)}
                  >
                    {/* Si la guardada no está en la lista corta (la cargó
                        el soporte a mano), se ofrece igual: un select que
                        esconde el valor actual lo pisa al primer guardado. */}
                    {!ZONAS_HORARIAS.includes(form.zonaHoraria) && (
                      <option value={form.zonaHoraria}>
                        {form.zonaHoraria}
                      </option>
                    )}
                    {ZONAS_HORARIAS.map((z) => (
                      <option key={z} value={z}>
                        {z.replace(/^America\//, "").replaceAll("_", " ")}
                      </option>
                    ))}
                  </select>
                  <div className="arc-hint">
                    La hora del taller: calendario de producción, corte de
                    jornada y horarios de WhatsApp se calculan con esta zona.
                  </div>
                </div>
              </div>
              <div className="arc-frow">
                <div className="arc-field">
                  <label htmlFor="empresa-redondeoPrecio">
                    Redondeo de precios
                  </label>
                  <select
                    id="empresa-redondeoPrecio"
                    value={form.redondeoPrecio}
                    onChange={(e) => set("redondeoPrecio", e.target.value)}
                  >
                    <option value="moneda">
                      Con centavos ({ejemploMoneda(form.monedaCodigo)})
                    </option>
                    <option value="entero">
                      A la unidad ({ejemploMoneda(form.monedaCodigo, true)})
                    </option>
                  </select>
                  <div className="arc-hint">
                    Cómo redondea el cotizador. En Argentina o Colombia los
                    centavos existen en el papel pero no en la calle.
                  </div>
                </div>
              </div>
              {form.monedaCodigo !==
                (initial.monedaCodigo || MONEDA_DEFAULT) && (
                <div className="arc-variant-note" style={{ marginTop: 4 }}>
                  <InfoIcon />
                  <span>
                    Cambiar la moneda no convierte ningún importe: los
                    presupuestos, órdenes y cobros ya cargados conservan su
                    número y se muestran con la moneda nueva. Es para corregir
                    la configuración inicial, no para mudar el negocio de país.
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="arc-card">
            <div className="arc-card-sec">
              <h2 className="arc-sec-t">
                <span className={configStyles.sectionNumber} aria-hidden="true">
                  05
                </span>
                Reseñas
              </h2>
              <div className="arc-frow">
                <div className="arc-field">
                  <label htmlFor="empresa-urlResenas">
                    Link para dejar una reseña{" "}
                    <span className="opt">(opcional)</span>
                  </label>
                  <input
                    id="empresa-urlResenas"
                    value={form.urlResenas}
                    onChange={(e) => set("urlResenas", e.target.value)}
                    placeholder="https://g.page/r/…/review"
                  />
                </div>
              </div>
              <div className="arc-variant-note" style={{ marginTop: 12 }}>
                <InfoIcon />
                <span>
                  En Google Maps: tu ficha de negocio → Pedir reseñas → copiar
                  el enlace. Es el que se le manda al cliente unos días después
                  de la entrega.
                </span>
              </div>
            </div>
          </div>
        </div>
        <TipoCambioEmpresa />
      </div>
    </ConfiguracionPage>
  );
}
