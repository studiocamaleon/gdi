import { apiRequest } from "@/lib/api";

/**
 * Credenciales MCP: los tokens con los que el tenant conecta su IA a Grafo.
 * Ver docs/mcp-cotizador-diseno.md — el token viaja UNA sola vez al crear.
 */
export type CredencialMcp = {
  id: string;
  nombre: string;
  /** Últimos 4 chars del token: identificable sin ser usable. */
  pista: string;
  scopes: string[];
  expiraEl: string | null;
  revocadoEl: string | null;
  ultimoUsoEl: string | null;
  createdAt: string;
  usuario: string;
};

export type CredencialMcpCreada = {
  id: string;
  nombre: string;
  /** El token en claro. No vuelve a mostrarse nunca. */
  token: string;
};

export async function getCredencialesMcp(): Promise<CredencialMcp[]> {
  return apiRequest<CredencialMcp[]>("/mcp/credenciales");
}

export async function crearCredencialMcp(
  nombre: string,
): Promise<CredencialMcpCreada> {
  return apiRequest<CredencialMcpCreada>("/mcp/credenciales", {
    method: "POST",
    body: JSON.stringify({ nombre }),
  });
}

export async function revocarCredencialMcp(id: string): Promise<void> {
  await apiRequest(`/mcp/credenciales/${id}`, { method: "DELETE" });
}
