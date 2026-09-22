// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, expect, it, vi } from "vitest";
import { AltaDniModal } from "./alta-dni-modal";
import { CapacidadesProvider } from "../navigation/capacidades-provider";
import type { DatosDocumento } from "@/lib/dni-argentino";
const mocks = vi.hoisted(() => ({
  buscar: vi.fn(),
  alta: vi.fn(),
  avisar: vi.fn(),
}));
vi.mock("@/lib/clientes-api", () => ({
  buscarClientePorDocumento: mocks.buscar,
  altaClientePorDocumento: mocks.alta,
  avisarClienteEscaneado: mocks.avisar,
}));
(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;
const datos: DatosDocumento = {
  documento: "37555536",
  nombres: "Ana",
  apellido: "Gomez",
  nombreCompleto: "Ana Gomez",
  sexo: null,
  fechaNacimiento: null,
};
beforeEach(() => vi.clearAllMocks());
it.each(["activo", "inactivo", "nuevo"])(
  "sin R01 resuelve el DNI de cliente %s sin ejecutar un alta",
  async (tipo) => {
    const cliente =
      tipo === "nuevo"
        ? null
        : { id: "cliente", nombre: "Ana Gomez", activo: tipo === "activo" };
    mocks.buscar.mockResolvedValue({ cliente });
    const creado = vi.fn(),
      cerrar = vi.fn(),
      container = document.createElement("div");
    const root = createRoot(container);
    try {
      await act(async () =>
        root.render(
          <CapacidadesProvider capacidades={{ funciones: { clientes: false } }}>
            <AltaDniModal datos={datos} onClose={cerrar} onCreado={creado} />
          </CapacidadesProvider>,
        ),
      );
      const boton = Array.from(container.querySelectorAll("button")).find((b) =>
        /Usar este cliente|Crear cliente/.test(b.textContent ?? ""),
      )!;
      expect(boton.disabled).toBe(tipo !== "activo");
      if (tipo === "activo") {
        await act(async () => boton.click());
        expect(creado).toHaveBeenCalledWith(cliente, true);
        expect(cerrar).toHaveBeenCalledOnce();
      } else
        expect(container.textContent).toContain(
          "continuar con la venta de mostrador",
        );
      expect(mocks.alta).not.toHaveBeenCalled();
    } finally {
      await act(async () => root.unmount());
    }
  },
);
