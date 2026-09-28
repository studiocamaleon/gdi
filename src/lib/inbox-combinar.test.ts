import { expect, it } from "vitest";
import { combinarInbox, ordenarConversacionesInbox } from "./inbox-combinar";
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
it("el refresco general reemplaza la ventana completa sin resucitar textos eliminados", () => {
  const anterior = {
    ...pagina([1, 2, 3]),
    origen: "GENERAL" as const,
    canalId: "alta-1",
    conversacionId: "chat-1",
  };
  const actual = {
    ...anterior,
    mensajes: [
      { ...anterior.mensajes[0], texto: null, eliminado: true },
      ...anterior.mensajes.slice(1),
    ],
  };
  expect(combinarInbox(anterior, actual, "reciente")).toEqual(actual);
  const acotada = {
    ...actual,
    mensajes: actual.mensajes.slice(1),
    ventanaAcotada: true,
  };
  expect(combinarInbox(anterior, acotada, "reciente").mensajes).toHaveLength(2);
  expect(
    combinarInbox(anterior, { ...actual, canalId: "alta-2" }, "anteriores")
      .canalId,
  ).toBe("alta-2");
  expect(
    combinarInbox(
      anterior,
      { ...actual, conversacionId: "chat-2" },
      "anteriores",
    ),
  ).toEqual({ ...actual, conversacionId: "chat-2" });
});

it("ordena por último mensaje, con desempate estable, sin mutar ni usar la lectura", () => {
  const chat = (id: string, fecha: string | null) => ({
    id,
    telefono: "+16505550123",
    nombre: id,
    ultimoMensaje: fecha
      ? { ...pagina([1]).mensajes[0], enviadoEl: fecha, estadoEntrega: "READ" }
      : null,
  });
  const filas = [
    chat("a", "2026-09-27T10:00:00Z"),
    chat("z", null),
    chat("c", "2026-09-28T10:00:00Z"),
    chat("b", "2026-09-28T10:00:00Z"),
  ];
  expect(ordenarConversacionesInbox(filas).map((c) => c.id)).toEqual([
    "c",
    "b",
    "a",
    "z",
  ]);
  expect(filas.map((c) => c.id)).toEqual(["a", "z", "c", "b"]);
});
