import { expect, it } from "vitest";
import { combinarInbox } from "./inbox-combinar";
import type { MetaInbox } from "./meta-inbox-api";
const pagina = (ids: number[], anterior: string | null = null): MetaInbox => ({
  empresaId: "empresa",
  usuarioId: "usuario",
  contacto: { telefono: "+16505550123" },
  anterior,
  contexto: null,
  mensajes: ids.map((n) => ({
    id: String(n),
    texto: `Mensaje ${n}`,
    nombreContacto: null,
    tipo: "text",
    enviadoEl: new Date(1700000000000 + n * 1000).toISOString(),
  })),
});
it("conserva historial y cursor sin duplicar al recibir mensajes", () => {
  const actual = combinarInbox(
    pagina([1, 2, 3], "1"),
    pagina([3, 4], "3"),
    "reciente",
  );
  expect(actual.mensajes.map((m) => m.id)).toEqual(["1", "2", "3", "4"]);
  expect(actual.anterior).toBe("1");
});
it("recupera una ventana continua si llegaron más mensajes que una página", () => {
  const reciente = pagina([51, 52, 53], "51");
  expect(combinarInbox(pagina([1, 2, 3]), reciente, "reciente")).toEqual(
    reciente,
  );
});
it("no mezcla identidades ni canales y actualiza el cursor al cargar anteriores", () => {
  const otro = { ...pagina([2, 3]), empresaId: "ajena" };
  expect(combinarInbox(pagina([1, 2]), otro, "reciente")).toEqual(otro);
  const anterior = combinarInbox(
    pagina([3, 4], "3"),
    pagina([1, 2, 3]),
    "anteriores",
  );
  expect(anterior.mensajes).toHaveLength(4);
  expect(anterior.anterior).toBeNull();
});
