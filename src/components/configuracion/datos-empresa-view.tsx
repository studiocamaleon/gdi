"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { InfoIcon, SaveIcon } from "lucide-react";
import { toast } from "sonner";

import { LogoTenantCard } from "@/components/archivos/logo-tenant-card";
import type { LogoTenant } from "@/lib/archivos-api";
import { guardarDatosEmpresa, type DatosEmpresa } from "@/lib/empresa-api";
import { latamCountries as PAISES } from "@/lib/clientes";

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
};

const vacio = (v: string | null) => v ?? "";

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
    paisCodigo: d.paisCodigo ?? "AR",
    telefonoCodigo: d.telefonoCodigo ?? "54",
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
      });
      toast.success("Datos de la empresa guardados.");
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
    <div
      className="apm-page"
      style={{
        flex: 1,
        minHeight: 0,
        overflowY: "auto",
        padding: "32px 28px 80px",
      }}
    >
      <div className="apm-wrap">
        <div className="apm-head">
          <div>
            <h1>Empresa</h1>
            <div className="sub">
              Cómo se presenta el negocio: es lo que sale en los presupuestos,
              los recibos y el seguimiento que ve el cliente.
            </div>
          </div>
          <div className="right">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void guardar()}
              disabled={guardando}
            >
              <SaveIcon />
              {guardando ? "Guardando…" : "Guardar cambios"}
            </button>
          </div>
        </div>

        <div className="arc-page" style={{ display: "block" }}>
          <div className="arc-card" style={{ marginBottom: 20 }}>
            <div className="arc-card-sec">
              <div className="arc-sec-t">Identidad</div>
              {/*
                El nombre y el logo son la misma cosa —la marca— y se leen
                juntos: apilados, la pantalla arrancaba con tres bloques
                sueltos y el ojo no sabía que el cuadrado de la izquierda era
                el logo de ESE nombre.
              */}
              <div className="emp-identidad">
                <div className="arc-field">
                  <label>Nombre comercial</label>
                  <input
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

          <div className="arc-card" style={{ marginBottom: 20 }}>
            <div className="arc-card-sec">
              <div className="arc-sec-t">Contacto</div>
              <div className="arc-frow">
                <div className="arc-field">
                  <label>País</label>
                  <select
                    value={form.paisCodigo}
                    onChange={(e) => {
                      const pais = e.target.value;
                      set("paisCodigo", pais);
                      // El código telefónico acompaña al país salvo que ya lo
                      // hayan tocado a mano: cambiar de país y quedarse con el
                      // +54 sólo produce un WhatsApp que no llega.
                      const codigo = PAISES.find((p) => p.code === pais)
                        ?.phoneCode;
                      if (codigo) set("telefonoCodigo", codigo);
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
                  <label>
                    Email <span className="opt">(opcional)</span>
                  </label>
                  <input
                    value={form.email}
                    onChange={(e) => set("email", e.target.value)}
                    placeholder="ventas@ejemplo.com.ar"
                  />
                </div>
              </div>
              <div className="arc-frow">
                <div className="arc-field">
                  <label>
                    Teléfono <span className="opt">(opcional)</span>
                  </label>
                  <div className="emp-tel">
                    <select
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
                      value={form.telefonoNumero}
                      onChange={(e) => set("telefonoNumero", e.target.value)}
                      placeholder="3415551840"
                      style={ANCHO_NUMERO}
                    />
                  </div>
                  <div className="arc-hint">Sin el código de país.</div>
                </div>
                <div className="arc-field">
                  <label>
                    WhatsApp <span className="opt">(si es otro número)</span>
                  </label>
                  <div className="emp-tel">
                    <select
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
                  <label>
                    Sitio web <span className="opt">(opcional)</span>
                  </label>
                  <input
                    value={form.sitioWeb}
                    onChange={(e) => set("sitioWeb", e.target.value)}
                    placeholder="www.ejemplo.com.ar"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="arc-card" style={{ marginBottom: 20 }}>
            <div className="arc-card-sec">
              <div className="arc-sec-t">Dónde atendés</div>
              <div className="arc-frow">
                <div className="arc-field">
                  <label>
                    Domicilio comercial <span className="opt">(opcional)</span>
                  </label>
                  <input
                    value={form.domicilioComercial}
                    onChange={(e) => set("domicilioComercial", e.target.value)}
                    placeholder="Calle 123"
                  />
                  <div className="arc-hint">
                    Dónde retira el cliente. No siempre es el domicilio fiscal.
                  </div>
                </div>
                <div className="arc-field">
                  <label>
                    Horario de atención <span className="opt">(opcional)</span>
                  </label>
                  <input
                    value={form.horarioAtencion}
                    onChange={(e) => set("horarioAtencion", e.target.value)}
                    placeholder="Lunes a viernes de 9 a 18"
                  />
                </div>
              </div>
              <div className="arc-frow">
                <div className="arc-field">
                  <label>
                    Localidad <span className="opt">(opcional)</span>
                  </label>
                  <input
                    value={form.localidad}
                    onChange={(e) => set("localidad", e.target.value)}
                    placeholder="Rosario"
                  />
                </div>
                <div className="arc-field">
                  <label>
                    Provincia <span className="opt">(opcional)</span>
                  </label>
                  <input
                    value={form.provincia}
                    onChange={(e) => set("provincia", e.target.value)}
                    placeholder="Santa Fe"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="arc-card">
            <div className="arc-card-sec">
              <div className="arc-sec-t">Reseñas</div>
              <div className="arc-frow">
                <div className="arc-field">
                  <label>
                    Link para dejar una reseña{" "}
                    <span className="opt">(opcional)</span>
                  </label>
                  <input
                    value={form.urlResenas}
                    onChange={(e) => set("urlResenas", e.target.value)}
                    placeholder="https://g.page/r/…/review"
                  />
                </div>
              </div>
              <div className="arc-variant-note" style={{ marginTop: 4 }}>
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
      </div>
    </div>
  );
}
