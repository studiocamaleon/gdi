// @vitest-environment jsdom
import * as React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CambiarTipoBorrador } from "./cambiar-tipo-borrador";
const mocks = vi.hoisted(() => ({ api: vi.fn(), replace: vi.fn(), success: vi.fn(), error: vi.fn(), puede: true }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: mocks.replace }) }));
vi.mock("@/lib/api", () => ({ apiRequest: mocks.api }));
vi.mock("sonner", () => ({ toast: { success: mocks.success, error: mocks.error } }));
vi.mock("@/components/navigation/permisos-provider", () => ({ usePuede: () => mocks.puede }));
vi.mock("@/components/navigation/capacidades-provider", () => ({ useCapacidad: () => true }));
vi.mock("@/components/design-system/action-button", () => ({ ActionButton: ({ children, isDisabled, onPress }: { children: React.ReactNode; isDisabled: boolean; onPress: () => void }) => <button disabled={isDisabled} onClick={onPress}>{children}</button> }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let dispose: (() => void) | undefined;
async function render(tipo: "orden" | "presupuesto", disabled = false) {
 const container = document.createElement("div"); document.body.append(container); const root = createRoot(container);
 await act(async () => root.render(<CambiarTipoBorrador id="documento" tipo={tipo} version="2030-01-01T00:00:00.000Z" disabled={disabled} />));
 dispose = () => { act(() => root.unmount()); container.remove(); };
 return container;
}
afterEach(() => { dispose?.(); vi.clearAllMocks(); mocks.puede = true; });
describe("cambio de tipo de borrador", () => {
 it.each([['orden','presupuesto','/comercial/presupuestos/nuevo'],['presupuesto','orden','/produccion/ordenes/nuevo']] as const)('cambia %s sin emitir ni duplicar el clic', async (tipo, destino, url) => {
  let resolver!: (v: unknown) => void;
  mocks.api.mockImplementation(() => new Promise(resolve => { resolver = resolve; }));
  const c = await render(tipo); const b = c.querySelector('button')!;
  await act(async () => { b.click(); b.click(); });
  expect(mocks.api).toHaveBeenCalledTimes(1);
  expect(mocks.api).toHaveBeenCalledWith(`/borradores/${tipo}/documento/a-${destino}`, {method:'POST',body:JSON.stringify({version:'2030-01-01T00:00:00.000Z'})});
  expect(b.disabled).toBe(true);
  await act(async () => resolver({id:'nuevo',tipo:destino}));
  expect(mocks.replace).toHaveBeenCalledWith(url);
 });
 it('no pierde el documento ni navega si el servidor rechaza el cambio', async () => {
  mocks.api.mockRejectedValue(new Error('El borrador cambió. Recargalo.'));
  const c = await render('orden'); await act(async () => c.querySelector('button')!.click());
  expect(mocks.error).toHaveBeenCalledWith('El borrador cambió. Recargalo.');
  expect(mocks.replace).not.toHaveBeenCalled(); expect(c.querySelector('button')!.disabled).toBe(false);
 });
 it('impide cambiar con edición pendiente y oculta la acción sin ambos permisos', async () => {
  const c = await render('orden',true); await act(async () => c.querySelector('button')!.click()); expect(mocks.api).not.toHaveBeenCalled(); dispose?.();
  mocks.puede=false; expect((await render('presupuesto')).querySelector('button')).toBeNull();
 });
});
