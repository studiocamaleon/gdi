// @vitest-environment jsdom
import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import type { ClienteDireccion } from "@/lib/clientes";
import type { DespachoOrden } from "@/lib/ordenes-trabajo";
import { DespachoOrdenCampo } from "./despacho-orden";

it("propone el domicilio de entrega y permite quitar el despacho", async () => {
  vi.stubGlobal("PointerEvent", MouseEvent);
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const envio: ClienteDireccion = {
    id: "envio",
    descripcion: "Sucursal de prueba",
    tipo: "entrega",
    principal: false,
    pais: "AR",
    ciudad: "El Calafate",
    direccion: "Calle de prueba",
    numero: "12",
    codigoPostal: "9405",
  };
  const fiscal: ClienteDireccion = {
    ...envio,
    id: "fiscal",
    tipo: "facturacion",
    principal: true,
    ciudad: "Otra ciudad",
  };
  function Formulario() {
    const [valor, setValor] = useState<DespachoOrden | null>(null);
    return (
      <DespachoOrdenCampo
        editable
        valor={valor}
        onChange={setValor}
        direcciones={[fiscal, envio]}
      />
    );
  }
  const div = document.createElement("div");
  document.body.append(div);
  const root = createRoot(div);
  try {
    await act(async () => root.render(<Formulario />));
    const checkbox = div.querySelector<HTMLElement>('[role="checkbox"]')!;
    await act(async () => checkbox.click());
    const inputs = Array.from(
      div.querySelectorAll<HTMLInputElement>('input:not([type="checkbox"])'),
    );
    expect(inputs.map((input) => input.value)).toEqual([
      "El Calafate",
      "Calle de prueba 12 (CP 9405)",
      "",
    ]);
    expect(inputs.map((input) => input.required)).toEqual([true, true, false]);
    await act(async () => checkbox.click());
    expect(div.textContent).not.toContain("Localidad de destino");
  } finally {
    await act(async () => root.unmount());
    div.remove();
    vi.unstubAllGlobals();
  }
});
