import { apiRequest } from "./api";
type Resultado = { ok: boolean; mensaje?: string };
export const estadoCorreo = () =>
  apiRequest<{
    habilitado: boolean;
    verificado: boolean;
    pendienteMfa?: boolean;
    email: string;
  }>("/auth/recuperacion/estado");
export const verificarMiCorreo = (password: string) =>
  apiRequest<Resultado>("/auth/recuperacion/verificar/solicitar", {
    method: "POST",
    body: JSON.stringify({ password }),
  });
export const solicitarRecuperacion = (email: string) =>
  apiRequest<Resultado>(
    "/auth/recuperacion/solicitar",
    { method: "POST", body: JSON.stringify({ email }) },
    { auth: false },
  );
export const confirmarCorreo = (token: string) =>
  apiRequest<Resultado>(
    "/auth/recuperacion/verificar",
    { method: "POST", body: JSON.stringify({ token }) },
    { auth: false },
  );
export const restablecerClave = (token: string, nueva: string) =>
  apiRequest<Resultado>(
    "/auth/recuperacion/restablecer",
    { method: "POST", body: JSON.stringify({ token, nueva }) },
    { auth: false },
  );
