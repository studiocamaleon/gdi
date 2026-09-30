// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CorreoRecuperacion } from "./correo-recuperacion";
const mocks = vi.hoisted(() => ({ estado: vi.fn(), enviar: vi.fn() }));
vi.mock("@/lib/recuperacion-api", () => ({ estadoCorreo: mocks.estado, verificarMiCorreo: mocks.enviar }));
let root: Root, container: HTMLDivElement;
beforeEach(() => {
  vi.resetAllMocks();vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT",true);vi.stubGlobal("PointerEvent",MouseEvent);
  container=document.createElement("div");document.body.append(container);root=createRoot(container);
});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();vi.unstubAllGlobals();});
it("actualiza la acreditación al volver desde el correo sin pedir otro envío",async()=>{
  mocks.estado.mockResolvedValueOnce({habilitado:true,verificado:false,email:"ficticio@example.invalid"}).mockResolvedValue({habilitado:true,verificado:true,email:"ficticio@example.invalid"});
  await act(async()=>root.render(<CorreoRecuperacion />));
  expect(container.textContent).toContain("Verificar correo");
  await act(async()=>window.dispatchEvent(new Event("focus")));
  expect(container.textContent).toContain("Verificado");expect(mocks.enviar).not.toHaveBeenCalled();
});
it.each(["servicio","mfa"])("no permite enviar cuando falta %s",async(caso)=>{
  mocks.estado.mockResolvedValue({habilitado:caso!=="servicio",pendienteMfa:caso==="mfa",verificado:false,email:"ficticio@example.invalid"});
  await act(async()=>root.render(<CorreoRecuperacion />));
  expect(container.querySelector("button")?.disabled).toBe(true);
  expect(mocks.enviar).not.toHaveBeenCalled();
});
it("no promete recuperación si el correo está verificado pero el servicio está deshabilitado",async()=>{
  mocks.estado.mockResolvedValue({habilitado:false,verificado:true,email:"ficticio@example.invalid"});
  await act(async()=>root.render(<CorreoRecuperacion />));
  expect(container.textContent).toContain("todavía no está habilitada");
  expect(container.textContent).not.toContain("Podés recuperar");
});
