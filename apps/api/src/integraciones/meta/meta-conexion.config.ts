export type MetaConexionConfig = {
  appId: string;
  appSecret: string;
  configId: string;
  graphVersion: string;
};

export function configuracionMetaConexion(): MetaConexionConfig | null {
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
  return { appId, appSecret, configId, graphVersion };
}
