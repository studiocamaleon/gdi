/** Contrato de transporte API/BFF. El secreto nunca se entrega al JS del navegador. */
export const MFA_DISPOSITIVO_MAX_AGE = 30 * 24 * 60 * 60;
export const MFA_COOKIES = {
  tenant: 'grafo_mfa_empresa',
  plataforma: 'grafo_mfa_plataforma',
} as const;
export type AlcanceMfa = keyof typeof MFA_COOKIES;
export const MFA_HEADERS = {
  tenant: 'x-grafo-mfa-empresa',
  plataforma: 'x-grafo-mfa-plataforma',
} as const;
export const MFA_RECORDADO_HEADER = 'x-grafo-mfa-recordado';
export type DispositivoRecordado = { token: string; alcance: AlcanceMfa };
