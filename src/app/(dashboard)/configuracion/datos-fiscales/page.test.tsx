import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import DatosFiscalesPage from "./page";
import { getConfiguracionFiscal } from "@/lib/administracion-api";
import { getAfip, type AfipIntegracion } from "@/lib/integraciones-api";
import { tienePermiso } from "@/lib/permisos-server";

vi.mock("@/lib/administracion-api", () => ({ getConfiguracionFiscal: vi.fn() }));
vi.mock("@/lib/integraciones-api", () => ({ getAfip: vi.fn() }));
vi.mock("@/lib/permisos-server", () => ({ tienePermiso: vi.fn() }));
vi.mock("@/components/navigation/sin-permiso", () => ({ SinPermiso: () => <p>Sin permiso</p> }));
vi.mock("@/components/administracion/configuracion-fiscal-view", () => ({
  ConfiguracionFiscalView: ({ ambienteArca }: { ambienteArca: string | null }) =>
    <p>{ambienteArca ?? "sin confirmar"}</p>,
}));

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(tienePermiso).mockResolvedValue(true);
  vi.mocked(getConfiguracionFiscal).mockResolvedValue(null);
});

it.each(["prod", "dev"] as const)("obtiene el ambiente %s de la API", async (ambiente) => {
  vi.mocked(getAfip).mockResolvedValue({ ambiente } as AfipIntegracion);
  expect(renderToStaticMarkup(await DatosFiscalesPage())).toBe(`<p>${ambiente}</p>`);
});

it("si falla la consulta conserva el estado desconocido", async () => {
  vi.mocked(getAfip).mockRejectedValue(new Error("API no disponible"));
  expect(renderToStaticMarkup(await DatosFiscalesPage())).toBe("<p>sin confirmar</p>");
});

it("sin permiso no consulta los datos fiscales ni la integración", async () => {
  vi.mocked(tienePermiso).mockResolvedValue(false);
  await DatosFiscalesPage();
  expect(getConfiguracionFiscal).not.toHaveBeenCalled();
  expect(getAfip).not.toHaveBeenCalled();
});
