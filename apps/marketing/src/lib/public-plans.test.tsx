import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
vi.mock("next/server", () => ({
  connection: vi.fn().mockResolvedValue(undefined),
}));
import { getPublicPlans, planSignup, type PublicPlan } from "./public-plans";
import { PublicPlans } from "../components/public-plans";
import { comparisonRows, hasDifferences } from "./plan-comparison";
import { publicIntegrations } from "./public-integrations";

const plan: PublicPlan = {
  codigo: "esencial",
  ofertaId: "oferta-2",
  nombre: "Grafo Esencial",
  descripcion: "Cotizá y organizá tus trabajos.",
  moneda: "USD",
  precioMensual: 190,
  precioAConsultar: false,
  registroPublico: true,
  recomendado: false,
  trialDias: 9,
  features: { usuariosMax: 3, storageGb: 250 },
  anual: null,
  usuarioMensual: { importe: 15 },
  usuarioAnual: null,
  prestaciones: [
    {
      clave: "cotizador",
      nombre: "Cotizador completo",
      grupo: "Venta y órdenes",
    },
  ],
};
function response(data: unknown = [plan], status = 200) {
  vi.stubEnv("MARKETING_API_URL", "http://catalogo.test/api/");
  return vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response(JSON.stringify(data), { status })),
  );
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("Oferta compartida entre web y registro", () => {
  it("consulta el catálogo sin caché ni credenciales y conserva los datos publicados", async () => {
    response();
    expect(await getPublicPlans()).toEqual([plan]);
    expect(fetch).toHaveBeenCalledWith(
      "http://catalogo.test/api/registro/planes",
      expect.objectContaining({ cache: "no-store" }),
    );
    const url = new URL(
      planSignup("https://app.test/registro?utm_source=web", plan),
    );
    expect(url.searchParams.get("plan")).toBe("esencial");
    expect(url.searchParams.get("oferta")).toBe("oferta-2");
    expect(url.searchParams.get("utm_source")).toBe("web");
  });
  it("presenta precio, usuarios, almacenamiento y funciones sin inventar anualidad ni herencia", async () => {
    response();
    const html = renderToStaticMarkup(
      await PublicPlans({
        signup: "https://app.test/registro",
        demo: "mailto:demo@test.local",
      }),
    );
    for (const value of [
      "Grafo Esencial",
      "190",
      "3 usuarios incluidos",
      "250 GB",
      "15",
      "Cotizador completo",
      "9 días gratis",
      "oferta=oferta-2",
    ])
      expect(html).toContain(value);
    for (const value of [
      "/año",
      "Todo lo de",
      "14 días",
      "Planificación",
      "Print",
    ])
      expect(html).not.toContain(value);
  });
  it("sólo muestra anualidad y adicionales anuales cuando están publicados", async () => {
    response([
      { ...plan, anual: { importe: 2100 }, usuarioAnual: { importe: 170 } },
    ]);
    const html = renderToStaticMarkup(
      await PublicPlans({
        signup: "https://app.test/registro",
        demo: "mailto:demo@test.local",
      }),
    );
    expect(html).toContain("Facturación anual");
    expect(html).toContain("2.100");
    expect(html).toContain("170");
  });
  it.each([
    [],
    { error: "No disponible" },
    [{ ...plan, precioMensual: -1 }],
    [{ ...plan, usuarioMensual: { importe: "15" } }],
  ])(
    "no inventa una oferta si el catálogo está vacío o no es válido: %j",
    async (data) => {
      response(data);
      const html = renderToStaticMarkup(
        await PublicPlans({
          signup: "https://app.test/registro",
          demo: "mailto:demo@test.local",
        }),
      );
      expect(html).toContain("Consultar al equipo");
      expect(html).not.toContain("190");
      expect(html).not.toContain("Empezar prueba");
    },
  );
  it("mantiene la página disponible ante una falla o timeout de API", async () => {
    response(undefined, 503);
    expect(await getPublicPlans()).toBeNull();
    vi.mocked(fetch).mockRejectedValue(new Error("timeout"));
    expect(await getPublicPlans()).toBeNull();
  });

  it("compara cada oferta por su clave, sin heredar funciones del plan anterior", async () => {
    const pro: PublicPlan = {
      ...plan,
      codigo: "pro",
      nombre: "Grafo Pro",
      features: { usuariosMax: 20, storageGb: 500 },
      prestaciones: [
        ...plan.prestaciones!,
        {
          clave: "compras",
          nombre: "Compras y abastecimiento",
          grupo: "Stock y compras",
        },
      ],
    };
    const avanzado: PublicPlan = {
      ...plan,
      codigo: "avanzado",
      nombre: "Grafo Avanzado",
      features: { usuariosMax: 40, storageGb: 1500 },
    };
    const plans = [plan, pro, avanzado];
    const rows = comparisonRows(plans);
    expect(rows.find((row) => row.key === "cotizador")?.values).toEqual([
      true,
      true,
      true,
    ]);
    expect(rows.find((row) => row.key === "compras")?.values).toEqual([
      false,
      true,
      false,
    ]);
    expect(rows.filter(hasDifferences).map((row) => row.key)).toEqual([
      "usuariosMax",
      "storageGb",
      "compras",
    ]);
    expect(rows.filter((row) => row.key === "cotizador")).toHaveLength(1);
    response(plans);
    const html = renderToStaticMarkup(
      await PublicPlans({
        signup: "https://app.test/registro",
        demo: "mailto:demo@test.local",
      }),
    );
    expect(html).toContain("<table");
    expect(html).toContain('scope="col"');
    expect(html).toContain("No incluido");
    expect(html).toContain("Sólo diferencias");
    expect(html).not.toContain("Ver las");
    const cards = html.match(/<article[\s\S]*?<\/article>/g)!;
    expect(cards).toHaveLength(3);
    expect(cards.every((card) => !card.includes("Cotizador completo"))).toBe(
      true,
    );
  });

  it("no confunde datos de capacidad ausentes con ilimitados ni elimina los ceros", () => {
    const rows = comparisonRows([
      { ...plan, features: {} },
      { ...plan, features: { usuariosMax: 0, storageGb: 0 } },
    ]);
    expect(rows.find((row) => row.key === "usuariosMax")?.values).toEqual([
      null,
      "Sin límite",
    ]);
    expect(rows.find((row) => row.key === "storageGb")?.values).toEqual([
      null,
      "0 GB",
    ]);
    expect(
      comparisonRows([{ ...plan, features: {}, prestaciones: [] }]),
    ).toEqual([]);
  });

  it("sólo anuncia conectores implementados y disponibles en una oferta pública", () => {
    const fiscal = {
      clave: "fiscal_argentina",
      nombre: "ARCA",
      grupo: "Administración",
    };
    const wati = {
      clave: "whatsapp_automatico",
      nombre: "WhatsApp",
      grupo: "Integraciones",
    };
    const web = {
      clave: "whatsapp_web",
      nombre: "Extensión",
      grupo: "Integraciones",
    };
    const result = publicIntegrations([
      { ...plan, prestaciones: [fiscal] },
      {
        ...plan,
        nombre: "Grafo Pro",
        prestaciones: [
          fiscal,
          wati,
          web,
          { clave: "google_drive", nombre: "Drive", grupo: "Integraciones" },
        ],
      },
    ]);
    expect(result.map((item) => item.key)).toEqual([
      "fiscal_argentina",
      "whatsapp_automatico",
    ]);
    expect(
      comparisonRows([{ ...plan, prestaciones: [wati, web] }]).map(
        (row) => row.key,
      ),
    ).not.toContain("whatsapp_web");
    expect(result[0].plans).toEqual(["Grafo Esencial", "Grafo Pro"]);
    expect(result[1].plans).toEqual(["Grafo Pro"]);
    expect(publicIntegrations([plan])).toEqual([]);
    expect(publicIntegrations([])).toEqual([]);
  });
});
