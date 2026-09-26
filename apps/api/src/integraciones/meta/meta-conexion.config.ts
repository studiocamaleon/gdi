export type MetaConexionConfig = {
  appId: string;
  appSecret: string;
  configId: string;
  graphVersion: string;
  modo?: 'SANDBOX' | 'COEXISTENCIA';
  sandboxWabaId?: string;
};

export function configuracionMetaConexion(): MetaConexionConfig | null {
  const modo =
    process.env.META_CONEXION_MODO === 'sandbox' ? 'SANDBOX' : 'COEXISTENCIA';
  const sandboxWabaId = process.env.META_SANDBOX_WABA_ID?.trim() ?? '';
  if (modo === 'SANDBOX' && !/^\d{1,32}$/.test(sandboxWabaId)) return null;
  const appId = process.env.META_APP_ID?.trim() ?? '';
  const appSecret = process.env.META_APP_SECRET?.trim() ?? '';
  const configId = process.env.META_EMBEDDED_SIGNUP_CONFIG_ID?.trim() ?? '';
  const graphVersion = process.env.META_GRAPH_API_VERSION ?? 'v26.0';
  if (
    !/^\d+$/.test(appId) ||
    !/^\d+$/.test(configId) ||
    !appSecret ||
    !/^v\d+\.0$/.test(graphVersion)
  )
    return null;
  return {
    appId,
    appSecret,
    configId,
    graphVersion,
    modo,
    ...(modo === 'SANDBOX' ? { sandboxWabaId } : {}),
  };
}

/** Alta todavía restringida a empresas de ensayo elegidas en el servidor. */
export function modoAltaPermitido(
  tenantId: string,
): 'SANDBOX' | 'COEXISTENCIA' | null {
  const habilitado = (process.env.META_CONEXION_TENANT_IDS ?? '')
    .split(',')
    .map((s) => s.trim())
    .includes(tenantId);
  if (!tenantId || !habilitado) return null;
  if (process.env.META_CONEXION_MODO === 'sandbox') return 'SANDBOX';
  if (
    process.env.META_CONEXION_MODO === 'coexistencia' &&
    process.env.META_INBOX_RECEPCION_ENABLED === 'true'
  )
    return 'COEXISTENCIA';
  return null;
}
