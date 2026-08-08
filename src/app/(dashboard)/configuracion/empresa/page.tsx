import { SinPermiso } from "@/components/navigation/sin-permiso";
import { tienePermiso } from "@/lib/permisos-server";
import { DatosEmpresaView } from "@/components/configuracion/datos-empresa-view";
import { getDatosEmpresa, type DatosEmpresa } from "@/lib/empresa-api";
import { getLogoTenant, type LogoTenant } from "@/lib/archivos-api";

export const dynamic = "force-dynamic";

const VACIO: DatosEmpresa = {
  nombre: "",
  telefonoCodigo: null,
  telefonoNumero: null,
  paisCodigo: null,
  whatsappCodigo: null,
  whatsappNumero: null,
  email: null,
  sitioWeb: null,
  domicilioComercial: null,
  localidad: null,
  provincia: null,
  horarioAtencion: null,
  urlResenas: null,
  urlPerfilGoogle: null,
  monedaCodigo: "ARS",
  zonaHoraria: "America/Argentina/Buenos_Aires",
  redondeoPrecio: "moneda",
};

export default async function EmpresaPage() {
  if (!(await tienePermiso("configuracion.gestionar"))) {
    return <SinPermiso modulo="Empresa" />;
  }

  const [datos, logo] = await Promise.all([
    getDatosEmpresa().catch(() => VACIO),
    getLogoTenant().catch((): LogoTenant => null),
  ]);
  return <DatosEmpresaView initial={datos} logoInicial={logo} />;
}
