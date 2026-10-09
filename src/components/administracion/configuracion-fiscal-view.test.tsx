import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { ConfiguracionFiscalView } from "./configuracion-fiscal-view";
import type { ConfiguracionFiscal } from "@/lib/administracion";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/components/navigation/capacidades-provider", () => ({ useCapacidad: () => true }));
vi.mock("@/components/navigation/permisos-provider", () => ({ usePuede: () => true }));

const config: ConfiguracionFiscal = {
  id: "fiscal-ensayo", razonSocial: "Imprenta de ensayo", cuit: "30000000015",
  condicionFiscal: "RI", ingresosBrutos: null, domicilioFiscal: null,
  inicioActividades: null, leyendaFacturaA: null,
  proveedorFacturacion: "afipsdk", puntosVenta: [],
};

function aviso(ambiente: "prod" | "dev" | null, proveedor = config.proveedorFacturacion) {
  const html = renderToStaticMarkup(<ConfiguracionFiscalView
    initialConfig={{ ...config, proveedorFacturacion: proveedor }} ambienteArca={ambiente}
  />);
  return html.match(/<div[^>]*role="alert"[\s\S]*?<\/div><\/div>/)?.[0] ?? html;
}

it("informa producción sin afirmar que son pruebas ni emitir comprobantes", () => {
  const texto = aviso("prod");
  expect(texto).toContain("ARCA · Producción");
  expect(texto).toContain("Los comprobantes autorizados tienen validez fiscal");
  expect(texto).not.toContain("no tienen validez fiscal");
  expect(texto).not.toContain("homologación");
});

it("advierte sin validez fiscal sólo cuando la API informa homologación", () => {
  expect(aviso("dev")).toContain("no tienen validez fiscal");
  expect(aviso("dev")).toContain("ARCA · Homologación");
});

it("si no se conoce el ambiente no supone producción ni homologación", () => {
  const texto = aviso(null);
  expect(texto).toContain("Ambiente de ARCA sin confirmar");
  expect(texto).not.toContain("tienen validez fiscal");
  expect(texto).not.toContain("ARCA · Producción");
  expect(texto).not.toContain("ARCA · Homologación");
});

it("la modalidad manual conserva su explicación sin confundirla con ARCA", () => {
  const texto = aviso("prod", "manual");
  expect(texto).toContain("Facturación manual");
  expect(texto).toContain("queda sin CAE");
  expect(texto).not.toContain("tienen validez fiscal");
});
