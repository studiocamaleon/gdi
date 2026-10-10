import { afterEach, expect, it, vi } from "vitest";
import { GET, POST } from "./route";

vi.mock("next/headers", () => ({ cookies: async () => ({ get: vi.fn() }) }));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
const ctx = { params: Promise.resolve({ path: ["clientes"] }) };

it.each([200,302,401,500])('no permite guardar respuestas de negocio en cachés compartidas: %s',async(status)=>{
  vi.stubEnv('STAGING_PRIVATE','false');
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('contenido ficticio',{status,headers:{'cache-control':'public, max-age=3600',...(status===302 ? {location:'https://files.example.invalid/?firma=ficticia'} : {})}})));
  const response=await GET(new Request('http://localhost/api/backend/clientes'),ctx);
  expect(response.headers.get('cache-control')).toBe('private, no-store');
  expect(response.headers.get('referrer-policy')).toBe('no-referrer');
});

it.each<Record<string, string>>([{}, { "content-length": "1" }])(
  "rechaza un cuerpo grande aunque no declare su tamaño real: %j",
  async (extra) => {
    const fetcher = vi.fn().mockResolvedValue(new Response("{}"));
    vi.stubGlobal("fetch", fetcher);
    const request = new Request("http://localhost/api/backend/clientes", {
      method: "POST",
      headers: {
        origin: "http://localhost",
        "content-type": "application/json",
        ...extra,
      },
      body: "x".repeat(1024 * 1024 + 1),
    });
    const response = await POST(request, ctx);
    expect(response.status).toBe(413);
    expect(fetcher).not.toHaveBeenCalled();
  },
);

it("rechaza el tamaño declarado excesivo antes de leer el cuerpo", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response("{}"));
  vi.stubGlobal("fetch", fetcher);
  const request = new Request("http://localhost/api/backend/clientes", {
    method: "POST",
    headers: { origin: "http://localhost", "content-length": "999999999" },
    body: "pequeño",
  });
  const response = await POST(request, ctx);
  expect(response.status).toBe(413);
  expect(fetcher).not.toHaveBeenCalled();
});

it("conserva el JSON permitido al reenviarlo al API", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response("{}"));
  vi.stubGlobal("fetch", fetcher);
  const body = JSON.stringify({ nombre: "Cliente ficticio" });
  const request = new Request("http://localhost/api/backend/clientes", {
    method: "POST",
    headers: { origin: "http://localhost", "content-type": "application/json" },
    body,
  });
  expect((await POST(request, ctx)).status).toBe(200);
  expect(new TextDecoder().decode(fetcher.mock.calls[0][1].body)).toBe(body);
});

it("transmite documentos sin esperar ni acumular toda la respuesta", async () => {
  const upstream = new Response("%PDF-contenido", {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": 'attachment; filename="demo.pdf"',
    },
  });
  const acumular = vi
    .spyOn(upstream, "arrayBuffer")
    .mockRejectedValue(new Error("No acumular archivos"));
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(upstream));
  const response = await GET(
    new Request("http://localhost/api/backend/documentos"),
    ctx,
  );
  expect(response.headers.get("content-disposition")).toContain("demo.pdf");
  expect(await response.text()).toBe("%PDF-contenido");
  expect(acumular).not.toHaveBeenCalled();
});
