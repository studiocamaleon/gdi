import { expect, it } from "vitest";
import { fechaConversacionInbox as fecha } from "./inbox-fecha";
const ar = "America/Argentina/Buenos_Aires";
it("usa el día de la empresa, incluso cerca de medianoche UTC", () => {
  const ahora = Date.parse("2026-09-28T02:00:00Z");
  expect(fecha("2026-09-28T01:00:00Z", ahora, ar)).toBe("22:00");
  expect(fecha("2026-09-27T02:00:00Z", ahora, ar)).toBe("Ayer");
  expect(fecha("2026-09-25T12:00:00Z", ahora, ar)).toBe("Viernes");
  expect(fecha("2025-09-25T12:00:00Z", ahora, ar)).toBe("25/9/25");
});
it("ayer es un día calendario y no un bloque de 24 horas durante el cambio de hora", () => {
  expect(
    fecha(
      "2026-03-07T05:10:00Z",
      Date.parse("2026-03-09T03:30:00Z"),
      "America/New_York",
    ),
  ).toBe("Ayer");
  expect(fecha("inválida", Date.now(), ar)).toBe("");
});
