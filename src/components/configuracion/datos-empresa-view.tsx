"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { InfoIcon, SaveIcon } from "lucide-react";
import { toast } from "sonner";

import { LogoTenantCard } from "@/components/archivos/logo-tenant-card";
import type { LogoTenant } from "@/lib/archivos-api";
import { guardarDatosEmpresa, type DatosEmpresa } from "@/lib/empresa-api";

/**
 * Cómo se presenta el negocio ante su cliente.
 *
 * Es la pantalla hermana de Datos fiscales, y están separadas a propósito: acá
 * va el nombre con el que la imprenta firma un presupuesto, allá la razón
 * social que ARCA exige en un comprobante. También son dos permisos distintos.
 */

type FormState = {
  nombre: string;
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

function estadoInicial(d: DatosEmpresa): FormState {
  return {
    nombre: d.nombre,
    telefonoCodigo: vacio(d.telefonoCodigo),
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
        telefonoCodigo: form.telefonoCodigo || undefined,
        telefonoNumero: form.telefonoNumero || undefined,
        whatsappCodigo: form.whatsappCodigo || undefined,
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
              <div className="arc-frow">
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
              </div>
              <LogoTenantCard
                nombreNegocio={form.nombre || "Grafo"}
                logoInicial={logoInicial}
              />
            </div>
          </div>

          <div className="arc-card" style={{ marginBottom: 20 }}>
            <div className="arc-card-sec">
              <div className="arc-sec-t">Contacto</div>
              <div className="arc-frow">
                <div className="arc-field">
                  <label>
                    Teléfono <span className="opt">(opcional)</span>
                  </label>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      value={form.telefonoCodigo}
                      onChange={(e) => set("telefonoCodigo", e.target.value)}
                      placeholder="341"
                      style={{ width: 90 }}
                    />
                    <input
                      value={form.telefonoNumero}
                      onChange={(e) => set("telefonoNumero", e.target.value)}
                      placeholder="5551840"
                      style={{ flex: 1 }}
                    />
                  </div>
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
                    WhatsApp <span className="opt">(si es otro número)</span>
                  </label>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      value={form.whatsappCodigo}
                      onChange={(e) => set("whatsappCodigo", e.target.value)}
                      placeholder="341"
                      style={{ width: 90 }}
                    />
                    <input
                      value={form.whatsappNumero}
                      onChange={(e) => set("whatsappNumero", e.target.value)}
                      placeholder="Dejalo vacío si es el mismo teléfono"
                      style={{ flex: 1 }}
                    />
                  </div>
                </div>
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
