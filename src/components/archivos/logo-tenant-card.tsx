"use client";

import * as React from "react";
import { Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import { ArchivoUploader } from "@/components/archivos/archivo-uploader";
import { ConfirmacionDestructiva } from "@/components/ui/confirmacion-destructiva";
import { EXTENSIONES_LOGO, urlDeArchivo, type Archivo } from "@/lib/archivos";
import {
  definirLogoTenant,
  quitarLogoTenant,
  type LogoTenant,
} from "@/lib/archivos-api";
import { rasterizarLogo } from "@/lib/rasterizar-logo";

/** Mismas iniciales que dibuja el PDF cuando no hay logo cargado. */
function iniciales(nombre: string): string {
  return nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * Logo del negocio. Es lo que ve el cliente en el PDF del presupuesto, en la
 * factura y en el seguimiento público; sin él se dibujan las iniciales.
 */
export function LogoTenantCard({
  nombreNegocio,
  logoInicial,
}: {
  nombreNegocio: string;
  logoInicial: LogoTenant;
}) {
  const [logo, setLogo] = React.useState<LogoTenant>(logoInicial);
  const [confirmarQuitar, setConfirmarQuitar] = React.useState(false);
  const [guardando, setGuardando] = React.useState(false);

  /**
   * Los PDF sólo dibujan PNG y JPEG. Un SVG o un WEBP se ven bien en la web y
   * desaparecen de los documentos sin decir nada, así que se convierten acá,
   * antes de subir: se guarda un solo archivo y sirve en los dos lados.
   */
  const prepararLogo = React.useCallback(async (file: File) => {
    const { archivo, convertido } = await rasterizarLogo(file);
    if (convertido) {
      toast.info("Convertimos el logo a PNG para que salga en los PDF.");
    } else if (!/^image\/(png|jpe?g)$/i.test(file.type)) {
      // Falló la conversión (un SVG que tira de fuentes o imágenes externas
      // ensucia el canvas). Se sube igual, pero hay que decir qué va a pasar.
      toast.warning(
        "No pudimos convertir este logo: se va a ver en la web pero no en los PDF. Probá subirlo en PNG.",
      );
    }
    return archivo;
  }, []);

  const alSubir = async (archivos: Archivo[]) => {
    const nuevo = archivos[0];
    if (!nuevo) return;
    setGuardando(true);
    try {
      setLogo(await definirLogoTenant(nuevo.id));
      toast.success("Logo actualizado.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo guardar el logo.",
      );
    } finally {
      setGuardando(false);
    }
  };

  const quitar = async () => {
    try {
      await quitarLogoTenant();
      setLogo(null);
      toast.success("Logo quitado. Vuelven las iniciales.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo quitar el logo.",
      );
    } finally {
      setConfirmarQuitar(false);
    }
  };

  return (
    <div className="arch-logo">
      {/* Logo + "Quitar logo" apilados y centrados como una sola columna; el
          `align-items:center` del `.arch-logo` la centra con los textos. */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 10,
          flex: "0 0 auto",
        }}
      >
        <div className="arch-logo-preview">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={urlDeArchivo(logo.archivoId)} alt="Logo del negocio" />
          ) : (
            <div className="arch-logo-iniciales">{iniciales(nombreNegocio)}</div>
          )}
        </div>
        {logo ? (
          <button
            type="button"
            className="btn"
            onClick={() => setConfirmarQuitar(true)}
          >
            <Trash2Icon />
            Quitar logo
          </button>
        ) : null}
      </div>

      <div className="arch-logo-body">
        <ArchivoUploader
          scope="TENANT_BRANDING"
          archivos={[]}
          onCambio={(a) => void alSubir(a)}
          transformar={prepararLogo}
          extensiones={EXTENSIONES_LOGO}
          unico
          sinLista
          soloLectura={guardando}
          titulo={logo ? "Reemplazar el logo" : "Subí el logo del negocio"}
          ayuda="PNG, JPG, WEBP o SVG. Fondo transparente y al menos 400 px de lado. Si subís SVG o WEBP lo convertimos a PNG, que es lo único que los PDF saben dibujar."
        />
        <div className="arch-logo-hint">
          Aparece en el presupuesto, la factura, el recibo, el estado de cuenta
          y el seguimiento que ve el cliente. Sin logo se dibujan las iniciales
          del negocio.
        </div>
      </div>

      <ConfirmacionDestructiva
        open={confirmarQuitar}
        onOpenChange={setConfirmarQuitar}
        titulo="Quitar el logo"
        descripcion="Los documentos vuelven a mostrar las iniciales del negocio. Podés volver a subirlo cuando quieras."
        requiereTipear={false}
        accionLabel="Quitar"
        onConfirmar={() => void quitar()}
      />
    </div>
  );
}

